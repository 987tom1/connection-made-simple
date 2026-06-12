// DIAGNOSTIC v2: imports full app, catches every possible error, returns it in body.
// Goal: surface the actual crash message so the MCP log truncation doesn't hide it.

let startupError: unknown = null;

// Catch uncaught exceptions and unhandled rejections so the process doesn't die
process.on('uncaughtException', (err) => {
  startupError = err;
  console.error('[CMS] uncaughtException:', err);
});
process.on('unhandledRejection', (reason) => {
  startupError = reason;
  console.error('[CMS] unhandledRejection:', reason);
});

let appPromise: Promise<import('express').Express> | null = null;

async function getApp(): Promise<import('express').Express> {
  try {
    const { createAppInstance } = await import('../src/app');
    return await createAppInstance();
  } catch (err) {
    console.error('[CMS] createAppInstance threw:', err);
    throw err;
  }
}

function handler(req: any, res: any): void {
  if (startupError) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ stage: 'startup', error: String(startupError), detail: (startupError as any)?.stack }));
    return;
  }

  if (!appPromise) appPromise = getApp();

  appPromise.then(
    (app) => { app(req, res); },
    (err) => {
      appPromise = null;
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ stage: 'init', error: String(err), detail: (err as any)?.stack }));
    }
  );
}

module.exports = handler;
