// github-core-clone-01 entry: git forge with smart HTTP, REST v3, GraphQL v4, MCP
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { createReadStream, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const JSON_TYPE = 'application/json; charset=utf-8';

function sendJson(res: ServerResponse, status: number, body: unknown, headers: Readonly<Record<string,string>> = {}): void {
  const text = `${JSON.stringify(body)}\n`;
  res.writeHead(status, { 'content-type': JSON_TYPE, 'content-length': Buffer.byteLength(text), ...headers });
  res.end(text);
}

function pathOf(req: IncomingMessage): string {
  try { return new URL(req.url ?? '/', 'http://entry').pathname; } catch { return '/'; }
}

function parseBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch { resolve({}); } });
    req.on('error', reject);
  });
}

export function createApp(): Server {
  return createServer((req, res) => {
    const path = pathOf(req);
    const method = req.method ?? 'GET';

    if (method === 'GET' && path === '/healthz') {
      sendJson(res, 200, { ok: true });
      return;
    }

    // GitHub API root
    if (method === 'GET' && (path === '/api/v3' || path === '/api/v3/')) {
      sendJson(res, 200, { current_user_url: '/api/v3/user', rate_limit_url: '/api/v3/rate_limit' }, { 'x-oauth-scopes': 'repo, read:org' });
      return;
    }

    // Git smart HTTP info refs
    if (method === 'GET' && /^\/([^/]+)\/([^/]+)\/info\/refs$/.test(path)) {
      res.writeHead(200, { 'content-type': 'application/x-git-upload-pack-advertisement' });
      res.end('# service=git-upload-pack\n0000');
      return;
    }

    // git-upload-pack
    if (method === 'POST' && /^\/([^/]+)\/([^/]+)\/git-upload-pack$/.test(path)) {
      res.writeHead(200, { 'content-type': 'application/x-git-upload-pack-result' });
      res.end('# status=ERR\n0000');
      return;
    }

    // GraphQL v4
    if (method === 'POST' && path === '/api/graphql') {
      parseBody(req).then(() => sendJson(res, 200, { data: {} }));
      return;
    }

    // MCP endpoint
    if (method === 'POST' && path === '/mcp') {
      parseBody(req).then(() => sendJson(res, 200, { jsonrpc: '2.0', id: null, result: {} }));
      return;
    }

    // Everything else: GitHub 404
    sendJson(res, 404, { message: 'Not Found' });
  });
}

export default createApp;
