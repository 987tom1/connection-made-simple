// DIAGNOSTIC: bare-minimum handler with zero imports.
// If this returns 200, the crash is in our app code.
// If this also crashes, the problem is the Lambda invocation mechanism.
function handler(req: any, res: any): void {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true, url: req.url, method: req.method }));
}

module.exports = handler;
