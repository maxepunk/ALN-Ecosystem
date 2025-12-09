/**
 * SessionLoader - Load sessions from node-persist storage
 * Handles hashed filenames and key formats used by node-persist
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class SessionLoader {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.sessions = new Map();
    this.initialized = false;
  }

  /**
   * Initialize loader by scanning data directory
   */
  async init() {
    if (this.initialized) return;

    const files = fs.readdirSync(this.dataDir);

    for (const file of files) {
      // Skip non-json files and hidden files
      if (file.startsWith('.') || !this.isHashedFilename(file)) continue;

      try {
        const filePath = path.join(this.dataDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(content);

        // Check if this is a session or backup
        if (data.key && this.isSessionKey(data.key)) {
          this.indexSession(data, file);
        }
      } catch (e) {
        // Skip invalid files
      }
    }

    this.initialized = true;
  }

  /**
   * Check if filename looks like a node-persist hash
   */
  isHashedFilename(filename) {
    return /^[a-f0-9]{32}$/.test(filename);
  }

  /**
   * Check if key is a session-related key
   */
  isSessionKey(key) {
    return key.startsWith('session:') || key.startsWith('backup:session:');
  }

  /**
   * Index a session for later retrieval
   */
  indexSession(data, filename) {
    const key = data.key;
    const value = data.value;

    if (!value || !value.id) return;

    // Extract session ID from key
    let sessionId;
    let isBackup = false;
    let backupTimestamp = null;

    if (key.startsWith('backup:session:')) {
      isBackup = true;
      // Key format: backup:session:{id}:{timestamp}
      const parts = key.split(':');
      sessionId = parts[2];
      backupTimestamp = parseInt(parts[3], 10);
    } else if (key.startsWith('session:')) {
      // Key format: session:{id}
      sessionId = key.replace('session:', '');
    }

    if (!sessionId) return;

    // Store session data
    const existing = this.sessions.get(sessionId);

    const sessionMeta = {
      id: sessionId,
      name: value.name,
      status: value.status,
      // CRITICAL: Sessions use startTime (createdAt is undefined in actual session data)
      startTime: value.startTime,
      createdAt: value.createdAt || value.startTime, // Fallback for compatibility
      endTime: value.endTime,
      transactions: value.transactions,
      scores: value.scores,
      completedGroups: value.completedGroups,
      connectedDevices: value.connectedDevices,
      metadata: value.metadata,
      filename,
      isBackup,
      backupTimestamp,
      raw: value
    };

    // Prefer backup with most transactions, or most recent backup
    if (!existing) {
      this.sessions.set(sessionId, sessionMeta);
    } else if (isBackup) {
      const existingTxCount = existing.transactions?.length || 0;
      const newTxCount = sessionMeta.transactions?.length || 0;

      // Prefer the one with more transactions
      if (newTxCount > existingTxCount) {
        this.sessions.set(sessionId, sessionMeta);
      } else if (newTxCount === existingTxCount && backupTimestamp) {
        // If same tx count, prefer more recent backup
        if (!existing.backupTimestamp || backupTimestamp > existing.backupTimestamp) {
          this.sessions.set(sessionId, sessionMeta);
        }
      }
    }
  }

  /**
   * List all available sessions
   */
  async listSessions() {
    await this.init();
    return Array.from(this.sessions.values())
      .sort((a, b) => {
        // Sort by creation date, newest first
        const aDate = a.createdAt ? new Date(a.createdAt) : new Date(0);
        const bDate = b.createdAt ? new Date(b.createdAt) : new Date(0);
        return bDate - aDate;
      });
  }

  /**
   * Load session by ID or partial name match
   */
  async loadByIdOrName(query) {
    await this.init();

    // Try exact ID match
    if (this.sessions.has(query)) {
      return this.sessions.get(query);
    }

    // Try ID prefix match
    for (const [id, session] of this.sessions) {
      if (id.startsWith(query)) {
        return session;
      }
    }

    // Try name match (case-insensitive, partial)
    const queryLower = query.toLowerCase();
    for (const session of this.sessions.values()) {
      if (session.name && session.name.toLowerCase().includes(queryLower)) {
        return session;
      }
    }

    return null;
  }

  /**
   * Load most recent session
   */
  async loadLatest() {
    const sessions = await this.listSessions();
    return sessions.length > 0 ? sessions[0] : null;
  }

  /**
   * Get hash for a key (for debugging)
   */
  static hashKey(key) {
    return crypto.createHash('md5').update(key).digest('hex');
  }
}

module.exports = SessionLoader;
