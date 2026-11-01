# Fantasy MVP

[![CI](https://github.com/smeriwether/historicalfantasyfootballstats.com/actions/workflows/test.yml/badge.svg)](https://github.com/smeriwether/historicalfantasyfootballstats.com/actions/workflows/test.yml)

A static site for comparing historical fantasy football statistics from 1970 to the current week, with a public MCP server for agents.

## Features

- **Every Season Since 1970**: Compare players across eras
- **Live Season**: The current season updates automatically, with a week-by-week view
- **MCP Server**: Query the data from any MCP-capable agent, no account needed
- **Configurable Scoring**: Customize fantasy point values (standard, PPR, half-PPR)
- **Position Filtering**: Filter by QB, RB, WR, TE, or view all positions
- **Decade/Year Filtering**: View by decade (1970s, 1980s, etc.) or individual years
- **Sortable Table**: Sort by any column including fantasy points
- **Mobile Friendly**: Responsive design that works on all devices
- **Persistent Settings**: Scoring configuration saved to localStorage

## Tech Stack

- React 18 + TypeScript
- Vite
- Tailwind CSS 4
- TanStack Table
- Zustand (state management)

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

It runs in the same Cloudflare Worker that serves the site (`src/worker.ts`). `npm run build` packs the data into `public/data/mcp/` for it.

### Limits

- **Cost:** the account is on Workers Free, so usage cannot produce a bill. Upgrading to Workers Paid removes that guarantee, because Cloudflare has no account-wide spending cap.
- **Daily quota:** 100,000 Worker requests a day, resetting at midnight UTC and shared with every Worker on the account. Only `/mcp` runs the Worker; static assets are free and unlimited.
- **Per IP:** the Worker's rate limiter returns 429 after 10 requests in 10 seconds. `workers.dev` and preview URLs are off, so the custom domain is the only way in.
- **Per request:** bodies over 16 KB are rejected and results are capped at 100 rows.

## Data Sources

- **1970-2024:** [Fantasy Data](https://www.kaggle.com/datasets/heefjones/nfl-fantasy-data-1970-2024) on Kaggle (Pro Football Reference data). Targets before 1992 and fumbles lost before 1994 are estimates, which is why some are fractional.
- **2025:** a Pro Football Reference export.
- **2026 onward:** [nflverse](https://github.com/nflverse/nflverse-data) weekly player stats, with snap counts for games played. nflverse has no games started, so that field is `null`.

`.github/workflows/update-data.yml` runs daily. When the numbers change it runs the tests and the build, then commits to `main` and deploys the site. It picks up stat corrections and rolls over to a new season by itself. A failed run leaves the published data alone.

## License

MIT
