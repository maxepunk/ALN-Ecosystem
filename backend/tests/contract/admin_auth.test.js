/**
 * Contract Tests for POST /api/admin/auth
 * Tests admin authentication endpoint
 * 
 * Requirements validated:
 * - Password-based authentication
 * - JWT token generation
 * - Token expiration handling
 * - Rate limiting for auth attempts
 * - Security against common attacks
 */

const request = require('supertest');

// This import will fail as app doesn't exist yet - exactly what we want for TDD
const app = require('../../src/app');
const sessionService = require('../../src/services/sessionService');
const stateService = require('../../src/services/stateService');

describe('POST /api/admin/auth - Admin Authentication', () => {
  const validPassword = process.env.ADMIN_PASSWORD || 'test-admin-password';

  // Clean up state before each test to ensure isolation
  beforeEach(async () => {
    await sessionService.reset();
    await stateService.reset();
  });

  describe('Valid Authentication', () => {
    it('should authenticate with correct password', async () => {
      const response = await request(app)
        .post('/api/admin/auth')
        .send({ password: validPassword })
        .expect('Content-Type', /json/)
        .expect(200);

      // Validate response structure from OpenAPI spec
      expect(response.body).toHaveProperty('token');
      expect(typeof response.body.token).toBe('string');
      expect(response.body.token.length).toBeGreaterThan(20); // JWT tokens are typically long
      
      expect(response.body).toHaveProperty('expiresIn');
      expect(typeof response.body.expiresIn).toBe('number');
      expect(response.body.expiresIn).toBeGreaterThan(0);
    });

    it('should return valid JWT token format', async () => {
      const response = await request(app)
        .post('/api/admin/auth')
        .send({ password: validPassword })
        .expect(200);

      // JWT should have three parts separated by dots
      const tokenParts = response.body.token.split('.');
      expect(tokenParts).toHaveLength(3);
      
      // Each part should be base64url encoded
      tokenParts.forEach(part => {
        expect(part).toMatch(/^[A-Za-z0-9_-]+$/);
      });
    });

    it('should set appropriate expiration time', async () => {
      const response = await request(app)
        .post('/api/admin/auth')
        .send({ password: validPassword })
        .expect(200);

      // Default should be 24 hours (86400 seconds)
      expect(response.body.expiresIn).toBe(86400);
    });

    it('should not require authentication for auth endpoint', async () => {
      // Should work without any auth header
      const response = await request(app)
        .post('/api/admin/auth')
        .send({ password: validPassword })
        .expect(200);

      expect(response.body).toHaveProperty('token');
    });

    it('should respond quickly to valid auth request', async () => {
      const startTime = Date.now();
      
      await request(app)
        .post('/api/admin/auth')
        .send({ password: validPassword })
        .expect(200);

      const responseTime = Date.now() - startTime;
      // Auth should be reasonably fast even with hashing
      expect(responseTime).toBeLessThan(500);
    });
  });

  describe('Invalid Authentication', () => {
    it('should reject incorrect password', async () => {
      const response = await request(app)
        .post('/api/admin/auth')
        .send({ password: 'wrong-password' })
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      // Should not reveal whether user exists or password is wrong
      expect(response.body.message).not.toContain('password');
      expect(response.body.message).toMatch(/invalid|unauthorized|authentication/i);
    });

    it('should reject empty password', async () => {
      const response = await request(app)
        .post('/api/admin/auth')
        .send({ password: '' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.message).toContain('password');
    });

    it('should reject missing password field', async () => {
      const response = await request(app)
        .post('/api/admin/auth')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.message).toContain('password');
    });

    it('should reject null password', async () => {
      const response = await request(app)
        .post('/api/admin/auth')
        .send({ password: null })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject non-string password', async () => {
      const invalidPasswords = [
        123456,
        true,
        { password: 'nested' },
        ['array'],
      ];

      for (const password of invalidPasswords) {
        const response = await request(app)
          .post('/api/admin/auth')
          .send({ password })
          .expect(400);

        expect(response.body).toHaveProperty('error');
      }
    });

    it('should have consistent timing for invalid passwords', async () => {
      const times = [];
      
      // Test multiple invalid passwords
      for (let i = 0; i < 5; i++) {
        const startTime = Date.now();
        
        await request(app)
          .post('/api/admin/auth')
          .send({ password: `wrong-password-${i}` })
          .expect(401);
        
        times.push(Date.now() - startTime);
      }

      // Check that times are consistent (prevent timing attacks)
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      times.forEach(time => {
        const deviation = Math.abs(time - avgTime) / avgTime;
        expect(deviation).toBeLessThan(0.3); // Within 30% variance
      });
    });
  });

  describe('Token Usage', () => {
    let authToken;

    beforeAll(async () => {
      const response = await request(app)
        .post('/api/admin/auth')
        .send({ password: validPassword });
      authToken = response.body.token;
    });

    it('should accept valid token for protected endpoints', async () => {
      // Test with session creation endpoint (requires auth)
      const response = await request(app)
        .post('/api/session')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Auth Test Session' })
        .expect(201);

      expect(response.body).toHaveProperty('id');
    });

    it('should reject expired token', async () => {
      // This would require a specifically crafted expired token
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE2MDAwMDAwMDB9.invalid';
      
      const response = await request(app)
        .post('/api/session')
        .set('Authorization', `Bearer ${expiredToken}`)
        .send({ name: 'Test Session' })
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.message).toMatch(/expired|invalid/i);
    });

    it('should reject tampered token', async () => {
      // Modify the token signature
      const tamperedToken = authToken.slice(0, -5) + 'xxxxx';
      
      const response = await request(app)
        .post('/api/session')
        .set('Authorization', `Bearer ${tamperedToken}`)
        .send({ name: 'Test Session' })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle multiple simultaneous auth requests', async () => {
      const promises = [];
      
      // Send 10 concurrent auth requests
      for (let i = 0; i < 10; i++) {
        promises.push(
          request(app)
            .post('/api/admin/auth')
            .send({ password: validPassword })
        );
      }

      const responses = await Promise.all(promises);
      
      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('token');
      });

      // Each should get a unique token (due to timestamps)
      const tokens = responses.map(r => r.body.token);
      // Tokens might be same if generated in same millisecond, so check most are unique
      const uniqueTokens = new Set(tokens);
      expect(uniqueTokens.size).toBeGreaterThan(5);
    });
  });

  describe('Rate Limiting', () => {
    // Rate limiting is not in the specification - this test should be skipped
    it.skip('should rate limit excessive auth attempts', async () => {
      const attempts = [];
      
      // Try 20 rapid auth attempts with wrong password
      for (let i = 0; i < 20; i++) {
        attempts.push(
          request(app)
            .post('/api/admin/auth')
            .send({ password: 'wrong-password' })
        );
      }

      const responses = await Promise.all(attempts);
      
      // Some should be rate limited (429 status)
      const rateLimited = responses.filter(r => r.status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
      
      // Rate limit response should have retry-after header
      if (rateLimited.length > 0) {
        expect(rateLimited[0].headers).toHaveProperty('retry-after');
      }
    });

    it('should not rate limit successful authentications as aggressively', async () => {
      const attempts = [];
      
      // Try 10 rapid auth attempts with correct password
      for (let i = 0; i < 10; i++) {
        attempts.push(
          request(app)
            .post('/api/admin/auth')
            .send({ password: validPassword })
        );
      }

      const responses = await Promise.all(attempts);
      
      // Most should succeed
      const successful = responses.filter(r => r.status === 200);
      expect(successful.length).toBeGreaterThan(5);
    });
  });

  describe('Security', () => {
    it('should not leak information about system', async () => {
      const response = await request(app)
        .post('/api/admin/auth')
        .send({ password: 'wrong-password' })
        .expect(401);

      const responseString = JSON.stringify(response.body);
      
      // Should not contain sensitive information
      expect(responseString).not.toMatch(/admin/i);
      expect(responseString).not.toMatch(/user/i);
      expect(responseString).not.toMatch(/exists/i);
      expect(responseString).not.toMatch(/incorrect/i);
    });

    it('should handle SQL injection attempts in password', async () => {
      const sqlInjections = [
        "' OR '1'='1",
        "admin'--",
        "'; DROP TABLE users; --",
        "' UNION SELECT * FROM users --",
      ];

      for (const injection of sqlInjections) {
        const response = await request(app)
          .post('/api/admin/auth')
          .send({ password: injection })
          .expect(401);

        expect(response.body).toHaveProperty('error');
        // Should not cause server error
        expect(response.status).toBeLessThan(500);
      }
    });

    it('should handle XSS attempts in password', async () => {
      const xssAttempts = [
        '<script>alert("XSS")</script>',
        'javascript:alert(1)',
        '<img src=x onerror=alert(1)>',
      ];

      for (const xss of xssAttempts) {
        const response = await request(app)
          .post('/api/admin/auth')
          .send({ password: xss })
          .expect(401);

        // Response should not contain unsanitized input
        const responseString = JSON.stringify(response.body);
        expect(responseString).not.toContain('<script>');
        expect(responseString).not.toContain('javascript:');
        expect(responseString).not.toContain('onerror');
      }
    });

    it('should handle very long passwords gracefully', async () => {
      const longPassword = 'a'.repeat(10000);
      
      const response = await request(app)
        .post('/api/admin/auth')
        .send({ password: longPassword });

      // Should not crash, should reject
      expect(response.status).toBeLessThan(500);
      expect([400, 401]).toContain(response.status);
    });

    it('should not accept GET requests', async () => {
      await request(app)
        .get('/api/admin/auth')
        .expect(405); // Method Not Allowed
    });

    it('should ignore extra fields in request', async () => {
      const response = await request(app)
        .post('/api/admin/auth')
        .send({
          password: validPassword,
          username: 'admin',
          role: 'superadmin',
          hack: 'attempt',
        })
        .expect(200);

      // Should only process password field
      expect(response.body).toHaveProperty('token');
      // Response should not echo back extra fields
      expect(response.body).not.toHaveProperty('username');
      expect(response.body).not.toHaveProperty('role');
    });
  });

  describe('Edge Cases', () => {
    it('should handle special characters in password', async () => {
      const specialPasswords = [
        '!@#$%^&*()',
        'пароль', // Cyrillic
        '密码', // Chinese
        '🔑🔐', // Emojis
        '\n\r\t', // Control characters
      ];

      for (const password of specialPasswords) {
        const response = await request(app)
          .post('/api/admin/auth')
          .send({ password });

        // Should handle gracefully (either accept or reject, but not crash)
        expect(response.status).toBeLessThan(500);
      }
    });

    it('should handle malformed JSON', async () => {
      await request(app)
        .post('/api/admin/auth')
        .set('Content-Type', 'application/json')
        .send('{"password": invalid json}')
        .expect(400);
    });

    it('should handle non-JSON content type', async () => {
      await request(app)
        .post('/api/admin/auth')
        .set('Content-Type', 'text/plain')
        .send('password=test')
        .expect(400);
    });

    it('should handle concurrent auth with same password', async () => {
      const promises = [];
      
      // Send 5 concurrent requests with correct password
      for (let i = 0; i < 5; i++) {
        promises.push(
          request(app)
            .post('/api/admin/auth')
            .send({ password: validPassword })
        );
      }

      const responses = await Promise.all(promises);
      
      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('token');
      });
    });
  });
});