import { spawn } from 'node:child_process';
import path from 'node:path';
import { syncMobileApks } from './sync-mobile-apks.mjs';

const repositoryRoot = process.cwd();
const androidRoot = path.join(repositoryRoot, 'mobile', 'android');
const gradleCommand = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';

const exitCode = await new Promise((resolve, reject) => {
  const child = spawn(gradleCommand, ['assembleMotoristaDebug', 'assembleTransportadoraDebug'], { cwd: androidRoot, stdio: 'inherit' });
  child.on('error', reject);
  child.on('exit', code => resolve(code ?? 1));
});

if (exitCode !== 0) process.exit(exitCode);
await syncMobileApks();
console.log('APKs compilados e publicados na home pública.');
