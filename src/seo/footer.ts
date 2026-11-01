export interface SiteLink {
  name: string;
  path: string;
}

export function statsLinks(endYear: number): SiteLink[] {
  return [
    { name: `${endYear} Fantasy Leaders`, path: `/seasons/${endYear}` },
    { name: 'Best Seasons of All Time', path: '/all-time' },
    { name: 'Career Leaders', path: '/career-leaders' },
    { name: 'All Seasons', path: '/seasons' },
  ];
}

export const aboutLinks: SiteLink[] = [
  { name: 'Explore All Pages', path: '/explore' },
  { name: 'How Scoring Works', path: '/methodology' },
  { name: 'MCP Server', path: '/mcp' },
];

const list = (links: SiteLink[]) =>
  `<ul>${links.map(({ name, path }) => `<li><a href="${path}">${name}</a></li>`).join('')}</ul>`;

/** The one footer for every page. Styled by public/footer.css. */
export function siteFooter(endYear: number): string {
  return `<footer class="site-footer"><div class="site-footer-inner">
<div class="site-footer-brand"><a href="/">Historical Fantasy Football Stats</a><p>Regular-season data from <a href="https://www.pro-football-reference.com/">Pro Football Reference</a> and <a href="https://github.com/nflverse/nflverse-data">nflverse</a>.</p></div>
<nav aria-label="Stats"><h2>Stats</h2>${list(statsLinks(endYear))}</nav>
<nav aria-label="About"><h2>About</h2>${list(aboutLinks)}</nav>
<nav aria-label="Elsewhere"><h2>Elsewhere</h2><ul><li><a href="https://x.com/stephenmhoc">Twitter/X</a></li><li><a href="https://github.com/smeriwether/historicalfantasyfootballstats.com">GitHub</a></li></ul></nav>
<p class="site-footer-credit">Made with ❤️ by <a href="https://merimerimeri.com">Stephen Meriwether</a>. Go Texans!</p>
</div></footer>`;
}
