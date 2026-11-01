import { describe, expect, it, vi } from 'vitest';
import worker from './worker';

function setup({ allowed = true } = {}) {
  const assets = vi.fn(async () => new Response('asset'));
  const limit = vi.fn(async () => ({ success: allowed }));
  const env = { ASSETS: { fetch: assets }, MCP_RATE_LIMITER: { limit } };
  return { assets, limit, env };
}

const mcpRequest = (init: RequestInit) => new Request('https://example.com/mcp', init);

describe('worker', () => {
  it('serves the docs page to browsers and crawlers', async () => {
    const { assets, limit, env } = setup();
    const response = await worker.fetch(mcpRequest({ headers: { Accept: 'text/html' } }), env);
    expect(await response.text()).toBe('asset');
    expect(assets).toHaveBeenCalled();
    expect(limit).not.toHaveBeenCalled();
  });

  it('keeps the 405 for MCP clients probing with GET', async () => {
    const { env } = setup();
    const headers = { Accept: 'application/json, text/event-stream' };
    expect((await worker.fetch(mcpRequest({ headers }), env)).status).toBe(405);
  });

  it('rate limits MCP calls per IP', async () => {
    const { limit, env } = setup({ allowed: false });
    const headers = { 'CF-Connecting-IP': '203.0.113.1' };
    const response = await worker.fetch(mcpRequest({ method: 'POST', headers, body: '{}' }), env);
    expect(response.status).toBe(429);
    expect(limit).toHaveBeenCalledWith({ key: '203.0.113.1' });
  });

  it('passes other paths to assets', async () => {
    const { assets, limit, env } = setup();
    await worker.fetch(new Request('https://example.com/data/x.json'), env);
    expect(assets).toHaveBeenCalled();
    expect(limit).not.toHaveBeenCalled();
  });
});
