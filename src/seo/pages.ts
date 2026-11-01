import type { PlayerSeason, Position, WeekSummary } from '../types';
import { calculateFantasyPoints } from '../utils/calculations';
import { DEFAULT_SCORING } from '../utils/constants';
import { CSV_FIELDS } from './csv';
import { aboutLinks, siteFooter, statsLinks } from './footer';
import { STAT_KEYS } from './rescoreTable';

const SITE = 'https://historicalfantasyfootballstats.com';
const SITE_NAME = 'Historical Fantasy Football Stats';
const POSITIONS: Position[] = ['QB', 'RB', 'WR', 'TE'];
const POSITION_NAMES: Record<Position, string> = {
  QB: 'Quarterback',
  RB: 'Running Back',
  WR: 'Wide Receiver',
  TE: 'Tight End',
};

// Position pages start here: older seasons are thin and rarely searched for.
const POSITION_PAGES_START_YEAR = 2000;
const SEASON_TABLE_ROWS = 50;
const WEEK_TABLE_ROWS = 25;
const FINAL_REGULAR_SEASON_WEEK = 18;

export interface SeoData {
  rows: PlayerSeason[];
  weekly: PlayerSeason[];
  meta: {
    startYear: number;
    endYear: number;
    updatedAt?: string;
    weeklySeasons: Record<string, WeekSummary[]>;
  };
}

export interface SeoPage {
  path: string;
  title: string;
  description: string;
  html: string;
  live: boolean;
}

interface Faq {
  question: string;
  answer: string;
}

interface Crumb {
  name: string;
  path: string;
}

interface PageInput {
  path: string;
  title: string;
  description: string;
  heading: string;
  answer: string;
  crumbs: Crumb[];
  sections: string[];
  faqs?: Faq[];
  live?: boolean;
  schema?: object[];
  /** 'table' rescoring, 'modal' settings only, or 'none' where no numbers are shown. */
  scoring?: 'table' | 'modal' | 'none';
}

export interface PageAssets {
  scripts: string[];
  styles: string[];
}

export type Scored = PlayerSeason & { ppr: number; half: number; standard: number; ppg: number };

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const scoreWith = (row: PlayerSeason, reception: number) =>
  calculateFantasyPoints(row, { ...DEFAULT_SCORING, reception });

export function scored(row: PlayerSeason): Scored {
  const ppr = scoreWith(row, 1);
  return {
    ...row,
    ppr,
    half: scoreWith(row, 0.5),
    standard: scoreWith(row, 0),
    ppg: row.games > 0 ? Math.round((ppr / row.games) * 10) / 10 : 0,
  };
}

const rank = (rows: PlayerSeason[]) => rows.map(scored).sort((a, b) => b.ppr - a.ppr);
const points = (value: number) => value.toFixed(1);
const realTeam = (row: PlayerSeason) => (row.team.endsWith('TM') ? null : row.team);

function identity(row: Scored) {
  const team = realTeam(row);
  return `${row.player} (${[row.position, team].filter(Boolean).join(', ')})`;
}

function topThree(rows: Scored[]) {
  const [, second, third] = rows;
  if (!third) return '';
  return `${identity(second)} and ${identity(third)} are next with ${points(second.ppr)} and ${points(third.ppr)}.`;
}

const POSITION_COLUMNS: Record<Position | 'All', [string, keyof PlayerSeason][]> = {
  All: [['Pass Yds', 'passYds'], ['Pass TD', 'passTD'], ['Rush Yds', 'rushYds'], ['Rush TD', 'rushTD'], ['Rec', 'rec'], ['Rec Yds', 'recYds'], ['Rec TD', 'recTD']],
  QB: [['Pass Yds', 'passYds'], ['Pass TD', 'passTD'], ['Int', 'passInt'], ['Rush Yds', 'rushYds'], ['Rush TD', 'rushTD']],
  RB: [['Rush Yds', 'rushYds'], ['Rush TD', 'rushTD'], ['Rec', 'rec'], ['Rec Yds', 'recYds'], ['Rec TD', 'recTD']],
  WR: [['Tgt', 'recTgt'], ['Rec', 'rec'], ['Rec Yds', 'recYds'], ['Rec TD', 'recTD']],
  TE: [['Tgt', 'recTgt'], ['Rec', 'rec'], ['Rec Yds', 'recYds'], ['Rec TD', 'recTD']],
};

function statsTable(caption: string, rows: Scored[], position: Position | 'All', firstColumn: 'year' | 'team' | 'opponent') {
  const columns = POSITION_COLUMNS[position];
  const firstHeading = { year: 'Year', team: 'Team', opponent: 'Opp' }[firstColumn];
  const headings = ['#', 'Player', firstHeading, 'Pos', 'G', 'PPR', 'Half', 'Std', 'PPG', ...columns.map(([label]) => label)];

  const body = rows
    .map((row, index) => {
      const cells = [
        index + 1,
        escapeHtml(row.player),
        escapeHtml(String(row[firstColumn] ?? '')),
        row.position,
        row.games,
        points(row.ppr),
        points(row.half),
        points(row.standard),
        points(row.ppg),
        ...columns.map(([, key]) => row[key]),
      ];
      const stats = STAT_KEYS.map((key) => row[key]).join(',');
      return `<tr data-rank="${index + 1}" data-stats="${stats}">${cells.map((cell) => `<td>${cell}</td>`).join('')}</tr>`;
    })
    .join('');

  return (
    `<div class="table"><table data-rescorable><caption>${escapeHtml(caption)}</caption><thead><tr>` +
    headings.map((heading) => `<th scope="col">${heading}</th>`).join('') +
    `</tr></thead><tbody>${body}</tbody></table></div>`
  );
}

