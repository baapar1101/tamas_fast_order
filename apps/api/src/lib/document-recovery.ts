import { privateFileId, privateFileUrl } from './private-files.js';

export interface DocumentReference {
  source: 'application' | 'profile' | 'cheque' | 'receipt' | 'report' | 'order';
  recordId: number; userId: number; field: string; value: string; label: string;
}
// Match an exact ID, never the prefix of another file ID (8 must not match 80).
export function referencesUpload(reference: DocumentReference, uploadId: number): boolean {
  return reference.source === 'order'
    ? new RegExp(`/api/files/${uploadId}(?:\\?variant=thumb)?(?=$|[^\\d?])`).test(reference.value)
    : privateFileId(reference.value) === uploadId;
}
export function replaceDocumentReference(reference: DocumentReference, uploadId: number, replacementId: number): string {
  if (!referencesUpload(reference, uploadId)) return reference.value;
  if (reference.source !== 'order') return privateFileUrl(replacementId, reference.value.endsWith('?variant=thumb'));
  return reference.value.replace(new RegExp(`/api/files/${uploadId}(\\?variant=thumb)?(?=$|[^\\d?])`, 'g'),
    (_match, thumb: string | undefined) => privateFileUrl(replacementId, Boolean(thumb)));
}
export function resolveDocumentOwner(references: DocumentReference[], uploadOwner: number | null) {
  const owners = new Set(references.map((ref) => ref.userId));
  if (owners.size > 1 || (owners.size === 1 && uploadOwner !== null && !owners.has(uploadOwner))) {
    return { userId: null, ownerSource: 'conflict' as const };
  }
  if (owners.size === 1) return { userId: [...owners][0]!, ownerSource: 'reference' as const };
  return { userId: uploadOwner, ownerSource: uploadOwner === null ? 'unknown' as const : 'upload' as const };
}
