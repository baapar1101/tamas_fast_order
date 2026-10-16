import type { InvestorDashboardDTO, InvestorSettingsDTO } from '@tamas/shared';

export const INVESTOR_SETTINGS_KEY = 'INVESTOR_PANEL_CONFIG';

export const DEFAULT_INVESTOR_SETTINGS: InvestorSettingsDTO = {
  initialCapital: 10_000_000_000,
  investorSharePercent: 60,
  executorSharePercent: 40,
  companyLabel: 'سرمایه‌گذاری تماس مارکت',
};

export type InvestorRange = InvestorDashboardDTO['period']['range'];

function safeMoney(value: unknown): number {
  const number = Number(value ?? 0);
  return Number.isSafeInteger(number) && number >= 0 ? number : 0;
}

export function normalizeInvestorSettings(value: unknown): InvestorSettingsDTO {
  if (!value || typeof value !== 'object') return { ...DEFAULT_INVESTOR_SETTINGS };
  const source = value as Partial<InvestorSettingsDTO>;
  const investorShare = Math.min(100, Math.max(0, Number(source.investorSharePercent ?? 60)));
  const executorShare = 100 - investorShare;
  return {
    initialCapital: safeMoney(source.initialCapital ?? DEFAULT_INVESTOR_SETTINGS.initialCapital),
    investorSharePercent: investorShare,
    executorSharePercent: executorShare,
    companyLabel: String(source.companyLabel ?? DEFAULT_INVESTOR_SETTINGS.companyLabel).trim().slice(0, 120)
      || DEFAULT_INVESTOR_SETTINGS.companyLabel,
  };
}
