'use strict';
/**
 * Tool login + auth enforcement (B0 BS.3, design r2 D-B0.2r2 /
 * D-B0.3r2).
 *
 * Login: password → an OPERATOR token with aud 'config-tool' — the
 * full O3 claim shape, grants computed by the ENGINE'S OWN pure
 * algebra (backend gameRules/grants, dependency-free — the same
 * import precedent as cueValidation). Password and signing secret come
 * from the SAME backend/.env the backend reads, with the backend's
 * exact defaults: one password, both doors, and the tool logs in even
 * with the orchestrator down.
 *
 * The aud pair (D-B0.3r2) is NOT interchangeable: this module verifies
 * aud 'config-tool' only — an orchestrator token never passes the
 * tool's gate, and vice versa. The orchestrator-aud half for proxied
 * writes is obtained FROM the backend's /api/admin/auth (so it lives
 * in the backend's revocable token store), not minted here.
 *
 * Enforcement (D-B0.2r2): mutating routes require auth ALWAYS, even on
 * loopback — the pages era inherits a closed door. Read routes join
 * them when the tool is bound beyond loopback (requireAllRoutes).
 */

const jwt = require('jsonwebtoken');
const { readEnv } = require('./envParser');
const { computeGrants } = require('../../backend/src/gameRules/grants');

// The backend's exact fallbacks (backend/src/config/index.js) — parity
// is the point, not a recommendation to run with them.
const DEFAULT_ADMIN_PASSWORD = 'admin';
const DEFAULT_JWT_SECRET = 'change-this-secret-in-production';

const TOKEN_TTL_SECONDS = 86400; // 24h — the backend's operator-token TTL

class ToolAuth {
  /**
   * @param {Object} opts
   * @param {string} opts.envPath - the backend .env this tool reads
   * @param {string} [opts.orchestratorUrl] - when set, login also
   *   obtains the ORCHESTRATOR-aud half of the pair from the backend's
   *   /api/admin/auth (revocable, store-registered there) for the
   *   tool's proxied writes — held server-side, never sent to the
   *   browser. Absent/unreachable orchestrator: login still succeeds.
   */
  constructor({ envPath, orchestratorUrl = null }) {
    this.envPath = envPath;
    this.orchestratorUrl = orchestratorUrl;
    this._orchestratorToken = null;
  }

  /** The server-held backend operator token, or null (orchestrator down/never logged in). */
  getOrchestratorToken() {
    return this._orchestratorToken;
  }

  // Best-effort: the same fetch posture as the music proxy (a 5s bound,
  // failure degrades — proxied writes then surface the backend's 401).
  async _fetchOrchestratorToken(password) {
    if (!this.orchestratorUrl) return;
    try {
      const r = await fetch(`${this.orchestratorUrl}/api/admin/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
        signal: AbortSignal.timeout(5000),
      });
      this._orchestratorToken = r.ok ? (await r.json()).token || null : null;
    } catch {
      this._orchestratorToken = null;
    }
  }

  // Fresh read per call: a password/secret edit (through this very
  // tool's env editor) applies without a restart.
  _security() {
    let values = {};
    try {
      values = readEnv(this.envPath).values;
    } catch { /* missing .env: the backend-default posture below */ }
    return {
      adminPassword: values.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD,
      jwtSecret: values.JWT_SECRET || DEFAULT_JWT_SECRET,
    };
  }

  /**
   * Verify a password and mint the tool's operator token.
   * @param {string} password
   * @returns {{token: string, expiresIn: number}}
   * @throws {Error} status 401 on a wrong password
   */
  login(password) {
    const { adminPassword, jwtSecret } = this._security();
    if (!password || typeof password !== 'string' || password !== adminPassword) {
      const err = new Error('Authentication failed: wrong password');
      err.status = 401;
      throw err;
    }
    const token = jwt.sign(
      {
        id: 'admin',
        role: 'admin',
        tier: 'operator',
        class: 'staffed',
        deviceId: 'config-tool',
        functions: computeGrants({ tier: 'operator', deviceClass: 'staffed' }),
        // No packHash claim: the tool cannot read the ACTIVE pack
        // without importing packService (the A1 module-graph leak the
        // runner exists to avoid), and tool tokens never cross to the
        // orchestrator — stale-grant detection does not apply here.
      },
      jwtSecret,
      { expiresIn: TOKEN_TTL_SECONDS, audience: 'config-tool' }
    );
    return { token, expiresIn: TOKEN_TTL_SECONDS };
  }

  /**
   * Verify a tool token: signature, aud 'config-tool', operator tier.
   * Fail-closed — anything else is null.
   * @param {string} token
   * @returns {Object|null} decoded claims or null
   */
  verify(token) {
    try {
      const decoded = jwt.verify(token, this._security().jwtSecret,
        { audience: 'config-tool' });
      if (decoded.tier !== 'operator') return null;
      return decoded;
    } catch {
      return null;
    }
  }

  /** Express handler for POST /api/auth/login (mounted BEFORE enforce). */
  loginHandler() {
    return async (req, res) => {
      try {
        const password = req.body && req.body.password;
        const session = this.login(password);
        await this._fetchOrchestratorToken(password);
        res.json(session);
      } catch (err) {
        res.status(err.status || 500).json({ error: err.message });
      }
    };
  }

  /**
   * Enforcement middleware. Mutating requests always require a valid
   * tool token; reads too when requireAllRoutes (bound beyond
   * loopback).
   * @param {{requireAllRoutes?: boolean}} [opts]
   */
  enforce({ requireAllRoutes = false } = {}) {
    const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
    return (req, res, next) => {
      if (!requireAllRoutes && READ_METHODS.has(req.method)) return next();
      const header = req.headers.authorization || '';
      const token = header.startsWith('Bearer ') ? header.substring(7) : null;
      const decoded = token ? this.verify(token) : null;
      if (!decoded) {
        return res.status(401).json({
          error: 'AUTH_REQUIRED',
          message: 'Log in to the config tool to make changes',
        });
      }
      req.operator = decoded;
      next();
    };
  }
}

module.exports = { ToolAuth };
