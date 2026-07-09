'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');
const { loadConfig } = require('./config');

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
};

function websocketAccept(key) {
  return crypto.createHash('sha1').update(`${key}${WS_GUID}`).digest('base64');
}

function decodeFrame(buffer) {
  if (buffer.length < 2) {
    return null;
  }

  const opcode = buffer[0] & 0x0f;
  const masked = (buffer[1] & 0x80) !== 0;
  let offset = 2;
  let length = buffer[1] & 0x7f;

  if (length === 126) {
    if (buffer.length < offset + 2) {
      return null;
    }
    length = buffer.readUInt16BE(offset);
    offset += 2;
  } else if (length === 127) {
    if (buffer.length < offset + 8) {
      return null;
    }
    const bigLength = buffer.readBigUInt64BE(offset);
    if (bigLength > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new Error('Frame is too large');
    }
    length = Number(bigLength);
    offset += 8;
  }

  if (!masked) {
    throw new Error('Client frame is not masked');
  }

  if (buffer.length < offset + 4 + length) {
    return null;
  }

  const mask = buffer.subarray(offset, offset + 4);
  offset += 4;

  const payload = Buffer.alloc(length);
  for (let i = 0; i < length; i += 1) {
    payload[i] = buffer[offset + i] ^ mask[i % 4];
  }

  return {
    opcode,
    payload,
    consumed: offset + length
  };
}

function encodeFrame(payload, opcode = 0x1) {
  const data = Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload));
  let header;

  if (data.length < 126) {
    header = Buffer.from([0x80 | opcode, data.length]);
  } else if (data.length <= 0xffff) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(data.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(data.length), 2);
  }

  return Buffer.concat([header, data]);
}

function safeJoin(root, requestPath) {
  const decodedPath = decodeURIComponent(requestPath.split('?')[0]);
  const relativePath = decodedPath === '/' ? '/index.html' : decodedPath;
  const filePath = path.join(root, relativePath);

  if (!filePath.startsWith(root)) {
    return null;
  }

  return filePath;
}

function serveStatic(req, res, root) {
  const filePath = safeJoin(root, req.url || '/');
  if (!filePath) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(error.code === 'ENOENT' ? 404 : 500);
      res.end(error.code === 'ENOENT' ? 'Not found' : 'Server error');
      return;
    }

    res.writeHead(200, {
      'content-type': MIME_TYPES[path.extname(filePath)] || 'application/octet-stream',
      'cache-control': 'no-store'
    });
    res.end(content);
  });
}

function bridgeWebSocket(webSocket, config) {
  const tcpSocket = net.createConnection({
    host: config.tcpHost,
    port: config.tcpPort
  });
  let pending = Buffer.alloc(0);
  let closed = false;

  function closeBoth() {
    if (closed) {
      return;
    }
    closed = true;
    webSocket.end(encodeFrame(Buffer.alloc(0), 0x8));
    tcpSocket.end();
  }

  tcpSocket.on('data', (data) => {
    webSocket.write(encodeFrame(data.toString('utf8')));
  });

  tcpSocket.on('error', () => {
    webSocket.write(encodeFrame('Unable to reach chat server.'));
    closeBoth();
  });

  tcpSocket.on('close', closeBoth);

  webSocket.on('data', (chunk) => {
    pending = Buffer.concat([pending, chunk]);

    while (pending.length > 0) {
      let frame;
      try {
        frame = decodeFrame(pending);
      } catch {
        closeBoth();
        return;
      }

      if (!frame) {
        return;
      }

      pending = pending.subarray(frame.consumed);

      if (frame.opcode === 0x8) {
        closeBoth();
        return;
      }

      if (frame.opcode === 0x1 || frame.opcode === 0x2) {
        tcpSocket.write(frame.payload);
      }
    }
  });

  webSocket.on('error', closeBoth);
  webSocket.on('close', closeBoth);
}

function createServer(config = loadConfig()) {
  const staticRoot = path.resolve(config.staticDir);
  const server = http.createServer((req, res) => {
    if (req.url === '/healthz') {
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('ok');
      return;
    }

    serveStatic(req, res, staticRoot);
  });

  server.on('upgrade', (req, socket) => {
    if (req.url !== '/ws') {
      socket.destroy();
      return;
    }

    const key = req.headers['sec-websocket-key'];
    if (!key) {
      socket.destroy();
      return;
    }

    socket.write([
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${websocketAccept(key)}`,
      '',
      ''
    ].join('\r\n'));

    bridgeWebSocket(socket, config);
  });

  return server;
}

if (require.main === module) {
  const config = loadConfig();
  const server = createServer(config);

  server.listen(config.httpPort, config.httpHost, () => {
    console.log(`socket-web listening on http://${config.httpHost}:${config.httpPort}`);
    console.log(`bridging websocket clients to ${config.tcpHost}:${config.tcpPort}`);
  });
}

module.exports = {
  createServer,
  decodeFrame,
  encodeFrame,
  websocketAccept
};
