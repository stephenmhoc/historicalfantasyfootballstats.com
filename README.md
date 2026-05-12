# Fantasy MVP

[![CI](https://github.com/smeriwether/historicalfantasyfootballstats.com/actions/workflows/test.yml/badge.svg)](https://github.com/smeriwether/historicalfantasyfootballstats.com/actions/workflows/test.yml)

A static site for comparing historical fantasy football statistics across 56 years of data (1970-2025).

## Features

- **56 Years of Data**: Compare players from 1970 to 2025
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

- Node.js 18+
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

3. Download the data:
   - Download the [Fantasy Data base dataset](https://www.kaggle.com/datasets/heefjones/nfl-fantasy-data-1970-2024) from Kaggle
   - Place `fantasy_data.csv` in the project root
   - Place the 2025 season export at `fantasy-2025.csv` in the project root

4. Process the data:
   ```bash
   npm run process-data
   npm run add-2025-data
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

## Scripts

- `npm run dev` - Start development server
- `npm run lint` - Run ESLint
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run process-data` - Convert CSV to JSON
- `npm run add-2025-data` - Clean `fantasy-2025.csv` and add only 2025 rows to the JSON dataset
- `npm test` - Run unit tests
- `npm run test:e2e` - Run Playwright e2e tests

## Deployment

### Cloudflare Pages

1. Push to GitHub
2. Connect repository in Cloudflare Pages dashboard
3. Configure build settings:
   - Build command: `npm run build`
   - Output directory: `dist`

Or deploy manually:
```bash
npm run build
npx wrangler pages deploy dist
```

## Data Source

Base player statistics from [Fantasy Data](https://www.kaggle.com/datasets/heefjones/nfl-fantasy-data-1970-2024) on Kaggle (Pro Football Reference data). The 2025 season is imported from `fantasy-2025.csv`.

## License

MIT
