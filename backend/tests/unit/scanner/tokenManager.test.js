/**
 * TokenManager Unit Tests (Scanner)
 * Tests token database management and fuzzy matching
 */

// Mock Debug
const DebugMock = {
    log: jest.fn()
};
global.Debug = DebugMock;

// Load actual DataManager class (now refactored to class-based)
const DataManagerClass = require('../../../../ALNScanner/js/core/dataManager');

// Create DataManager instance with minimal dependencies
const dataManagerInstance = new DataManagerClass({
    tokenManager: null, // Not needed for these tests
    settings: {},
    debug: DebugMock,
    uiManager: null,
    app: null
});

// Make DataManager instance available globally (as TokenManager expects)
global.DataManager = dataManagerInstance;

// Load TokenManager
const TokenManager = require('../../../../ALNScanner/js/core/tokenManager');

describe('TokenManager - Business Logic (Layer 1 Unit Tests)', () => {
    beforeEach(() => {
        // Reset state
        TokenManager.database = {};
        TokenManager.groupInventory = null;

        // Clear mock calls
        jest.clearAllMocks();
    });

    describe('Demo Data Loading', () => {
        it('should load demo data correctly', () => {
            TokenManager.loadDemoData();

            expect(TokenManager.database).toBeDefined();
            expect(Object.keys(TokenManager.database).length).toBeGreaterThan(0);
        });

        it('should include expected demo tokens', () => {
            TokenManager.loadDemoData();

            expect(TokenManager.database['a1b2c3d4']).toBeDefined();
            expect(TokenManager.database['deadbeef']).toBeDefined();
            expect(TokenManager.database['cafe1234']).toBeDefined();
        });

        it('should include complete Government Files group', () => {
            TokenManager.loadDemoData();

            const govTokens = Object.values(TokenManager.database)
                .filter(t => t.SF_Group.toLowerCase().includes('government'));

            expect(govTokens.length).toBeGreaterThanOrEqual(3);
        });

        it('should include incomplete Server Logs group', () => {
            TokenManager.loadDemoData();

            const serverTokens = Object.values(TokenManager.database)
                .filter(t => t.SF_Group.includes('Server Logs'));

            expect(serverTokens.length).toBe(2); // Only 2 out of 5
        });

        it('should build group inventory after loading demo data', () => {
            TokenManager.loadDemoData();

            expect(TokenManager.groupInventory).not.toBeNull();
            expect(typeof TokenManager.groupInventory).toBe('object');
        });
    });

    describe('Group Inventory Building', () => {
        beforeEach(() => {
            // Set up test database
            TokenManager.database = {
                "token1": {
                    "SF_RFID": "token1",
                    "SF_ValueRating": 3,
                    "SF_MemoryType": "Technical",
                    "SF_Group": "Test Group (x3)"
                },
                "token2": {
                    "SF_RFID": "token2",
                    "SF_ValueRating": 2,
                    "SF_MemoryType": "Technical",
                    "SF_Group": "Test Group (x3)"
                },
                "token3": {
                    "SF_RFID": "token3",
                    "SF_ValueRating": 4,
                    "SF_MemoryType": "Business",
                    "SF_Group": "Test Group (x3)"
                },
                "single1": {
                    "SF_RFID": "single1",
                    "SF_ValueRating": 5,
                    "SF_MemoryType": "Personal",
                    "SF_Group": "Single Token (x1)"
                }
            };
        });

        it('should build group inventory from database', () => {
            const inventory = TokenManager.buildGroupInventory();

            expect(inventory).toBeDefined();
            expect(typeof inventory).toBe('object');
        });

        it('should normalize group names for consistent matching', () => {
            const inventory = TokenManager.buildGroupInventory();

            // Verify inventory uses normalized names (lowercase, trimmed)
            const keys = Object.keys(inventory);
            keys.forEach(key => {
                expect(key).toBe(key.toLowerCase());
                expect(key).toBe(key.trim());
            });
        });

        it('should group tokens by normalized name', () => {
            const inventory = TokenManager.buildGroupInventory();

            const testGroupKey = 'test group';
            expect(inventory[testGroupKey]).toBeDefined();
            expect(inventory[testGroupKey].tokens.size).toBe(3);
        });

        it('should track multiplier for each group', () => {
            const inventory = TokenManager.buildGroupInventory();

            const testGroupKey = 'test group';
            expect(inventory[testGroupKey].multiplier).toBe(3);
        });

        it('should track all memory types in group', () => {
            const inventory = TokenManager.buildGroupInventory();

            const testGroupKey = 'test group';
            expect(inventory[testGroupKey].memoryTypes.size).toBe(2); // Technical + Business
            expect(inventory[testGroupKey].memoryTypes.has('Technical')).toBe(true);
            expect(inventory[testGroupKey].memoryTypes.has('Business')).toBe(true);
        });

        it('should handle single-token groups', () => {
            const inventory = TokenManager.buildGroupInventory();

            const singleGroupKey = 'single token';
            expect(inventory[singleGroupKey]).toBeDefined();
            expect(inventory[singleGroupKey].tokens.size).toBe(1);
        });

        it('should handle case variations in group names', () => {
            TokenManager.database = {
                "token1": {
                    "SF_RFID": "token1",
                    "SF_ValueRating": 3,
                    "SF_MemoryType": "Technical",
                    "SF_Group": "Government Files (x3)"
                },
                "token2": {
                    "SF_RFID": "token2",
                    "SF_ValueRating": 2,
                    "SF_MemoryType": "Technical",
                    "SF_Group": "government files (x3)" // lowercase variation
                }
            };

            const inventory = TokenManager.buildGroupInventory();
            const govGroupKey = 'government files';

            expect(inventory[govGroupKey]).toBeDefined();
            expect(inventory[govGroupKey].tokens.size).toBe(2); // Both tokens grouped together
        });
    });

    describe('Token Finding (Fuzzy Matching)', () => {
        beforeEach(() => {
            TokenManager.database = {
                "abc123": { SF_RFID: "abc123", SF_ValueRating: 3 },
                "DEADBEEF": { SF_RFID: "DEADBEEF", SF_ValueRating: 5 },
                "12:34:56:78": { SF_RFID: "12:34:56:78", SF_ValueRating: 2 },
                "cafebabe": { SF_RFID: "cafebabe", SF_ValueRating: 4 }
            };
        });

        it('should find token with direct match', () => {
            const result = TokenManager.findToken('abc123');

            expect(result).not.toBeNull();
            expect(result.token.SF_RFID).toBe('abc123');
            expect(result.matchedId).toBe('abc123');
        });

        it('should find token with case variation (lowercase)', () => {
            const result = TokenManager.findToken('deadbeef');

            expect(result).not.toBeNull();
            expect(result.token.SF_RFID).toBe('DEADBEEF');
            expect(result.matchedId).toBe('DEADBEEF');
        });

        it('should find token with case variation (uppercase)', () => {
            const result = TokenManager.findToken('ABC123');

            expect(result).not.toBeNull();
            expect(result.token.SF_RFID).toBe('abc123');
            expect(result.matchedId).toBe('abc123');
        });

        it('should find token without colons', () => {
            const result = TokenManager.findToken('12345678');

            expect(result).not.toBeNull();
            expect(result.token.SF_RFID).toBe('12:34:56:78');
            expect(result.matchedId).toBe('12:34:56:78');
        });

        it('should find token with colons removed and lowercase', () => {
            TokenManager.database = {
                "abcd1234": { SF_RFID: "abcd1234", SF_ValueRating: 3 }
            };

            const result = TokenManager.findToken('AB:CD:12:34');

            expect(result).not.toBeNull();
            expect(result.token.SF_RFID).toBe('abcd1234');
        });

        it('should add colons to hex strings if needed', () => {
            const result = TokenManager.findToken('cafebabe');

            expect(result).not.toBeNull();
            expect(result.token.SF_ValueRating).toBe(4);
        });

        it('should return null for non-existent token', () => {
            const result = TokenManager.findToken('doesnotexist');

            expect(result).toBeNull();
        });

        it('should handle empty string', () => {
            const result = TokenManager.findToken('');

            expect(result).toBeNull();
        });
    });

    describe('Group Inventory Caching', () => {
        beforeEach(() => {
            TokenManager.database = {
                "token1": {
                    "SF_RFID": "token1",
                    "SF_ValueRating": 3,
                    "SF_MemoryType": "Technical",
                    "SF_Group": "Test Group (x2)"
                }
            };
        });

        it('should return group inventory if already built', () => {
            const inventory1 = TokenManager.buildGroupInventory();
            TokenManager.groupInventory = inventory1;

            const inventory2 = TokenManager.getGroupInventory();

            expect(inventory2).toBe(inventory1); // Same reference
        });

        it('should build group inventory if not cached', () => {
            TokenManager.groupInventory = null;

            const inventory = TokenManager.getGroupInventory();

            expect(inventory).not.toBeNull();
            expect(typeof inventory).toBe('object');
        });

        it('should cache group inventory after building', () => {
            TokenManager.groupInventory = null;

            const inventory1 = TokenManager.getGroupInventory();
            const inventory2 = TokenManager.getGroupInventory();

            expect(inventory2).toBe(inventory1); // Same cached reference
        });
    });

    describe('Group Statistics', () => {
        beforeEach(() => {
            TokenManager.loadDemoData();
        });

        it('should log stats without crashing', () => {
            expect(() => {
                TokenManager.logGroupStats();
            }).not.toThrow();
        });

        it('should handle null inventory gracefully', () => {
            TokenManager.groupInventory = null;

            expect(() => {
                TokenManager.logGroupStats();
            }).not.toThrow();
        });

        it('should call Debug.log for stats output', () => {
            DebugMock.log.mockClear();

            TokenManager.logGroupStats();

            expect(DebugMock.log).toHaveBeenCalled();
        });
    });
});
