/**
 * Unit Tests: PersistenceService
 * Tests the storage abstraction layer
 * Uses MemoryStorage backend in test environment
 */

const persistenceService = require('../../../src/services/persistenceService');

describe('PersistenceService', () => {
  beforeEach(async () => {
    // Reset service to clean state
    await persistenceService.reset();
  });

  afterEach(async () => {
    // Cleanup after each test
    await persistenceService.cleanup();
  });

  describe('save and load operations', () => {
    it('should save and load data by key', async () => {
      // ARRANGE
      const testData = {
        id: 'test-123',
        value: 'test value',
        nested: { field: 42 }
      };

      // ACT
      await persistenceService.save('test-key', testData);
      const loaded = await persistenceService.load('test-key');

      // ASSERT
      expect(loaded).toBeTruthy();
      expect(loaded.id).toBe('test-123');
      expect(loaded.value).toBe('test value');
      expect(loaded.nested.field).toBe(42);
    });

    it('should return null for non-existent key', async () => {
      // ACT
      const loaded = await persistenceService.load('nonexistent-key');

      // ASSERT
      expect(loaded).toBeNull();
    });

    it('should auto-initialize on first operation', async () => {
      // ARRANGE - Service already reset, not initialized
      const testData = { test: 'value' };

      // ACT - Should auto-initialize
      await persistenceService.save('auto-init-key', testData);
      const loaded = await persistenceService.load('auto-init-key');

      // ASSERT
      expect(loaded).toBeTruthy();
      expect(loaded.test).toBe('value');
    });
  });

  describe('saveSession and loadSession', () => {
    it('should save and load session data', async () => {
      // ARRANGE
      const sessionData = {
        id: 'test-session-123',
        teamScores: { '001': 100, '002': 50 },
        status: 'active',
        startTime: Date.now()
      };

      // ACT
      await persistenceService.saveSession(sessionData);
      const loaded = await persistenceService.loadSession('test-session-123');

      // ASSERT
      expect(loaded).toBeTruthy();
      expect(loaded.id).toBe('test-session-123');
      expect(loaded.teamScores['001']).toBe(100);
      expect(loaded.status).toBe('active');
    });

    it('should return null for non-existent session', async () => {
      // ACT
      const loaded = await persistenceService.loadSession('nonexistent-session');

      // ASSERT
      expect(loaded).toBeNull();
    });
  });

  describe('getAllSessions', () => {
    it('should return all sessions', async () => {
      // ARRANGE
      await persistenceService.saveSession({ id: 'session-1', data: 'first' });
      await persistenceService.saveSession({ id: 'session-2', data: 'second' });
      await persistenceService.save('not-a-session', { data: 'should not appear' });

      // ACT
      const sessions = await persistenceService.getAllSessions();

      // ASSERT
      expect(sessions).toHaveLength(2);
      expect(sessions.some(s => s.id === 'session-1')).toBe(true);
      expect(sessions.some(s => s.id === 'session-2')).toBe(true);
    });

    it('should return empty array when no sessions exist', async () => {
      // ACT
      const sessions = await persistenceService.getAllSessions();

      // ASSERT
      expect(sessions).toEqual([]);
    });
  });

  describe('delete operation', () => {
    it('should delete data by key', async () => {
      // ARRANGE
      await persistenceService.save('delete-test', { data: 'to be deleted' });

      // ACT
      await persistenceService.delete('delete-test');
      const loaded = await persistenceService.load('delete-test');

      // ASSERT
      expect(loaded).toBeNull();
    });
  });

  describe('exists operation', () => {
    it('should return true for existing key', async () => {
      // ARRANGE
      await persistenceService.save('exists-test', { data: 'exists' });

      // ACT
      const exists = await persistenceService.exists('exists-test');

      // ASSERT
      expect(exists).toBe(true);
    });

    it('should return false for non-existent key', async () => {
      // ACT
      const exists = await persistenceService.exists('nonexistent-key');

      // ASSERT
      expect(exists).toBe(false);
    });
  });

  describe('keys and values operations', () => {
    it('should return all keys', async () => {
      // ARRANGE
      await persistenceService.save('key1', { data: 'one' });
      await persistenceService.save('key2', { data: 'two' });

      // ACT
      const keys = await persistenceService.keys();

      // ASSERT
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys.length).toBeGreaterThanOrEqual(2);
    });

    it('should return all values', async () => {
      // ARRANGE
      await persistenceService.save('val-key1', { data: 'value1' });
      await persistenceService.save('val-key2', { data: 'value2' });

      // ACT
      const values = await persistenceService.values();

      // ASSERT
      expect(values.length).toBeGreaterThanOrEqual(2);
      expect(values.some(v => v.data === 'value1')).toBe(true);
      expect(values.some(v => v.data === 'value2')).toBe(true);
    });
  });

  describe('clear operation', () => {
    it('should clear all data', async () => {
      // ARRANGE
      await persistenceService.save('clear-key1', { data: 'one' });
      await persistenceService.save('clear-key2', { data: 'two' });

      // ACT
      await persistenceService.clear();
      const size = await persistenceService.size();

      // ASSERT
      expect(size).toBe(0);
    });
  });

  describe('size operation', () => {
    it('should return number of stored items', async () => {
      // ARRANGE
      await persistenceService.save('size-key1', { data: 'one' });
      await persistenceService.save('size-key2', { data: 'two' });

      // ACT
      const size = await persistenceService.size();

      // ASSERT
      expect(size).toBe(2);
    });

    it('should return zero for empty storage', async () => {
      // ACT
      const size = await persistenceService.size();

      // ASSERT
      expect(size).toBe(0);
    });
  });

  describe('saveGameState and loadGameState', () => {
    it('should save and load game state', async () => {
      // ARRANGE
      const gameState = {
        session: { id: 'test-session' },
        scores: { '001': 100 },
        videoStatus: { isPlaying: false }
      };

      // ACT
      await persistenceService.saveGameState(gameState);
      const loaded = await persistenceService.loadGameState();

      // ASSERT
      expect(loaded).toBeTruthy();
      expect(loaded.session.id).toBe('test-session');
      expect(loaded.scores['001']).toBe(100);
    });

    it('should return null when no game state exists', async () => {
      // ACT
      const loaded = await persistenceService.loadGameState();

      // ASSERT
      expect(loaded).toBeNull();
    });
  });

  describe('saveAdminConfig and loadAdminConfig', () => {
    it('should save and load admin config', async () => {
      // ARRANGE
      const adminConfig = {
        password: 'admin-password',
        features: { videoPlayback: true }
      };

      // ACT
      await persistenceService.saveAdminConfig(adminConfig);
      const loaded = await persistenceService.loadAdminConfig();

      // ASSERT
      expect(loaded).toBeTruthy();
      expect(loaded.password).toBe('admin-password');
      expect(loaded.features.videoPlayback).toBe(true);
    });
  });

  describe('saveTokens and loadTokens', () => {
    it('should save and load tokens', async () => {
      // ARRANGE
      const tokens = [
        { id: 'token1', type: 'video' },
        { id: 'token2', type: 'image' }
      ];

      // ACT
      await persistenceService.saveTokens(tokens);
      const loaded = await persistenceService.loadTokens();

      // ASSERT
      expect(loaded).toHaveLength(2);
      expect(loaded[0].id).toBe('token1');
      expect(loaded[1].type).toBe('image');
    });

    it('should return empty array when no tokens exist', async () => {
      // ACT
      const loaded = await persistenceService.loadTokens();

      // ASSERT
      expect(loaded).toEqual([]);
    });
  });

  describe('backupSession', () => {
    it('should create timestamped backup', async () => {
      // ARRANGE
      const session = { id: 'backup-test', data: 'important' };

      // ACT
      await persistenceService.backupSession(session);
      const keys = await persistenceService.keys();

      // ASSERT
      const backupKey = keys.find(k => k.startsWith('backup:session:backup-test:'));
      expect(backupKey).toBeTruthy();
    });
  });

  describe('archiveSession', () => {
    it('should archive session and delete active session', async () => {
      // ARRANGE
      const session = { id: 'archive-test', data: 'to archive' };
      await persistenceService.saveSession(session);

      // ACT
      await persistenceService.archiveSession(session);

      // ASSERT
      const active = await persistenceService.loadSession('archive-test');
      expect(active).toBeNull();

      const archived = await persistenceService.getArchivedSessions();
      expect(archived).toHaveLength(1);
      expect(archived[0].id).toBe('archive-test');
    });
  });

  describe('getArchivedSessions', () => {
    it('should return all archived sessions', async () => {
      // ARRANGE
      const session1 = { id: 'archived-1', data: 'first' };
      const session2 = { id: 'archived-2', data: 'second' };
      await persistenceService.archiveSession(session1);
      await persistenceService.archiveSession(session2);

      // ACT
      const archived = await persistenceService.getArchivedSessions();

      // ASSERT
      expect(archived).toHaveLength(2);
      expect(archived.some(s => s.id === 'archived-1')).toBe(true);
      expect(archived.some(s => s.id === 'archived-2')).toBe(true);
    });

    it('should return empty array when no archived sessions exist', async () => {
      // ACT
      const archived = await persistenceService.getArchivedSessions();

      // ASSERT
      expect(archived).toEqual([]);
    });
  });

  describe('cleanOldBackups', () => {
    it('should delete old backups when they exceed max age', async () => {
      // ARRANGE
      const session = { id: 'cleanup-test', data: 'old' };
      await persistenceService.backupSession(session);

      // Wait a tiny bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      // ACT - Clean backups older than 0 hours (immediate cleanup)
      const deleted = await persistenceService.cleanOldBackups(0);

      // ASSERT - Bug has been FIXED in production (commit 0e05b16d)
      // Fixed: ISO timestamp extraction uses parts.slice(3).join(':')
      // to handle colons in ISO 8601 format (2025-10-29T22:30:00.000Z)
      expect(deleted).toBe(1); // Backup correctly deleted
    });

    it('should return zero when no old backups exist', async () => {
      // ARRANGE
      const session = { id: 'recent-backup', data: 'recent' };
      await persistenceService.backupSession(session);

      // ACT - Clean backups older than 24 hours (backup is recent)
      const deleted = await persistenceService.cleanOldBackups(24);

      // ASSERT
      expect(deleted).toBe(0);
    });
  });
});
