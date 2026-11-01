import fs from 'fs';
import path from 'path';
import { beforeAll, describe, expect, it } from 'vitest';
// @ts-expect-error Plain JS build script with no type declarations
import { packRows } from '../../scripts/buildMcpData.js';
import meta from '../generated/dataMeta.json';
import { Dataset } from './dataset';
import { handleMcpRequest } from './server';

// Exercises the real dataset through the real request handler.
const DATA_DIR = path.join(__dirname, '..', '..', 'public', 'data');
const VERSION = '2026-07-28';
const LATEST_SEASON = Math.max(...Object.keys(meta.weeklySeasons).map(Number));

let dataset: Dataset;

beforeAll(() => {
  const read = (file: string) => JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
  const rows = [...read('fantasy_data.json'), ...read(`weekly/${LATEST_SEASON}.json`)];
  const { buffer, lookup } = packRows(rows);
  dataset = new Dataset(buffer.buffer as ArrayBuffer, lookup);
});

function post(body: unknown, headers: Record<string, string> = {}) {
  const request = new Request('https://example.com/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
  return handleMcpRequest(request, async () => dataset);
}

function modern(method: string, params: Record<string, unknown> = {}, headers: Record<string, string> = {}) {
  return post(
    {
      jsonrpc: '2.0',
      id: 1,
      method,
      params: { ...params, _meta: { 'io.modelcontextprotocol/protocolVersion': VERSION } },
    },
    {
      'MCP-Protocol-Version': VERSION,
      'Mcp-Method': method,
      ...(method === 'tools/call' ? { 'Mcp-Name': String(params.name) } : {}),
      ...headers,
    }
  );
}

async function tool(name: string, args: Record<string, unknown> = {}) {
  const response = await modern('tools/call', { name, arguments: args });
  expect(response.status).toBe(200);
  const { result } = await response.json();
  return result;
}

describe('modern protocol', () => {
  it('implements server/discover', async () => {
    const { result } = await (await modern('server/discover')).json();
    expect(result.resultType).toBe('complete');
    expect(result.supportedVersions).toContain(VERSION);
    expect(result.capabilities.tools).toEqual({});
    expect(result._meta['io.modelcontextprotocol/serverInfo'].name).toBeTruthy();
  });

  it('lists tools with cache hints', async () => {
    const { result } = await (await modern('tools/list')).json();
    expect(result.tools.map((t: { name: string }) => t.name)).toContain('get_leaders');
    expect(result.cacheScope).toBe('public');
  });

  it('rejects an unsupported version and says what is supported', async () => {
    const response = await post(
      { jsonrpc: '2.0', id: 1, method: 'tools/list', params: { _meta: { 'io.modelcontextprotocol/protocolVersion': '1900-01-01' } } },
      { 'MCP-Protocol-Version': '1900-01-01', 'Mcp-Method': 'tools/list' }
    );
    expect(response.status).toBe(400);
    const { error } = await response.json();
    expect(error.code).toBe(-32022);
    expect(error.data).toMatchObject({ requested: '1900-01-01' });
    expect(error.data.supported).toContain(VERSION);
  });

  it('rejects headers that disagree with the body', async () => {
    const response = await modern('tools/list', {}, { 'Mcp-Method': 'tools/call' });
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe(-32020);
  });

  it('returns 404 for unknown methods', async () => {
    const response = await modern('resources/list');
    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe(-32601);
  });
});

describe('legacy protocol', () => {
  it('negotiates through initialize, then lists tools', async () => {
    const init = await post({
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } },
    });
    const { result } = await init.json();
    expect(result.protocolVersion).toBe('2025-06-18');
    expect(result.capabilities.tools).toBeDefined();
    expect(init.headers.get('Mcp-Session-Id')).toBeNull();

    const notified = await post({ jsonrpc: '2.0', method: 'notifications/initialized' }, { 'MCP-Protocol-Version': '2025-06-18' });
    expect(notified.status).toBe(202);

    const list = await post({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, { 'MCP-Protocol-Version': '2025-06-18' });
    expect((await list.json()).result.tools.length).toBeGreaterThan(0);
  });

  it('offers its newest legacy version to unknown clients', async () => {
    const init = await post({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2030-01-01' } });
    expect((await init.json()).result.protocolVersion).toBe('2025-11-25');
  });
});

describe('transport', () => {
  it('rejects GET and DELETE with 405', async () => {
    for (const method of ['GET', 'DELETE']) {
      const response = await handleMcpRequest(new Request('https://example.com/mcp', { method }), async () => dataset);
      expect(response.status).toBe(405);
    }
  });

  it('allows browser clients', async () => {
    const response = await handleMcpRequest(new Request('https://example.com/mcp', { method: 'OPTIONS' }), async () => dataset);
    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('rejects oversized requests before parsing them', async () => {
    const response = await post('x'.repeat(20_000));
    expect(response.status).toBe(413);
  });

  it('handles malformed bodies', async () => {
    expect((await (await post('{nope')).json()).error.code).toBe(-32700);
    expect((await (await post({ id: 1 })).json()).error.code).toBe(-32600);
  });
});

describe('tools', () => {
  it('describes coverage', async () => {
    const { structuredContent: info } = await tool('get_data_info');
    expect(info.endYear).toBe(meta.endYear);
    expect(info.latestSeason).toBe(LATEST_SEASON);
  });

  it('finds players despite punctuation', async () => {
    const { structuredContent } = await tool('search_players', { query: 'ceedee' });
    expect(structuredContent.players[0].name).toBe('CeeDee Lamb');
  });

  it('agrees with the site on a known season', async () => {
    const { structuredContent } = await tool('get_player_stats', { player: 'Christian McCaffrey', start_year: 2019, end_year: 2019 });
    const [career] = structuredContent.careers;
    expect(career.seasons).toHaveLength(1);
    expect(career.seasons[0]).toMatchObject({ year: 2019, rushYds: 1387, rec: 116, recYds: 1005, gamesStarted: 16 });
    // 138.7 + 15*6 + 116 + 100.5 + 4*6 (the site does not score 2-point conversions)
    expect(career.seasons[0].fantasyPoints).toBeCloseTo(469.2, 1);
    expect(career.totals.fantasyPoints).toBe(career.seasons[0].fantasyPoints);
  });

  it('separates different players who share a name', async () => {
    const { structuredContent } = await tool('get_player_stats', { player: 'Alex Smith' });
    expect(structuredContent.careers.map((c: { position: string }) => c.position).sort()).toEqual(['QB', 'TE']);
  });

  it('asks for clarification on an ambiguous partial name', async () => {
    const result = await tool('get_player_stats', { player: 'johnson' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/several players/);
  });

  it('ranks all-time seasons, and scoring changes the order', async () => {
    const ppr = (await tool('get_leaders', { limit: 3 })).structuredContent.leaders;
    expect(ppr[0].rank).toBe(1);
    expect(ppr[0].fantasyPoints).toBeGreaterThanOrEqual(ppr[1].fantasyPoints);

    const qbHeavy = { preset: 'standard', passingTD: 10 };
    const passing = (await tool('get_leaders', { scoring: qbHeavy, limit: 1 })).structuredContent.leaders;
    expect(passing[0].position).toBe('QB');
  });

  it('never returns weekly rows as seasons', async () => {
    const { leaders } = (await tool('get_leaders', { year: LATEST_SEASON, limit: 100 })).structuredContent;
    expect(leaders.every((row: { week: number | null }) => row.week === null)).toBe(true);
  });

  it('ranks a single week', async () => {
    const { structuredContent } = await tool('get_leaders', { year: LATEST_SEASON, week: 1, limit: 5 });
    expect(structuredContent.leaders).toHaveLength(5);
    expect(structuredContent.leaders[0]).toMatchObject({ week: 1, year: LATEST_SEASON, games: 1 });
    expect(structuredContent.leaders[0].opponent).toBeTruthy();
  });

  it('totals careers across seasons', async () => {
    const { leaders } = (await tool('get_leaders', { group_by: 'player', position: 'WR', limit: 1 })).structuredContent;
    expect(leaders[0].player).toBe('Jerry Rice');
    expect(leaders[0].seasons).toBeGreaterThan(15);
  });

  it('ranks per game with a minimum sample', async () => {
    const { leaders } = (await tool('get_leaders', { per_game: true, min_games: 10, limit: 5 })).structuredContent;
    expect(leaders.every((row: { games: number }) => row.games >= 10)).toBe(true);
    expect(leaders[0].pointsPerGame).toBeGreaterThanOrEqual(leaders[1].pointsPerGame);
  });

  it('returns a game log whose points add up to the season', async () => {
    const leader = (await tool('get_leaders', { year: LATEST_SEASON, limit: 1 })).structuredContent.leaders[0];
    const { games } = (await tool('get_player_weekly', { player: leader.player, position: leader.position })).structuredContent;
    expect(games.length).toBeGreaterThan(0);
    const total = games.reduce((sum: number, game: { fantasyPoints: number }) => sum + game.fantasyPoints, 0);
    expect(total).toBeCloseTo(leader.fantasyPoints, 0);
  });

  it('reports bad input as a tool error', async () => {
    const cases = [
      ['get_player_weekly', { player: 'Josh Allen', season: 1985 }],
      ['get_leaders', { week: 3 }],
      ['get_leaders', { position: 'K' }],
      ['get_leaders', { scoring: { preset: 'ppr', bogus: 1 } }],
      ['get_player_stats', { player: 'zzzzzz' }],
      ['search_players', {}],
    ] as const;

    for (const [name, args] of cases) {
      const result = await tool(name, args as Record<string, unknown>);
      expect(result.isError).toBe(true);
    }
  });
});
