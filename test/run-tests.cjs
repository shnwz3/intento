const fs = require('node:fs');
const path = require('node:path');

async function main() {
    const testDir = __dirname;
    const files = fs.readdirSync(testDir)
        .filter((file) => file.endsWith('.test.cjs'))
        .sort();

    let passed = 0;
    let failed = 0;

    for (const file of files) {
        const cases = require(path.join(testDir, file));
        for (const testCase of cases) {
            try {
                await testCase.run();
                passed += 1;
                console.log(`PASS ${file} - ${testCase.name}`);
            } catch (error) {
                failed += 1;
                console.error(`FAIL ${file} - ${testCase.name}`);
                console.error(error.stack || error.message);
            }
        }
    }

    console.log(`\n${passed} passed, ${failed} failed`);
    if (failed > 0) {
        process.exitCode = 1;
    }
}

main().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
});
