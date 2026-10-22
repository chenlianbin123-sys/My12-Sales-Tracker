const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const root = path.join(__dirname, '..');
let count = 0;
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (file.endsWith('.js')) {
      const result = cp.spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
      if (result.status !== 0) { console.error(result.stderr || result.error || file); process.exit(1); }
      count++;
    } else if (file.endsWith('.json')) {
      JSON.parse(fs.readFileSync(file, 'utf8'));
    }
  }
}
for (const dir of ['miniprogram', 'cloudfunctions', 'scripts', 'tests']) walk(path.join(root, dir));
console.log(`JavaScript syntax checked: ${count} files; JSON parsed successfully.`);
