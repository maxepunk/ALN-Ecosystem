/**
 * ErrorAnalysisCheck - Surface any errors during session
 *
 * Analyzes log errors:
 * - HTTP request failures (404, 500, etc.)
 * - WebSocket errors
 * - VLC errors
 * - Unhandled exceptions
 */

class ErrorAnalysisCheck {
  constructor(logParser) {
    this.logParser = logParser;
    this.name = 'Error Analysis';
  }

  /**
   * Run the validation check
   * @param {Object} session - Session data
   * @returns {Object} Check result
   */
  async run(session) {
    const findings = [];
    let status = 'PASS';

    // CRITICAL FIX: sessions use startTime, not createdAt (createdAt is always undefined)
    const sessionStart = session.startTime;
    const sessionEnd = session.endTime || new Date().toISOString();

    // Get all error/warning logs
    let errors = [];
    try {
      errors = await this.logParser.findErrors(sessionStart, sessionEnd);
    } catch (err) {
      findings.push({
        severity: 'WARNING',
        message: `Could not read error logs: ${err.message}`,
        details: { error: err.message }
      });
      return {
        name: this.name,
        status: 'WARNING',
        findings,
        summary: {}
      };
    }

    // Categorize errors
    const categories = {
      http: [],
      websocket: [],
      vlc: [],
      unhandled: [],
      validation: [],
      other: []
    };

    for (const entry of errors) {
      const msg = entry.message.toLowerCase();

      if (msg.includes('request failed') || msg.includes('http') ||
          msg.includes('404') || msg.includes('500') || msg.includes('fetch')) {
        categories.http.push(entry);
      } else if (msg.includes('websocket') || msg.includes('socket') ||
                 msg.includes('connection') || msg.includes('disconnect')) {
        categories.websocket.push(entry);
      } else if (msg.includes('vlc') || msg.includes('video') ||
                 msg.includes('playback')) {
        categories.vlc.push(entry);
      } else if (msg.includes('unhandled') || msg.includes('uncaught') ||
                 msg.includes('rejection') || msg.includes('exception')) {
        categories.unhandled.push(entry);
      } else if (msg.includes('validation') || msg.includes('invalid') ||
                 msg.includes('required')) {
        categories.validation.push(entry);
      } else {
        categories.other.push(entry);
      }
    }

    const errorEntries = errors.filter(e => e.level === 'error');
    const warnEntries = errors.filter(e => e.level === 'warn');

    // Determine status based on errors
    if (categories.unhandled.length > 0) {
      status = 'WARNING';
    }
    if (errorEntries.length > 10) {
      status = 'WARNING';
    }

    // Report summary
    findings.push({
      severity: 'INFO',
      message: `Log analysis: ${errorEntries.length} errors, ${warnEntries.length} warnings`,
      details: {
        errors: errorEntries.length,
        warnings: warnEntries.length,
        total: errors.length
      }
    });

    // Report by category
    if (categories.http.length > 0) {
      findings.push({
        severity: categories.http.length > 5 ? 'WARNING' : 'INFO',
        message: `HTTP errors: ${categories.http.length}`,
        details: {
          count: categories.http.length,
          samples: categories.http.slice(0, 5).map(e => ({
            message: e.message,
            timestamp: e.timestamp
          }))
        }
      });
    }

    if (categories.websocket.length > 0) {
      findings.push({
        severity: categories.websocket.length > 5 ? 'WARNING' : 'INFO',
        message: `WebSocket errors: ${categories.websocket.length}`,
        details: {
          count: categories.websocket.length,
          samples: categories.websocket.slice(0, 5).map(e => ({
            message: e.message,
            timestamp: e.timestamp
          }))
        }
      });
    }

    if (categories.vlc.length > 0) {
      const severity = categories.vlc.length > 3 ? 'WARNING' : 'INFO';
      if (severity === 'WARNING' && status === 'PASS') status = 'WARNING';
      findings.push({
        severity,
        message: `VLC errors: ${categories.vlc.length}`,
        details: {
          count: categories.vlc.length,
          samples: categories.vlc.slice(0, 5).map(e => ({
            message: e.message,
            timestamp: e.timestamp
          }))
        }
      });
    }

    if (categories.unhandled.length > 0) {
      status = 'WARNING';
      findings.push({
        severity: 'WARNING',
        message: `Unhandled exceptions: ${categories.unhandled.length}`,
        details: {
          count: categories.unhandled.length,
          exceptions: categories.unhandled.slice(0, 5).map(e => ({
            message: e.message,
            timestamp: e.timestamp,
            stack: e.metadata?.stack || e.metadata?.error?.stack
          }))
        }
      });
    }

    if (categories.validation.length > 0) {
      findings.push({
        severity: 'INFO',
        message: `Validation errors: ${categories.validation.length}`,
        details: {
          count: categories.validation.length,
          samples: categories.validation.slice(0, 5).map(e => ({
            message: e.message,
            timestamp: e.timestamp
          }))
        }
      });
    }

    if (categories.other.length > 0) {
      findings.push({
        severity: 'INFO',
        message: `Other errors: ${categories.other.length}`,
        details: {
          count: categories.other.length,
          samples: categories.other.slice(0, 5).map(e => ({
            message: e.message,
            timestamp: e.timestamp
          }))
        }
      });
    }

    // No errors is good!
    if (errors.length === 0) {
      findings.push({
        severity: 'INFO',
        message: 'No errors found during session',
        details: { note: 'Clean session with no logged errors' }
      });
    }

    return {
      name: this.name,
      status,
      findings,
      summary: {
        totalErrors: errorEntries.length,
        totalWarnings: warnEntries.length,
        httpErrors: categories.http.length,
        websocketErrors: categories.websocket.length,
        vlcErrors: categories.vlc.length,
        unhandledExceptions: categories.unhandled.length,
        validationErrors: categories.validation.length,
        otherErrors: categories.other.length
      }
    };
  }
}

module.exports = ErrorAnalysisCheck;
