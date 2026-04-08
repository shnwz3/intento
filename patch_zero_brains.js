const fs = require('fs');
const p = 'c:\\Users\\FEROZ RAHIL\\Desktop\\Intento\\intento-app\\src\\main\\services\\brain\\BrainService.js';
let content = fs.readFileSync(p, 'utf8');

// 1. Remove _createInitialBrain from `_loadFromDisk` when length === 0
content = content.replace(
    /if \(Object\.keys\(this\.brains\)\.length === 0\) \{\s*this\._createInitialBrain\(\);\s*return;\s*\}/,
    `if (Object.keys(this.brains).length === 0) {\n                console.log('Brains loaded: 0 profiles');\n            }`
);

// 2. Fix activeBrainId assignment in `_loadFromDisk` to handle undefined
content = content.replace(
    /this\.activeBrainId = this\.brains\[data\.activeBrainId\] \? data\.activeBrainId : Object\.keys\(this\.brains\)\[0\];/,
    `this.activeBrainId = this.brains[data.activeBrainId] ? data.activeBrainId : (Object.keys(this.brains)[0] || null);`
);

// 3. Fix deleteBrain to allow completely emptying brains
const targetDelete = `    deleteBrain(id) {
        if (!this.brains[id]) return this._failure('BRAIN_NOT_FOUND', 'Brain not found.');

        if (Object.keys(this.brains).length <= 1) {
            this._createInitialBrain();
            return this._success({ activeBrainId: this.activeBrainId });
        }

        delete this.brains[id];
        if (this.activeBrainId === id) {
            this.activeBrainId = Object.keys(this.brains)[0];
        }

        const saveResult = this._saveToDisk();
        if (!saveResult.success) return saveResult;
        return this._success({ activeBrainId: this.activeBrainId });
    }`;

const newDelete = `    deleteBrain(id) {
        if (!this.brains[id]) return this._failure('BRAIN_NOT_FOUND', 'Brain not found.');

        delete this.brains[id];
        
        const remainingBrains = Object.keys(this.brains);
        if (this.activeBrainId === id || !this.brains[this.activeBrainId]) {
            this.activeBrainId = remainingBrains.length > 0 ? remainingBrains[0] : null;
        }

        const saveResult = this._saveToDisk();
        if (!saveResult.success) return saveResult;
        return this._success({ activeBrainId: this.activeBrainId });
    }`;

content = content.replace(targetDelete, newDelete);
fs.writeFileSync(p, content, 'utf8');
