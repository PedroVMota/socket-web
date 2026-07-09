'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadConfig, parseInteger } = require('../src/config');

test('parseInteger falls back for invalid values', () => {
  assert.equal(parseInteger('', 8080, 1, 65535), 8080);
  assert.equal(parseInteger('abc', 8080, 1, 65535), 8080);
  assert.equal(parseInteger('70000', 8080, 1, 65535), 8080);
});

test('loadConfig reads HTTP and TCP settings', () => {
  assert.deepEqual(loadConfig({
    HTTP_HOST: '127.0.0.1',
    HTTP_PORT: '9000',
    CHAT_TCP_HOST: 'chat.internal',
    CHAT_TCP_PORT: '6000',
    STATIC_DIR: '/tmp/static'
  }), {
    httpHost: '127.0.0.1',
    httpPort: 9000,
    tcpHost: 'chat.internal',
    tcpPort: 6000,
    staticDir: '/tmp/static'
  });
});
