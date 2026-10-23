export function isPdfDocument(buffer: Buffer): boolean {
  return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
}
