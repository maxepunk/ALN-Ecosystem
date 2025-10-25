#!/usr/bin/env node
/**
 * Test VLC metadata loading timing
 * Simulates the exact retry logic from videoQueueService.js
 */

const axios = require('axios');
const path = require('path');

const vlcClient = axios.create({
  baseURL: 'http://localhost:8080',
  auth: {
    username: '',
    password: 'vlc'
  }
});

async function clearPlaylist() {
  await vlcClient.get('/requests/status.json', {
    params: { command: 'pl_empty' }
  });
  console.log('✓ Playlist cleared');
}

async function playVideo(videoPath) {
  const vlcPath = `file://${process.cwd()}/public/videos/${videoPath}`;
  console.log(`\n→ Playing: ${vlcPath}`);

  await vlcClient.get('/requests/status.json', {
    params: {
      command: 'in_enqueue',
      input: vlcPath
    }
  });

  await vlcClient.get('/requests/status.json', {
    params: { command: 'pl_play' }
  });

  console.log('✓ Video enqueued and play command sent');
}

async function getStatus() {
  const response = await vlcClient.get('/requests/status.json');
  return response.data;
}

async function testVideoLoading(videoFile) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${videoFile}`);
  console.log('='.repeat(60));

  // Clear and play video
  await clearPlaylist();
  await playVideo(videoFile);

  // Wait 1 second (same as videoQueueService.js line 122)
  console.log('\n⏱️  Waiting 1000ms for VLC to switch...');
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Try to get duration with retries (same as videoQueueService.js lines 124-148)
  let duration = 0;
  let retries = 5;

  console.log('\n📊 Attempting to get duration (5 retries with 500ms delays):');
  while (retries > 0) {
    const status = await getStatus();
    const attempt = 6 - retries;

    console.log(`\n  Attempt ${attempt}:`);
    console.log(`    State: ${status.state}`);
    console.log(`    Length: ${status.length} seconds`);
    console.log(`    Position: ${status.position}`);
    console.log(`    Filename: ${status.information?.category?.meta?.filename || 'unknown'}`);

    if (status.length > 1) {
      duration = status.length;
      console.log(`    ✓ Valid duration found: ${duration}s`);
      break;
    }

    retries--;
    if (retries > 0) {
      console.log(`    ⚠️  Duration not ready (${status.length}s), retrying...`);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  if (duration <= 1) {
    console.log(`\n❌ FAILED: No valid duration after 5 retries`);
    console.log(`   Would fall back to token metadata (likely 0, causing immediate timeout)`);
  } else {
    console.log(`\n✅ SUCCESS: Got duration ${duration}s`);
  }

  // Check status one more time after 2 more seconds
  console.log('\n⏱️  Waiting 2 more seconds to see if duration appears later...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  const lateStatus = await getStatus();
  console.log(`\n  Late check (3s after play):`);
  console.log(`    State: ${lateStatus.state}`);
  console.log(`    Length: ${lateStatus.length}s`);

  return duration;
}

async function main() {
  console.log('\n🔬 VLC Metadata Loading Timing Test');
  console.log('This simulates the exact retry logic from videoQueueService.js\n');

  try {
    // Test 1: idle-loop.mp4 (known working)
    await testVideoLoading('idle-loop.mp4');

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 2: jaw001.mp4 (the problematic one)
    await testVideoLoading('jaw001.mp4');

    console.log('\n' + '='.repeat(60));
    console.log('Test complete');
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

main();
