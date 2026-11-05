import { access, cp, mkdir } from 'node:fs/promises';
import path from 'node:path';

const repositoryRoot = process.cwd();
const outputRoot = path.join(repositoryRoot, 'apps', 'home-web', 'public', 'downloads');
const apkFiles = [
  ['mobile/android/app/build/outputs/apk/motorista/debug/app-motorista-debug.apk', 'encomendaszap-motorista.apk'],
  ['mobile/android/app/build/outputs/apk/transportadora/debug/app-transportadora-debug.apk', 'encomendaszap-transportadora.apk'],
];

export async function syncMobileApks() {
  await mkdir(outputRoot, { recursive: true });
  for (const [source, destination] of apkFiles) {
    const sourcePath = path.join(repositoryRoot, source);
    try {
      await access(sourcePath);
    } catch {
      throw new Error(`APK não encontrado: ${source}. Execute npm run build:mobile antes de sincronizar os downloads.`);
    }
    await cp(sourcePath, path.join(outputRoot, destination));
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await syncMobileApks();
  console.log('Downloads dos APKs atualizados em apps/home-web/public/downloads/.');
}
