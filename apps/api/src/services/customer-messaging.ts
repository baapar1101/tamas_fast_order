import type { CustomerTelegramEvent } from './customer-telegram.js';

export async function sendCustomerNotification(
  userId: number | null | undefined,
  event: CustomerTelegramEvent,
  title: string,
  text: string,
  channels: { telegram?: boolean; bale?: boolean } = { telegram: true, bale: true },
): Promise<{ telegram: boolean; bale: boolean }> {
  const jobs: Array<Promise<boolean>> = [];
  const names: Array<'telegram' | 'bale'> = [];
  if (channels.telegram !== false) {
    names.push('telegram');
    jobs.push(import('./customer-telegram.js').then(({ sendCustomerTelegramNotification }) => sendCustomerTelegramNotification(userId, event, title, text)));
  }
  if (channels.bale !== false) {
    names.push('bale');
    jobs.push(import('./customer-bale.js').then(({ sendCustomerBaleNotification }) => sendCustomerBaleNotification(userId, event, title, text)));
  }
  const results = await Promise.allSettled(jobs);
  const delivered = { telegram: false, bale: false };
  results.forEach((result, index) => {
    const name = names[index];
    if (name) delivered[name] = result.status === 'fulfilled' && result.value;
  });
  return delivered;
}
