// Test with actual app to isolate the issue
process.env.NODE_ENV = 'test';
process.env.ENABLE_VIDEO_PLAYBACK = 'false';

const http = require('http');

async function test() {
  console.log('1. Loading app...');
  const app = require('./src/app');

  console.log('2. Initializing services...');
  await app.initializeServices();

  console.log('3. Creating HTTP server with app...');
  const server = http.createServer(app);

  console.log('4. Server object created:', !!server);
  console.log('5. Attempting to listen on port 3002...');

  const timeout = setTimeout(() => {
    console.log('6. TIMEOUT: Server.listen() did not complete after 5 seconds');
    process.exit(1);
  }, 5000);

  server.listen(3002, '127.0.0.1', () => {
    console.log('6. SUCCESS: Server listening on 3002');
    clearTimeout(timeout);

    // Test if we can connect
    const net = require('net');
    const client = net.createConnection({ port: 3002 }, () => {
      console.log('7. Client connected successfully');
      client.end();
      server.close();
      process.exit(0);
    });
  });

  server.on('error', (err) => {
    console.log('6. ERROR:', err.message);
    clearTimeout(timeout);
    process.exit(1);
  });
}

test().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});