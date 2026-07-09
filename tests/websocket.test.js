'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { decodeFrame, encodeFrame, websocketAccept } = require('../src/server');

function maskedClientFrame(text) {
  const payload = Buffer.from(text);
  const mask = Buffer.from([1, 2, 3, 4]);
  const header = Buffer.from([0x81, 0x80 | payload.length]);
  const masked = Buffer.alloc(payload.length);

  for (let i = 0; i < payload.length; i += 1) {
    masked[i] = payload[i] ^ mask[i % 4];
  }

  return Buffer.concat([header, mask, masked]);
}

test('websocketAccept creates the expected handshake digest', () => {
  const key = crypto.randomBytes(16).toString('base64');
  assert.match(websocketAccept(key), /^[A-Za-z0-9+/]+={0,2}$/);
});

test('decodeFrame reads masked client text frames', () => {
  const decoded = decodeFrame(maskedClientFrame('hello'));
  assert.equal(decoded.opcode, 0x1);
  assert.equal(decoded.payload.toString('utf8'), 'hello');
  assert.equal(decoded.consumed, 11);
});

test('encodeFrame writes unmasked server text frames', () => {
  assert.deepEqual(encodeFrame('ok'), Buffer.from([0x81, 0x02, 0x6f, 0x6b]));
});
