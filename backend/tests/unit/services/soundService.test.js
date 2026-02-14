'use strict';

const { EventEmitter } = require('events');

jest.mock('child_process');
jest.mock('fs');

describe('SoundService', () => {
  let soundService;
  let spawn;
  let fs;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    // Setup fs mock
    fs = require('fs');
    fs.existsSync = jest.fn(() => true);

    // Setup spawn mock - create fresh mock for each test
    const childProcess = require('child_process');
    const newMockProcess = new EventEmitter();
    newMockProcess.pid = 12345;
    newMockProcess.kill = jest.fn();
    newMockProcess.stdout = new EventEmitter();
    newMockProcess.stderr = new EventEmitter();

    spawn = childProcess.spawn;
    spawn.mockReturnValue(newMockProcess);

    soundService = require('../../../src/services/soundService');
    soundService.reset();
  });

  afterEach(() => {
    soundService.cleanup();
  });

  describe('play()', () => {
    it('should spawn pw-play with file path', () => {
      soundService.play({ file: 'fanfare.wav' });
      expect(spawn).toHaveBeenCalledWith(
        'pw-play',
        expect.arrayContaining([expect.stringContaining('fanfare.wav')]),
        expect.any(Object)
      );
    });

    it('should emit sound:started', () => {
      const handler = jest.fn();
      soundService.on('sound:started', handler);
      soundService.play({ file: 'fanfare.wav' });
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ file: 'fanfare.wav' })
      );
    });

    it('should accept optional target sink', () => {
      soundService.play({ file: 'fanfare.wav', target: 'bt-left' });
      expect(spawn).toHaveBeenCalledWith(
        'pw-play',
        expect.arrayContaining(['--target', 'bt-left']),
        expect.any(Object)
      );
    });

    it('should accept optional volume', () => {
      soundService.play({ file: 'fanfare.wav', volume: 80 });
      expect(spawn).toHaveBeenCalledWith(
        'pw-play',
        expect.arrayContaining(['--volume', '0.8']),
        expect.any(Object)
      );
    });

    it('should track running process', () => {
      soundService.play({ file: 'fanfare.wav' });
      expect(soundService.getPlaying()).toHaveLength(1);
      expect(soundService.getPlaying()[0].file).toBe('fanfare.wav');
    });
  });

  describe('stop()', () => {
    it('should kill process by filename', () => {
      const proc = new EventEmitter();
      proc.pid = 99;
      proc.kill = jest.fn();
      proc.stdout = new EventEmitter();
      proc.stderr = new EventEmitter();
      spawn.mockReturnValue(proc);

      soundService.play({ file: 'fanfare.wav' });
      soundService.stop({ file: 'fanfare.wav' });

      expect(proc.kill).toHaveBeenCalled();
    });

    it('should kill all processes when no file specified', () => {
      const procs = [];
      for (let i = 0; i < 3; i++) {
        const proc = new EventEmitter();
        proc.pid = 100 + i;
        proc.kill = jest.fn();
        proc.stdout = new EventEmitter();
        proc.stderr = new EventEmitter();
        procs.push(proc);
        spawn.mockReturnValueOnce(proc);
        soundService.play({ file: `sound${i}.wav` });
      }

      soundService.stop({});

      procs.forEach(proc => expect(proc.kill).toHaveBeenCalled());
    });
  });

  describe('process lifecycle', () => {
    it('should emit sound:completed when process exits with code 0', () => {
      const proc = new EventEmitter();
      proc.pid = 200;
      proc.kill = jest.fn();
      proc.stdout = new EventEmitter();
      proc.stderr = new EventEmitter();
      spawn.mockReturnValue(proc);

      const handler = jest.fn();
      soundService.on('sound:completed', handler);

      soundService.play({ file: 'fanfare.wav' });
      proc.emit('close', 0);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ file: 'fanfare.wav' })
      );
    });

    it('should remove from playing list after exit', () => {
      const proc = new EventEmitter();
      proc.pid = 300;
      proc.kill = jest.fn();
      proc.stdout = new EventEmitter();
      proc.stderr = new EventEmitter();
      spawn.mockReturnValue(proc);

      soundService.play({ file: 'fanfare.wav' });
      expect(soundService.getPlaying()).toHaveLength(1);

      proc.emit('close', 0);
      expect(soundService.getPlaying()).toHaveLength(0);
    });
  });
});
