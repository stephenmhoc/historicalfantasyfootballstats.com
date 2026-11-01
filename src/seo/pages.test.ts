import fs from 'fs';
import path from 'path';
import { beforeAll, describe, expect, it } from 'vitest';
import meta from '../generated/dataMeta.json';
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
      for (const [, href] of p.html.matchAll(/<a href="(\/[^"]*)"/g)) expect(known).toContain(href);
    }
    for (const [, href] of homepageContent(data).matchAll(/<a href="(\/[^"]*)"/g)) expect(known).toContain(href);
  });

  it('lists every page in the sitemap, dating only live ones', () => {
    const sitemap = buildSitemap(pages, data);
    expect(sitemap.match(/<loc>/g)).toHaveLength(pages.length + 2);
    expect(sitemap).toContain(`<loc>https://historicalfantasyfootballstats.com/seasons/${meta.endYear}</loc>\n    <lastmod>`);
    expect(sitemap).toContain('<loc>https://historicalfantasyfootballstats.com/seasons/1985</loc>\n  </url>');
  });

  it('points AI engines at the key pages', () => {
    const llms = buildLlmsTxt(data);
    expect(llms).toContain(`/seasons/${meta.endYear})`);
    expect(llms).toContain('/mcp)');
  });
});
