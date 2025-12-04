const DataManager = require('../../../ALNScanner/src/core/dataManager');
console.log('Type:', typeof DataManager);
console.log('Is Class:', /^\s*class\s/.test(DataManager.toString()));
console.log('Keys:', Object.keys(DataManager));
if (typeof DataManager === 'object') {
    console.log('Prototype Keys:', Object.getOwnPropertyNames(Object.getPrototypeOf(DataManager)));
} else if (typeof DataManager === 'function') {
    console.log('Prototype Keys:', Object.getOwnPropertyNames(DataManager.prototype));
}
