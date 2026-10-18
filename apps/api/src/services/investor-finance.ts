import { and, desc, eq, gte, isNull, ne, sql } from 'drizzle-orm';
import type {
  InvestmentEntryDTO,
  InvestorDashboardDTO,
  InvestorSettingsDTO,
} from '@tamas/shared';
import { db } from '../db/client.js';
import {
  creditCheques,
  investmentEntries,
  orderItems,
  orders,
  products,
  settings,
} from '../db/schema.js';
import {
  DEFAULT_INVESTOR_SETTINGS,
  INVESTOR_SETTINGS_KEY,
  normalizeInvestorSettings,
  type InvestorRange,
} from './investor-model.js';

export { DEFAULT_INVESTOR_SETTINGS, INVESTOR_SETTINGS_KEY, normalizeInvestorSettings } from './investor-model.js';

const DAY_MS = 86_400_000;
const RANGE_DAYS: Record<InvestorRange, number> = { '7d': 7, '30d': 30, '90d': 90, '365d': 365 };

export async function getInvestorSettings(): Promise<InvestorSettingsDTO> {
  const [row] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, INVESTOR_SETTINGS_KEY)).limit(1);
  if (!row?.value) return { ...DEFAULT_INVESTOR_SETTINGS };
  try {
    return normalizeInvestorSettings(JSON.parse(row.value));
  } catch {
    return { ...DEFAULT_INVESTOR_SETTINGS };
  }
}

