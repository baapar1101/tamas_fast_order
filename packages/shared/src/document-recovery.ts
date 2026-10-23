export type DocumentRequestStatus = 'pending' | 'submitted' | 'completed' | 'cancelled';
export type DocumentSubmissionStatus = 'pending' | 'approved' | 'rejected';
export type DocumentAvailability = 'available' | 'missing' | 'unavailable';
export const DOCUMENT_REQUEST_STATUS_LABELS: Record<DocumentRequestStatus, string> = {
  pending: 'در انتظار آپلود', submitted: 'در انتظار بررسی مدیر', completed: 'تکمیل‌شده', cancelled: 'لغوشده',
};
export interface DocumentSubmissionDTO {
  id: number; uploadId: number; fileUrl: string; status: DocumentSubmissionStatus;
  submittedAt: string; reviewedAt: string | null; reviewNote: string | null;
}
export interface DocumentRequestDTO {
  id: number; originalUploadId: number; userId: number; documentLabel: string; message: string;
  status: DocumentRequestStatus; createdAt: string; updatedAt: string;
  notificationDelivery: Record<string, string>; submissions: DocumentSubmissionDTO[];
}
export interface DocumentHealthDTO {
  uploadId: number; originalName: string; fileUrl: string; scope: 'credit' | 'payment';
  availability: DocumentAvailability; thumbnailAvailability: DocumentAvailability | null;
  userId: number | null; userName: string; userRole: string; userStoreName: string;
  ownerSource: 'reference' | 'upload' | 'unknown' | 'conflict';
  references: Array<{ source: string; recordId: number; label: string }>;
  requests: DocumentRequestDTO[]; resolved: boolean; createdAt: string;
}
