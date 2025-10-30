/**
 * Unit Tests: FileStorage Persistence
 *
 * Tests file-based storage implementation details (paths, formats, persistence).
 * This validates storage mechanism, not session behavior (which is tested in E2E tests).
 *
 * @group unit
 * @priority medium
 */

const FileStorage = require('../../../src/storage/FileStorage');
const fs = require('fs').promises;
const path = require('path');

describe('FileStorage Persistence', () => {
  let storage;
  let testDir;

  beforeEach(async () => {
    testDir = path.join(__dirname, '../../fixtures/storage-test');
    storage = new FileStorage();
    await storage.init({ dataDir: testDir });
  });

  afterEach(async () => {
    // Cleanup test files
    try {
      const files = await fs.readdir(testDir);
      for (const file of files) {
        await fs.unlink(path.join(testDir, file));
      }
    } catch (err) {
      // Directory might not exist or be empty
    }
  });

  // ========================================
  // TEST 1: Save session to correct file path
  // ========================================

  test('saves session to correct file path with correct structure', async () => {
    const session = {
      id: 'test-session-123',
      name: 'Persistence Path Test',
      teams: ['001'],
      status: 'active',
      startTime: new Date().toISOString()
    };

    await storage.save(`session:${session.id}`, session);

    // Verify file exists at correct path
    const expectedPath = path.join(testDir, `session-${session.id}.json`);
    const stats = await fs.stat(expectedPath);
    expect(stats.isFile()).toBe(true);

    // Verify file contents
    const contents = await fs.readFile(expectedPath, 'utf-8');
    const loaded = JSON.parse(contents);
    expect(loaded).toEqual(session);

    console.log('✓ Session saved to correct path:', expectedPath);
  });

  // ========================================
  // TEST 2: Load session from file
  // ========================================

  test('loads session from file correctly', async () => {
    const session = {
      id: 'test-session-456',
      name: 'Load Test Session',
      teams: ['002', '003'],
      status: 'active',
      startTime: new Date().toISOString()
    };

    // Save session
    await storage.save(`session:${session.id}`, session);

    // Load session
    const loaded = await storage.load(`session:${session.id}`);
    expect(loaded).toEqual(session);

    console.log('✓ Session loaded correctly');
  });

  // ========================================
  // TEST 3: Update existing session file
  // ========================================

  test('updates existing session file', async () => {
    const session = {
      id: 'test-session-789',
      name: 'Update Test',
      teams: ['001'],
      status: 'active',
      startTime: new Date().toISOString()
    };

    // Save initial version
    await storage.save(`session:${session.id}`, session);

    // Update session
    const updatedSession = {
      ...session,
      status: 'ended',
      endTime: new Date().toISOString()
    };

    await storage.save(`session:${session.id}`, updatedSession);

    // Load and verify
    const loaded = await storage.load(`session:${session.id}`);
    expect(loaded.status).toBe('ended');
    expect(loaded.endTime).toBeDefined();

    console.log('✓ Session updated correctly');
  });

  // ========================================
  // TEST 4: Handle missing file gracefully
  // ========================================

  test('returns null for non-existent session', async () => {
    const loaded = await storage.load('session:non-existent');
    expect(loaded).toBeNull();

    console.log('✓ Non-existent session handled gracefully');
  });

  // ========================================
  // TEST 5: Persist multiple sessions
  // ========================================

  test('persists multiple sessions independently', async () => {
    const session1 = {
      id: 'session-1',
      name: 'Session 1',
      teams: ['001']
    };

    const session2 = {
      id: 'session-2',
      name: 'Session 2',
      teams: ['002']
    };

    // Save both
    await storage.save(`session:${session1.id}`, session1);
    await storage.save(`session:${session2.id}`, session2);

    // Verify both exist
    const files = await fs.readdir(testDir);
    expect(files).toContain(`session-${session1.id}.json`);
    expect(files).toContain(`session-${session2.id}.json`);

    // Load and verify
    const loaded1 = await storage.load(`session:${session1.id}`);
    const loaded2 = await storage.load(`session:${session2.id}`);

    expect(loaded1.name).toBe('Session 1');
    expect(loaded2.name).toBe('Session 2');

    console.log('✓ Multiple sessions persisted independently');
  });

  // ========================================
  // TEST 6: Delete session file
  // ========================================

  test('deletes session file correctly', async () => {
    const session = {
      id: 'test-session-delete',
      name: 'Delete Test',
      teams: ['001']
    };

    // Save session
    await storage.save(`session:${session.id}`, session);

    // Verify exists
    let loaded = await storage.load(`session:${session.id}`);
    expect(loaded).not.toBeNull();

    // Delete
    await storage.delete(`session:${session.id}`);

    // Verify deleted
    loaded = await storage.load(`session:${session.id}`);
    expect(loaded).toBeNull();

    console.log('✓ Session deleted correctly');
  });
});

/**
 * FILE STORAGE UNIT TEST SUCCESS CRITERIA:
 *
 * If all tests pass, FileStorage implementation is correct:
 * ✓ Files saved to correct paths
 * ✓ Files loaded correctly
 * ✓ Updates work
 * ✓ Missing files handled gracefully
 * ✓ Multiple sessions independent
 * ✓ Deletion works
 *
 * This validates storage mechanism - E2E tests validate session behavior
 */
