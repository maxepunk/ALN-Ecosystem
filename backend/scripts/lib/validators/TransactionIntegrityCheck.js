/**
 * TransactionIntegrityCheck - Verify each transaction's points field
 * Ensures stored points match the scoring formula
 */

class TransactionIntegrityCheck {
  constructor(calculator) {
    this.calculator = calculator;
    this.name = 'Transaction Integrity';
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
    let checkedCount = 0;
    let errorCount = 0;

    for (const tx of transactions) {
      // Skip duplicates (should have 0 points)
      if (tx.status === 'duplicate') {
        if (tx.points && tx.points !== 0) {
          findings.push({
            severity: 'WARNING',
            message: `Duplicate transaction has non-zero points`,
            details: {
              transactionId: tx.id,
              tokenId: tx.tokenId,
              points: tx.points,
              expected: 0
            }
          });
        }
        continue;
      }

      // Skip detective mode (should have 0 points)
      if (tx.mode === 'detective') {
        if (tx.points && tx.points !== 0) {
          findings.push({
            severity: 'WARNING',
            message: `Detective mode transaction has non-zero points`,
            details: {
              transactionId: tx.id,
              tokenId: tx.tokenId,
              points: tx.points,
              expected: 0
            }
          });
        }
        continue;
      }

      // Only check accepted blackmarket transactions
      if (tx.status !== 'accepted') continue;

      checkedCount++;

      const expectedPoints = this.calculator.calculateTokenValue(tx.tokenId);
      const actualPoints = tx.points || 0;

      if (expectedPoints !== actualPoints) {
        status = 'FAIL';
        errorCount++;
        findings.push({
          severity: 'ERROR',
          message: `Points mismatch for transaction`,
          details: {
            transactionId: tx.id,
            tokenId: tx.tokenId,
            teamId: tx.teamId,
            mode: tx.mode,
            storedPoints: actualPoints,
            expectedPoints,
            difference: actualPoints - expectedPoints,
            timestamp: tx.timestamp
          }
        });
      }
    }

    // Add summary finding
    if (errorCount === 0) {
      findings.push({
        severity: 'INFO',
        message: `All ${checkedCount} transactions verified`,
        details: {
          totalTransactions: transactions.length,
          acceptedChecked: checkedCount,
          duplicatesSkipped: transactions.filter(t => t.status === 'duplicate').length,
          detectiveSkipped: transactions.filter(t => t.mode === 'detective').length
        }
      });
    }

    return {
      name: this.name,
      status,
      findings,
      summary: {
        totalTransactions: transactions.length,
        checkedCount,
        errorCount,
        skippedDuplicates: transactions.filter(t => t.status === 'duplicate').length,
        skippedDetective: transactions.filter(t => t.mode === 'detective').length
      }
    };
  }
}

module.exports = TransactionIntegrityCheck;