const section = (heading: string, body: string) => `<section><h2>${escapeHtml(heading)}</h2>${body}</section>`;

const linkList = (links: Crumb[]) =>
  `<ul class="links">${links.map(({ name, path }) => `<li><a href="${path}">${escapeHtml(name)}</a></li>`).join('')}</ul>`;

function faqSection(faqs: Faq[]) {
  const items = faqs
    .map(({ question, answer }) => `<h3>${escapeHtml(question)}</h3><p>${escapeHtml(answer)}</p>`)
    .join('');
  return section('Frequently asked questions', items);
}

/** JSON-LD sits in a script tag, so "<" must not be able to close it. */
const jsonLd = (value: object) =>
  `<script type="application/ld+json">${JSON.stringify(value).replace(/</g, '\\u003c')}</script>`;

function scoringBar(table: boolean) {
  const note = table
    ? '<p class="note" data-scoring-note hidden>Your Score uses your settings and reranks only the players listed here. The <a href="/">stats explorer</a> ranks everyone.</p>'
    : '';
  return `<div class="scoring-bar"><p>Default scoring is PPR, half-PPR, and standard. Change it to match your league.</p><button type="button" data-scoring-open hidden>Scoring Settings</button>${note}</div>`;
}

function renderPage(data: SeoData, assets: PageAssets, input: PageInput): SeoPage {
  const { path, title, description, heading, answer, crumbs, sections, faqs = [], live = false, schema = [], scoring = 'table' } = input;
  const url = `${SITE}${path}`;
  const updated = data.meta.updatedAt?.slice(0, 10);
  const updatedLabel = updated
    ? new Date(data.meta.updatedAt!).toLocaleDateString('en-US', { dateStyle: 'long', timeZone: 'UTC' })
    : null;

  const structured = [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: crumbs.map((crumb, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: crumb.name,
        item: `${SITE}${crumb.path}`,
      })),
    },
    ...(faqs.length
      ? [{
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faqs.map(({ question, answer: text }) => ({
            '@type': 'Question',
            name: question,
            acceptedAnswer: { '@type': 'Answer', text },
          })),
        }]
      : []),
    ...schema,
  ];

  const breadcrumb = crumbs
    .map((crumb, index) =>
      index === crumbs.length - 1 ? escapeHtml(crumb.name) : `<a href="${crumb.path}">${escapeHtml(crumb.name)}</a>`
    )
    .join(' › ');

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}" />
<meta name="theme-color" content="#0f766e" />
<link rel="canonical" href="${url}" />
<link rel="icon" type="image/svg+xml" href="/football.svg" />
${assets.styles.map((href) => `<link rel="stylesheet" href="/${href}" />`).join('\n')}
<link rel="stylesheet" href="/pages.css" />
<link rel="stylesheet" href="/footer.css" />
${scoring === 'none' ? '' : assets.scripts.map((src) => `<script type="module" src="/${src}"></script>`).join('\n')}
<meta property="og:type" content="website" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:url" content="${url}" />
<meta property="og:site_name" content="${SITE_NAME}" />
<meta property="og:image" content="${SITE}/og-image.png" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:site" content="@stephenmhoc" />
${structured.map(jsonLd).join('\n')}
</head>
<body>
<header><div class="wrap site-header"><a class="brand" href="/">${SITE_NAME}</a><a class="explore" href="/explore">Explore all pages</a></div></header>
<main class="wrap">
<p class="breadcrumb">${breadcrumb}</p>
<h1>${escapeHtml(heading)}</h1>
<p class="answer">${escapeHtml(answer)}</p>
${live && updatedLabel && updated ? `<p class="updated">Updated <time datetime="${updated}">${updatedLabel}</time></p>` : ''}
${scoring === 'none' ? '' : scoringBar(scoring === 'table')}
${[...sections, ...(faqs.length ? [faqSection(faqs)] : [])].join('\n')}
</main>
${siteFooter(data.meta.endYear)}
</body>
</html>
`;

  return { path, title, description, html, live };
}

function dataset(path: string, name: string, description: string, data: SeoData) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name,
    description,
    url: `${SITE}${path}`,
    ...(data.meta.updatedAt ? { dateModified: data.meta.updatedAt.slice(0, 10) } : {}),
    creator: { '@type': 'Person', name: 'Stephen Meriwether', url: 'https://merimerimeri.com' },
  };
}

const scoringFaq: Faq = {
  question: 'How are these fantasy points calculated?',
  answer:
    'PPR scoring gives 1 point per reception, 0.1 per rushing or receiving yard, 0.04 per passing yard, 6 per rushing or receiving touchdown, 4 per passing touchdown, and -2 per interception or fumble lost. Half-PPR gives 0.5 per reception and standard gives none.',
};

const estimateNote = (year: number) =>
  year < 1994 ? '<p class="note">Fumbles lost before 1994 and targets before 1992 are estimates. <a href="/methodology">How scoring works</a>.</p>' : '';

interface SeasonStatus {
  inProgress: boolean;
  label: string;
  week?: WeekSummary;
}

function seasonStatus(data: SeoData, year: number): SeasonStatus {
  const weeks = data.meta.weeklySeasons[year] ?? [];
  const week = weeks.at(-1);
  const finished = !week || (week.week >= FINAL_REGULAR_SEASON_WEEK && week.gamesPlayed === week.gamesScheduled);
  return finished ? { inProgress: false, label: 'final' } : { inProgress: true, label: `through Week ${week.week}`, week };
}

function seasonPage(data: SeoData, assets: PageAssets, year: number): SeoPage {
  const ranked = rank(data.rows.filter((row) => row.year === year));
  const [top] = ranked;
  const status = seasonStatus(data, year);
  const isCurrent = year === data.meta.endYear;
  const leaders = POSITIONS.map((position) => ranked.find((row) => row.position === position)!).filter(Boolean);
  const weeks = data.meta.weeklySeasons[year] ?? [];

  const answer = status.inProgress
    ? `${identity(top)} leads all players in ${year} fantasy scoring ${status.label} with ${points(top.ppr)} PPR points in ${top.games} games. ${topThree(ranked)}`
    : `${identity(top)} was the top fantasy scorer of the ${year} NFL season with ${points(top.ppr)} PPR points in ${top.games} games. ${topThree(ranked)}`;

  const positionLinks = year >= POSITION_PAGES_START_YEAR
    ? POSITIONS.map((position) => ({ name: `${year} ${position} leaders`, path: `/seasons/${year}/${position.toLowerCase()}` }))
    : [];

  const faqs: Faq[] = [
    {
      question: status.inProgress ? `Who is leading fantasy football in ${year}?` : `Who was the best fantasy football player in ${year}?`,
      answer: `${identity(top)} ${status.inProgress ? 'leads' : 'led'} with ${points(top.ppr)} PPR points, ${points(top.half)} half-PPR points, and ${points(top.standard)} standard points.`,
    },
    ...leaders.map((row) => ({
      question: status.inProgress ? `Who is the top fantasy ${row.position} in ${year}?` : `Who was the top fantasy ${row.position} in ${year}?`,
      answer: `${row.player} ${status.inProgress ? 'is the top' : 'was the top'} ${POSITION_NAMES[row.position].toLowerCase()} with ${points(row.ppr)} PPR points in ${row.games} games.`,
    })),
    scoringFaq,
  ];

  const title = status.inProgress
    ? `${year} Fantasy Football Leaders: Through Week ${status.week!.week} Stats`
    : `${year} Fantasy Football Leaders: Final PPR Rankings`;

  const sections = [
    section(
      `Top ${Math.min(SEASON_TABLE_ROWS, ranked.length)} fantasy scorers, ${year}`,
      statsTable(`${year} fantasy points, ${status.label}, sorted by PPR`, ranked.slice(0, SEASON_TABLE_ROWS), 'All', 'team') + estimateNote(year)
    ),
  ];
  if (weeks.length) {
    sections.push(section(`${year} weekly leaders`, linkList(weeks.map(({ week }) => ({ name: `Week ${week}`, path: `/seasons/${year}/week/${week}` })))));
  }
  if (positionLinks.length) sections.push(section('By position', linkList(positionLinks)));

  const description = `${year} fantasy football leaders ${status.inProgress ? status.label : 'and final rankings'}: ${top.player} ${status.inProgress ? 'leads' : 'led'} with ${points(top.ppr)} PPR points. PPR, half-PPR, and standard stats for every position.`;

  return renderPage(data, assets, {
    path: `/seasons/${year}`,
    title,
    description,
    heading: `${year} Fantasy Football Leaders`,
    answer,
    crumbs: [{ name: 'Home', path: '/' }, { name: 'Seasons', path: '/seasons' }, { name: String(year), path: `/seasons/${year}` }],
    sections,
    faqs,
    live: isCurrent,
    schema: [dataset(`/seasons/${year}`, `${year} NFL Fantasy Football Stats`, description, data)],
  });
}

function seasonPositionPage(data: SeoData, assets: PageAssets, year: number, position: Position): SeoPage {
  const ranked = rank(data.rows.filter((row) => row.year === year && row.position === position));
  const [top] = ranked;
  const status = seasonStatus(data, year);
  const name = POSITION_NAMES[position];
  const path = `/seasons/${year}/${position.toLowerCase()}`;
  const verb = status.inProgress ? 'leads' : 'led';

  const answer = `${identity(top)} ${verb} ${year} fantasy ${name.toLowerCase()}s ${status.inProgress ? status.label : ''} with ${points(top.ppr)} PPR points in ${top.games} games. ${topThree(ranked)}`.replace('  ', ' ');
  const description = `${year} fantasy ${name.toLowerCase()} rankings ${status.inProgress ? status.label : ''}: ${top.player} ${verb} with ${points(top.ppr)} PPR points. See PPR, half-PPR, and standard stats.`.replace('  ', ' ');

  return renderPage(data, assets, {
    path,
    title: `${year} Fantasy ${position} Leaders: ${name} Rankings${status.inProgress ? ` Through Week ${status.week!.week}` : ''}`,
    description,
    heading: `${year} Fantasy ${name} Leaders`,
    answer,
    crumbs: [
      { name: 'Home', path: '/' },
      { name: 'Seasons', path: '/seasons' },
      { name: String(year), path: `/seasons/${year}` },
      { name: position, path },
    ],
    sections: [
      section(
        `Top ${Math.min(SEASON_TABLE_ROWS, ranked.length)} ${year} ${position}s`,
        statsTable(`${year} ${position} fantasy points, ${status.label}, sorted by PPR`, ranked.slice(0, SEASON_TABLE_ROWS), position, 'team')
      ),
      section('Other positions', linkList(POSITIONS.filter((p) => p !== position).map((p) => ({ name: `${year} ${p} leaders`, path: `/seasons/${year}/${p.toLowerCase()}` })))),
    ],
    faqs: [
      {
        question: `Who ${status.inProgress ? 'is' : 'was'} the best fantasy ${position} in ${year}?`,
        answer: `${identity(top)} ${verb} with ${points(top.ppr)} PPR points, or ${points(top.ppg)} per game.`,
      },
      scoringFaq,
    ],
    live: year === data.meta.endYear,
    schema: [dataset(path, `${year} NFL Fantasy ${name} Stats`, description, data)],
  });
}

function weekPage(data: SeoData, assets: PageAssets, year: number, summary: WeekSummary): SeoPage {
  const { week, gamesPlayed, gamesScheduled } = summary;
  const ranked = rank(data.weekly.filter((row) => row.year === year && row.week === week));
  const [top] = ranked;
  const path = `/seasons/${year}/week/${week}`;
  const incomplete = gamesScheduled !== null && gamesPlayed < gamesScheduled;
  const scope = incomplete ? ` so far (${gamesPlayed} of ${gamesScheduled} games played)` : '';
  const answer = `${identity(top)} ${incomplete ? 'leads' : 'led'} Week ${week} of the ${year} NFL season${scope} with ${points(top.ppr)} PPR points against ${top.opponent}. ${topThree(ranked)}`;
  const description = `${year} Week ${week} fantasy football leaders${scope}: ${top.player} scored ${points(top.ppr)} PPR points. See every top performance with PPR, half-PPR, and standard points.`;

  return renderPage(data, assets, {
    path,
    title: `${year} Week ${week} Fantasy Football Leaders and Top Scorers`,
    description,
    heading: `${year} Week ${week} Fantasy Football Leaders`,
    answer,
    crumbs: [
      { name: 'Home', path: '/' },
      { name: 'Seasons', path: '/seasons' },
      { name: String(year), path: `/seasons/${year}` },
      { name: `Week ${week}`, path },
    ],
    sections: [
      section(
        `Top ${Math.min(WEEK_TABLE_ROWS, ranked.length)} performances`,
        statsTable(`${year} Week ${week} fantasy points, sorted by PPR`, ranked.slice(0, WEEK_TABLE_ROWS), 'All', 'opponent')
      ),
    ],
    faqs: [
      {
        question: `Who scored the most fantasy points in Week ${week} of ${year}?`,
        answer: `${identity(top)} ${incomplete ? 'leads so far' : 'led the week'} with ${points(top.ppr)} PPR points, ${points(top.half)} half-PPR points, and ${points(top.standard)} standard points.`,
      },
      scoringFaq,
    ],
    live: year === data.meta.endYear,
  });
}

function allTimePage(data: SeoData, assets: PageAssets, position?: Position): SeoPage {
  const ranked = rank(position ? data.rows.filter((row) => row.position === position) : data.rows);
  const [top] = ranked;
  const label = position ? `${POSITION_NAMES[position]} ` : '';
  const path = position ? `/all-time/${position.toLowerCase()}` : '/all-time';
  const range = `${data.meta.startYear}-${data.meta.endYear}`;
  const answer = `The best fantasy ${position ? `${POSITION_NAMES[position].toLowerCase()} ` : ''}season since ${data.meta.startYear} is ${top.player}'s ${top.year} season, with ${points(top.ppr)} PPR points in ${top.games} games. ${ranked[1].player}'s ${ranked[1].year} season is second with ${points(ranked[1].ppr)}.`;
  const description = `The best fantasy football ${label.toLowerCase()}seasons of all time, ${range}. ${top.player}'s ${top.year} season ranks first with ${points(top.ppr)} PPR points.`;
  const crumbs = [{ name: 'Home', path: '/' }, { name: 'All-Time', path: '/all-time' }];
  if (position) crumbs.push({ name: position, path });

  return renderPage(data, assets, {
    path,
    title: `Best Fantasy ${position ? `${position} ` : 'Football '}Seasons of All Time (${range})`,
    description,
    heading: `Best Fantasy ${label || 'Football '}Seasons of All Time`,
    answer,
    crumbs,
    sections: [
      section(
        `Top ${SEASON_TABLE_ROWS} seasons, ${range}`,
        statsTable(`Best fantasy seasons, ${range}, sorted by PPR`, ranked.slice(0, SEASON_TABLE_ROWS), position ?? 'All', 'year') +
          '<p class="note">Seasons were scored with today\'s rules, whether or not fantasy football was played that year.</p>'
      ),
      section(position ? 'Other lists' : 'By position', linkList([
        ...(position ? [{ name: 'All positions', path: '/all-time' }] : []),
        ...POSITIONS.filter((p) => p !== position).map((p) => ({ name: `Best ${p} seasons`, path: `/all-time/${p.toLowerCase()}` })),
      ])),
    ],
    faqs: [
      {
        question: `What is the best fantasy ${position ? `${position} ` : 'football '}season of all time?`,
        answer: `${top.player}'s ${top.year} season ranks first with ${points(top.ppr)} PPR points, ${points(top.half)} half-PPR points, and ${points(top.standard)} standard points.`,
      },
      scoringFaq,
    ],
    schema: [dataset(path, `Best Fantasy ${label}Seasons of All Time`, description, data)],
  });
}

