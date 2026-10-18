/** Safely preview or apply a local Excel stock upload on the production host. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { closeDb } from '../src/db/client.js';
import { processExcelUpload } from '../src/services/sheets/excel-sync.js';

const pathArg = process.argv.find((arg) => arg.startsWith('--file='))?.slice('--file='.length);
const apply = process.argv.includes('--apply');
const expectedPlanHash = process.argv.find((arg) => arg.startsWith('--plan-hash='))?.slice('--plan-hash='.length);

try {
  if (!pathArg) throw new Error('مسیر فایل را با --file=/path/to/file.xlsx وارد کنید.');
  if (apply && !expectedPlanHash) throw new Error('برای اعمال، هش پیش‌نمایش را با --plan-hash=... وارد کنید.');
  const buffer = await readFile(resolve(pathArg));
  const report = await processExcelUpload(buffer, { dryRun: !apply, expectedPlanHash });
  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run',
    totalRows: report.totalRows,
    updated: report.updated,
    skipped: report.skipped,
    planHash: report.planHash,
    backupPath: report.backupPath,
    errorCount: report.errors.length,
    examples: report.errors.slice(0, 12),
  }, null, 2));
} finally {
  await closeDb();
}
