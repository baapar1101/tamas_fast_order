import assert from 'node:assert/strict';
import test from 'node:test';
import { clientErrorResponse } from '../src/lib/client-error.js';

test('malformed requests and oversized uploads stay client errors instead of becoming 500', () => {
  assert.equal(clientErrorResponse(400)?.code, 'bad_request');
  assert.equal(clientErrorResponse(413)?.code, 'payload_too_large');
  assert.equal(clientErrorResponse(415)?.code, 'unsupported_media_type');
  assert.equal(clientErrorResponse(500), null);
});
