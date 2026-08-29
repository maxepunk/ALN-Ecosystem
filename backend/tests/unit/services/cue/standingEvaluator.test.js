'use strict';

/**
 * Standing Evaluator pinning tests.
 * Verifies extracted module produces identical outputs to original in-service logic.
 */

describe('standingEvaluator', () => {
  let standingEvaluator;

  beforeEach(() => {
    jest.resetModules();
    standingEvaluator = require('../../../../src/services/cue/standingEvaluator');
  });

  describe('CONDITION_OPS', () => {
    const { CONDITION_OPS } = require('../../../../src/services/cue/standingEvaluator');

    it('eq: returns true for equal values', () => {
      expect(CONDITION_OPS.eq('Business', 'Business')).toBe(true);
    });

    it('eq: returns false for unequal values', () => {
      expect(CONDITION_OPS.eq('Business', 'Personal')).toBe(false);
    });

    it('neq: returns true when values differ', () => {
      expect(CONDITION_OPS.neq('Business', 'Personal')).toBe(true);
    });

    it('gt: returns true when actual > expected', () => {
      expect(CONDITION_OPS.gt(50000, 40000)).toBe(true);
    });

    it('gte: returns true when actual === expected', () => {
      expect(CONDITION_OPS.gte(40000, 40000)).toBe(true);
    });

    it('lt: returns true when actual < expected', () => {
      expect(CONDITION_OPS.lt(3, 4)).toBe(true);
    });

    it('lte: returns true when actual === expected', () => {
      expect(CONDITION_OPS.lte(4, 4)).toBe(true);
    });

    it('in: returns true when value is in array', () => {
      expect(CONDITION_OPS.in('Technical', ['Business', 'Technical'])).toBe(true);
    });

    it('in: returns false when array not provided', () => {
      expect(CONDITION_OPS.in('Technical', null)).toBe(false);
    });
  });

  describe('evaluateConditions()', () => {
    const { evaluateConditions } = require('../../../../src/services/cue/standingEvaluator');

    it('returns true for empty conditions', () => {
      expect(evaluateConditions([], {})).toBe(true);
    });

    it('returns true when all conditions match', () => {
      expect(evaluateConditions(
        [{ field: 'memoryType', op: 'eq', value: 'Business' }],
        { memoryType: 'Business' }
      )).toBe(true);
    });

    it('returns false when any condition fails', () => {
      expect(evaluateConditions(
        [
          { field: 'memoryType', op: 'eq', value: 'Business' },
          { field: 'teamScore', op: 'gt', value: 100000 },
        ],
        { memoryType: 'Business', teamScore: 50000 }
      )).toBe(false);
    });

    it('returns false for unknown operator', () => {
      expect(evaluateConditions(
        [{ field: 'x', op: 'unknownOp', value: 1 }],
        { x: 1 }
      )).toBe(false);
    });

    it('fails closed for a prototype-named operator, never truthy off the chain (S6 review, F5-sec)', () => {
      // 'constructor'/'toString' resolve to Object.prototype members
      // under a truthy-index lookup and would evaluate truthy — a cue
      // that matches on everything. Object.hasOwn makes them unknown ops.
      expect(evaluateConditions([{ field: 'x', op: 'constructor', value: 1 }], { x: 1 })).toBe(false);
      expect(evaluateConditions([{ field: 'x', op: 'toString', value: 1 }], { x: 1 })).toBe(false);
      expect(evaluateConditions([{ field: 'x', op: 'valueOf', value: 1 }], { x: 1 })).toBe(false);
    });
  });

  describe('parseClockTime()', () => {
    const { parseClockTime } = require('../../../../src/services/cue/standingEvaluator');

    it('parses HH:MM:SS correctly', () => {
      expect(parseClockTime('01:00:00')).toBe(3600);
      expect(parseClockTime('00:30:00')).toBe(1800);
      expect(parseClockTime('00:00:30')).toBe(30);
      expect(parseClockTime('01:30:45')).toBe(5445);
    });

    it('throws for invalid format', () => {
      expect(() => parseClockTime('not-a-time')).toThrow(/invalid/i);
    });
  });

  describe('findMatchingClockCues() invalid-clock warn latch (S6 review, F5-state)', () => {
    const {
      findMatchingClockCues, resetClockWarnings,
    } = require('../../../../src/services/cue/standingEvaluator');
    const logger = require('../../../../src/utils/logger');

    it('warns ONCE per bad cue across many ticks, and re-warns after resetClockWarnings()', () => {
      resetClockWarnings();
      const cues = new Map([['bad', { id: 'bad', trigger: { clock: '90 minutes' } }]]);
      const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});
      try {
        // 10 ticks (a real show ticks ~7,200 times) — one warn total.
        for (let s = 0; s < 10; s++) findMatchingClockCues(cues, new Set(), new Set(), s);
        const badClockWarns = () => warnSpy.mock.calls.filter(([m]) => /invalid time/.test(m)).length;
        expect(badClockWarns()).toBe(1);

        // A new cue set (loadCues/reset) clears the latch → re-warns.
        resetClockWarnings();
        findMatchingClockCues(cues, new Set(), new Set(), 11);
        expect(badClockWarns()).toBe(2);
      } finally {
        warnSpy.mockRestore();
        resetClockWarnings();
      }
    });
  });

  describe("ENGINE_EVENT_NORMALIZERS['phase:changed'] (A3 slice 5 / B11)", () => {
    it('normalizes phase:changed to flat condition fields (phaseId eq ... authorable)', () => {
      const { EVENT_NORMALIZERS } = require('../../../../src/services/cue/standingEvaluator');
      const normalizer = EVENT_NORMALIZERS['phase:changed'];
      expect(normalizer).toBeDefined();

      const result = normalizer({
        phaseId: 'the-job',
        previousPhaseId: 'casing',
        label: 'The Job',
        elapsed: 1800,
        via: 'time',
      });

      expect(result).toEqual({
        phaseId: 'the-job',
        previousPhaseId: 'casing',
        label: 'The Job',
        elapsed: 1800,
        via: 'time',
      });
    });
  });
});

