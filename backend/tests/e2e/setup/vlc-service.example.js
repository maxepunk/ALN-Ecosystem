/**
 * Example Usage: VLC Service Helper for E2E Tests
 *
 * This example demonstrates how to use the VLC service helper
 * in E2E tests with smart real/mock switching.
 */

const vlcService = require('./vlc-service');

async function exampleBasicUsage() {
  console.log('=== Example 1: Basic VLC Setup ===\n');

  // Setup VLC (auto-detects and chooses real or mock)
  const vlc = await vlcService.setupVLC();

  console.log('VLC Setup Complete:');
  console.log(`  Type: ${vlc.type}`);
  console.log(`  URL: ${vlc.url}`);
  console.log(`  Port: ${vlc.port}`);
  console.log(`  Mode: ${vlcService.getVLCMode()}`);

  // Get status
  const status = await vlcService.getVLCStatus();
  console.log(`\nVLC State: ${status.state}`);

  // Cleanup
  await vlcService.cleanup();
  console.log('\nCleanup complete\n');
}

async function exampleManualControl() {
  console.log('=== Example 2: Manual VLC Control ===\n');

  // Check if VLC is available
  const available = await vlcService.isVLCAvailable();
  console.log(`VLC available: ${available}`);

  if (!available) {
    console.log('Starting VLC...');
    const started = await vlcService.startVLCIfNeeded();
    console.log(`VLC started: ${started}`);

    if (started) {
      console.log('Waiting for VLC to be ready...');
      const ready = await vlcService.waitForVLCReady();
      console.log(`VLC ready: ${ready}`);
    }
  }

  // Get status
  const status = await vlcService.getVLCStatus();
  console.log(`\nVLC Status:`);
  console.log(`  State: ${status.state}`);
  console.log(`  Current video: ${status.currentItem || 'none'}`);

  // Cleanup
  await vlcService.stopVLC();
  console.log('\nVLC stopped\n');
}

async function exampleMockFallback() {
  console.log('=== Example 3: Mock VLC Fallback ===\n');

  // Force mock mode by not starting real VLC
  console.log('Starting mock VLC server...');
  const port = await vlcService.mockVLCService();
  console.log(`Mock VLC running on port: ${port}`);

  // Get mock server instance for test assertions
  const mockServer = vlcService.getMockVLCServer();
  if (mockServer) {
    console.log('\nMock VLC state:');
    console.log(`  State: ${mockServer.state}`);
    console.log(`  Current video: ${mockServer.currentVideo || 'none'}`);

    // Simulate video playback
    mockServer.handleInPlay('file:///path/to/test.mp4');
    console.log(`\nAfter simulating playback:`);
    console.log(`  State: ${mockServer.state}`);
    console.log(`  Current video: ${mockServer.currentVideo}`);
  }

  // Cleanup
  await vlcService.stopMockVLC();
  console.log('\nMock VLC stopped\n');
}

async function exampleTestPattern() {
  console.log('=== Example 4: E2E Test Pattern ===\n');

  try {
    // Setup (before all tests)
    const vlc = await vlcService.setupVLC();
    console.log(`Using ${vlc.type} VLC for tests`);

    // Test case 1: Check initial state
    const status1 = await vlcService.getVLCStatus();
    console.log(`\nTest 1 - Initial state: ${status1.state}`);

    // Test case 2: Verify VLC mode
    const mode = vlcService.getVLCMode();
    console.log(`Test 2 - VLC mode: ${mode}`);

    // Test case 3: Mock-specific assertions
    if (mode === 'mock') {
      const mockServer = vlcService.getMockVLCServer();
      console.log(`Test 3 - Mock server available: ${mockServer !== null}`);
    }

    // Cleanup (after all tests)
    await vlcService.cleanup();
    console.log('\nAll tests complete\n');
  } catch (error) {
    console.error('Test failed:', error.message);
    await vlcService.cleanup();
  }
}

// Run examples
async function runAllExamples() {
  console.log('VLC Service Helper - Usage Examples\n');
  console.log('=' .repeat(50));
  console.log('\n');

  try {
    await exampleBasicUsage();
    await exampleManualControl();
    await exampleMockFallback();
    await exampleTestPattern();

    console.log('=' .repeat(50));
    console.log('\nAll examples completed successfully!');
  } catch (error) {
    console.error('\nExample failed:', error.message);
    process.exit(1);
  }
}

// Only run if executed directly
if (require.main === module) {
  runAllExamples().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = {
  exampleBasicUsage,
  exampleManualControl,
  exampleMockFallback,
  exampleTestPattern
};
