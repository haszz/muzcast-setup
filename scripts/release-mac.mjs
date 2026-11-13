// Public distribution only. Local/ad-hoc builds remain available with dist:mac.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

process.chdir(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
const run = (file, args, options = {}) => execFileSync(file, args, { encoding: 'utf8', ...options });

async function release() {
  if (process.platform !== 'darwin') throw Error('La publication Mac exige macOS.');
  const identity = process.env.MUZCAST_DEVELOPER_ID;
  if (!identity?.startsWith('Developer ID Application: ')) {
    throw Error('Définir MUZCAST_DEVELOPER_ID avec un certificat Developer ID Application. Apple Development et les signatures ad hoc ne sont pas acceptés.');
  }
  const identities = run('security', ['find-identity', '-v', '-p', 'codesigning']);
  if (!identities.includes(`"${identity}"`)) throw Error('Certificat Developer ID Application et clé privée introuvables dans le trousseau.');
  const profile = process.env.APPLE_KEYCHAIN_PROFILE;
  if (!profile) throw Error('APPLE_KEYCHAIN_PROFILE doit désigner un profil notarytool enregistré dans le trousseau.');
  // Avoid electron-builder choosing unrelated Apple API/password credentials first.
  for (const key of ['APPLE_ID', 'APPLE_APP_SPECIFIC_PASSWORD', 'APPLE_API_KEY', 'APPLE_API_KEY_ID', 'APPLE_API_ISSUER']) delete process.env[key];
  const auth = ['--keychain-profile', profile];
  if (process.env.APPLE_KEYCHAIN) auth.push('--keychain', process.env.APPLE_KEYCHAIN);
  run('xcrun', ['notarytool', 'history', ...auth, '--output-format', 'json']);
  if (process.argv.includes('--preflight')) {
    console.log('Certificat de distribution et accès notarisation disponibles. Aucun paquet créé.');
    return;
  }
  process.env.CSC_NAME = identity.replace(/^Developer ID Application: /, "");
  process.env.MUZCAST_NETWORK_SIGN_IDENTITY = identity;
  run('npm', ['run', 'build:relay'], { stdio: 'inherit' });
  run('npm', ['run', 'build'], { stdio: 'inherit' });
  // Unique output directory: never confuse previous unverified artifacts with this release.
  mkdirSync('dist', { recursive: true });
  const output = mkdtempSync(resolve('dist/public-mac-'));
  const { build, Platform, Arch } = await import('electron-builder');
  const artifacts = await build({
    targets: Platform.MAC.createTarget(['dmg'], Arch.arm64, Arch.x64),
    publish: 'never',
    config: {
      extends: './electron-builder.yml',
      directories: { output },
      forceCodeSigning: true,
      mac: {
        identity: process.env.CSC_NAME, hardenedRuntime: true, notarize: true,
        // Locale resource packs are sealed by their parent bundle, not executable code.
        signIgnore: ['\\.pak$'],
        entitlements: 'build/entitlements.public.plist',
        entitlementsInherit: 'build/entitlements.public.plist',
      },
    },
  });
  const dmgs = artifacts.filter(path => path.endsWith('.dmg'));
  if (dmgs.length !== 2) throw Error('Les deux DMG arm64 et x64 sont requis.');
  const verified = [];
  for (const dmg of dmgs) {
    const receipt = JSON.parse(run('xcrun', ['notarytool', 'submit', dmg, ...auth, '--wait', '--output-format', 'json']));
    if (receipt.status !== 'Accepted') throw Error(`Notarisation refusée : ${receipt.id} (${receipt.status}). Consulter notarytool log.`);
    run('xcrun', ['stapler', 'staple', dmg]);
    run('xcrun', ['stapler', 'validate', dmg]);
    const mounted = JSON.parse(run('plutil', ['-convert', 'json', '-o', '-', '-'], {
      input: run('hdiutil', ['attach', dmg, '-readonly', '-nobrowse', '-plist']),
    }));
    const mount = mounted['system-entities'].find(item => item['mount-point'])?.['mount-point'];
    if (!mount) throw Error('Impossible de vérifier le DMG monté.');
    try {
      const app = resolve(mount, 'MuzcastSetup.app');
      run('codesign', ['--verify', '--deep', '--strict', app]);
      run('xcrun', ['stapler', 'validate', app]);
      run('spctl', ['--assess', '--type', 'execute', '--verbose=2', app]);
    } finally {
      run('hdiutil', ['detach', mount]);
    }
    verified.push({ path: dmg, sha256: createHash('sha256').update(readFileSync(dmg)).digest('hex'), notarizationId: receipt.id });
  }
  writeFileSync(resolve(output, 'verified-mac-release.json'), JSON.stringify({ verifiedAt: new Date().toISOString(), identity, artifacts: verified }, null, 2) + '\n');
  console.log(`Paquets notarisés et vérifiés : ${output}. Publication réseau non effectuée.`);
}

release().catch(error => { console.error(error.message); process.exitCode = 1; });
