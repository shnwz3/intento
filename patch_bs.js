const fs = require('fs');
const p = 'c:\\Users\\FEROZ RAHIL\\Desktop\\Intento\\intento-app\\src\\main\\services\\brain\\BrainService.js';
let content = fs.readFileSync(p, 'utf8');

const target = `    deleteBrain(id) {
        if (Object.keys(this.brains).length <= 1) {
            return this._failure('LAST_BRAIN', 'Cannot delete the only brain profile.');
        }
        if (!this.brains[id]) return this._failure('BRAIN_NOT_FOUND', 'Brain not found.');

        delete this.brains[id];
        if (this.activeBrainId === id) {
            this.activeBrainId = Object.keys(this.brains)[0];
        }

        const saveResult = this._saveToDisk();
        if (!saveResult.success) return saveResult;
        return this._success({ activeBrainId: this.activeBrainId });
    }`;

const replacement = `    deleteBrain(id) {
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

content = content.replace(target, replacement);
fs.writeFileSync(p, content, 'utf8');
