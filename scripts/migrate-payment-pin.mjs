/** Run once BEFORE pulling the release on the server. Never prints a secret. */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const envPath = resolve(root, '.env');
const envText = await readFile(envPath, 'utf8');
if (/^AQAYEPARDAKHT_PIN=.+$/m.test(envText)) {
  console.log('Payment environment is already configured.');
} else {
  const legacy = await readFile(resolve(root, 'payment/index.js'), 'utf8');
  const pin = legacy.match(/const\s+PIN\s*=\s*["']([A-Za-z0-9]+)["']/)?.[1];
  if (!pin) throw new Error('No legacy payment configuration found; configure AQAYEPARDAKHT_PIN before deployment.');
  if (!process.argv.includes('--write')) {
    console.log('Legacy payment configuration can be migrated. Run with --write to apply.');
  } else {
    await writeFile(`${envPath}.payment-migration.bak`, envText, { mode: 0o600, flag: 'wx' });
    const withoutEmptyPin = envText.replace(/^AQAYEPARDAKHT_PIN=.*$/gm, '');
    await writeFile(envPath, `${withoutEmptyPin.trimEnd()}\nAQAYEPARDAKHT_PIN=${pin}\n`, { mode: 0o600 });
    console.log('Payment configuration migrated to the server environment.');
  }
}