export function toInvestmentEntryDTO(row: typeof investmentEntries.$inferSelect): InvestmentEntryDTO {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    amount: row.amount,
    title: row.title,
    category: row.category,
    reference: row.reference,
    notes: row.notes,
    transactionDate: row.transactionDate.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function productUnits(product: Pick<typeof products.$inferSelect, 'stock' | 'kermanStock' | 'tehranStock'>): number {
  const split = Math.max(0, product.kermanStock) + Math.max(0, product.tehranStock);
  return split > 0 ? split : Math.max(0, product.stock);
}

function bucketKey(date: Date, range: InvestorRange): string {
  const value = new Date(date);
  if (range === '365d') return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}`;
  if (range === '90d') {
    const day = value.getUTCDay() || 7;
    value.setUTCDate(value.getUTCDate() - day + 1);
  }
  return value.toISOString().slice(0, 10);
}

type FinancedSaleRow = {
  orderId: number;
  orderTotal: number;
  orderSubtotal: number;
  createdAt: Date;
  price: number;
  costPrice: number;
  qty: number;
};

function summarizeFinancedSales(rows: FinancedSaleRow[]) {
  const ordersById = new Map<number, {
    createdAt: Date;
    orderTotal: number;
    orderSubtotal: number;
    financedSubtotal: number;
    cost: number;
    units: number;
    valuedUnits: number;
  }>();
  for (const row of rows) {
    const current = ordersById.get(row.orderId) ?? {
      createdAt: row.createdAt,
      orderTotal: row.orderTotal,
      orderSubtotal: row.orderSubtotal,
      financedSubtotal: 0,
      cost: 0,
      units: 0,
      valuedUnits: 0,
    };
    const qty = Math.max(0, row.qty);
    current.financedSubtotal += Math.max(0, row.price) * qty;
    current.cost += Math.max(0, row.costPrice) * qty;
    current.units += qty;
    if (row.costPrice > 0) current.valuedUnits += qty;
    ordersById.set(row.orderId, current);
  }
  return [...ordersById.values()].map((order) => ({
    ...order,
    sales: order.orderSubtotal > 0
      ? Math.round(order.orderTotal * order.financedSubtotal / order.orderSubtotal)
      : 0,
  }));
}

export async function buildInvestorDashboard(range: InvestorRange): Promise<InvestorDashboardDTO> {
  const to = new Date();
  const from = new Date(to.getTime() - (RANGE_DAYS[range] - 1) * DAY_MS);
  from.setHours(0, 0, 0, 0);
  const paidOrderWhere = and(
    eq(orders.paymentStatus, 'paid'),
    ne(orders.status, 'cancelled'),
    gte(orders.createdAt, from),
    isNull(orders.deletedAt),
  );
  const allPaidOrderWhere = and(eq(orders.paymentStatus, 'paid'), ne(orders.status, 'cancelled'), isNull(orders.deletedAt));

  const [
    investorSettings,
    productRows,
    periodSaleItemRows,
    periodEntries,
    allPaidEntries,
    chequeRows,
    recentEntries,
    allTimeSaleItemRows,
  ] = await Promise.all([
    getInvestorSettings(),
    db.select({
      productId: products.productId,
      sku: products.sku,
      title: products.title,
      stock: products.stock,
      kermanStock: products.kermanStock,
      tehranStock: products.tehranStock,
      costPrice: products.costPrice,
    }).from(products).where(and(
      isNull(products.deletedAt),
      eq(products.status, 'active'),
      eq(products.investorFinanced, true),
    )),
    db.select({
      orderId: orders.id,
      orderTotal: orders.total,
      orderSubtotal: orders.subtotal,
      createdAt: orders.createdAt,
      price: orderItems.price,
      costPrice: orderItems.costPrice,
      qty: orderItems.qty,
    }).from(orderItems).innerJoin(orders, eq(orderItems.orderId, orders.id)).where(and(
      paidOrderWhere,
      eq(orderItems.investorFinanced, true),
    )),
    db.select().from(investmentEntries).where(and(
      isNull(investmentEntries.deletedAt),
      eq(investmentEntries.status, 'paid'),
      gte(investmentEntries.transactionDate, from),
    )).orderBy(investmentEntries.transactionDate),
    db.select().from(investmentEntries).where(and(
      isNull(investmentEntries.deletedAt),
      eq(investmentEntries.status, 'paid'),
    )),
    db.select({
      status: creditCheques.status,
      amount: sql<number>`coalesce(sum(${creditCheques.amount}), 0)`,
      count: sql<number>`count(*)`,
    }).from(creditCheques).where(sql`exists (
      select 1 from ${orderItems}
      where ${orderItems.orderId} = ${creditCheques.orderId}
        and ${orderItems.investorFinanced} = true
    )`).groupBy(creditCheques.status),
    db.select().from(investmentEntries)
      .where(isNull(investmentEntries.deletedAt))
      .orderBy(desc(investmentEntries.transactionDate), desc(investmentEntries.id)).limit(8),
    db.select({
      orderId: orders.id,
      orderTotal: orders.total,
      orderSubtotal: orders.subtotal,
      createdAt: orders.createdAt,
      price: orderItems.price,
      costPrice: orderItems.costPrice,
      qty: orderItems.qty,
    }).from(orderItems).innerJoin(orders, eq(orderItems.orderId, orders.id)).where(and(
      allPaidOrderWhere,
      eq(orderItems.investorFinanced, true),
    )),
  ]);

  let inventoryUnits = 0;
  let inventoryValue = 0;
  let valuedInventoryUnits = 0;
  let productsWithoutCost = 0;
  const topInventory = productRows.map((product) => {
    const units = productUnits(product);
    const value = units * product.costPrice;
    inventoryUnits += units;
    inventoryValue += value;
    if (product.costPrice > 0) valuedInventoryUnits += units;
    else if (units > 0) productsWithoutCost += 1;
    return { productId: product.productId, sku: product.sku, title: product.title, units, costPrice: product.costPrice, value };
  }).filter((item) => item.units > 0).sort((a, b) => b.value - a.value || b.units - a.units).slice(0, 8);

  const salesRows = summarizeFinancedSales(periodSaleItemRows);
  const allTimeSalesRows = summarizeFinancedSales(allTimeSaleItemRows);
  const netSales = salesRows.reduce((sum, row) => sum + row.sales, 0);
  const orderCount = salesRows.length;
  const costOfGoodsSold = salesRows.reduce((sum, row) => sum + row.cost, 0);
  const soldUnits = salesRows.reduce((sum, row) => sum + row.units, 0);
  const valuedSoldUnits = salesRows.reduce((sum, row) => sum + row.valuedUnits, 0);
  const sumEntry = (rows: typeof periodEntries, type: typeof investmentEntries.$inferSelect['type']) =>
    rows.filter((row) => row.type === type).reduce((sum, row) => sum + row.amount, 0);
  const netPurchases = sumEntry(periodEntries, 'purchase');
  const operatingExpenses = sumEntry(periodEntries, 'expense');
  const grossProfit = netSales - costOfGoodsSold;
  const netProfit = grossProfit - operatingExpenses;
  const distributableProfit = Math.max(0, netProfit);
  const investorShare = Math.round(distributableProfit * investorSettings.investorSharePercent / 100);
  const executorShare = distributableProfit - investorShare;

  const allEntry = (type: typeof investmentEntries.$inferSelect['type']) => sumEntry(allPaidEntries, type);
  const availableWorkingCapital = investorSettings.initialCapital
    + allEntry('capital_injection')
    + allEntry('adjustment')
    + allTimeSalesRows.reduce((sum, row) => sum + row.sales, 0)
    - allEntry('capital_withdrawal')
    - allEntry('purchase')
    - allEntry('expense')
    - allEntry('profit_distribution');

  const cheque = (status: typeof creditCheques.$inferSelect['status']) => chequeRows.find((row) => row.status === status);

  type TrendBucket = InvestorDashboardDTO['trend'][number] & { cost: number };
  const trendMap = new Map<string, TrendBucket>();
  const ensureTrend = (date: Date) => {
    const key = bucketKey(date, range);
    const current = trendMap.get(key) ?? { date: key, sales: 0, purchases: 0, expenses: 0, profit: 0, cost: 0 };
    trendMap.set(key, current);
    return current;
  };
  for (const sale of salesRows) {
    const bucket = ensureTrend(sale.createdAt);
    bucket.sales += sale.sales;
    bucket.cost += sale.cost;
  }
  for (const entry of periodEntries) {
    const bucket = ensureTrend(entry.transactionDate);
    if (entry.type === 'purchase') bucket.purchases += entry.amount;
    if (entry.type === 'expense') bucket.expenses += entry.amount;
  }
  const trend = [...trendMap.values()].sort((a, b) => a.date.localeCompare(b.date)).map(({ cost, ...point }) => ({
    ...point,
    profit: point.sales - cost - point.expenses,
  }));

  return {
    period: { range, from: from.toISOString(), to: to.toISOString() },
    settings: investorSettings,
    metrics: {
      inventoryUnits,
      inventoryValue,
      valuedInventoryUnits,
      unvaluedInventoryUnits: Math.max(0, inventoryUnits - valuedInventoryUnits),
      netSales,
      netPurchases,
      operatingExpenses,
      costOfGoodsSold,
      grossProfit,
      netProfit,
      distributableProfit,
      investorShare,
      executorShare,
      orderCount,
      averageOrderValue: orderCount ? Math.round(netSales / orderCount) : 0,
      grossMarginPercent: netSales ? Number(((grossProfit / netSales) * 100).toFixed(1)) : 0,
      availableWorkingCapital,
    },
    dataQuality: {
      inventoryCostCoveragePercent: inventoryUnits ? Number(((valuedInventoryUnits / inventoryUnits) * 100).toFixed(1)) : 100,
      salesCostCoveragePercent: soldUnits ? Number(((valuedSoldUnits / soldUnits) * 100).toFixed(1)) : 100,
      productsWithoutCost,
    },
    cheques: {
      pendingAmount: Number(cheque('pending')?.amount ?? 0),
      pendingCount: Number(cheque('pending')?.count ?? 0),
      passedAmount: Number(cheque('passed')?.amount ?? 0),
      bouncedAmount: Number(cheque('bounced')?.amount ?? 0),
      bouncedCount: Number(cheque('bounced')?.count ?? 0),
    },
    trend,
    topInventory,
    recentEntries: recentEntries.map(toInvestmentEntryDTO),
  };
}
