/**
 * EventTimelineCheck - Detect event ordering anomalies
 * Checks for score:updated before transaction:new and other timing issues
 * WARNING level - highlights potential bugs but doesn't fail
 */

class EventTimelineCheck {
  constructor(logParser) {
    this.logParser = logParser;
    this.name = 'Event Timeline';
  }

  /**
   * Run the validation check
   * @param {Object} session - Session data
   * @returns {Object} Check result
   */
  async run(session) {
    const findings = [];
    let status = 'PASS';

    const startTime = session.createdAt;
    const endTime = session.endTime || new Date().toISOString();

    let timeline = [];
    try {
      timeline = await this.logParser.getSessionTimeline(startTime, endTime);
    } catch (e) {
      findings.push({
        severity: 'WARNING',
        message: 'Could not parse log file for timeline',
        details: { error: e.message }
      });
      return { name: this.name, status: 'INFO', findings, summary: { error: e.message } };
    }

    if (timeline.length === 0) {
      findings.push({
        severity: 'INFO',
        message: 'No relevant events found in logs for this session',
        details: {
          sessionStart: startTime,
          sessionEnd: endTime
        }
      });
      return { name: this.name, status: 'INFO', findings, summary: { eventsFound: 0 } };
    }

    // Analyze event ordering
    const orderingIssues = this.findOrderingIssues(timeline);
    const gapIssues = this.findGapIssues(timeline);
    const burstIssues = this.findBurstIssues(timeline);

    // Add ordering issues
    for (const issue of orderingIssues) {
      status = 'WARNING';
      findings.push({
        severity: 'WARNING',
        message: issue.message,
        details: issue.details
      });
    }

    // Add gap issues
    for (const issue of gapIssues) {
      findings.push({
        severity: 'INFO',
        message: issue.message,
        details: issue.details
      });
    }

    // Add burst issues
    for (const issue of burstIssues) {
      findings.push({
        severity: 'INFO',
        message: issue.message,
        details: issue.details
      });
    }

    // Check for errors during session
    const errors = timeline.filter(e => e.level === 'error');
    if (errors.length > 0) {
      status = 'WARNING';
      findings.push({
        severity: 'WARNING',
        message: `${errors.length} errors occurred during session`,
        details: {
          errors: errors.slice(0, 10).map(e => ({
            timestamp: e.timestamp,
            message: e.message
          }))
        }
      });
    }

    return {
      name: this.name,
      status,
      findings,
      summary: {
        totalEvents: timeline.length,
        orderingIssues: orderingIssues.length,
        gapIssues: gapIssues.length,
        burstIssues: burstIssues.length,
        errors: errors.length
      }
    };
  }

  /**
   * Find score:updated before transaction:new issues
   */
  findOrderingIssues(timeline) {
    const issues = [];
    let lastScoreUpdate = null;
    let lastTransactionNew = null;

    for (const event of timeline) {
      const msg = event.message.toLowerCase();

      if (msg.includes('score:updated') || msg.includes('broadcasted score')) {
        // If we see a score update without a preceding transaction
        if (lastTransactionNew === null && lastScoreUpdate === null) {
          // First score update is fine
        } else if (lastTransactionNew) {
          // Score update after transaction - expected
          const delta = new Date(event.timestamp) - new Date(lastTransactionNew.timestamp);
          if (delta < 0) {
            issues.push({
              message: 'Score update timestamp before transaction',
              details: {
                scoreUpdateTime: event.timestamp,
                transactionTime: lastTransactionNew.timestamp,
                deltaMs: delta
              }
            });
          }
        }
        lastScoreUpdate = event;
      }

      if (msg.includes('transaction:new') || msg.includes('transaction:added') ||
          msg.includes('scan accepted')) {
        lastTransactionNew = event;
      }
    }

    return issues;
  }

  /**
   * Find large gaps in activity
   */
  findGapIssues(timeline) {
    const issues = [];
    const GAP_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

    for (let i = 1; i < timeline.length; i++) {
      const prev = new Date(timeline[i - 1].timestamp);
      const curr = new Date(timeline[i].timestamp);
      const gap = curr - prev;

      if (gap > GAP_THRESHOLD_MS) {
        issues.push({
          message: `${Math.round(gap / 60000)} minute gap in activity`,
          details: {
            from: timeline[i - 1].timestamp,
            to: timeline[i].timestamp,
            gapMinutes: Math.round(gap / 60000)
          }
        });
      }
    }

    return issues;
  }

  /**
   * Find bursts of activity (potential spam or issues)
   */
  findBurstIssues(timeline) {
    const issues = [];
    const BURST_WINDOW_MS = 1000; // 1 second
    const BURST_THRESHOLD = 10; // 10 events per second

    for (let i = 0; i < timeline.length; i++) {
      const windowStart = new Date(timeline[i].timestamp);
      let count = 0;

      for (let j = i; j < timeline.length; j++) {
        const eventTime = new Date(timeline[j].timestamp);
        if (eventTime - windowStart <= BURST_WINDOW_MS) {
          count++;
        } else {
          break;
        }
      }

      if (count >= BURST_THRESHOLD) {
        issues.push({
          message: `Burst of ${count} events in 1 second`,
          details: {
            timestamp: timeline[i].timestamp,
            eventCount: count
          }
        });
        // Skip ahead to avoid duplicate reports
        i += count - 1;
      }
    }

    return issues;
  }
}

module.exports = EventTimelineCheck;