function careerTotals(rows: PlayerSeason[]) {
  const totals = new Map<string, PlayerSeason & { seasons: number }>();
  const stats = ['games', 'passCmp', 'passAtt', 'passYds', 'passTD', 'passInt', 'rushAtt', 'rushYds', 'rushTD', 'recTgt', 'rec', 'recYds', 'recTD', 'fmb', 'fmbLost'] as const;

  for (const row of rows) {
    // Name plus position keeps different players who share a name apart.
    const key = `${row.player}|${row.position}`;
    const total = totals.get(key);
    if (!total) {
      totals.set(key, { ...row, seasons: 1 });
      continue;
    }
    total.seasons += 1;
    for (const stat of stats) total[stat] += row[stat];
    total.year = Math.max(total.year, row.year);
  }
  return [...totals.values()];
}

function careerPage(data: SeoData, assets: PageAssets, position?: Position): SeoPage {
  const careers = careerTotals(position ? data.rows.filter((row) => row.position === position) : data.rows);
  const ranked = rank(careers);
  const [top] = ranked;
  const label = position ? POSITION_NAMES[position] : '';
  const path = position ? `/career-leaders/${position.toLowerCase()}` : '/career-leaders';
  const answer = `${top.player} has the most career fantasy points${position ? ` among ${label.toLowerCase()}s` : ''} since ${data.meta.startYear}, with ${points(top.ppr)} PPR points in ${top.games} games. ${ranked[1].player} is second with ${points(ranked[1].ppr)}.`;
  const description = `All-time fantasy football career leaders${position ? ` at ${label.toLowerCase()}` : ''} since ${data.meta.startYear}. ${top.player} ranks first with ${points(top.ppr)} career PPR points.`;
  const crumbs = [{ name: 'Home', path: '/' }, { name: 'Career Leaders', path: '/career-leaders' }];
  if (position) crumbs.push({ name: position, path });

  return renderPage(data, assets, {
    path,
    title: `All-Time Fantasy ${position ? `${position} ` : 'Football '}Career Leaders: Most Points Ever`,
    description,
    heading: `All-Time Fantasy ${label || 'Football'} Career Leaders`,
    answer,
    crumbs,
    sections: [
      section(
        `Top ${SEASON_TABLE_ROWS} careers`,
        statsTable(`Career fantasy points since ${data.meta.startYear}, sorted by PPR. Year is the last season played.`, ranked.slice(0, SEASON_TABLE_ROWS), position ?? 'All', 'year') +
          `<p class="note">Careers count regular-season stats from ${data.meta.startYear} on, so anyone who played earlier is only partly counted.</p>`
      ),
      section(position ? 'Other lists' : 'By position', linkList([
        ...(position ? [{ name: 'All positions', path: '/career-leaders' }] : []),
        ...POSITIONS.filter((p) => p !== position).map((p) => ({ name: `${p} career leaders`, path: `/career-leaders/${p.toLowerCase()}` })),
      ])),
    ],
    faqs: [
      {
        question: `Who has the most fantasy points of all time${position ? ` at ${position}` : ''}?`,
        answer: `${top.player} leads with ${points(top.ppr)} career PPR points, ${points(top.half)} half-PPR points, and ${points(top.standard)} standard points.`,
      },
      scoringFaq,
    ],
    schema: [dataset(path, `Fantasy ${label} Career Leaders`.replace('  ', ' '), description, data)],
  });
}

