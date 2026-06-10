const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const src = path.join(root, 'data', 'site_data.json');
const dst = path.join(root, 'data', 'site_data.js');

const data = JSON.parse(fs.readFileSync(src, 'utf8').replace(/^\uFEFF/, ''));
fs.writeFileSync(dst, `export default ${JSON.stringify(data, null, 2)};\n`);
console.log(`Wrote ${dst}`);
