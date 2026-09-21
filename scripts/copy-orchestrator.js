const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const binaryName = process.platform === 'win32' ? 'devflow-orchestrator.exe' : 'devflow-orchestrator';
const source = path.join(root, 'rust', 'orchestrator', 'target', 'release', binaryName);
const destinationDir = path.join(root, 'dist-electron', 'bin');
const destination = path.join(destinationDir, binaryName);

if (!fs.existsSync(source)) {
  throw new Error(`Rust orchestrator binary not found at ${source}`);
}
fs.mkdirSync(destinationDir, { recursive: true });
fs.copyFileSync(source, destination);
if (process.platform !== 'win32') fs.chmodSync(destination, 0o755);
console.log(`[orchestrator] copied ${source} -> ${destination}`);