function seasonsIndex(data: SeoData, assets: PageAssets): SeoPage {
  const years: number[] = [];
  for (let year = data.meta.endYear; year >= data.meta.startYear; year--) years.push(year);

  return renderPage(data, assets, {
    path: '/seasons',
    title: `NFL Fantasy Football Stats by Season (${data.meta.startYear}-${data.meta.endYear})`,
    description: `Fantasy football leaders for every NFL season from ${data.meta.startYear} to ${data.meta.endYear}, with PPR, half-PPR, and standard points.`,
    heading: 'Fantasy Football Stats by Season',
    answer: `This site covers every NFL season from ${data.meta.startYear} through ${data.meta.endYear}, with fantasy points for every quarterback, running back, wide receiver, and tight end.`,
    crumbs: [{ name: 'Home', path: '/' }, { name: 'Seasons', path: '/seasons' }],
    sections: [section('All seasons', linkList(years.map((year) => ({ name: String(year), path: `/seasons/${year}` }))))],
    scoring: 'none',
  });
}

function methodologyPage(data: SeoData, assets: PageAssets): SeoPage {
  const { startYear, endYear } = data.meta;

  return renderPage(data, assets, {
    path: '/methodology',
    title: 'How Fantasy Points Are Calculated: Scoring and Data Sources',
    description: 'How this site calculates PPR, half-PPR, and standard fantasy points, where the NFL stats come from, how often they update, and what the known limits are.',
    heading: 'How Scoring and Data Work',
    answer: `Fantasy points on this site are calculated from regular-season NFL stats for quarterbacks, running backs, wide receivers, and tight ends from ${startYear} through ${endYear}, using one set of scoring rules for every era.`,
    crumbs: [{ name: 'Home', path: '/' }, { name: 'How Scoring Works', path: '/methodology' }],
    scoring: 'modal',
    sections: [
      section(
        'Scoring rules',
        `<div class="table"><table><thead><tr><th scope="col">Stat</th><th scope="col">PPR</th><th scope="col">Half</th><th scope="col">Std</th></tr></thead><tbody>
<tr><td>Reception</td><td>1</td><td>0.5</td><td>0</td></tr>
<tr><td>Passing yards</td><td>1 per 25</td><td>1 per 25</td><td>1 per 25</td></tr>
<tr><td>Passing touchdown</td><td>4</td><td>4</td><td>4</td></tr>
<tr><td>Interception</td><td>-2</td><td>-2</td><td>-2</td></tr>
<tr><td>Rushing or receiving yards</td><td>1 per 10</td><td>1 per 10</td><td>1 per 10</td></tr>
<tr><td>Rushing or receiving touchdown</td><td>6</td><td>6</td><td>6</td></tr>
<tr><td>Fumble lost</td><td>-2</td><td>-2</td><td>-2</td></tr>
</tbody></table></div><p class="note">Two-point conversions are not scored. On the <a href="/">stats explorer</a>, you can change any of these values.</p>`
      ),
      section(
        'Data sources',
        `<p>Seasons through 2025 come from Pro Football Reference. Seasons from 2026 onward come from <a href="https://github.com/nflverse/nflverse-data">nflverse</a>, with games played taken from snap counts.</p><p>The current season is checked daily, which also picks up official stat corrections. Compared on the 2025 season, the nflverse pipeline matched Pro Football Reference on every passing, rushing, receiving, and fumble stat for the 569 players compared.</p>`
      ),
      section(
        'Known limits',
        '<ul><li>Stats cover the regular season only.</li><li>Targets before 1992 and fumbles lost before 1994 are estimates.</li><li>Games started are not available for 2026 onward.</li><li>Seasons with fewer games are not adjusted, so use points per game to compare eras.</li><li>Two-way and position-switching players can appear under more than one position.</li></ul>'
      ),
    ],
    faqs: [
      scoringFaq,
      {
        question: 'How often does the data update?',
        answer: 'The site checks for new stats every day during the season, and it deploys only when the numbers change.',
      },
    ],
  });
}

