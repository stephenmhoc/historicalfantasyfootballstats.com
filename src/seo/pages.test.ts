import fs from 'fs';
import path from 'path';
import { beforeAll, describe, expect, it } from 'vitest';
import meta from '../generated/dataMeta.json';
import { buildCsvFiles, toCsv } from './csv';
import { siteFooter } from './footer';
import { STAT_KEYS } from './rescoreTable';
import { buildLlmsTxt, buildPages, buildSitemap, homepageContent, type SeoData, type SeoPage } from './pages';

const DATA_DIR = path.join(__dirname, '..', '..', 'public', 'data');
const read = (file: string) => JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));

let data: SeoData;
let pages: SeoPage[];
const page = (url: string) => pages.find((candidate) => candidate.path === url)!;
const jsonLd = (html: string) =>
  [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map((match) => JSON.parse(match[1]));

beforeAll(() => {
  data = {
    rows: read('fantasy_data.json'),
    weekly: fs.readdirSync(path.join(DATA_DIR, 'weekly')).flatMap((file) => read(`weekly/${file}`)),
    meta,
  };
  pages = buildPages(data);
});

describe('buildPages', () => {
  it('gives every page a unique title, description and path', () => {
    for (const key of ['path', 'title', 'description'] as const) {
      expect(new Set(pages.map((p) => p[key])).size).toBe(pages.length);
    }
  });

  it('keeps titles and descriptions a searchable length', () => {
    expect(Math.max(...pages.map((p) => p.title.length))).toBeLessThanOrEqual(70);
    expect(Math.max(...pages.map((p) => p.description.length))).toBeLessThanOrEqual(220);
  });

  it('has valid structured data, canonical URLs and one h1 everywhere', () => {
    for (const p of pages) {
      expect(jsonLd(p.html).length).toBeGreaterThan(0);
      expect(p.html).toContain(`rel="canonical" href="https://historicalfantasyfootballstats.com${p.path}"`);
      expect(p.html.match(/<h1>/g)).toHaveLength(1);
      expect(p.html).not.toMatch(/undefined|NaN|\bnull\b/);
    }
  });

  it('marks the current season in progress and links its weeks', () => {
    const current = page(`/seasons/${meta.endYear}`);
    expect(current.title).toContain('Through Week');
    expect(current.html).toContain(`/seasons/${meta.endYear}/week/1"`);
    expect(current.html).toContain('leads all players');
    expect(current.html).toContain('<time');
  });

  it('agrees with known history', () => {
    expect(page('/seasons/2019/rb').html).toContain('Christian McCaffrey (RB, CAR) led 2019 fantasy running backs with 469.2 PPR');
    expect(page('/career-leaders/wr').html).toContain('Jerry Rice has the most career fantasy points');
  });

  it('only links to pages that exist', () => {
    const known = new Set([...pages.map((p) => p.path), '/', '/mcp']);
    for (const p of pages) {
      for (const [, href] of p.html.matchAll(/<a href="(\/[^"]*)"/g)) {
        if (!href.startsWith('/data/')) expect(known).toContain(href);
      }
    }
    for (const [, href] of homepageContent(data).matchAll(/<a href="(\/[^"]*)"/g)) expect(known).toContain(href);
  });

  it('lists every page in the sitemap, dating only live ones', () => {
    const sitemap = buildSitemap(pages, data);
    expect(sitemap.match(/<loc>/g)).toHaveLength(pages.length + 2);
    expect(sitemap).toContain(`<loc>https://historicalfantasyfootballstats.com/seasons/${meta.endYear}</loc>\n    <lastmod>`);
    expect(sitemap).toContain('<loc>https://historicalfantasyfootballstats.com/seasons/1985</loc>\n  </url>');
  });

  it('shares one footer and offers scoring wherever player numbers appear', () => {
    const footer = siteFooter(meta.endYear);
    for (const p of pages) expect(p.html).toContain(footer);
    for (const p of pages.filter(({ html }) => html.includes('data-stats='))) {
      expect(p.html).toContain('data-scoring-open');
      expect(p.html).toContain('data-rescorable');
    }
  });

  it('stores the stats needed to rescore a row', () => {
    const row = page('/seasons/2019/rb').html.match(/data-stats="([^"]+)"/)![1].split(',').map(Number);
    const mccaffrey = data.rows.find((r) => r.year === 2019 && r.player === 'Christian McCaffrey')!;
    expect(row).toEqual(STAT_KEYS.map((key) => mccaffrey[key]));
  });

  it('links every generated page group from the explore page', () => {
    const { html } = page('/explore');
    for (const href of [`/seasons/${meta.endYear}"`, '/seasons/1970"', '/all-time/qb"', '/career-leaders/te"', '/methodology"']) {
      expect(html).toContain(href);
    }
  });

  it('offers a working download for every link on the data page', () => {
    const files = new Set(buildCsvFiles(data).map(({ fileName }) => `/${fileName}`));
    const links = [...page('/data').html.matchAll(/<a href="([^"]+\.csv)"/g)].map((match) => match[1]);
    expect(links.length).toBe(files.size);
    for (const link of links) expect(files).toContain(link);
  });

  it('writes CSV rows that agree with the site', () => {
    const lines = toCsv(data.rows.filter((row) => row.year === 2019)).trim().split('\n');
    const columns = lines[0].split(',');
    const top = lines[1].split(',');
    expect(top[columns.indexOf('player')]).toBe('Christian McCaffrey');
    expect(top[columns.indexOf('ppr_points')]).toBe('469.2');
    expect(columns).not.toContain('week');
    expect(lines).toHaveLength(data.rows.filter((row) => row.year === 2019).length + 1);
  });

  it('quotes CSV values that contain commas or quotes', () => {
    const [row] = data.rows;
    const csv = toCsv([{ ...row, player: 'Odell "OBJ" Beckham, Jr.' }]);
    expect(csv).toContain('"Odell ""OBJ"" Beckham, Jr."');
  });

  it('opens links to other sites in a new tab', () => {
    const sources = [...pages.map((p) => p.html), fs.readFileSync(path.join(DATA_DIR, '..', 'mcp.html'), 'utf8')];
    for (const html of sources) {
      for (const [link] of html.matchAll(/<a [^>]*href="https?:[^>]*>/g)) {
        expect(link).toContain('target="_blank"');
        expect(link).toContain('rel="noopener noreferrer"');
      }
    }
  });

  it('points AI engines at the key pages', () => {
    const llms = buildLlmsTxt(data);
    expect(llms).toContain(`/seasons/${meta.endYear})`);
    expect(llms).toContain('/mcp)');
  });
});
