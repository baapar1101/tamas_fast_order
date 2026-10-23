import type { CreditReportDataDTO, CreditReportSnapshotDTO } from '@tamas/shared';
import type { creditReportSnapshots } from '../db/schema.js';

type CreditReportRow = typeof creditReportSnapshots.$inferSelect;

export function creditReportExpiresAt(from = new Date()): Date {
  const expiresAt = new Date(from);
  expiresAt.setUTCMonth(expiresAt.getUTCMonth() + 2);
  return expiresAt;
}

export function toCreditReportSnapshotDTO(row: CreditReportRow, now = new Date()): CreditReportSnapshotDTO {
  return {
    id: row.id,
    userId: row.userId,
    creditApplicationId: row.creditApplicationId,
    fileUrl: row.fileUrl,
    originalName: row.originalName,
    reportNumber: row.reportNumber,
    reportDate: row.reportDate,
    extractedNationalId: row.extractedNationalId,
    extractedFullName: row.extractedFullName,
    extractedMobile: row.extractedMobile,
    score: row.score,
    riskGrade: row.riskGrade,
    riskLevel: row.riskLevel,
    goodPayerMinPercent: row.goodPayerMinBasisPoints === null ? null : row.goodPayerMinBasisPoints / 100,
    goodPayerMaxPercent: row.goodPayerMaxBasisPoints === null ? null : row.goodPayerMaxBasisPoints / 100,
    bouncedChequeCount: row.bouncedChequeCount,
    extractionStatus: row.extractionStatus,
    confidence: row.confidence,
    warnings: row.warnings,
    data: row.data as unknown as CreditReportDataDTO,
    expiresAt: row.expiresAt.toISOString(),
    isExpired: row.expiresAt.getTime() <= now.getTime(),
    createdAt: row.createdAt.toISOString(),
  };
}
