import { bindings, defineConfig, triggers } from 'cf/config';
import * as entrypoint from './src/worker.ts' with { type: 'cf-worker' };

export default defineConfig({
  accountId: 'a5338d302c3f447a7039df25cfbfb8d5',
  worker: {
    name: 'historicalfantasyfootballstats',
    entrypoint,
    compatibilityDate: '2026-10-01',
    env: {
      ASSETS: bindings.assets(),
      MCP_RATE_LIMITER: bindings.rateLimit({
        namespace: '1001',
        simple: { limit: 10, period: 10 },
      }),
    },
    assets: {
      notFoundHandling: '404-page',
      // Everything else is served as a static asset, which is free and never runs the Worker.
      runWorkerFirst: ['/mcp'],
    },
    // A route rather than a custom domain, so the zone's DNS records stay untouched.
    triggers: [
      triggers.fetch({
        pattern: 'historicalfantasyfootballstats.com/*',
        zone: 'historicalfantasyfootballstats.com',
      }),
    ],
    workersDev: false,
    previewUrls: false,
    observability: { enabled: true },
  },
});
