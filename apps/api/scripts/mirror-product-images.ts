import { closeDb } from '../src/db/client.js';
import { mirrorProductImages } from '../src/services/product-image-mirror.js';

const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
const concurrencyArg = process.argv.find((arg) => arg.startsWith('--concurrency='));
const limit = Math.max(1, Number(limitArg?.split('=')[1] ?? 100));
const concurrency = Math.max(1, Number(concurrencyArg?.split('=')[1] ?? 4));

let totalLocalized = 0;
let totalFailed = 0;

try {
  while (true) {
    const report = await mirrorProductImages({ limit, concurrency });
    totalLocalized += report.localizedImages;
    totalFailed += report.failedImages;
    console.log(JSON.stringify(report));
    if (report.remainingProducts === 0) break;
    if (report.processedProducts === 0 && report.localizedImages === 0) {
      console.error('No further progress is possible. Check the reported URLs and retry later.');
      process.exitCode = 1;
      break;
    }
  }
  console.log(`Image mirror finished: ${totalLocalized} localized, ${totalFailed} failed.`);
} finally {
  await closeDb();
}

