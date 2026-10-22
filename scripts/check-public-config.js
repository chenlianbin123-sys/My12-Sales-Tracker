const fs = require('node:fs');
const cp = require('node:child_process');
const path = require('node:path');

const root = path.join(__dirname, '..');
const files = cp.execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
const findings = [];
const credentialPatterns = [
  /AKID[A-Za-z0-9]{16,}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /(?:secretId|secretKey|access_token|password)\s*[:=]\s*["'][^"']+["']/i
];
for (const file of files) {
  const absolute = path.join(root, file);
  if (!fs.existsSync(absolute)) continue;
  if (/(?:^|\/)project\.private\.config\.json$|\.(?:pem|key)$/.test(file)) {
    findings.push(`${file}: local/private file must not be tracked`);
  }
  const text = fs.readFileSync(absolute, 'utf8');
  if (credentialPatterns.some(pattern => pattern.test(text))) findings.push(`${file}: possible credential; inspect locally (value withheld)`);
}
const config = JSON.parse(fs.readFileSync(path.join(root, 'project.config.json'), 'utf8'));
if (config.appid !== 'YOUR_APPID') findings.push('project.config.json: public AppID must remain a placeholder');
const app = fs.readFileSync(path.join(root, 'miniprogram/app.js'), 'utf8');
if (!/env:\s*["']YOUR_CLOUD_ENV_ID["']/.test(app)) findings.push('miniprogram/app.js: public cloud environment must remain a placeholder');
if (findings.length) {
  console.error(findings.join('\n'));
  process.exitCode = 1;
} else {
  console.log('Public configuration checks passed. Pattern checks do not certify the absence of secrets.');
}