function explorePage(data: SeoData, assets: PageAssets): SeoPage {
  const { startYear, endYear, weeklySeasons } = data.meta;
  const weeks = weeklySeasons[endYear] ?? [];
  const byPosition = (root: string, label: (position: Position) => string) =>
    POSITIONS.map((position) => ({ name: label(position), path: `${root}/${position.toLowerCase()}` }));
  const decades: Crumb[] = [];
  for (let decade = Math.floor(endYear / 10) * 10; decade >= Math.floor(startYear / 10) * 10; decade -= 10) {
    for (let year = Math.min(decade + 9, endYear); year >= Math.max(decade, startYear); year--) {
      decades.push({ name: String(year), path: `/seasons/${year}` });
    }
  }

  return renderPage(data, assets, {
    path: '/explore',
    title: 'Explore Fantasy Football Stats: Every Leaderboard',
    description: `Every fantasy football leaderboard on this site in one place: the ${endYear} season, weekly leaders, the best seasons ever, career leaders, and every year since ${startYear}.`,
    heading: 'Explore Fantasy Football Stats',
    answer: `Every leaderboard on this site, from the ${endYear} season back to ${startYear}.`,
    crumbs: [{ name: 'Home', path: '/' }, { name: 'Explore', path: '/explore' }],
    sections: [
      section(`${endYear} season`, linkList([{ name: `${endYear} leaders`, path: `/seasons/${endYear}` }, ...byPosition(`/seasons/${endYear}`, (p) => `${endYear} ${p} leaders`)])),
      ...(weeks.length ? [section(`${endYear} weekly leaders`, linkList(weeks.map(({ week }) => ({ name: `Week ${week}`, path: `/seasons/${endYear}/week/${week}` }))))] : []),
      section('Best seasons of all time', linkList([{ name: 'All positions', path: '/all-time' }, ...byPosition('/all-time', (p) => `Best ${p} seasons`)])),
      section('Career leaders', linkList([{ name: 'All positions', path: '/career-leaders' }, ...byPosition('/career-leaders', (p) => `${p} career leaders`)])),
      section('Every season', linkList(decades)),
      section('Tools and guides', linkList([{ name: 'Stats explorer', path: '/' }, ...aboutLinks.filter(({ path }) => path !== '/explore')])),
    ],
    live: true,
    scoring: 'none',
  });
}

