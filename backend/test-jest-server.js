// Test if Jest is the problem
process.env.NODE_ENV = 'test';
process.env.ENABLE_VIDEO_PLAYBACK = 'false';

// Simulate Jest environment
global.beforeAll = (fn) => fn();
global.beforeEach = (fn) => fn();
global.it = (name, fn) => fn();
global.describe = (name, fn) => fn();
global.expect = (val) => ({ toHaveProperty: () => {} });

console.log('Simulating Jest test...');

const test = async () => {
  console.log('1. Setting up like test does...');

  // Import setup file
  const { createTestServer } = require('./tests/contract/ws-test-setup');

  // Import app
  const app = require('./src/app');

  console.log('2. Creating test server...');
  const testServer = await createTestServer(app);
  const server = testServer.server;

  console.log('3. Attempting server.listen...');

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      console.log('4. TIMEOUT: server.listen did not complete');
      reject(new Error('Timeout'));
    }, 3000);

    server.listen(3002, '127.0.0.1', () => {
      console.log('4. SUCCESS: Server listening!');
      clearTimeout(timeout);
      server.close();
      resolve();
    });

    server.on('error', (err) => {
      console.log('4. ERROR:', err.message);
      clearTimeout(timeout);
      reject(err);
    });
  });
};

test().then(() => {
  console.log('Test passed!');
  process.exit(0);
}).catch(err => {
  console.error('Test failed:', err.message);
  process.exit(1);
});