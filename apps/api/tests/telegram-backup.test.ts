import assert from 'node:assert/strict';
import test from 'node:test';

process.env.DATABASE_URL ||= 'postgres://test:test@127.0.0.1:5432/test';
process.env.APP_SECRET ||= 'telegram-backup-test-secret';

const {
  getTehranClock,
  isTelegramBackupDue,
  parseTelegramBackupConfig,
} = await import('../src/services/telegram-backup.js');

test('normalizes Telegram backup settings with safe defaults and limits', () => {
  assert.deepEqual(parseTelegramBackupConfig({}), {
    enabled: false,
    time: '03:00',
    groupId: '',
    retentionDays: 3,
  });
  assert.deepEqual(parseTelegramBackupConfig({
    TELEGRAM_BACKUP_ENABLED: 'true',
    TELEGRAM_BACKUP_TIME: '7:05',
    TELEGRAM_BACKUP_GROUP_ID: ' managers ',
    TELEGRAM_BACKUP_RETENTION_DAYS: '99',
  }), {
    enabled: true,
    time: '07:05',
    groupId: 'managers',
    retentionDays: 30,
  });
});

test('calculates the schedule in Tehran and only sends once per local day', () => {
  const now = new Date('2026-10-23T00:10:00.000Z');
  const clock = getTehranClock(now);
  assert.deepEqual(clock, { date: '2026-10-23', time: '03:40', hour: 3, minute: 40 });

  const config = { enabled: true, time: '03:30', groupId: 'private-admins', retentionDays: 3 };
  assert.equal(isTelegramBackupDue(config, clock, undefined, undefined, now), true);
  assert.equal(isTelegramBackupDue(config, clock, '2026-10-23', undefined, now), false);
  assert.equal(isTelegramBackupDue({ ...config, time: '04:00' }, clock, undefined, undefined, now), false);
  assert.equal(isTelegramBackupDue(config, clock, undefined, '2026-10-23T00:00:00.000Z', now), false);
  assert.equal(isTelegramBackupDue(config, clock, undefined, '2026-10-22T23:39:00.000Z', now), true);
});
