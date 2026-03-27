const assert = require('node:assert/strict');

const {
    cleanText,
    isRefusal,
    isLowQuality,
} = require('../src/main/services/vision/utils/textCleaner');

module.exports = [
    {
        name: 'cleanText removes wrappers and quotes',
        run() {
            const input = '```json\n"Sure: hello there"\n```';
            assert.equal(cleanText(input), 'hello there');
        },
    },
    {
        name: 'isRefusal catches common refusal phrases',
        run() {
            assert.equal(isRefusal("I'm sorry, I can't help with that."), true);
            assert.equal(isRefusal('Here is the answer.'), false);
        },
    },
    {
        name: 'isLowQuality only rejects empty responses',
        run() {
            assert.equal(isLowQuality(''), true);
            assert.equal(isLowQuality('Yes'), false);
        },
    },
];
