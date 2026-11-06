import { access, cp, mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import path from 'node:path';
const run = promisify(execFile);
const root = process.cwd();
const output = path.join(root, 'apps/home-web/public/downloads');

export async function syncMobileApks() {
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  if (!sdk) throw new Error('Configure ANDROID_HOME para validar os APKs.');
  const versions = (await readdir(path.join(sdk, 'build-tools'))).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
  const bin = path.join(sdk, 'build-tools', versions.at(-1));
  async function info(file) {
    const {stdout} = await run(path.join(bin,'aapt'), ['dump','badging',file]);
    const match = stdout.match(/package: name='([^']+)' versionCode='(\d+)' versionName='([^']+)'/);
    if (!match) throw new Error('Metadados do APK inválidos.');
    const signed = await run(path.join(bin,'apksigner'), ['verify','--print-certs',file]);
    const certificates = [...signed.stdout.matchAll(/certificate SHA-256 digest: ([a-f0-9]+)/g)].map(item=>item[1]).sort();
    if (!certificates.length) throw new Error('APK sem assinatura válida.');
    return {packageName:match[1], versionCode:Number(match[2]), versionName:match[3], certificates};
  }
  const releases = [];
  for (const flavor of ['motorista','transportadora']) {
    const source = path.join(root, `mobile/android/app/build/outputs/apk/${flavor}/debug/app-${flavor}-debug.apk`);
    const destination = path.join(output, `encomendaszap-${flavor}.apk`);
    const metadata = await info(source);
    if (metadata.packageName !== `br.com.zapencomendas.${flavor}.debug`) throw new Error('Perfil do APK incorreto.');
    const bytes = await readFile(source);
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    let previousExists = false;
    try { await access(destination); previousExists = true; } catch {}
    if (previousExists) {
      const previous = await info(destination);
      const previousHash = createHash('sha256').update(await readFile(destination)).digest('hex');
      if (JSON.stringify(previous.certificates) !== JSON.stringify(metadata.certificates)) throw new Error(`Assinatura alterada: ${flavor}. Preserve a chave existente.`);
      if (metadata.versionCode < previous.versionCode || (sha256 !== previousHash && metadata.versionCode === previous.versionCode)) throw new Error(`Incremente versionCode: ${flavor}.`);
    }
    const {certificates, ...version} = metadata;
    releases.push({source,destination,manifest:{...version,flavor,sha256,size:bytes.length,apkUrl:`https://dotas.site/downloads/encomendaszap-${flavor}.apk`}});
  }
  await mkdir(output,{recursive:true});
  for (const release of releases) {
    await cp(release.source,release.destination+'.tmp');
    await rename(release.destination+'.tmp',release.destination);
    const manifestPath = path.join(output,release.manifest.flavor+'.json');
    await writeFile(manifestPath+'.tmp',JSON.stringify(release.manifest,null,2)+'\n');
    await rename(manifestPath+'.tmp',manifestPath);
  }
}
if (import.meta.url === `file://${process.argv[1]}`) await syncMobileApks();
