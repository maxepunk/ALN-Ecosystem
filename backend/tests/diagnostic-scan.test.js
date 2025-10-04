/**
 * Diagnostic test to capture actual 500 error from scan endpoint
 */

const request = require('supertest');
const app = require('../src/app');

describe('Diagnostic: POST /api/scan error', () => {
  it('should show actual error message', async () => {
    const response = await request(app.app)
      .post('/api/scan')
      .send({
        tokenId: '534e2b03',
        teamId: '001',
        deviceId: 'PLAYER_SCANNER_01',
        timestamp: new Date().toISOString()
      });

    console.log('Status:', response.status);
    console.log('Body:', JSON.stringify(response.body, null, 2));

    if (response.status === 500) {
      console.log('ERROR DETAILS:', response.body);
    }
  });
});
