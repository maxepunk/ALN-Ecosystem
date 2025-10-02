#!/usr/bin/env node
/**
 * Test script to verify Detective mode transactions don't affect scoring
 */

const fetch = require('node-fetch');
const BASE_URL = 'http://localhost:3000';

async function authenticate() {
    const response = await fetch(`${BASE_URL}/api/admin/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'admin123' })
    });
    const { token } = await response.json();
    return token;
}

async function createSession(token) {
    const response = await fetch(`${BASE_URL}/api/session`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: 'Detective Mode Test' })
    });
    const result = await response.json();
    console.log('   Session response:', JSON.stringify(result, null, 2));
    if (result.status === 'error') {
        throw new Error(result.error || 'Failed to create session');
    }
    return result.data || result;
}

async function submitScan(token, tokenId, teamId, mode) {
    // GM scanners use /api/transaction/submit, not /api/scan
    const response = await fetch(`${BASE_URL}/api/transaction/submit`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            tokenId,
            teamId,
            scannerId: 'test-scanner',
            stationMode: mode,
            timestamp: new Date().toISOString()
        })
    });
    const result = await response.json();
    console.log(`   Raw response:`, JSON.stringify(result, null, 2));
    return result;
}

async function getScores(token) {
    const response = await fetch(`${BASE_URL}/api/state`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    const state = await response.json();
    // Extract scores from the game state
    return { data: state.scores || [] };
}

async function getOrCreateSession(token) {
    // Try to get active session first
    const stateRes = await fetch(`${BASE_URL}/api/state`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const state = await stateRes.json();
    console.log('   Current state:', JSON.stringify(state, null, 2));

    if (state.sessionId) {
        console.log('   Using existing session');
        return { id: state.sessionId };
    }

    console.log('   Creating new session...');
    // Create new session
    return createSession(token);
}

async function runTest() {
    console.log('🧪 Testing Detective Mode Scoring...\n');

    try {
        // Authenticate
        console.log('1. Authenticating...');
        const token = await authenticate();
        console.log('   ✅ Authenticated\n');

        // Get or create session
        console.log('2. Getting test session...');
        const session = await getOrCreateSession(token);
        console.log(`   ✅ Session ready: ${session.id}\n`);

        // Submit Black Market scan for Team A
        console.log('3. Submitting Black Market scan for Team A (should score)...');
        const bmResult = await submitScan(token, 'TEST_TOKEN_1', 'TEAM_A', 'blackmarket');
        console.log(`   Result: ${bmResult.message}`);
        console.log(`   Points: ${bmResult.points || 0}\n`);

        // Get scores after Black Market scan
        console.log('4. Checking scores after Black Market scan...');
        const scoresAfterBM = await getScores(token);
        const teamAScoreBM = scoresAfterBM.data?.find(s => s.teamId === 'TEAM_A');
        console.log(`   Team A score: ${teamAScoreBM?.currentScore || 0}`);
        console.log(`   Expected: 10 (token value)\n`);

        // Submit Detective scan for Team B
        console.log('5. Submitting Detective scan for Team B (should NOT score)...');
        const detResult = await submitScan(token, 'TEST_TOKEN_2', 'TEAM_B', 'detective');
        console.log(`   Result: ${detResult.message}`);
        console.log(`   Points: ${detResult.points || 0}\n`);

        // Get scores after Detective scan
        console.log('6. Checking scores after Detective scan...');
        const scoresAfterDet = await getScores(token);
        const teamBScore = scoresAfterDet.data?.find(s => s.teamId === 'TEAM_B');
        console.log(`   Team B score: ${teamBScore?.currentScore || 0}`);
        console.log(`   Expected: 0 (detective mode)\n`);

        // Verify results
        console.log('📊 Test Results:');
        if (teamAScoreBM?.currentScore === 10) {
            console.log('   ✅ Black Market mode correctly adds points');
        } else {
            console.log('   ❌ Black Market mode failed to add points');
        }

        if (!teamBScore || teamBScore.currentScore === 0) {
            console.log('   ✅ Detective mode correctly skips scoring');
        } else {
            console.log('   ❌ Detective mode incorrectly added points');
        }

        // Test duplicate scan in Detective mode
        console.log('\n7. Testing duplicate scan in Detective mode...');
        const dupResult = await submitScan(token, 'TEST_TOKEN_2', 'TEAM_C', 'detective');
        console.log(`   Result: ${dupResult.message}`);
        console.log(`   Status: ${dupResult.status}`);

        if (dupResult.status === 'duplicate' || dupResult.message.includes('already claimed')) {
            console.log('   ✅ Detective mode respects duplicate detection');
        } else {
            console.log('   ❌ Detective mode duplicate detection failed');
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        process.exit(1);
    }
}

// Check if server is running
fetch(`${BASE_URL}/health`)
    .then(() => runTest())
    .catch(() => {
        console.error('❌ Backend server not running. Start it with: cd backend && npm run dev');
        process.exit(1);
    });