/**
 * Script to restore lost Team 1 score
 */

const fetch = require('node-fetch');

const ORCHESTRATOR_URL = 'http://localhost:3000';
const ADMIN_PASSWORD = 'test-admin-password';

async function restoreTeam1() {
  console.log('\n=== Restoring Team 1 Score ===\n');

  try {
    // 1. Authenticate as admin
    console.log('1. Authenticating...');
    const authResponse = await fetch(`${ORCHESTRATOR_URL}/api/admin/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: ADMIN_PASSWORD })
    });

    if (!authResponse.ok) {
      throw new Error(`Auth failed: ${authResponse.status}`);
    }

    const { token } = await authResponse.json();
    console.log('✅ Got admin token');

    // 2. Submit a transaction for Team 1 with the lost token
    // Since jaw001 was already claimed by team 1, we can't use it again
    // Let's use a different token to restore their points
    console.log('\n2. Restoring Team 1 score...');

    // Use asm001 token which has 10000 points value
    const scanResponse = await fetch(`${ORCHESTRATOR_URL}/api/scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        tokenId: 'asm001',
        teamId: '1',
        scannerId: 'RESTORE_SCRIPT'
      })
    });

    const result = await scanResponse.json();

    if (result.status === 'accepted') {
      console.log('✅ Team 1 score restored with 10000 points');
    } else {
      console.log('⚠️ Transaction result:', result.status, result.message);
    }

    // 3. Check the current state
    console.log('\n3. Checking current scores...');
    const stateResponse = await fetch(`${ORCHESTRATOR_URL}/api/state`);
    const state = await stateResponse.json();

    console.log('\nCurrent team scores:');
    state.scores.forEach(score => {
      console.log(`  Team ${score.teamId}: ${score.currentScore} points`);
    });

  } catch (error) {
    console.error('Restore failed:', error.message);
    process.exit(1);
  }
}

// Check server and run
fetch(`${ORCHESTRATOR_URL}/api/state/status`)
  .then(() => {
    console.log('Server running, starting restore...');
    restoreTeam1();
  })
  .catch(() => {
    console.log('Server not running');
    process.exit(1);
  });