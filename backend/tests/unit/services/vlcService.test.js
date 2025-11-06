/**
 * Unit tests for VLC Service
 * Tests VLC HTTP interface integration with axios mocking
 */

const vlcService = require('../../../src/services/vlcService');
const axios = require('axios');

// Mock axios HTTP calls
jest.mock('axios');

describe('VLCService', () => {
  let mockAxiosInstance;

  beforeEach(() => {
    // Reset service state
    if (vlcService.reset) {
      vlcService.reset();
    }
    jest.clearAllMocks();

    // Create mock axios instance
    mockAxiosInstance = {
      get: jest.fn(),
    };

    // Mock axios.create to return our mock instance
    axios.create.mockReturnValue(mockAxiosInstance);
  });

  describe('init and checkConnection', () => {
    it('should initialize VLC client and connect successfully', async () => {
      // ARRANGE
      mockAxiosInstance.get.mockResolvedValue({
        status: 200,
        data: { version: '3.0.0', state: 'stopped' }
      });

      // ACT
      await vlcService.init();
      const isConnected = vlcService.isConnected();

      // ASSERT
      expect(axios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          auth: expect.objectContaining({
            username: '',
            password: expect.any(String)
          }),
          timeout: 5000
        })
      );
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/requests/status.json');
      expect(isConnected).toBe(true);
    });

    it('should handle connection failure gracefully', async () => {
      // ARRANGE
      mockAxiosInstance.get.mockRejectedValue(new Error('Connection refused'));

      // ACT
      await vlcService.init();
      const isConnected = vlcService.isConnected();

      // ASSERT
      // Service initializes but starts in disconnected state
      expect(isConnected).toBe(false);
      expect(axios.create).toHaveBeenCalled();
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/requests/status.json');
    });
  });

  describe('playVideo', () => {
    beforeEach(async () => {
      // Initialize connection for playVideo tests
      mockAxiosInstance.get.mockResolvedValue({
        status: 200,
        data: { state: 'playing' }
      });
      await vlcService.init();
      jest.clearAllMocks(); // Clear init calls
    });

    it('should send play command with file path', async () => {
      // ARRANGE
      mockAxiosInstance.get.mockResolvedValue({
        status: 200,
        data: { state: 'playing', loop: true } // Mock loop enabled so setLoop(false) will toggle
      });

      // ACT
      await vlcService.playVideo('test-video.mp4');

      // ASSERT
      // Verify pl_empty command was sent (clear playlist)
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/requests/status.json',
        expect.objectContaining({
          params: { command: 'pl_empty' }
        })
      );

      // Verify loop was toggled (setLoop uses pl_loop, not pl_repeat)
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/requests/status.json',
        expect.objectContaining({
          params: { command: 'pl_loop' }
        })
      );

      // Verify in_play command was sent with correct file path
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/requests/status.json',
        expect.objectContaining({
          params: expect.objectContaining({
            command: 'in_play',
            input: expect.stringContaining('test-video.mp4')
          })
        })
      );
    });

    it('should emit video:played event', (done) => {
      // ARRANGE
      mockAxiosInstance.get.mockResolvedValue({
        status: 200,
        data: { state: 'playing' }
      });

      // ACT
      vlcService.once('video:played', (videoPath) => {
        // ASSERT
        expect(videoPath).toBe('test.mp4');
        done();
      });

      vlcService.playVideo('test.mp4');
    });
  });

  describe('stop', () => {
    beforeEach(async () => {
      // Initialize connection for stop tests
      mockAxiosInstance.get.mockResolvedValue({
        status: 200,
        data: { state: 'stopped' }
      });
      await vlcService.init();
      jest.clearAllMocks();
    });

    it('should send stop command', async () => {
      // ARRANGE
      mockAxiosInstance.get.mockResolvedValue({ status: 200 });

      // ACT
      await vlcService.stop();

      // ASSERT
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/requests/status.json',
        expect.objectContaining({
          params: { command: 'pl_stop' }
        })
      );
    });
  });

  describe('getStatus', () => {
    beforeEach(async () => {
      // Initialize connection for getStatus tests
      mockAxiosInstance.get.mockResolvedValue({
        status: 200,
        data: { state: 'stopped' }
      });
      await vlcService.init();
      jest.clearAllMocks();
    });

    it('should parse VLC status response', async () => {
      // ARRANGE
      mockAxiosInstance.get.mockResolvedValue({
        status: 200,
        data: {
          state: 'playing',
          position: 0.5,
          length: 120,
          time: 60,
          volume: 128,
          fullscreen: false,
          information: {
            category: {
              meta: {
                filename: 'test-video.mp4'
              }
            }
          }
        }
      });

      // ACT
      const status = await vlcService.getStatus();

      // ASSERT
      expect(status.connected).toBe(true);
      expect(status.state).toBe('playing');
      expect(status.position).toBe(0.5);
      expect(status.length).toBe(120);
      expect(status.time).toBe(60);
      expect(status.volume).toBe(128);
      expect(status.currentItem).toBe('test-video.mp4');
    });

    it('should return disconnected status when not connected', async () => {
      // ARRANGE
      vlcService.connected = false;

      // ACT
      const status = await vlcService.getStatus();

      // ASSERT
      expect(status.connected).toBe(false);
      expect(status.state).toBe('disconnected');
      expect(status.currentItem).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      // ARRANGE
      mockAxiosInstance.get.mockRejectedValue(new Error('Timeout'));

      // ACT
      const status = await vlcService.getStatus();

      // ASSERT
      expect(status.connected).toBe(false);
      expect(status.state).toBe('error');
      expect(status.error).toBe('Timeout');
    });
  });
});
