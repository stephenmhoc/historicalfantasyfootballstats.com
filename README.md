# Historical Fantasy Football Stats

[![CI](https://github.com/smeriwether/historicalfantasyfootballstats.com/actions/workflows/test.yml/badge.svg)](https://github.com/smeriwether/historicalfantasyfootballstats.com/actions/workflows/test.yml)

A site for comparing NFL fantasy football stats from 1970 to the current week, live at [historicalfantasyfootballstats.com](https://historicalfantasyfootballstats.com). It has an interactive stats explorer, generated leaderboard pages, free CSV downloads, and a public MCP server for agents.

## Features

- **Stats Explorer**: Filter by position, decade, or year, and sort any column
- **Live Season**: The current season updates automatically, with a week-by-week view
- **Leaderboard Pages**: Static pages for every season, position, and week, plus all-time and career lists
- **Configurable Scoring**: PPR, half-PPR, standard, or custom values, saved in the browser and shared across pages
- **Data Downloads**: Free CSV files for every season at `/data`
- **MCP Server**: Query the data from any MCP-capable agent, no account needed
- **AI and Search Friendly**: Answer-first pages, structured data, `sitemap.xml`, and `llms.txt`
- **Mobile Friendly**: Responsive design that works on all devices

## Tech Stack

- React 18 + TypeScript
- Vite
- Tailwind CSS 4
- TanStack Table
- Zustand (state management)
- Cloudflare Workers with static assets

## Getting Started

### Prerequisites

- Node.js 22+
- npm

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/smeriwether/historicalfantasyfootballstats.com.git
   cd historicalfantasyfootballstats.com
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

The dev server runs the stats explorer only. Generated pages, CSV files, `sitemap.xml`, `llms.txt`, and the shared footer on `/mcp` and the 404 page exist only in a production build, so use `npm run build` and `npm run preview` to see them.

## Scripts

- `npm run dev` - Start development server
- `npm run lint` - Run ESLint
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run update-data` - Refresh the current season from nflverse (`-- --season 2026` to choose one)
- `npm run process-data` - Rebuild 1970-2024 from the Kaggle `fantasy_data.csv`, keeping later seasons
- `npm run add-2025-data` - Replace 2025 rows from a PFR export at `fantasy-2025.csv`
- `npm test` - Run unit tests
- `npm run test:e2e` - Run Playwright e2e tests

## Deployment

The site is a Cloudflare Worker with static assets, configured in `cloudflare.config.ts` and deployed with the [`cf` CLI](https://developers.cloudflare.com/cf/).

`.github/workflows/deploy.yml` deploys every push to `main`, using the `CLOUDFLARE_API_TOKEN` repository secret. To deploy by hand:

```bash
cf auth login
npm run deploy
```

## MCP Server

An open, read-only [MCP](https://modelcontextprotocol.io) server runs at `https://historicalfantasyfootballstats.com/mcp`. It needs no API key.

```bash
claude mcp add --transport http fantasy-stats https://historicalfantasyfootballstats.com/mcp
```

| Tool | Purpose |
| --- | --- |
| `get_data_info` | Coverage, freshness and caveats |
| `search_players` | Find players by name |
| `get_player_stats` | Season-by-season stats and career totals |
| `get_player_weekly` | Game-by-game stats |
| `get_leaders` | Rank seasons, weeks, careers or per-game output |

Tools that return fantasy points accept a `preset` (`ppr`, `half_ppr`, `standard`) and any individual overrides.

Its docs page is `public/mcp.html`, served when a browser or crawler requests `/mcp`. It runs in the same Cloudflare Worker that serves the site (`src/worker.ts`). `npm run build` packs the data into `public/data/mcp/` for it.

### Limits

- **Cost:** the account is on Workers Free, so usage cannot produce a bill. Upgrading to Workers Paid removes that guarantee, because Cloudflare has no account-wide spending cap.
- **Daily quota:** 100,000 Worker requests a day, resetting at midnight UTC and shared with every Worker on the account. Only `/mcp` runs the Worker; static assets are free and unlimited.
- **Per IP:** the Worker's rate limiter returns 429 after 10 requests in 10 seconds. `workers.dev` and preview URLs are off, so the custom domain is the only way in.
- **Per request:** bodies over 16 KB are rejected and results are capped at 100 rows.

## Generated Pages

`npm run build` generates everything below from `public/data`, using the same scoring code as the site. The `seoPages` plugin in `vite.config.ts` does this, and nothing it produces is committed.

| Output | Source | Contents |
| --- | --- | --- |
| `/seasons`, `/seasons/{year}` | `src/seo/pages.ts` | Season index and leaders for every year |
| `/seasons/{year}/{qb,rb,wr,te}` | `src/seo/pages.ts` | Position leaders from 2000 on |
| `/seasons/{year}/week/{n}` | `src/seo/pages.ts` | Weekly leaders for seasons with weekly data |
| `/all-time`, `/career-leaders` | `src/seo/pages.ts` | Best seasons and careers, overall and by position |
| `/data` | `src/seo/pages.ts` | Downloads and a guide to every column |
| `/explore`, `/methodology` | `src/seo/pages.ts` | Index of every page, and scoring rules and limits |
| `/data/csv/*.csv` | `src/seo/csv.ts` | All seasons, one file per season, and weekly files |
| `sitemap.xml`, `llms.txt` | `src/seo/pages.ts` | Built from the page list |

- **Page content:** each page opens with a sentence answering its main question, then adds a table, FAQs, a canonical URL, and JSON-LD.
- **Footer:** `src/seo/footer.ts` is the only footer, used by the React app and every static page. `public/footer.css` styles it. `public/mcp.html` and `public/404.html` hold a `<!--site-footer-->` placeholder that the build fills in.
- **Scoring on static pages:** `src/seo/scoringWidget.tsx` loads the same modal as the homepage, and `src/seo/rescoreTable.ts` applies custom scoring. Each table row stores its stats in a `data-stats` attribute. Custom scoring adds a Your Score column and reranks only the rows on that page.
- **Styles:** generated pages load Tailwind for the modal as well as `public/pages.css`, so class names in `pages.css` must not match Tailwind utilities. A `.table` class once broke mobile layouts this way.

## Data

### Sources

| Seasons | Source | Notes |
| --- | --- | --- |
| 1970-2024 | [Fantasy Data](https://www.kaggle.com/datasets/heefjones/nfl-fantasy-data-1970-2024) on Kaggle (Pro Football Reference data) | Targets before 1992 and fumbles lost before 1994 are estimates, so some are fractional |
| 2025 | A Pro Football Reference export | |
| 2026 onward | [nflverse](https://github.com/nflverse/nflverse-data) | No games started, so that field is `null` |

All stats are regular season only.

### Files

| Path | Committed | Contents |
| --- | --- | --- |
| `public/data/fantasy_data.json` | Yes | One row per player season, newest first |
| `public/data/weekly/{year}.json` | Yes | One row per player game, for nflverse seasons |
| `src/generated/dataMeta.json` | Yes | Year range, weeks with games played and scheduled, and `updatedAt` |
| `public/data/mcp/` | No | Packed data for the MCP server, built by `scripts/buildMcpData.js` |

### Daily Updates

`.github/workflows/update-data.yml` runs daily at 10:17 UTC, after West Coast games end and nflverse has published. It can also be run by hand, with an optional season.

1. **Pick the season.** `scripts/updateData.js` uses the current one, which changes on September 1. That is how a new season rolls over without any code changes.
2. **Download from nflverse.** It fetches weekly player stats, the player list, snap counts, and the schedule. If no regular-season stats exist yet, it stops.
3. **Transform.** `scripts/lib/nflverse.js` maps rows to the site's format, including team codes, fullbacks counted as RBs, and two-way players listed on defense. It keeps each player's existing name spelling so a career stays one player. Games played come from snap counts when available.
4. **Check.** The update fails if nflverse is missing a required column, the latest week goes backward, or the weekly row count drops by more than 10%. It also refuses to overwrite a PFR-sourced season unless run with `--force`, because that would lose games started.
5. **Publish.** If nothing changed, the run ends here. Otherwise it runs the unit tests and the build, commits to `main`, and deploys.

Stat corrections are picked up the same way, because each run rewrites the whole season. A failed run leaves the published data alone. `updatedAt` changes only when stats change.

The workflow deploys for itself because a push made with `GITHUB_TOKEN` does not trigger `deploy.yml`. It also re-enables its own schedule on every run, because GitHub turns off scheduled workflows after 60 days without repository activity.

To run an update locally:

```bash
npm run update-data -- --season 2026
```

Add `--cache-dir <dir>` to reuse downloaded files between runs.

## License

MIT
