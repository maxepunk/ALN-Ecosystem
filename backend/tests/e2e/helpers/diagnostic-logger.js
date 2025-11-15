/**
 * Diagnostic Logger for E2E Tests
 *
 * Purpose: Trace event flow through multi-component system
 * Usage: Enable via DIAGNOSTIC_MODE=true environment variable
 *
 * Component Boundaries Tracked:
 * 1. Backend: gm:command received
 * 2. Backend: Session service event emission
 * 3. Backend: Broadcast sent to room
 * 4. Frontend: WebSocket message received
 * 5. Frontend: MonitoringDisplay processes message
 * 6. Frontend: DataManager event emission
 * 7. Frontend: UI update triggered
 */

const chalk = require('chalk');

class DiagnosticLogger {
  constructor(testName) {
    this.testName = testName;
    this.enabled = process.env.DIAGNOSTIC_MODE === 'true';
    this.timeline = [];
    this.startTime = Date.now();
  }

  /**
   * Log event at component boundary
   * @param {string} component - Component name
   * @param {string} boundary - Boundary description (e.g., "INPUT", "OUTPUT")
   * @param {string} event - Event name
   * @param {Object} data - Event data (optional)
   */
  log(component, boundary, event, data = null) {
    if (!this.enabled) return;

    const timestamp = Date.now() - this.startTime;
    const entry = {
      timestamp,
      component,
      boundary,
      event,
      data: data ? JSON.stringify(data).substring(0, 100) : null
    };

    this.timeline.push(entry);

    // Color-coded console output
    const color = boundary === 'INPUT' ? chalk.cyan :
                  boundary === 'OUTPUT' ? chalk.green :
                  boundary === 'ERROR' ? chalk.red : chalk.yellow;

    console.log(color(`[${timestamp}ms] ${component} ${boundary}: ${event}`));
    if (data && boundary !== 'OUTPUT') {
      console.log(chalk.gray(`  Data: ${JSON.stringify(data, null, 2).substring(0, 200)}`));
    }
  }

  /**
   * Log backend event emission
   */
  backend(event, data) {
    this.log('BACKEND', 'OUTPUT', event, data);
  }

  /**
   * Log backend event reception
   */
  backendInput(event, data) {
    this.log('BACKEND', 'INPUT', event, data);
  }

  /**
   * Log WebSocket broadcast
   */
  broadcast(room, event, data) {
    this.log('BROADCAST', 'OUTPUT', `${room}::${event}`, { room, event });
  }

  /**
   * Log frontend WebSocket reception
   */
  frontendReceived(event, data) {
    this.log('FRONTEND-WS', 'INPUT', event, data);
  }

  /**
   * Log frontend event dispatch
   */
  frontendDispatch(event, data) {
    this.log('FRONTEND-EVENT', 'OUTPUT', event, data);
  }

  /**
   * Log UI update
   */
  uiUpdate(component, action) {
    this.log('UI', 'UPDATE', `${component}.${action}`);
  }

  /**
   * Log error
   */
  error(component, message, details) {
    this.log(component, 'ERROR', message, details);
  }

  /**
   * Dump complete timeline
   */
  dumpTimeline() {
    if (!this.enabled) return;

    console.log(chalk.bold.yellow('\n=== DIAGNOSTIC TIMELINE ==='));
    console.log(chalk.bold(`Test: ${this.testName}`));
    console.log(chalk.bold(`Total duration: ${Date.now() - this.startTime}ms\n`));

    this.timeline.forEach(entry => {
      const color = entry.boundary === 'INPUT' ? chalk.cyan :
                    entry.boundary === 'OUTPUT' ? chalk.green :
                    entry.boundary === 'ERROR' ? chalk.red : chalk.yellow;

      console.log(color(`[+${entry.timestamp}ms] ${entry.component} ${entry.boundary}: ${entry.event}`));
      if (entry.data && entry.boundary === 'ERROR') {
        console.log(chalk.gray(`  ${entry.data}`));
      }
    });

    console.log(chalk.bold.yellow('=========================\n'));
  }

