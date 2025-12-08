/**
 * PlayerCorrelationCheck - Cross-reference player scans with GM transactions
 * Reports tokens scanned by players but not turned in, and GM-only tokens
 * INFO level - doesn't cause failure
 */

class PlayerCorrelationCheck {
  constructor(logParser) {
    this.logParser = logParser;
    this.name = 'Player Correlation';
  }

  /**
   * Run the validation check
   * @param {Object} session - Session data
   * @returns {Object} Check result
   */
  async run(session) {
    const findings = [];
    const status = 'INFO'; // This check is informational only

    const transactions = session.transactions || [];
    const startTime = session.createdAt;
    const endTime = session.endTime || new Date().toISOString();

    // Get GM-submitted tokens (accepted transactions)
    const gmTokens = new Set(
      transactions
        .filter(tx => tx.status === 'accepted')
        .map(tx => tx.tokenId)
    );

    // Try to find player scan events from logs
    let playerScans = [];
    try {
      playerScans = await this.logParser.findPlayerScans(startTime, endTime);
    } catch (e) {
      findings.push({
        severity: 'WARNING',
        message: 'Could not parse log file for player scans',
        details: { error: e.message }
      });
      return { name: this.name, status, findings, summary: { error: e.message } };
    }

    // Extract token IDs from player scans
    const playerTokens = new Set();
    for (const scan of playerScans) {
      const tokenId = this.extractTokenId(scan);
      if (tokenId) {
        playerTokens.add(tokenId);
      }
    }

    // Tokens scanned by players but not turned in to GM
    const notTurnedIn = [];
    for (const tokenId of playerTokens) {
      if (!gmTokens.has(tokenId)) {
        notTurnedIn.push(tokenId);
      }
    }

    // Tokens turned in to GM but not scanned by players
    const gmOnlyTokens = [];
    for (const tokenId of gmTokens) {
      if (!playerTokens.has(tokenId)) {
        gmOnlyTokens.push(tokenId);
      }
    }

    // Generate findings
    if (playerScans.length === 0) {
      findings.push({
        severity: 'INFO',
        message: 'No player scan events found in logs',
        details: {
          note: 'Player scanner may not have been used, or logs may not contain scan events',
          gmTokensCount: gmTokens.size
        }
      });
    } else {
      findings.push({
        severity: 'INFO',
        message: `Found ${playerScans.length} player scan events`,
        details: {
          uniqueTokensScanned: playerTokens.size,
          gmTokensCount: gmTokens.size
        }
      });
    }

    if (notTurnedIn.length > 0) {
      findings.push({
        severity: 'INFO',
        message: `${notTurnedIn.length} tokens scanned by players but not turned in`,
        details: {
          tokens: notTurnedIn,
          note: 'These tokens were discovered but players did not submit them to GM'
        }
      });
    }

    if (gmOnlyTokens.length > 0) {
      findings.push({
        severity: 'INFO',
        message: `${gmOnlyTokens.length} tokens turned in without player scan`,
        details: {
          tokens: gmOnlyTokens,
          note: 'These may have been manually entered or player scanner logs missing'
        }
      });
    }

    // Check for correlation rate
    const overlap = [...gmTokens].filter(t => playerTokens.has(t)).length;
    const correlationRate = gmTokens.size > 0
      ? Math.round((overlap / gmTokens.size) * 100)
      : 0;

    return {
      name: this.name,
      status,
      findings,
      summary: {
        playerScanEvents: playerScans.length,
        uniquePlayerTokens: playerTokens.size,
        gmTokens: gmTokens.size,
        tokensNotTurnedIn: notTurnedIn.length,
        gmOnlyTokens: gmOnlyTokens.length,
        correlationRate: `${correlationRate}%`,
        overlap
      }
    };
  }

  /**
   * Extract token ID from a log entry
   */
  extractTokenId(logEntry) {
    // Check metadata first
    if (logEntry.metadata?.tokenId) {
      return logEntry.metadata.tokenId;
    }

    // Try to extract from message
    const msg = logEntry.message;

    // Pattern: "token: xyz123" or "tokenId: xyz123"
    const match = msg.match(/token(?:Id)?[:\s]+([a-zA-Z0-9_-]+)/i);
    if (match) {
      return match[1];
    }

    // Pattern: scan for a token ID in the message
    const tokenMatch = msg.match(/([a-f0-9]{6,8})/i);
    if (tokenMatch) {
      return tokenMatch[1];
    }

    return null;
  }
}

module.exports = PlayerCorrelationCheck;
