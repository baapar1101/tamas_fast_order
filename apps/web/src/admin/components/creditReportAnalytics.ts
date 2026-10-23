import type { CreditApplicationDTO, CreditReportSnapshotDTO } from '@tamas/shared';

export type AdminCreditReport = CreditReportSnapshotDTO & {
  userName: string;
  userPhone: string;
  userStoreName: string;
};

export type CreditRiskBucket = 'low' | 'medium' | 'high' | 'unknown';
export type CreditPortfolioPriority = 'urgent' | 'follow_up' | 'normal';

export interface CreditPortfolioRow {
  userId: number;
  userName: string;
  userPhone: string;
  userStoreName: string;
  nationalId: string;
  applicationStatus: CreditApplicationDTO['status'] | null;
  report: AdminCreditReport | null;
  historyCount: number;
  risk: CreditRiskBucket;
  priority: CreditPortfolioPriority;
  priorityReasons: string[];
}

export interface CreditReportAnalytics {
  rows: CreditPortfolioRow[];
  portfolioCount: number;
  coveredCount: number;
  coveragePercent: number | null;
  validCount: number;
  missingCount: number;
  expiredCount: number;
  expiringSoonCount: number;
  reviewNeededCount: number;
  averageScore: number | null;
  averageConfidence: number | null;
  highRiskCount: number;
  bouncedCustomerCount: number;
  bouncedChequeTotal: number;
  urgentCount: number;
  followUpCount: number;
  riskDistribution: Array<{ key: CreditRiskBucket; label: string; count: number; color: string }>;
  scoreDistribution: Array<{ key: string; label: string; count: number; color: string }>;
  trend: Array<{ month: string; label: string; reports: number; averageScore: number | null }>;
}

const RISK_META: Record<CreditRiskBucket, { label: string; color: string }> = {
  low: { label: 'کم‌ریسک', color: '#22c55e' },
  medium: { label: 'ریسک متوسط', color: '#f59e0b' },
  high: { label: 'پرریسک', color: '#ef4444' },
  unknown: { label: 'نامشخص', color: '#64748b' },
};

export function classifyCreditRisk(report: Pick<CreditReportSnapshotDTO, 'riskGrade' | 'riskLevel'> | null): CreditRiskBucket {
  if (!report) return 'unknown';
  const level = String(report.riskLevel ?? '').replace(/\s+/g, ' ').trim();
  const grade = String(report.riskGrade ?? '').trim().toUpperCase();
  if (/خیلی زیاد|زیاد|بسیار بالا|پرریسک/.test(level) || /^[DE]/.test(grade)) return 'high';
  if (/متوسط|میانه/.test(level) || /^C/.test(grade)) return 'medium';
  if (/خیلی کم|کم|پایین/.test(level) || /^[AB]/.test(grade)) return 'low';
  return 'unknown';
}

function scoreBand(score: number | null): string {
  if (score === null) return 'unknown';
  if (score < 500) return 'critical';
  if (score < 600) return 'weak';
  if (score < 700) return 'medium';
  if (score < 800) return 'good';
  return 'excellent';
}

