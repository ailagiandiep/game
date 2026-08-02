const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const appSource = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

assert.ok(html.includes('id="btn-clear-names"'), 'Should render a clear-all names button in the setup form');
assert.ok(html.includes('Xoá tất cả'), 'Should label the clear-all button in Vietnamese');
assert.ok(appSource.includes('btnClearNames') || appSource.includes('btn-clear-names'), 'Should wire the clear-all button in the app script');

console.log('UI clear button test passed');
