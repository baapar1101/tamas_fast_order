import assert from 'node:assert/strict';
import test from 'node:test';
import type { CreditApplicationDTO } from '@tamas/shared';
import {
  buildCreditReportAnalytics,
  classifyCreditRisk,
  type AdminCreditReport,
} from '../src/admin/components/creditReportAnalytics';

const applicant = (userId: number, name: string): CreditApplicationDTO => ({
  id: userId,
  userId,
  userName: name,
  userPhone: `0912000000${userId}`,
  userStoreName: '',
  nationalId: `000000000${userId}`,
  businessType: 'فروشگاه',
  nationalCardUrl: '',
  businessDocsUrl: '',
  checkImageUrl: '',
  bankStatementUrl: null,
  referralInfo: null,
  status: 'active',
  rejectionReason: null,
  adminCreditScore: 0,
  assignedCreditLimit: 0,
  internalNotes: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

const report = (fields: Partial<AdminCreditReport> & Pick<AdminCreditReport, 'id' | 'userId' | 'createdAt'>): AdminCreditReport => ({
  creditApplicationId: fields.userId,
  fileUrl: '/report.pdf',
  originalName: 'report.pdf',
  reportNumber: String(fields.id),
  reportDate: null,
  extractedNationalId: null,
  extractedFullName: null,
  extractedMobile: null,
  score: 700,
  riskGrade: 'B1',
  riskLevel: 'ریسک کم',
  goodPayerMinPercent: 70,
  goodPayerMaxPercent: 80,
  bouncedChequeCount: 0,
  extractionStatus: 'parsed',
  confidence: 90,
  warnings: [],
  data: {
    provider: 'ics24', reportNumber: null, reportDate: null,
    identity: { nationalId: null, fullName: null, fatherName: null, birthDate: null, gender: null, maritalStatus: null, birthPlace: null, mobile: null },
    score: 700, riskGrade: 'B1', riskLevel: 'ریسک کم', goodPayerProbability: null,
    inquiryCounts: { oneMonth: 0, oneYear: 0 }, bouncedChequeCount: 0,
    negativeReasons: [], taxStatuses: [], pages: [], warnings: [], confidence: 90,
  },
  expiresAt: '2027-01-01T00:00:00.000Z',
  isExpired: false,
  userName: `کاربر ${fields.userId}`,
  userPhone: '',
  userStoreName: '',
  ...fields,
});

test('risk classifier handles Persian risk text before overlapping low-risk words', () => {
  assert.equal(classifyCreditRisk({ riskGrade: 'E1', riskLevel: 'ریسک خیلی زیاد' }), 'high');
  assert.equal(classifyCreditRisk({ riskGrade: 'C2', riskLevel: 'ریسک متوسط' }), 'medium');
  assert.equal(classifyCreditRisk({ riskGrade: 'A1', riskLevel: 'ریسک خیلی کم' }), 'low');
  assert.equal(classifyCreditRisk({ riskGrade: null, riskLevel: null }), 'unknown');
});

test('portfolio uses only the latest report per customer and retains history counts', () => {
  const now = new Date('2026-10-23T00:00:00.000Z');
  const analytics = buildCreditReportAnalytics([
    report({ id: 1, userId: 1, createdAt: '2026-08-01T00:00:00.000Z', score: 520 }),
    report({ id: 2, userId: 1, createdAt: '2026-10-01T00:00:00.000Z', score: 780 }),
    report({ id: 3, userId: 2, createdAt: '2026-10-02T00:00:00.000Z', score: 480, riskGrade: 'D1', riskLevel: 'ریسک زیاد', bouncedChequeCount: 2 }),
  ], [applicant(1, 'اول'), applicant(2, 'دوم'), applicant(3, 'سوم')], now);

  assert.equal(analytics.portfolioCount, 3);
  assert.equal(analytics.coveredCount, 2);
  assert.equal(analytics.coveragePercent, 67);
  assert.equal(analytics.averageScore, 630);
  assert.equal(analytics.highRiskCount, 1);
  assert.equal(analytics.bouncedChequeTotal, 2);
  assert.equal(analytics.rows.find((row) => row.userId === 1)?.historyCount, 2);
  assert.equal(analytics.rows.find((row) => row.userId === 2)?.priority, 'urgent');
  assert.equal(analytics.rows.find((row) => row.userId === 3)?.priority, 'follow_up');
});
