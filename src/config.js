'use strict';

function parseInteger(value, fallback, min, max) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    return fallback;
  }

  return parsed;
}

function loadConfig(env = process.env) {
  return {
    httpHost: env.HTTP_HOST || '0.0.0.0',
    httpPort: parseInteger(env.HTTP_PORT, 8080, 1, 65535),
    tcpHost: env.CHAT_TCP_HOST || 'c-web-socket-server',
    tcpPort: parseInteger(env.CHAT_TCP_PORT, 5555, 1, 65535),
    staticDir: env.STATIC_DIR || 'public'
  };
}

module.exports = {
  loadConfig,
  parseInteger
};
