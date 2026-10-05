const STORAGE_KEY = 'tamas_acquisition_v1';
const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

export interface AcquisitionAttribution {
  source: string;
  medium?: string;
  campaign?: string;
  referrer?: string;
  landingPage?: string;
  capturedAt: number;
}

function inferSource(referrer: string): { source: string; medium: string } {
  if (!referrer) return { source: 'direct', medium: 'direct' };
  try {
    const host = new URL(referrer).hostname.toLowerCase();
    if (host.includes('google.')) return { source: 'google', medium: 'organic' };
    if (host.includes('instagram.')) return { source: 'instagram', medium: 'social' };
    if (host.includes('t.me') || host.includes('telegram.')) return { source: 'telegram', medium: 'social' };
    if (host.includes('whatsapp.')) return { source: 'whatsapp', medium: 'social' };
    if (host.includes('eitaa.')) return { source: 'eitaa', medium: 'social' };
    if (host === window.location.hostname) return { source: 'direct', medium: 'internal' };
    return { source: host.replace(/^www\./, ''), medium: 'referral' };
  } catch {
    return { source: 'direct', medium: 'direct' };
  }
}

export function captureAttribution(): void {
  try {
    const params = new URLSearchParams(window.location.search);
    const explicit = params.get('utm_source') || params.get('ref') || params.get('source');
    const previous = readAttribution();
    if (!explicit && previous) return;

    const inferred = inferSource(document.referrer);
    const value: AcquisitionAttribution = {
      source: (explicit || inferred.source).trim().slice(0, 120).toLowerCase(),
      medium: (params.get('utm_medium') || inferred.medium).trim().slice(0, 120).toLowerCase(),
      campaign: (params.get('utm_campaign') || '').trim().slice(0, 200) || undefined,
      referrer: document.referrer.slice(0, 1000) || undefined,
      landingPage: `${window.location.pathname}${window.location.search}`.slice(0, 1000),
      capturedAt: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Attribution must never interfere with shopping or checkout.
  }
}

export function readAttribution(): AcquisitionAttribution | undefined {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    const value = JSON.parse(raw) as AcquisitionAttribution;
    if (!value.source || !value.capturedAt || Date.now() - value.capturedAt > MAX_AGE_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return undefined;
    }
    return value;
  } catch {
    return undefined;
  }
}
