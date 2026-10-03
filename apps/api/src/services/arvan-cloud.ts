import { getAllSettings } from './settings.js';

const DEFAULT_BASE_URL = 'https://napi.arvancloud.ir/cdn/4.0';
const VALID_PERIODS = new Set(['1h', '3h', '6h', '12h', '24h', '7d', '30d']);

export type ArvanReportPeriod = '1h' | '3h' | '6h' | '12h' | '24h' | '7d' | '30d';

export interface ArvanAnalytics {
  configured: true;
  domain: string;
  period: ArvanReportPeriod;
  totalVisitors: number;
  peakAt: string | null;
  chart: Array<{ at: string; visitors: number }>;
  requests: { total: number; saved: number };
  traffic: { total: number; saved: number };
  fetchedAt: string;
}

interface ArvanConfig {
  baseUrl: string;
  domain: string;
  apiKey: string;
  secretKey: string;
}

type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
}

function number(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function numberArray(value: unknown): number[] {
  return Array.isArray(value) ? value.map(number) : [];
}

function cleanDomain(value: string): string {
  return value.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '').replace(/\.$/, '').toLowerCase();
}

function normalizeAuthorization(value: string): string {
  const key = value.trim();
  if (/^(apikey|bearer)\s+/i.test(key)) return key;
  return `Apikey ${key}`;
}

export function parseArvanPeriod(value: unknown): ArvanReportPeriod {
  const period = String(value ?? '24h');
  return (VALID_PERIODS.has(period) ? period : '24h') as ArvanReportPeriod;
}

export async function getArvanConfig(): Promise<ArvanConfig> {
  const settings = await getAllSettings();
  return {
    baseUrl: (settings.ARVAN_CDN_API_BASE || DEFAULT_BASE_URL).trim().replace(/\/+$/, ''),
    domain: cleanDomain(settings.ARVAN_CDN_DOMAIN || settings.custom_domain || ''),
    apiKey: (settings.private_ARVAN_API_KEY || settings.ARVAN_API_KEY || '').trim(),
    secretKey: (settings.private_ARVAN_SECRET_KEY || settings.ARVAN_SECRET_KEY || '').trim(),
  };
}

export async function isArvanConfigured(): Promise<boolean> {
  const config = await getArvanConfig();
  return Boolean(config.domain && (config.apiKey || config.secretKey));
}

async function request(config: ArvanConfig, path: string, period: ArvanReportPeriod): Promise<JsonObject> {
  if (!config.domain) throw new Error('دامنه CDN اروان تنظیم نشده است.');
  if (!config.apiKey && !config.secretKey) throw new Error('کلید API اروان تنظیم نشده است.');

  const url = new URL(`${config.baseUrl}/domains/${encodeURIComponent(config.domain)}${path}`);
  url.searchParams.set('period', period);

  // CDN v4 documents one API key in the Authorization header. Some machine-user
  // screens expose a key/secret pair, so try the API key first and the secret as
  // a safe fallback on an authentication failure.
  const candidates = [...new Set([config.apiKey, config.secretKey].filter(Boolean))];
  let lastStatus = 0;
  let lastMessage = '';

  for (const credential of candidates) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch(url, {
        headers: {
          accept: 'application/json',
          authorization: normalizeAuthorization(credential),
        },
        signal: controller.signal,
      });
      lastStatus = response.status;
      const payload = object(await response.json().catch(() => ({})));
      if (response.ok) return payload;
      const errors = object(payload.errors);
      lastMessage = String(payload.message || payload.error || Object.values(errors)[0] || '');
      if (response.status !== 401 && response.status !== 403) break;
    } catch (error) {
      if ((error as Error).name === 'AbortError') throw new Error('پاسخ اروان کلاد بیش از حد طول کشید.');
      throw new Error('ارتباط با سرویس CDN اروان برقرار نشد.');
    } finally {
      clearTimeout(timeout);
    }
  }

  if (lastStatus === 401 || lastStatus === 403) throw new Error('کلید دسترسی اروان معتبر نیست یا مجوز مشاهده گزارش CDN را ندارد.');
  if (lastStatus === 404) throw new Error('دامنه در حساب CDN اروان پیدا نشد.');
  if (lastStatus === 422) throw new Error('بازه گزارش برای پلن فعلی دامنه قابل استفاده نیست.');
  throw new Error(lastMessage ? `خطای اروان کلاد: ${lastMessage}` : `دریافت گزارش اروان ناموفق بود (کد ${lastStatus || 'شبکه'}).`);
}

export async function getArvanAnalytics(period: ArvanReportPeriod): Promise<ArvanAnalytics> {
  const config = await getArvanConfig();
  const [visitorPayload, savedPayload] = await Promise.all([
    request(config, '/reports/visitors', period),
    request(config, '/reports/traffics/saved', period),
  ]);

  const visitorData = object(visitorPayload.data);
  const visitorStats = object(object(visitorData.statistics).visitors);
  const visitorChart = object(object(visitorData.charts).visitors);
  const categories = stringArray(visitorChart.categories);
  const series = Array.isArray(visitorChart.series) ? object(visitorChart.series[0]) : {};
  const values = numberArray(series.data);

  const savedData = object(savedPayload.data);
  const savedStats = object(savedData.statistics);
  const requestStats = object(savedStats.request);
  const trafficStats = object(savedStats.traffic);

  return {
    configured: true,
    domain: config.domain,
    period,
    totalVisitors: number(visitorStats.total_visitors),
    peakAt: visitorStats.top_visitors ? String(visitorStats.top_visitors) : null,
    chart: categories.map((at, index) => ({ at, visitors: values[index] ?? 0 })),
    requests: { total: number(requestStats.total), saved: number(requestStats.saved) },
    traffic: { total: number(trafficStats.total), saved: number(trafficStats.saved) },
    fetchedAt: new Date().toISOString(),
  };
}