describe('cueVocabulary (game-event normalizers)', () => {
  let cueVocabulary;

  beforeEach(() => {
    jest.resetModules();
    cueVocabulary = require('../../../../src/gameRules/cueVocabulary');
  });

  describe('GAME_EVENT_NORMALIZERS', () => {
    it('normalizes transaction:accepted to flat fields', () => {
      const { GAME_EVENT_NORMALIZERS } = cueVocabulary;
      const normalizer = GAME_EVENT_NORMALIZERS['transaction:accepted'];
      expect(normalizer).toBeDefined();

      const result = normalizer({
        transaction: {
          tokenId: 'T1',
          teamId: 'Alpha',
          deviceType: 'gm',
          points: 50000,
          memoryType: 'Business',
          valueRating: 3,
          groupId: 'grp1',
        },
        teamScore: { currentScore: 100000 },
        groupBonus: { bonus: 50000 },
      });

      expect(result.tokenId).toBe('T1');
      expect(result.memoryType).toBe('Business');
      expect(result.valueRating).toBe(3);
      expect(result.groupId).toBe('grp1');
      expect(result.teamScore).toBe(100000);
      expect(result.hasGroupBonus).toBe(true);
    });

    it('normalizes group:completed to flat fields', () => {
      const { GAME_EVENT_NORMALIZERS } = cueVocabulary;
      const normalizer = GAME_EVENT_NORMALIZERS['group:completed'];

      const result = normalizer({
        teamId: 'Alpha',
        groupId: 'grp1',
        multiplier: 5,
        bonus: 250000,
      });

      expect(result.groupId).toBe('grp1');
      expect(result.multiplier).toBe(5);
    });
  });
});
