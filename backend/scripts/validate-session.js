#!/usr/bin/env node
/**
 * ALN Session Validation Script
 * Post-session analysis tool for detecting scoring discrepancies and bugs
 *
 * Usage:
 *   npm run session:validate list              # List available sessions
 *   npm run session:validate <sessionId>       # Validate specific session
 *   npm run session:validate 1207              # Partial name match
 *   npm run session:validate latest            # Most recent session
 */

const path = require('path');
const SessionLoader = require('./lib/SessionLoader');
const TokenLoader = require('./lib/TokenLoader');
const ScoringCalculator = require('./lib/ScoringCalculator');
const LogParser = require('./lib/LogParser');
const ReportGenerator = require('./lib/ReportGenerator');
const { resolveSessionPack } = require('./lib/packResolver');
const modeSemantics = require('../src/gameRules/modeSemantics');

// Validators (9 holistic validators)
const TransactionFlowCheck = require('./lib/validators/TransactionFlowCheck');
const ScoringIntegrityCheck = require('./lib/validators/ScoringIntegrityCheck');
const NonScoringModeCheck = require('./lib/validators/NonScoringModeCheck');
const VideoPlaybackCheck = require('./lib/validators/VideoPlaybackCheck');
const DeviceConnectivityCheck = require('./lib/validators/DeviceConnectivityCheck');
const GroupCompletionCheck = require('./lib/validators/GroupCompletionCheck');
const DuplicateHandlingCheck = require('./lib/validators/DuplicateHandlingCheck');
const ErrorAnalysisCheck = require('./lib/validators/ErrorAnalysisCheck');
const SessionLifecycleCheck = require('./lib/validators/SessionLifecycleCheck');

const DATA_DIR = path.join(__dirname, '../data');
const LOG_FILE = path.join(__dirname, '../logs/combined.log');

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    printUsage();
    process.exit(1);
  }

  const command = args[0];

  try {
    // Initialize loaders
    const sessionLoader = new SessionLoader(DATA_DIR);
    await sessionLoader.init();

    // Handle 'list' command
    if (command === 'list') {
      await listSessions(sessionLoader);
      process.exit(0);
    }

    // Load session
    let session;
    if (command === 'latest') {
      session = await sessionLoader.loadLatest();
    } else {
      session = await sessionLoader.loadByIdOrName(command);
    }

    if (!session) {
      console.error(`Error: Session not found: ${command}`);
      console.error('Use "npm run session:validate list" to see available sessions');
      process.exit(1);
    }

    // Resolve WHICH pack this session should be validated against (D4s2:
    // the session's stamped pack identity, or the on-disk pack for
    // unstamped/legacy sessions — loud notes either way).
    const pack = resolveSessionPack(session);
    // The modeSemantics L6 shim warns loudly when a null gameConfig rides
    // the baked ALN table — collect it into the report instead of letting
    // it splat into the report stream mid-render.
    modeSemantics.setLegacyWarnHook((msg) => pack.notes.push(`mode seam: ${msg}`));

    // Load tokens + calculator FROM the resolved pack
    const tokenLoader = new TokenLoader(pack.packDir);
    const tokens = tokenLoader.loadTokens();
    const calculator = new ScoringCalculator(tokens, {
      gameConfig: pack.gameConfig,
      packDir: pack.packDir,
    });

    // Initialize log parser
    const logParser = new LogParser(LOG_FILE);

    // Run all validators
    const results = await runValidators(session, tokens, calculator, logParser, pack);

    // Generate report
    const report = ReportGenerator.generate(session, results, pack);
    console.log(report);

    // Exit with appropriate code
    const hasFailures = results.some(r => r.status === 'FAIL');
    process.exit(hasFailures ? 1 : 0);

  } catch (error) {
    console.error(`Error: ${error.message}`);
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

async function listSessions(sessionLoader) {
  const sessions = await sessionLoader.listSessions();

  if (sessions.length === 0) {
    console.log('No sessions found in data directory');
    return;
  }

  console.log('\n# Available Sessions\n');
  console.log('| ID | Name | Status | Created | Transactions |');
  console.log('|----|------|--------|---------|--------------|');

  for (const s of sessions) {
    const id = s.id.substring(0, 8) + '...';
    const created = s.createdAt ? new Date(s.createdAt).toLocaleString() : 'Unknown';
    const txCount = s.transactions?.length || 0;
    console.log(`| ${id} | ${s.name || 'Unnamed'} | ${s.status || 'unknown'} | ${created} | ${txCount} |`);
  }
  console.log('');
}

async function runValidators(session, tokens, calculator, logParser, pack) {
  const results = [];
  const tokensMap = new Map(tokens.map(t => [t.id, t]));

  // 1. Transaction Flow Check (valid modes = the resolved pack's declared ids)
  console.error('Running Transaction Flow Check...');
  const txFlowCheck = new TransactionFlowCheck(tokensMap, { gameConfig: pack.gameConfig });
  results.push(await txFlowCheck.run(session));

  // 2. Scoring Integrity Check (CRITICAL - compares against log broadcasts, NOT session.scores)
  console.error('Running Scoring Integrity Check...');
  const scoringCheck = new ScoringIntegrityCheck(calculator, logParser);
  results.push(await scoringCheck.run(session));

  // 3. Non-Scoring Mode Check (was DetectiveModeCheck — generalized D4s2)
  console.error('Running Non-Scoring Mode Check...');
  const nonScoringCheck = new NonScoringModeCheck(tokensMap, calculator);
  results.push(await nonScoringCheck.run(session));

  // 4. Video Playback Check
  console.error('Running Video Playback Check...');
  const videoCheck = new VideoPlaybackCheck(logParser, tokensMap);
  results.push(await videoCheck.run(session));

  // 5. Device Connectivity Check
  console.error('Running Device Connectivity Check...');
  const deviceCheck = new DeviceConnectivityCheck(logParser);
  results.push(await deviceCheck.run(session));

  // 6. Group Completion Check
  console.error('Running Group Completion Check...');
  const groupCheck = new GroupCompletionCheck(calculator, tokens, logParser);
  results.push(await groupCheck.run(session));

  // 7. Duplicate Handling Check (ENHANCED: includes false positive and ghost scoring detection)
  console.error('Running Duplicate Handling Check...');
  const dupCheck = new DuplicateHandlingCheck(logParser);
  results.push(await dupCheck.run(session));

  // 8. Error Analysis Check
  console.error('Running Error Analysis Check...');
  const errorCheck = new ErrorAnalysisCheck(logParser);
  results.push(await errorCheck.run(session));

  // 9. Session Lifecycle Check (NEW: tracks deletions, resets, pause/resume)
  console.error('Running Session Lifecycle Check...');
  const lifecycleCheck = new SessionLifecycleCheck(logParser);
  results.push(await lifecycleCheck.run(session));

  return results;
}

function printUsage() {
  console.log(`
ALN Session Validation Tool

Usage:
  npm run session:validate list              List available sessions
  npm run session:validate <sessionId>       Validate by full or partial ID
  npm run session:validate <name>            Validate by partial name match
  npm run session:validate latest            Validate most recent session

Examples:
  npm run session:validate 1207              Match session named "1207 game"
  npm run session:validate 54fbdd52          Match session by ID prefix
  npm run session:validate latest > report.md  Save report to file

Exit Codes:
  0  All critical checks passed
  1  One or more critical checks failed
`);
}

main();
