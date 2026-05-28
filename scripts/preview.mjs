/**
 * Local production preview for Astro + @astrojs/vercel.
 * `astro preview` only serves static `dist/` and does not run on-demand API routes.
 * This script serves `dist/client/` and delegates /api/* to the Vercel build output.
 *
 * Prerequisite: npm run build
 */
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createRequest, writeResponse } from 'astro/app/node';

const repoRoot = path.join(fileURLToPath(new URL('.', import.meta.url)), '..');
const clientDir = path.join(repoRoot, 'dist', 'client');
const handlerUrl = path.join(
  repoRoot,
  '.vercel',
  'output',
  'functions',
  '_render.func',
  'dist',
  'server',
  'entry.mjs',
);

const preferredPort = Number(process.env.PORT) || 4321;

if (!existsSync(clientDir)) {
  console.error('[preview] Missing dist/client. Run `npm run build` first.');
  process.exit(1);
}

if (!existsSync(handlerUrl)) {
  console.error('[preview] Missing Vercel server bundle. Run `npm run build` first.');
  process.exit(1);
}

const { default: handler } = await import(pathToFileURL(handlerUrl).href);

if (typeof handler?.fetch !== 'function') {
  console.error('[preview] Server entry does not export a fetch handler.');
  process.exit(1);
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.woff2': 'font/woff2',
  };
  return types[ext] ?? 'application/octet-stream';
}

function resolveStaticFile(pathname) {
  const safePath = pathname.replace(/\0/g, '');
  if (safePath.includes('..')) return null;

  if (safePath === '/' || safePath === '') {
    const index = path.join(clientDir, 'index.html');
    return existsSync(index) ? index : null;
  }

  const direct = path.join(clientDir, safePath);
  if (existsSync(direct) && !direct.endsWith(path.sep)) {
    return direct;
  }

  if (!path.extname(safePath)) {
    const asDir = path.join(clientDir, safePath, 'index.html');
    if (existsSync(asDir)) return asDir;
    const asHtml = path.join(clientDir, `${safePath}.html`);
    if (existsSync(asHtml)) return asHtml;
  }

  return null;
}

function needsServerHandler(pathname) {
  return (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_image') ||
    pathname.startsWith('/_server-islands/')
  );
}

/** @param {number} port */
function listen(server, port) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, () => {
      server.off('error', reject);
      resolve(port);
    });
  });
}

const server = createServer(async (req, res) => {
  try {
    const host =
      typeof req.headers.host === 'string' && req.headers.host.trim()
        ? req.headers.host.trim()
        : 'localhost';
    const pathname = new URL(req.url ?? '/', `http://${host}`).pathname;

    if (!needsServerHandler(pathname) && (req.method === 'GET' || req.method === 'HEAD')) {
      const file = resolveStaticFile(pathname);
      if (file) {
        if (req.method === 'HEAD') {
          res.writeHead(200, { 'Content-Type': contentType(file) });
          res.end();
          return;
        }
        const body = await readFile(file);
        res.writeHead(200, { 'Content-Type': contentType(file) });
        res.end(body);
        return;
      }
    }

    const request = createRequest(req, { port: activePort });
    const response = await handler.fetch(request);
    await writeResponse(response, res);
  } catch (error) {
    if (error instanceof Error) {
      console.error('[preview]', error.message);
    } else {
      console.error('[preview]', String(error));
    }
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Internal Server Error');
  }
});

let activePort = preferredPort;

try {
  activePort = await listen(server, preferredPort);
} catch (error) {
  if (error && typeof error === 'object' && 'code' in error && error.code === 'EADDRINUSE') {
    console.warn(
      `[preview] Port ${preferredPort} is in use (often \`astro preview\`, which does not run /api routes).`,
    );
    for (let candidate = preferredPort + 1; candidate <= preferredPort + 10; candidate += 1) {
      try {
        activePort = await listen(server, candidate);
        break;
      } catch (retryError) {
        if (
          !retryError ||
          typeof retryError !== 'object' ||
          !('code' in retryError) ||
          retryError.code !== 'EADDRINUSE'
        ) {
          throw retryError;
        }
      }
    }
    if (activePort === preferredPort) {
      console.error(`[preview] No free port between ${preferredPort} and ${preferredPort + 10}.`);
      process.exit(1);
    }
    console.warn(`[preview] Using http://localhost:${activePort}/ instead.`);
  } else {
    throw error;
  }
}

console.log(`Preview (static + API): http://localhost:${activePort}/`);
console.log(`Health check: http://localhost:${activePort}/api/health`);
console.log(
  'Note: `npm run preview:astro` serves static files only — API routes need this preview script.',
);
