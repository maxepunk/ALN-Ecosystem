const io = require('socket.io-client');

console.log('Testing WebSocket connection to ALN Orchestrator...\n');

const socket = io('http://localhost:3000', {
  reconnection: true,
  reconnectionDelay: 1000,
  timeout: 5000,
});

socket.on('connect', () => {
  console.log('✅ Connected! Socket ID:', socket.id);

  // Test GM identification
  console.log('\nSending GM identification...');
  socket.emit('gm:identify', {
    stationId: 'TEST_GM_001',
    version: '1.0.0'
  });
});

socket.on('gm:identified', (data) => {
  console.log('✅ GM identified successfully:', data);

  // Test heartbeat
  console.log('\nSending heartbeat...');
  socket.emit('heartbeat', {});
});

socket.on('heartbeat', (data) => {
  console.log('✅ Heartbeat acknowledged:', data);

  // Test state sync
  console.log('\nRequesting state sync...');
  socket.emit('sync:request');
});

socket.on('state:sync', (data) => {
  console.log('✅ State sync received:');
  console.log('  - Session:', data.sessionId || 'No active session');
  console.log('  - VLC Connected:', data.systemStatus?.vlcConnected || false);
  console.log('  - Teams:', data.scores?.length || 0);

  console.log('\n✅ All WebSocket tests passed!');
  process.exit(0);
});

socket.on('connect_error', (error) => {
  console.error('❌ Connection failed:', error.message);
  process.exit(1);
});

socket.on('error', (error) => {
  console.error('❌ Socket error:', error);
});

setTimeout(() => {
  console.error('\n❌ Test timeout after 10 seconds');
  process.exit(1);
}, 10000);