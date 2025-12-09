/**
 * DuplicateConsistencyCheck - Validate duplicate transaction chains
 * Every duplicate must reference a valid original transaction
 */

class DuplicateConsistencyCheck {
  constructor() {
    this.name = 'Duplicate Consistency';
  }

  /**
   * Run the validation check
   * @param {Object} session - Session data
   * @returns {Object} Check result
   */
  async run(session) {
    const findings = [];
    let status = 'PASS';

    const transactions = session.transactions || [];

    // Build map of all transaction IDs
    const txMap = new Map(transactions.map(tx => [tx.id, tx]));

    // Find all duplicates
    const duplicates = transactions.filter(tx => tx.status === 'duplicate');

    let validDuplicates = 0;
    let orphanedDuplicates = 0;

    for (const dup of duplicates) {
      const originalId = dup.originalTransactionId;

      if (!originalId) {
        status = 'FAIL';
        orphanedDuplicates++;
        findings.push({
          severity: 'ERROR',
          message: `Duplicate missing originalTransactionId`,
          details: {
            duplicateId: dup.id,
            tokenId: dup.tokenId,
            teamId: dup.teamId,
            timestamp: dup.timestamp
          }
        });
        continue;
      }

      const original = txMap.get(originalId);

      if (!original) {
        status = 'FAIL';
        orphanedDuplicates++;
        findings.push({
          severity: 'ERROR',
          message: `Duplicate references non-existent original`,
          details: {
            duplicateId: dup.id,
            originalTransactionId: originalId,
            tokenId: dup.tokenId,
            teamId: dup.teamId
          }
        });
        continue;
      }

      if (original.status !== 'accepted') {
        findings.push({
          severity: 'WARNING',
          message: `Duplicate references non-accepted original`,
          details: {
            duplicateId: dup.id,
            originalTransactionId: originalId,
            originalStatus: original.status,
            tokenId: dup.tokenId
          }
        });
        continue;
      }

      // Valid duplicate - calculate time delta
      validDuplicates++;
      const dupTime = new Date(dup.timestamp);
      const origTime = new Date(original.timestamp);
      const deltaMs = dupTime - origTime;
      const deltaMinutes = Math.round(deltaMs / 60000);

      findings.push({
        severity: 'INFO',
        message: `Valid duplicate detected`,
        details: {
          tokenId: dup.tokenId,
          teamId: dup.teamId,
          originalTeam: original.teamId,
          timeDeltaMinutes: deltaMinutes,
          sameTeam: dup.teamId === original.teamId
        }
      });
    }

    // Summary
    if (duplicates.length === 0) {
      findings.push({
        severity: 'INFO',
        message: 'No duplicate transactions in session',
        details: { totalTransactions: transactions.length }
      });
    }

    return {
      name: this.name,
      status,
      findings,
      summary: {
        totalTransactions: transactions.length,
        duplicateCount: duplicates.length,
        validDuplicates,
        orphanedDuplicates,
        duplicateTokens: [...new Set(duplicates.map(d => d.tokenId))]
      }
    };
  }
}

module.exports = DuplicateConsistencyCheck;
