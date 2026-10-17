import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_INVESTOR_SETTINGS,
  calculateOrderInvestment,
  calculateWarehouseInvestment,
  normalizeInvestorSettings,
} from '../src/services/investor-model.js';

test('investor settings default to the agreed ten-billion toman, 60/40 model', () => {
  assert.deepEqual(normalizeInvestorSettings(null), DEFAULT_INVESTOR_SETTINGS);
  assert.equal(DEFAULT_INVESTOR_SETTINGS.initialCapital, 10_000_000_000);
  assert.equal(DEFAULT_INVESTOR_SETTINGS.investorSharePercent, 60);
  assert.equal(DEFAULT_INVESTOR_SETTINGS.executorSharePercent, 40);
});

test('executor share is always the exact complement of investor share', () => {
  const result = normalizeInvestorSettings({
    initialCapital: 12_500_000_000,
    investorSharePercent: 67.5,
    executorSharePercent: 99,
    companyLabel: '  مشارکت آزمایشی  ',
  });
  assert.equal(result.investorSharePercent, 67.5);
  assert.equal(result.executorSharePercent, 32.5);
  assert.equal(result.companyLabel, 'مشارکت آزمایشی');
});

test('invalid financial configuration is bounded and cannot create negative capital', () => {
  const result = normalizeInvestorSettings({
    initialCapital: -1,
    investorSharePercent: 140,
    executorSharePercent: -40,
    companyLabel: '',
  });
  assert.equal(result.initialCapital, 0);
  assert.equal(result.investorSharePercent, 100);
  assert.equal(result.executorSharePercent, 0);
  assert.equal(result.companyLabel, DEFAULT_INVESTOR_SETTINGS.companyLabel);
});

test('order investment uses frozen item costs and only marks paid non-cancelled orders as realized', () => {
  const result = calculateOrderInvestment({
    total: 1_000_000,
    subtotal: 1_000_000,
    paymentStatus: 'paid',
    status: 'delivered',
    items: [
      { qty: 2, price: 400_000, costPrice: 250_000, investorFinanced: true },
      { qty: 1, price: 200_000, costPrice: 100_000, investorFinanced: true },
    ],
  }, DEFAULT_INVESTOR_SETTINGS);
  assert.equal(result.costOfGoodsSold, 600_000);
  assert.equal(result.grossProfit, 400_000);
  assert.equal(result.grossMarginPercent, 40);
  assert.equal(result.investorShare, 240_000);
  assert.equal(result.executorShare, 160_000);
  assert.equal(result.costCoveragePercent, 100);
  assert.equal(result.realized, true);
});

test('losses are visible but are never distributed between investor and executor', () => {
  const result = calculateOrderInvestment({
    total: 100_000,
    subtotal: 100_000,
    paymentStatus: 'unpaid',
    status: 'new',
    items: [{ qty: 1, price: 100_000, costPrice: 140_000, investorFinanced: true }],
  }, DEFAULT_INVESTOR_SETTINGS);
  assert.equal(result.grossProfit, -40_000);
  assert.equal(result.distributableProfit, 0);
  assert.equal(result.investorShare, 0);
  assert.equal(result.executorShare, 0);
  assert.equal(result.realized, false);
});

test('order investment excludes non-financed products and allocates discounts proportionally', () => {
  const result = calculateOrderInvestment({
    total: 900_000,
    subtotal: 1_000_000,
    paymentStatus: 'paid',
    status: 'delivered',
    items: [
      { qty: 1, price: 600_000, costPrice: 400_000, investorFinanced: true },
      { qty: 1, price: 400_000, costPrice: 250_000, investorFinanced: false },
    ],
  }, DEFAULT_INVESTOR_SETTINGS);
  assert.equal(result.financedSales, 540_000);
  assert.equal(result.financedUnits, 1);
  assert.equal(result.costOfGoodsSold, 400_000);
  assert.equal(result.grossProfit, 140_000);
  assert.equal(result.investorShare, 84_000);
});

test('warehouse valuation does not double count flat stock when split warehouses exist', () => {
  const result = calculateWarehouseInvestment([
    { stock: 99, kermanStock: 3, tehranStock: 2, costPrice: 100_000 },
    { stock: 4, kermanStock: 0, tehranStock: 0, costPrice: 50_000 },
    { stock: 2, kermanStock: 0, tehranStock: 0, costPrice: 0 },
  ], DEFAULT_INVESTOR_SETTINGS);
  assert.equal(result.totals.units, 11);
  assert.equal(result.totals.inventoryValue, 700_000);
  assert.equal(result.totals.investorValue, 420_000);
  assert.equal(result.totals.executorValue, 280_000);
  assert.equal(result.totals.productsWithoutCost, 1);
  assert.equal(result.warehouses.find((bucket) => bucket.warehouse === 'site')?.units, 6);
});
