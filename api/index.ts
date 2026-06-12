import { createAppInstance } from '../src/app';

const appPromise = createAppInstance();

// module.exports (not export default) so esbuild CJS bundle is a callable function
async function handler(req: any, res: any): Promise<void> {
  const app = await appPromise;
  app(req, res);
}

module.exports = handler;
