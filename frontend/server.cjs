const http = require('http');
const fs = require('fs');
const path = require('path');

const port = Number(process.env.PORT || 3000);
const distRoot = path.resolve(__dirname, 'dist');
const immutableAsset = /-[A-Za-z0-9_-]{8,}\.(?:js|css|woff2?|png|jpe?g|gif|svg|webp|ico)$/i;
const mimeTypes = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.map': 'application/json; charset=utf-8',
};

const sendFile = (req, res, filePath) => {
  const extension = path.extname(filePath).toLowerCase();
  res.setHeader('Content-Type', mimeTypes[extension] || 'application/octet-stream');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (path.basename(filePath) === 'index.html') {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  } else if (immutableAsset.test(path.basename(filePath)) || filePath.includes(`${path.sep}assets${path.sep}`)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  } else {
    res.setHeader('Cache-Control', 'public, max-age=604800');
  }
  const stat = fs.statSync(filePath);
  res.setHeader('Content-Length', stat.size);
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(filePath).pipe(res);
};

http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    return res.end('Method Not Allowed');
  }
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { res.statusCode = 400; return res.end('Bad Request'); }

  let requested = path.resolve(distRoot, `.${pathname}`);
  if (requested !== distRoot && !requested.startsWith(`${distRoot}${path.sep}`)) {
    res.statusCode = 403;
    return res.end('Forbidden');
  }
  try {
    if (fs.existsSync(requested) && fs.statSync(requested).isDirectory()) requested = path.join(requested, 'index.html');
    if (fs.existsSync(requested) && fs.statSync(requested).isFile()) return sendFile(req, res, requested);
    if (path.extname(pathname)) { res.statusCode = 404; return res.end('Not Found'); }
    return sendFile(req, res, path.join(distRoot, 'index.html'));
  } catch (error) {
    console.error('Static server error:', error);
    res.statusCode = 500;
    return res.end('Internal Server Error');
  }
}).listen(port, '0.0.0.0', () => {
  console.log(`HBE frontend listening on port ${port}`);
});
