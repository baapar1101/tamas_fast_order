import assert from 'node:assert/strict';
import test from 'node:test';
import { isPdfDocument } from '../src/lib/upload-document.js';

test('documents advertised as PDF must contain a PDF signature', () => {
  assert.equal(isPdfDocument(Buffer.from('%PDF-1.7\n')), true);
  assert.equal(isPdfDocument(Buffer.from('<script>alert(1)</script>')), false);
  assert.equal(isPdfDocument(Buffer.alloc(0)), false);
});
