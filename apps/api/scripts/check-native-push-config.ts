import { verifyNativePushConfiguration } from '../src/services/native-push.js';
import { closeDb } from '../src/db/client.js';
try { console.log(JSON.stringify(await verifyNativePushConfiguration())); }
catch (error) { console.error(error instanceof Error ? error.message : 'FCM validation failed'); process.exitCode=1; }
finally { await closeDb(); }
