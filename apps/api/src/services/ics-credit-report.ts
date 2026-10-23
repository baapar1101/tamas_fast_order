import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

export interface CreditReportToken {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CreditReportPageData {
  page: number;
  rows: string[];
  tokens: CreditReportToken[];
}

export interface ParsedIcsCreditReport {
  provider: 'ics24';
  reportNumber: string | null;
  reportDate: string | null;
  identity: {
    nationalId: string | null;
    fullName: string | null;
    fatherName: string | null;
    birthDate: string | null;
    gender: string | null;
    maritalStatus: string | null;
    birthPlace: string | null;
    mobile: string | null;
  };
  score: number | null;
  riskGrade: string | null;
  riskLevel: string | null;
  goodPayerProbability: { min: number; max: number } | null;
  inquiryCounts: { oneMonth: number | null; oneYear: number | null };
  bouncedChequeCount: number | null;
  negativeReasons: Array<{ code: string; description: string }>;
  taxStatuses: Array<{ year: string; status: string }>;
  pages: CreditReportPageData[];
  warnings: string[];
  confidence: number;
}

const faDigits = '۰۱۲۳۴۵۶۷۸۹';
const arDigits = '٠١٢٣٤٥٦٧٨٩';

export function normalizeCreditReportText(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[۰-۹]/g, (digit) => String(faDigits.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String(arDigits.indexOf(digit)))
    .replace(/[\u200c\u200f\u202a-\u202e]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function rowText(tokens: CreditReportToken[]): string[] {
  const rows: Array<{ y: number; items: CreditReportToken[] }> = [];
  for (const token of tokens) {
    let row = rows.find((candidate) => Math.abs(candidate.y - token.y) <= 2.5);
    if (!row) {
      row = { y: token.y, items: [] };
      rows.push(row);
    }
    row.items.push(token);
  }
  return rows
    .sort((a, b) => b.y - a.y)
    .map((row) => row.items.sort((a, b) => b.x - a.x).map((item) => item.text).join(' ').trim())
    .filter(Boolean);
}

function allText(pages: CreditReportPageData[]): string {
  return pages.flatMap((page) => page.rows).join('\n');
}

function firstMatch(text: string, expressions: RegExp[]): string | null {
  for (const expression of expressions) {
    const match = text.match(expression);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

function labelValue(tokens: CreditReportToken[], label: string): string | null {
  const normalizedLabel = normalizeCreditReportText(label);
  const labelToken = tokens.find((token) => token.text.includes(normalizedLabel));
  if (!labelToken) return null;

  const sameRow = tokens
    .filter((token) => token !== labelToken && Math.abs(token.y - labelToken.y) <= 3 && token.x < labelToken.x)
    .sort((a, b) => b.x - a.x);
  return sameRow[0]?.text ?? null;
}

function parseNumber(value: string | null): number | null {
  if (!value) return null;
  const number = Number(value.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(number) ? number : null;
}

function parseNegativeReasons(pages: CreditReportPageData[]) {
  const reasons: Array<{ code: string; description: string }> = [];
  for (const page of pages) {
    for (const row of page.rows) {
      const match = row.match(/\b([A-Z]{3}\d)\b/);
      if (!match) continue;
      const description = row
        .replace(match[0], '')
        .replace(/^\s*\d+\s*/, '')
        .trim();
      const code = match[1]!;
      if (description && !reasons.some((item) => item.code === code)) {
        reasons.push({ code, description });
      }
    }
  }
  return reasons;
}

function parseTaxStatuses(pages: CreditReportPageData[]) {
  const results: Array<{ year: string; status: string }> = [];
  for (const page of pages) {
    for (const row of page.rows) {
      const year = row.match(/\b(14\d{2})\b/)?.[1];
      if (!year || !/(مالیات|اظهارنامه|بدهی|نامشخص|فاقد)/.test(row)) continue;
      const status = row.replace(year, '').trim();
      if (status && !results.some((item) => item.year === year && item.status === status)) {
        results.push({ year, status });
      }
    }
  }
  return results;
}

function parseBouncedChequeCount(pages: CreditReportPageData[]): number | null {
  const page = pages.find((item) => item.rows.some((row) => row.includes('جزئیات چک های برگشتی')));
  if (!page) return null;
  const start = page.rows.findIndex((row) => row.includes('بانک شناسه چک'));
  const end = page.rows.findIndex((row) => row.includes('وضعیت محکومیت'));
  if (start < 0 || end <= start) return null;
  return page.rows.slice(start + 1, end).filter((row) => /بانک\s+.+\b\d{8,}\b.*\b14\d{2}\//.test(row)).length;
}

export async function parseIcsCreditReport(buffer: Buffer): Promise<ParsedIcsCreditReport> {
  const document = await getDocument({ data: new Uint8Array(buffer) }).promise;
  const pages: CreditReportPageData[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const tokens: CreditReportToken[] = content.items
      .filter((item): item is typeof item & { str: string; transform: number[]; width: number; height: number } => 'str' in item)
      .map((item) => ({
        text: normalizeCreditReportText(item.str),
        x: Math.round(item.transform[4] * 100) / 100,
        y: Math.round(item.transform[5] * 100) / 100,
        width: Math.round(item.width * 100) / 100,
        height: Math.round(item.height * 100) / 100,
      }))
      .filter((item) => item.text.length > 0);
    pages.push({ page: pageNumber, rows: rowText(tokens), tokens });
    page.cleanup();
  }
  await document.destroy();

  const text = allText(pages);
  if (!/(ics24\.ir|اعتبارسنجی ایرانیان|گزارش اعتباری شخص حقیقی)/i.test(text)) {
    throw new Error('فایل بارگذاری‌شده گزارش معتبر اعتبارسنجی ICS24 نیست.');
  }

  const firstPage = pages[0]?.tokens ?? [];
  const nationalId = firstMatch(text, [/(?:شماره|کد)\s*ملی\s*[:：]?\s*([0-9]{10})/, /\b([0-9]{10})\b/]);
  const reportNumberRow = pages.flatMap((page) => page.rows).find((row) => row.includes('شماره یکتا گزارش'));
  const reportNumber = reportNumberRow?.split('گزارش:').at(-1)?.replace(/\D/g, '') || null;
  const reportDate = firstMatch(text, [/(?:تاریخ\s*(?:و\s*زمان\s*)?گزارش)\s*[:：]?\s*([0-9/:-]+(?:\s+[0-9:]+)?)/])
    ?? pages[0]?.rows[0]?.match(/(14\d{2}\/\d{2}\/\d{2})(?:\s+(\d{2}:\d{2}))?/)?.slice(1).filter(Boolean).join(' ')
    ?? null;
  const grade = firstMatch(text, [/\b([A-E][1-3])\b/]);
  const riskLevel = firstMatch(text, [/(ریسک\s+(?:خیلی\s+کم|کم|متوسط|زیاد|خیلی\s+زیاد))/]);
  const scoreCandidate = text.match(/(?:امتیاز(?:\s*اعتباری)?|رتبه اعتباری)[^\n0-9]{0,30}([0-9]{3})/i)?.[1]
    ?? pages.flatMap((page) => page.tokens).find((token) => /^\d{3}$/.test(token.text) && Number(token.text) >= 300 && Number(token.text) <= 900)?.text
    ?? null;
  const payerRange = text.match(/([0-9]+(?:\.[0-9]+)?)\s*[%٪]\s*(?:تا|الی|-|–)\s*([0-9]+(?:\.[0-9]+)?)\s*[%٪]/);

  const oneMonth = firstMatch(text, [/(?:یک\s*ماه|1\s*ماه)[^\n0-9]{0,30}([0-9]+)/]);
  const oneYear = firstMatch(text, [/(?:یک\s*سال|1\s*سال)[^\n0-9]{0,30}([0-9]+)/]);
  const identityRow = pages[0]?.rows.find((row) => /تلفن همراه\s+09\d{9}/.test(row));
  const fullNameFromRow = identityRow?.replace(/تلفن همراه\s+09\d{9}.*/, '').trim() || null;

  const identity = {
    nationalId,
    fullName: labelValue(firstPage, 'نام و نام خانوادگی')
      ?? firstMatch(text, [/(?:نام\s*و\s*نام\s*خانوادگی)\s*[:：]?\s*([^\n]+)/]),
    fatherName: labelValue(firstPage, 'نام پدر'),
    birthDate: labelValue(firstPage, 'تاریخ تولد'),
    gender: labelValue(firstPage, 'جنسیت'),
    maritalStatus: labelValue(firstPage, 'وضعیت تاهل') ?? labelValue(firstPage, 'وضعیت تأهل'),
    birthPlace: labelValue(firstPage, 'محل تولد'),
    mobile: labelValue(firstPage, 'تلفن همراه') ?? firstMatch(text, [/\b(09[0-9]{9})\b/]),
  };
  if (!identity.fullName) identity.fullName = fullNameFromRow;

  const warnings: string[] = [];
  if (!reportNumber) warnings.push('شماره یکتای گزارش استخراج نشد.');
  if (!nationalId) warnings.push('کد ملی از گزارش استخراج نشد.');
  if (!scoreCandidate) warnings.push('امتیاز اعتباری از گزارش استخراج نشد.');
  if (!grade) warnings.push('رتبه ریسک از گزارش استخراج نشد.');
  const confidence = Math.round(([
    reportNumber,
    reportDate,
    nationalId,
    identity.fullName,
    scoreCandidate,
    grade,
    riskLevel,
    identity.mobile,
  ].filter(Boolean).length / 8) * 100);

  return {
    provider: 'ics24',
    reportNumber,
    reportDate,
    identity,
    score: parseNumber(scoreCandidate),
    riskGrade: grade,
    riskLevel,
    goodPayerProbability: payerRange ? { min: Number(payerRange[1]), max: Number(payerRange[2]) } : null,
    inquiryCounts: { oneMonth: parseNumber(oneMonth), oneYear: parseNumber(oneYear) },
    bouncedChequeCount: parseBouncedChequeCount(pages),
    negativeReasons: parseNegativeReasons(pages),
    taxStatuses: parseTaxStatuses(pages),
    pages,
    warnings,
    confidence,
  };
}
