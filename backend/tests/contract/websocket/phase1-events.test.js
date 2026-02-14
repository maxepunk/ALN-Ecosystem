'use strict';

const { validateWebSocketEvent } = require('../../helpers/contract-validator');

describe('Phase 1 AsyncAPI Contract - New Events', () => {

  describe('gameclock:status', () => {
    it('should validate running status', () => {
      validateWebSocketEvent({
        event: 'gameclock:status',
        data: { state: 'running', elapsed: 3600 },
        timestamp: new Date().toISOString()
      }, 'gameclock:status');
    });

    it('should validate paused status', () => {
      validateWebSocketEvent({
        event: 'gameclock:status',
        data: { state: 'paused', elapsed: 1800 },
        timestamp: new Date().toISOString()
      }, 'gameclock:status');
    });

    it('should validate stopped status', () => {
      validateWebSocketEvent({
        event: 'gameclock:status',
        data: { state: 'stopped', elapsed: 0 },
        timestamp: new Date().toISOString()
      }, 'gameclock:status');
    });
  });

  describe('cue:fired', () => {
    it('should validate cue fired event', () => {
      validateWebSocketEvent({
        event: 'cue:fired',
        data: {
          cueId: 'business-sale',
          trigger: 'event:transaction:accepted',
          source: 'cue'
        },
        timestamp: new Date().toISOString()
      }, 'cue:fired');
    });
  });

  describe('cue:status', () => {
    it('should validate active cue status', () => {
      validateWebSocketEvent({
        event: 'cue:status',
        data: {
          cueId: 'opening-sequence',
          state: 'running'
        },
        timestamp: new Date().toISOString()
      }, 'cue:status');
    });
  });

  describe('cue:completed', () => {
    it('should validate cue completed event', () => {
      validateWebSocketEvent({
        event: 'cue:completed',
        data: { cueId: 'first-scan-fanfare' },
        timestamp: new Date().toISOString()
      }, 'cue:completed');
    });
  });

  describe('cue:error', () => {
    it('should validate cue error event', () => {
      validateWebSocketEvent({
        event: 'cue:error',
        data: {
          cueId: 'business-sale',
          action: 'sound:play',
          position: null,
          error: 'pw-play not found'
        },
        timestamp: new Date().toISOString()
      }, 'cue:error');
    });
  });

  describe('sound:status', () => {
    it('should validate sound status event', () => {
      validateWebSocketEvent({
        event: 'sound:status',
        data: {
          playing: [
            { file: 'fanfare.wav', target: 'combine-bt' }
          ]
        },
        timestamp: new Date().toISOString()
      }, 'sound:status');
    });
  });
});

describe('Phase 1 AsyncAPI Contract - gm:command actions', () => {
  const { getWebSocketSchema } = require('../../helpers/contract-validator');
  const yaml = require('js-yaml');
  const fs = require('fs');
  const path = require('path');

  // Load AsyncAPI spec to verify action enum
  const asyncapi = yaml.load(
    fs.readFileSync(path.join(__dirname, '../../../contracts/asyncapi.yaml'), 'utf8')
  );

  const newActions = [
    'session:start',
    'cue:fire', 'cue:stop', 'cue:pause', 'cue:resume',
    'cue:enable', 'cue:disable',
    'sound:play', 'sound:stop',
    'audio:volume:set'
  ];

  it('should include all Phase 1 actions in gm:command action enum', () => {
    // Find GmCommand message schema
    const gmCommandMessage = asyncapi.components.messages.GmCommand;
    expect(gmCommandMessage).toBeDefined();

    const actionEnum = gmCommandMessage.payload.properties.data.properties.action.enum;
    expect(actionEnum).toBeDefined();

    // Verify each new action is in the enum
    newActions.forEach(action => {
      expect(actionEnum).toContain(action);
    });
  });

  it('should validate gm:command with session:start action', () => {
    validateWebSocketEvent({
      event: 'gm:command',
      data: {
        action: 'session:start',
        payload: {}
      },
      timestamp: new Date().toISOString()
    }, 'gm:command');
  });

  it('should validate gm:command with cue:fire action', () => {
    validateWebSocketEvent({
      event: 'gm:command',
      data: {
        action: 'cue:fire',
        payload: {
          cueId: 'business-sale'
        }
      },
      timestamp: new Date().toISOString()
    }, 'gm:command');
  });

  it('should validate gm:command with sound:play action', () => {
    validateWebSocketEvent({
      event: 'gm:command',
      data: {
        action: 'sound:play',
        payload: {
          file: 'fanfare.wav',
          target: 'combine-bt'
        }
      },
      timestamp: new Date().toISOString()
    }, 'gm:command');
  });

  it('should validate gm:command with audio:volume:set action', () => {
    validateWebSocketEvent({
      event: 'gm:command',
      data: {
        action: 'audio:volume:set',
        payload: {
          volume: 75
        }
      },
      timestamp: new Date().toISOString()
    }, 'gm:command');
  });
});