  /**
   * Analyze timeline for common issues
   */
  analyzeGaps() {
    if (!this.enabled || this.timeline.length === 0) return;

    console.log(chalk.bold.magenta('\n=== GAP ANALYSIS ==='));

    // Check for backend output without corresponding frontend input
    const backendEvents = this.timeline.filter(e => e.component === 'BACKEND' && e.boundary === 'OUTPUT');
    const frontendInputs = this.timeline.filter(e => e.component === 'FRONTEND-WS' && e.boundary === 'INPUT');

    backendEvents.forEach(backendEvent => {
      const matchingFrontend = frontendInputs.find(fe =>
        fe.event === backendEvent.event && fe.timestamp > backendEvent.timestamp
      );

      if (!matchingFrontend) {
        console.log(chalk.red(`❌ Backend emitted ${backendEvent.event} but frontend never received it`));
        console.log(chalk.gray(`   Emitted at: +${backendEvent.timestamp}ms`));
      } else {
        const delay = matchingFrontend.timestamp - backendEvent.timestamp;
        if (delay > 1000) {
          console.log(chalk.yellow(`⚠️  ${backendEvent.event} took ${delay}ms to reach frontend (>1s)`));
        } else {
          console.log(chalk.green(`✓ ${backendEvent.event} delivered in ${delay}ms`));
        }
      }
    });

    console.log(chalk.bold.magenta('===================\n'));
  }
}

/**
 * Create diagnostic logger for test
 * @param {string} testName - Test name
 * @returns {DiagnosticLogger}
 */
function createDiagnosticLogger(testName) {
  return new DiagnosticLogger(testName);
}

/**
 * Add diagnostic instrumentation to page (browser console)
 * Injects logging into frontend code
 */
async function instrumentFrontend(page, logger) {
  if (process.env.DIAGNOSTIC_MODE !== 'true') return;

  await page.exposeFunction('__diagnosticLog', (component, boundary, event, data) => {
    logger.log(component, boundary, event, data);
  });

  await page.evaluate(() => {
    // Intercept OrchestratorClient message reception
    const originalDispatch = EventTarget.prototype.dispatchEvent;
    EventTarget.prototype.dispatchEvent = function(event) {
      if (event.type === 'message:received' && event.detail) {
        window.__diagnosticLog('FRONTEND-WS', 'INPUT', event.detail.type, event.detail.payload);
      }
      return originalDispatch.call(this, event);
    };

    // Intercept DataManager event emission
    if (window.DataManager) {
      const originalAdd = window.DataManager.addTransaction;
      window.DataManager.addTransaction = function(tx) {
        window.__diagnosticLog('DataManager', 'INPUT', 'addTransaction', { tokenId: tx.tokenId });
        const result = originalAdd.call(this, tx);
        window.__diagnosticLog('DataManager', 'OUTPUT', 'transaction:added', { tokenId: tx.tokenId });
        return result;
      };
    }

    console.log('[DIAGNOSTIC] Frontend instrumentation active');
  });
}

/**
 * Dump state on test failure
 */
async function dumpStateOnFailure(page, orchestratorUrl, logger) {
  try {
    const frontendState = await page.evaluate(() => ({
      socketConnected: window.orchestratorClient?.socket?.connected,
      socketId: window.orchestratorClient?.socket?.id,
      transactions: window.DataManager?.transactions?.length,
      backendScores: window.DataManager?.backendScores ?
        Array.from(window.DataManager.backendScores.entries()) : [],
      historyActive: document.getElementById('historyScreen')?.classList.contains('active'),
      adminInitialized: !!window.adminController,
      adminModules: window.adminController ? Object.keys(window.adminController.modules || {}) : []
    })).catch(err => ({ error: `Page closed: ${err.message}` }));

    const backendState = await fetch(`${orchestratorUrl}/api/state`)
      .then(r => r.json())
      .catch(err => ({ error: `Backend offline: ${err.message}` }));

    console.log(chalk.bold.red('\n=== FAILURE STATE DUMP ==='));
    console.log(chalk.bold('Frontend State:'));
    console.log(JSON.stringify(frontendState, null, 2));
    console.log(chalk.bold('\nBackend State:'));
    console.log(JSON.stringify(backendState, null, 2));
    console.log(chalk.bold.red('==========================\n'));

    logger.dumpTimeline();
    logger.analyzeGaps();

  } catch (error) {
    console.error(chalk.red('Error dumping state:'), error.message);
  }
}

module.exports = {
  createDiagnosticLogger,
  instrumentFrontend,
  dumpStateOnFailure
};
