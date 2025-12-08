/**
 * TransactionFlowCheck - Verify all transactions are valid and complete
 * Checks: required fields, valid status, timestamps, token existence
 */

class TransactionFlowCheck {
  constructor(tokensMap) {
    this.tokensMap = tokensMap;
    this.name = 'Transaction Flow';

    // Required fields for a valid transaction
    this.requiredFields = ['tokenId', 'teamId', 'status', 'timestamp'];
    this.validStatuses = ['accepted', 'duplicate', 'rejected'];
    this.validModes = ['detective', 'blackmarket'];
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
    const sessionStart = session.createdAt ? new Date(session.createdAt) : null;
    const sessionEnd = session.endTime ? new Date(session.endTime) : new Date();

    let validCount = 0;
    let errorCount = 0;
    let warningCount = 0;

    // Field presence statistics
    const fieldStats = {
      missingTokenId: 0,
      missingTeamId: 0,
      missingStatus: 0,
      missingTimestamp: 0,
      missingMode: 0,
      missingDeviceId: 0,
      invalidStatus: 0,
      invalidMode: 0,
      unknownTokens: 0,
      outsideTimeframe: 0
    };

    for (let i = 0; i < transactions.length; i++) {
      const tx = transactions[i];
      const txRef = `Transaction #${i + 1} (${tx.id || 'no-id'})`;
      let txValid = true;

      // Check required fields
      if (!tx.tokenId) {
        fieldStats.missingTokenId++;
        txValid = false;
        findings.push({
          severity: 'ERROR',
          message: `${txRef}: Missing tokenId`,
          details: { transactionIndex: i }
        });
      }

      if (!tx.teamId) {
        fieldStats.missingTeamId++;
        txValid = false;
        findings.push({
          severity: 'ERROR',
          message: `${txRef}: Missing teamId`,
          details: { transactionIndex: i, tokenId: tx.tokenId }
        });
      }

      if (!tx.status) {
        fieldStats.missingStatus++;
        txValid = false;
        findings.push({
          severity: 'ERROR',
          message: `${txRef}: Missing status`,
          details: { transactionIndex: i, tokenId: tx.tokenId }
        });
      } else if (!this.validStatuses.includes(tx.status)) {
        fieldStats.invalidStatus++;
        txValid = false;
        findings.push({
          severity: 'ERROR',
          message: `${txRef}: Invalid status "${tx.status}"`,
          details: { transactionIndex: i, tokenId: tx.tokenId, status: tx.status }
        });
      }

      if (!tx.timestamp) {
        fieldStats.missingTimestamp++;
        findings.push({
          severity: 'WARNING',
          message: `${txRef}: Missing timestamp`,
          details: { transactionIndex: i, tokenId: tx.tokenId }
        });
        warningCount++;
      } else if (sessionStart || sessionEnd) {
        const txTime = new Date(tx.timestamp);
        if ((sessionStart && txTime < sessionStart) || (sessionEnd && txTime > sessionEnd)) {
          fieldStats.outsideTimeframe++;
          findings.push({
            severity: 'WARNING',
            message: `${txRef}: Timestamp outside session timeframe`,
            details: {
              transactionIndex: i,
              tokenId: tx.tokenId,
              txTime: tx.timestamp,
              sessionStart: session.createdAt,
              sessionEnd: session.endTime
            }
          });
          warningCount++;
        }
      }

      // Check mode field (should be present for proper handling)
      if (!tx.mode) {
        fieldStats.missingMode++;
        findings.push({
          severity: 'WARNING',
          message: `${txRef}: Missing mode field (detective/blackmarket)`,
          details: { transactionIndex: i, tokenId: tx.tokenId }
        });
        warningCount++;
      } else if (!this.validModes.includes(tx.mode)) {
        fieldStats.invalidMode++;
        findings.push({
          severity: 'WARNING',
          message: `${txRef}: Invalid mode "${tx.mode}"`,
          details: { transactionIndex: i, tokenId: tx.tokenId, mode: tx.mode }
        });
        warningCount++;
      }

      // Check deviceId (nice to have)
      if (!tx.deviceId) {
        fieldStats.missingDeviceId++;
        // This is INFO level, not critical
      }

      // Check token exists in database
      if (tx.tokenId && this.tokensMap && !this.tokensMap.has(tx.tokenId)) {
        fieldStats.unknownTokens++;
        findings.push({
          severity: 'WARNING',
          message: `${txRef}: Token not found in database`,
          details: { transactionIndex: i, tokenId: tx.tokenId }
        });
        warningCount++;
      }

      if (txValid) {
        validCount++;
      } else {
        errorCount++;
      }
    }

    // Determine overall status
    if (errorCount > 0) {
      status = 'FAIL';
    } else if (warningCount > 0) {
      status = 'WARNING';
    }

    // Add summary finding
    findings.push({
      severity: 'INFO',
      message: `Analyzed ${transactions.length} transactions: ${validCount} valid, ${errorCount} errors, ${warningCount} warnings`,
      details: fieldStats
    });

    return {
      name: this.name,
      status,
      findings,
      summary: {
        totalTransactions: transactions.length,
        validCount,
        errorCount,
        warningCount,
        fieldStats
      }
    };
  }
}

module.exports = TransactionFlowCheck;