function average(values: number[]): number | null {
  return values.length > 0 ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function buildCreditReportAnalytics(
  reports: AdminCreditReport[],
  applicants: CreditApplicationDTO[],
  now = new Date(),
): CreditReportAnalytics {
  const sortedReports = [...reports].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const latestByUser = new Map<number, AdminCreditReport>();
  const historyCount = new Map<number, number>();
  for (const report of sortedReports) {
    historyCount.set(report.userId, (historyCount.get(report.userId) ?? 0) + 1);
    if (!latestByUser.has(report.userId)) latestByUser.set(report.userId, report);
  }

  const applicantByUser = new Map<number, CreditApplicationDTO>();
  for (const applicant of applicants) {
    const current = applicantByUser.get(applicant.userId);
    if (!current || Date.parse(applicant.updatedAt) > Date.parse(current.updatedAt)) applicantByUser.set(applicant.userId, applicant);
  }
  const userIds = new Set([...applicantByUser.keys(), ...latestByUser.keys()]);
  const soonThreshold = now.getTime() + 14 * 86_400_000;

  const rows: CreditPortfolioRow[] = [...userIds].map((userId) => {
    const applicant = applicantByUser.get(userId) ?? null;
    const report = latestByUser.get(userId) ?? null;
    const risk = classifyCreditRisk(report);
    const reasons: string[] = [];
    let priority: CreditPortfolioPriority = 'normal';
    if (!report) {
      priority = 'follow_up';
      reasons.push('فاقد گزارش ICS24');
    } else {
      const expiresAt = Date.parse(report.expiresAt);
      if (report.isExpired || expiresAt <= now.getTime()) reasons.push('گزارش منقضی');
      else if (expiresAt <= soonThreshold) reasons.push('نزدیک به انقضا');
      if (report.extractionStatus === 'failed') reasons.push('استخراج ناموفق');
      else if (report.extractionStatus === 'needs_review') reasons.push('نیازمند بازبینی استخراج');
      if ((report.bouncedChequeCount ?? 0) > 0) reasons.push('دارای چک برگشتی');
      if (risk === 'high') reasons.push('ریسک بالا');
      else if (risk === 'medium') reasons.push('ریسک متوسط');
      if (report.score !== null && report.score < 600) reasons.push('امتیاز کمتر از ۶۰۰');

      if (report.isExpired || report.extractionStatus === 'failed' || (report.bouncedChequeCount ?? 0) > 0 || risk === 'high') priority = 'urgent';
      else if (reasons.length > 0) priority = 'follow_up';
    }
    return {
      userId,
      userName: applicant?.userName || report?.userName || 'کاربر',
      userPhone: applicant?.userPhone || report?.userPhone || '',
      userStoreName: applicant?.userStoreName || report?.userStoreName || '',
      nationalId: applicant?.nationalId || report?.extractedNationalId || '',
      applicationStatus: applicant?.status ?? null,
      report,
      historyCount: historyCount.get(userId) ?? 0,
      risk,
      priority,
      priorityReasons: reasons,
    };
  }).sort((a, b) => {
    const rank: Record<CreditPortfolioPriority, number> = { urgent: 0, follow_up: 1, normal: 2 };
    return rank[a.priority] - rank[b.priority]
      || (a.report?.score ?? -1) - (b.report?.score ?? -1)
      || a.userName.localeCompare(b.userName, 'fa');
  });

  const latest = [...latestByUser.values()];
  const scored = latest.flatMap((report) => report.score === null ? [] : [report.score]);
  const confidenceValues = latest.map((report) => report.confidence);
  const riskCounts: Record<CreditRiskBucket, number> = { low: 0, medium: 0, high: 0, unknown: 0 };
  latest.forEach((report) => { riskCounts[classifyCreditRisk(report)] += 1; });

  const scoreMeta = [
    { key: 'critical', label: 'بحرانی · کمتر از ۵۰۰', color: '#dc2626' },
    { key: 'weak', label: 'ضعیف · ۵۰۰ تا ۵۹۹', color: '#f97316' },
    { key: 'medium', label: 'متوسط · ۶۰۰ تا ۶۹۹', color: '#f59e0b' },
    { key: 'good', label: 'خوب · ۷۰۰ تا ۷۹۹', color: '#14b8a6' },
    { key: 'excellent', label: 'عالی · ۸۰۰ و بیشتر', color: '#22c55e' },
    { key: 'unknown', label: 'بدون امتیاز', color: '#64748b' },
  ];
  const scoreCounts = new Map(scoreMeta.map((item) => [item.key, 0]));
  latest.forEach((report) => {
    const key = scoreBand(report.score);
    scoreCounts.set(key, (scoreCounts.get(key) ?? 0) + 1);
  });

  const trendMonths = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    return { date, month: monthKey(date) };
  });
  const trend = trendMonths.map(({ date, month }) => {
    const periodReports = sortedReports.filter((report) => monthKey(new Date(report.createdAt)) === month);
    const periodScores = periodReports.flatMap((report) => report.score === null ? [] : [report.score]);
    return {
      month,
      label: date.toLocaleDateString('fa-IR', { month: 'short', year: 'numeric' }),
      reports: periodReports.length,
      averageScore: average(periodScores),
    };
  });

  const coveredCount = latestByUser.size;
  const portfolioCount = rows.length;
  const expiredCount = latest.filter((report) => report.isExpired || Date.parse(report.expiresAt) <= now.getTime()).length;
  const expiringSoonCount = latest.filter((report) => {
    const expiry = Date.parse(report.expiresAt);
    return expiry > now.getTime() && expiry <= soonThreshold;
  }).length;

  return {
    rows,
    portfolioCount,
    coveredCount,
    coveragePercent: portfolioCount > 0 ? Math.round((coveredCount / portfolioCount) * 100) : null,
    validCount: coveredCount - expiredCount,
    missingCount: rows.filter((row) => !row.report).length,
    expiredCount,
    expiringSoonCount,
    reviewNeededCount: latest.filter((report) => report.extractionStatus !== 'parsed').length,
    averageScore: average(scored),
    averageConfidence: average(confidenceValues),
    highRiskCount: riskCounts.high,
    bouncedCustomerCount: latest.filter((report) => (report.bouncedChequeCount ?? 0) > 0).length,
    bouncedChequeTotal: latest.reduce((sum, report) => sum + (report.bouncedChequeCount ?? 0), 0),
    urgentCount: rows.filter((row) => row.priority === 'urgent').length,
    followUpCount: rows.filter((row) => row.priority === 'follow_up').length,
    riskDistribution: (Object.keys(RISK_META) as CreditRiskBucket[]).map((key) => ({ key, ...RISK_META[key], count: riskCounts[key] })),
    scoreDistribution: scoreMeta.map((item) => ({ ...item, count: scoreCounts.get(item.key) ?? 0 })),
    trend,
  };
}
