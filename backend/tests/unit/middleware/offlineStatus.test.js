/**
 * Unit tests for Offline Status Middleware
 * Tests middleware functions directly without Express/WebSocket
 */

describe('Offline Status Middleware', () => {
  let middleware;
  let mockOfflineQueueService;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    // Mock the offline queue service
    mockOfflineQueueService = {
      isOffline: false,
      setOfflineStatus: jest.fn((status) => {
        mockOfflineQueueService.isOffline = status;
      })
    };

    // Mock the require for offlineQueueService
    jest.doMock('../../../src/services/offlineQueueService', () => mockOfflineQueueService);

    // Get the middleware functions
    middleware = require('../../../src/middleware/offlineStatus');
  });

  describe('offlineStatusMiddleware', () => {
    test('adds offline status to request object', () => {
      const req = {};
      const res = { locals: {} };
      const next = jest.fn();

      mockOfflineQueueService.isOffline = true;

      middleware.offlineStatusMiddleware(req, res, next);

      expect(req.isOffline).toBe(true);
      expect(res.locals.offlineMode).toBe(true);
      expect(next).toHaveBeenCalled();
    });

    test('sets false when service is online', () => {
      const req = {};
      const res = { locals: {} };
      const next = jest.fn();

      mockOfflineQueueService.isOffline = false;

      middleware.offlineStatusMiddleware(req, res, next);

      expect(req.isOffline).toBe(false);
      expect(res.locals.offlineMode).toBe(false);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('isOffline', () => {
    test('returns true when service is offline', () => {
      mockOfflineQueueService.isOffline = true;

      const result = middleware.isOffline();

      expect(result).toBe(true);
    });

    test('returns false when service is online', () => {
      mockOfflineQueueService.isOffline = false;

      const result = middleware.isOffline();

      expect(result).toBe(false);
    });

    test('returns false when service status is undefined', () => {
      mockOfflineQueueService.isOffline = undefined;

      const result = middleware.isOffline();

      expect(result).toBe(false);
    });
  });

  describe('setOfflineStatus', () => {
    test('updates service offline status to true', () => {
      middleware.setOfflineStatus(true);

      expect(mockOfflineQueueService.setOfflineStatus).toHaveBeenCalledWith(true);
      expect(mockOfflineQueueService.isOffline).toBe(true);
    });

    test('updates service offline status to false', () => {
      mockOfflineQueueService.isOffline = true;

      middleware.setOfflineStatus(false);

      expect(mockOfflineQueueService.setOfflineStatus).toHaveBeenCalledWith(false);
      expect(mockOfflineQueueService.isOffline).toBe(false);
    });
  });

  describe('initializeWithService', () => {
    test('sets the service instance', () => {
      const customService = {
        isOffline: true,
        setOfflineStatus: jest.fn()
      };

      middleware.initializeWithService(customService);

      // Test that it uses the custom service
      const result = middleware.isOffline();
      expect(result).toBe(true);
    });
  });

  // getService is an internal method not exported, so we don't test it
  // This follows proper unit testing principles - test public API only
});