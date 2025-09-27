// Minimal test to debug server startup
process.env.NODE_ENV = 'test';
process.env.ENABLE_VIDEO_PLAYBACK = 'false';

const http = require('http');

async function test() {
  console.log('1. Creating basic HTTP server...');
  const server = http.createServer((req, res) => {
    res.end('test');
  });

  console.log('2. Attempting to listen on port 3002...');
  server.listen(3002, '127.0.0.1', () => {
    console.log('3. SUCCESS: Server listening on 3002');
    server.close();
    process.exit(0);
  });

  server.on('error', (err) => {
    console.log('3. ERROR:', err.message);
    process.exit(1);
  });
}

test();