function dataPage(data: SeoData, assets: PageAssets): SeoPage {
  const { startYear, endYear, weeklySeasons } = data.meta;
  const weeklyYears = Object.keys(weeklySeasons).filter((year) => weeklySeasons[year].length);
  const url = (path: string) => `${SITE}${path}`;
  const count = data.rows.length.toLocaleString('en-US');
  const description = `Download historical fantasy football data for free: ${count} QB, RB, WR, and TE seasons from ${startYear} through ${endYear} as CSV, with PPR, half-PPR, and standard points.`;

  const download = (name: string, path: string) => `<li><a href="${path}" download>${escapeHtml(name)}</a></li>`;
  const years: number[] = [];
  for (let year = endYear; year >= startYear; year--) years.push(year);

  const fields = CSV_FIELDS.map(({ name, description: text }) => `<tr><td><code>${name}</code></td><td>${escapeHtml(text)}</td></tr>`).join('');

  return renderPage(data, assets, {
    path: '/data',
    title: `Historical Fantasy Football Data: Free CSV Downloads (${startYear}-${endYear})`,
    description,
    heading: 'Historical Fantasy Football Data',
    answer: `Download fantasy football data for every QB, RB, WR, and TE season from ${startYear} through ${endYear} as free CSV files, with no signup. The full file has ${count} player seasons, each with stats and PPR, half-PPR, and standard points.`,
    crumbs: [{ name: 'Home', path: '/' }, { name: 'Data', path: '/data' }],
    sections: [
      section(
        'Download the data',
        `<ul class="links">${download(`All seasons, ${startYear}-${endYear} (CSV)`, '/data/csv/all-seasons.csv')}${weeklyYears.map((year) => download(`${year} weekly stats (CSV)`, `/data/csv/weekly-${year}.csv`)).join('')}</ul>`
      ),
      section('Download one season', `<ul class="links">${years.map((year) => download(String(year), `/data/csv/${year}.csv`)).join('')}</ul>`),
      section(
        'Other ways to use it',
        linkList([
          { name: 'Season data as JSON', path: '/data/fantasy_data.json' },
          { name: 'MCP server for AI agents', path: '/mcp' },
          { name: 'Stats explorer', path: '/' },
        ])
      ),
      section('Fields', `<div class="table fields"><table><thead><tr><th scope="col">Column</th><th scope="col">Meaning</th></tr></thead><tbody>${fields}</tbody></table></div>`),
      section(
        'Sources and limits',
        `<p>Seasons through 2025 come from <a href="https://www.pro-football-reference.com/">Pro Football Reference</a>. Seasons from 2026 onward come from <a href="https://github.com/nflverse/nflverse-data">nflverse</a>. The current season is checked daily.</p><p>Stats cover the regular season only. See <a href="/methodology">how scoring and data work</a> for the rules and known limits.</p>`
      ),
    ],
    faqs: [
      {
        question: 'Where can I download historical fantasy football data?',
        answer: `This page has free CSV files for every NFL season from ${startYear} through ${endYear}, for all seasons at once or one season at a time.`,
      },
      {
        question: 'Does the data include fantasy points?',
        answer: 'Yes. Every row has PPR, half-PPR, and standard points, plus the raw stats needed to apply your own scoring.',
      },
      {
        question: 'Is there weekly fantasy football data?',
        answer: `Weekly files are available for ${weeklyYears.join(', ') || 'the live season'}. Earlier seasons are season totals only.`,
      },
    ],
    live: true,
    scoring: 'none',
    schema: [{
      '@context': 'https://schema.org',
      '@type': 'Dataset',
      name: `Historical Fantasy Football Data ${startYear}-${endYear}`,
      description,
      url: url('/data'),
      temporalCoverage: `${startYear}/..`,
      isAccessibleForFree: true,
      keywords: ['fantasy football', 'NFL', 'historical stats', 'PPR'],
      ...(data.meta.updatedAt ? { dateModified: data.meta.updatedAt.slice(0, 10) } : {}),
      creator: { '@type': 'Person', name: 'Stephen Meriwether', url: 'https://merimerimeri.com' },
      isBasedOn: ['https://www.pro-football-reference.com/', 'https://github.com/nflverse/nflverse-data'],
      distribution: [
        { '@type': 'DataDownload', encodingFormat: 'text/csv', contentUrl: url('/data/csv/all-seasons.csv') },
        { '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: url('/data/fantasy_data.json') },
      ],
    }],
  });
}

export function buildPages(data: SeoData, assets: PageAssets = { scripts: [], styles: [] }): SeoPage[] {
  const { startYear, endYear, weeklySeasons } = data.meta;
  const pages = [dataPage(data, assets), explorePage(data, assets), seasonsIndex(data, assets), methodologyPage(data, assets), allTimePage(data, assets), careerPage(data, assets)];

  for (const position of POSITIONS) {
    pages.push(allTimePage(data, assets, position), careerPage(data, assets, position));
  }

  for (let year = endYear; year >= startYear; year--) {
    pages.push(seasonPage(data, assets, year));
    if (year >= POSITION_PAGES_START_YEAR) {
      for (const position of POSITIONS) pages.push(seasonPositionPage(data, assets, year, position));
    }
    for (const summary of weeklySeasons[year] ?? []) pages.push(weekPage(data, assets, year, summary));
  }

  return pages;
}

export function buildSitemap(pages: SeoPage[], data: SeoData): string {
  const lastmod = data.meta.updatedAt?.slice(0, 10);
  const entry = (path: string, live: boolean) =>
    `  <url>\n    <loc>${SITE}${path}</loc>\n${live && lastmod ? `    <lastmod>${lastmod}</lastmod>\n` : ''}  </url>`;

  const entries = [entry('/', true), entry('/mcp', false), ...pages.map((page) => entry(page.path, page.live))];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`;
}

/** A plain-text guide to the site for AI engines and agents. See llmstxt.org. */
export function buildLlmsTxt(data: SeoData): string {
  const { startYear, endYear } = data.meta;
  const status = seasonStatus(data, endYear);
  const line = ({ name, path }: Crumb, note: string) => `- [${name}](${SITE}${path}): ${note}`;

  return `# ${SITE_NAME}

> NFL fantasy football stats for every QB, RB, WR, and TE season from ${startYear} through ${endYear}, with PPR, half-PPR, standard, and custom scoring. The ${endYear} season is ${status.inProgress ? `updated daily and currently runs ${status.label}` : 'complete'}.

Fantasy points use one set of rules for every era. Stats are regular season only. Targets before 1992 and fumbles lost before 1994 are estimates.

## Key pages

${[
  line({ name: `${endYear} Fantasy Leaders`, path: `/seasons/${endYear}` }, 'current season leaders, with weekly and position pages'),
  line({ name: 'Best Seasons of All Time', path: '/all-time' }, 'top single seasons overall and by position'),
  line({ name: 'Career Leaders', path: '/career-leaders' }, 'most career fantasy points overall and by position'),
  line({ name: 'Download the Data', path: '/data' }, 'free CSV downloads for every season, with a field guide'),
  line({ name: 'Explore', path: '/explore' }, 'an index of every leaderboard on the site'),
  line({ name: 'All Seasons', path: '/seasons' }, `an index of every season since ${startYear}`),
  line({ name: 'How Scoring Works', path: '/methodology' }, 'scoring rules, data sources, and limits'),
].join('\n')}

## For agents

- [MCP server](${SITE}/mcp): a free, open MCP server for live queries and custom scoring, with no API key
- [All seasons CSV](${SITE}/data/csv/all-seasons.csv): every season row with fantasy points
- [Season data](${SITE}/data/fantasy_data.json): all season rows as JSON
- [Weekly data](${SITE}/data/weekly/${endYear}.json): ${endYear} weekly rows as JSON
`;
}

function miniTable(title: string, rows: Scored[]) {
  const body = rows
    .map((row, index) =>
      `<tr><td>${index + 1}</td><td>${escapeHtml(row.player)}</td><td>${row.position}</td><td>${row.year}</td><td>${points(row.ppr)}</td></tr>`
    )
    .join('');

  return (
    `<h2>${title}</h2><table><thead><tr><th>Rank</th><th>Player</th><th>Pos</th><th>Year</th>` +
    `<th>PPR Points</th></tr></thead><tbody>${body}</tbody></table>`
  );
}

/** Real content for the initial homepage HTML. React replaces it on load. */
export function homepageContent(data: SeoData): string {
  const { startYear, endYear } = data.meta;
  const links = [...statsLinks(endYear), ...aboutLinks]
    .map(({ name, path }) => `<li><a href="${path}">${escapeHtml(name)}</a></li>`)
    .join('');

  return (
    `<main style="max-width:56rem;margin:0 auto;padding:1.5rem 1rem">` +
    `<h1>Historical Fantasy Football Stats</h1>` +
    `<p>Compare historical fantasy football data from ${startYear}-${endYear}. Rank every QB, RB, WR, ` +
    `and TE season with PPR, half-PPR, standard, or your own custom scoring, or ` +
    `<a href="/data">download the data</a>.</p>` +
    miniTable(`${endYear} Fantasy Football Leaders`, rank(data.rows.filter((row) => row.year === endYear)).slice(0, 10)) +
    miniTable('Best Fantasy Seasons of All Time', rank(data.rows).slice(0, 10)) +
    `<ul>${links}</ul></main>`
  );
}
