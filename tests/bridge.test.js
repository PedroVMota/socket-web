'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const net = require('node:net');
const { once } = require('node:events');
const { createServer } = require('../src/server');

function listen(server, host = '127.0.0.1') {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, host, () => {
      server.off('error', reject);
      resolve(server.address().port);
    });
  });
}

function clientFrame(text) {
  const payload = Buffer.from(text);
  const mask = Buffer.from([5, 6, 7, 8]);
  const header = Buffer.from([0x81, 0x80 | payload.length]);
  const masked = Buffer.alloc(payload.length);

  for (let i = 0; i < payload.length; i += 1) {
    masked[i] = payload[i] ^ mask[i % 4];
  }

  return Buffer.concat([header, mask, masked]);
}

test('websocket messages are bridged to the TCP chat server', async (t) => {
  const tcpServer = net.createServer((socket) => {
    socket.on('data', (data) => {
      socket.write(`echo:${data.toString('utf8')}`);
    });
  });

  let tcpPort;
  try {
    tcpPort = await listen(tcpServer);
  } catch (error) {
    if (error.code === 'EPERM') {
      t.skip('local socket binding is blocked');
      return;
    }
    throw error;
  }
  t.after(() => tcpServer.close());

  const webServer = createServer({
    httpHost: '127.0.0.1',
    httpPort: 0,
    tcpHost: '127.0.0.1',
    tcpPort,
    staticDir: 'public'
  });
  const webPort = await listen(webServer);
  t.after(() => webServer.close());

  const socket = net.createConnection({ host: '127.0.0.1', port: webPort });
  t.after(() => socket.destroy());

  await once(socket, 'connect');
  const key = crypto.randomBytes(16).toString('base64');
  socket.write([
    'GET /ws HTTP/1.1',
    'Host: 127.0.0.1',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Key: ${key}`,
    'Sec-WebSocket-Version: 13',
    '',
    ''
  ].join('\r\n'));

  const [handshake] = await once(socket, 'data');
  assert.match(handshake.toString('utf8'), /^HTTP\/1.1 101 Switching Protocols/);

  socket.write(clientFrame('hello'));

  const [message] = await once(socket, 'data');
  assert.equal(message[0], 0x81);
  assert.equal(message.subarray(2).toString('utf8'), 'echo:hello');
});
