import type {
  AdminOrderInvestmentDTO,
  InvestorDashboardDTO,
  InvestorSettingsDTO,
  WarehouseInvestmentSummaryDTO,
} from '@tamas/shared';

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

export function calculateOrderInvestment(
  order: {
    total: number;
    subtotal: number;
    paymentStatus: 'paid' | 'unpaid' | 'pending';
    status: string;
    items: Array<{ qty: number; price: number; costPrice: number; investorFinanced: boolean }>;
  },
  settings: InvestorSettingsDTO,
): AdminOrderInvestmentDTO {
  let costOfGoodsSold = 0;
  let totalUnits = 0;
  let valuedUnits = 0;
  let financedSubtotal = 0;
  for (const item of order.items) {
    if (!item.investorFinanced) continue;
    const qty = Math.max(0, Number(item.qty) || 0);
    const price = Math.max(0, Number(item.price) || 0);
    const costPrice = Math.max(0, Number(item.costPrice) || 0);
    totalUnits += qty;
    financedSubtotal += qty * price;
    costOfGoodsSold += qty * costPrice;
    if (costPrice > 0) valuedUnits += qty;
  }
  const subtotal = Math.max(0, Number(order.subtotal) || 0);
  const financedSales = subtotal > 0
    ? Math.round(Math.max(0, Number(order.total) || 0) * financedSubtotal / subtotal)
    : 0;
  const grossProfit = financedSales - costOfGoodsSold;
  const distributableProfit = Math.max(0, grossProfit);
  const investorShare = Math.round(distributableProfit * settings.investorSharePercent / 100);
  return {
    financedSales,
    financedUnits: totalUnits,
    costOfGoodsSold,
    grossProfit,
    grossMarginPercent: financedSales ? Number(((grossProfit / financedSales) * 100).toFixed(1)) : 0,
    distributableProfit,
    investorShare,
    executorShare: distributableProfit - investorShare,
    investorSharePercent: settings.investorSharePercent,
    executorSharePercent: settings.executorSharePercent,
    costCoveragePercent: totalUnits ? Number(((valuedUnits / totalUnits) * 100).toFixed(1)) : 100,
    realized: order.paymentStatus === 'paid' && order.status !== 'cancelled',
  };
}

export function calculateWarehouseInvestment(
  productRows: Array<{ stock: number; kermanStock: number; tehranStock: number; costPrice: number }>,
  settings: InvestorSettingsDTO,
): WarehouseInvestmentSummaryDTO {
  const buckets = [
    { warehouse: 'kerman' as const, label: 'انبار کرمان', units: 0, valuedUnits: 0, inventoryValue: 0 },
    { warehouse: 'tehran' as const, label: 'انبار تهران', units: 0, valuedUnits: 0, inventoryValue: 0 },
    { warehouse: 'site' as const, label: 'موجودی عمومی سایت', units: 0, valuedUnits: 0, inventoryValue: 0 },
  ];
  let productsWithoutCost = 0;
  for (const product of productRows) {
    const costPrice = Math.max(0, Number(product.costPrice) || 0);
    const kerman = Math.max(0, Number(product.kermanStock) || 0);
    const tehran = Math.max(0, Number(product.tehranStock) || 0);
    const site = kerman + tehran === 0 ? Math.max(0, Number(product.stock) || 0) : 0;
    const quantities = [kerman, tehran, site];
    if (costPrice === 0 && quantities.some((quantity) => quantity > 0)) productsWithoutCost += 1;
    quantities.forEach((quantity, index) => {
      const bucket = buckets[index]!;
      bucket.units += quantity;
      bucket.inventoryValue += quantity * costPrice;
      if (costPrice > 0) bucket.valuedUnits += quantity;
    });
  }
  const warehouses = buckets.map((bucket) => {
    const investorValue = Math.round(bucket.inventoryValue * settings.investorSharePercent / 100);
    return {
      ...bucket,
      investorValue,
      executorValue: bucket.inventoryValue - investorValue,
      costCoveragePercent: bucket.units ? Number(((bucket.valuedUnits / bucket.units) * 100).toFixed(1)) : 100,
    };
  });
  const units = warehouses.reduce((sum, bucket) => sum + bucket.units, 0);
  const valuedUnits = warehouses.reduce((sum, bucket) => sum + bucket.valuedUnits, 0);
  const inventoryValue = warehouses.reduce((sum, bucket) => sum + bucket.inventoryValue, 0);
  const investorValue = Math.round(inventoryValue * settings.investorSharePercent / 100);
  return {
    settings,
    totals: {
      units,
      valuedUnits,
      inventoryValue,
      investorValue,
      executorValue: inventoryValue - investorValue,
      productsWithoutCost,
      costCoveragePercent: units ? Number(((valuedUnits / units) * 100).toFixed(1)) : 100,
    },
    warehouses,
  };
}
