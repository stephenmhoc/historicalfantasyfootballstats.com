import { readFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { cloudflare } from '@cloudflare/vite-plugin'
import dataMeta from './src/generated/dataMeta.json'
import type { PlayerSeason } from './src/types'
import { calculateFantasyPoints } from './src/utils/calculations'
import { DEFAULT_SCORING } from './src/utils/constants'

// Substituted into index.html, so the page metadata follows the data.
process.env.VITE_DATA_RANGE = `${dataMeta.startYear}-${dataMeta.endYear}`

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function leaderTable(title: string, rows: PlayerSeason[]) {
  const top = rows
    .map((row) => ({ ...row, points: calculateFantasyPoints(row, DEFAULT_SCORING) }))
    .sort((a, b) => b.points - a.points)
    .slice(0, 10)

  const body = top
    .map(
      (row, index) =>
        `<tr><td>${index + 1}</td><td>${escapeHtml(row.player)}</td><td>${row.position}</td>` +
        `<td>${row.year}</td><td>${row.points.toFixed(1)}</td></tr>`
    )
    .join('')

  return (
    `<h2>${title}</h2><table><thead><tr><th>Rank</th><th>Player</th><th>Pos</th><th>Year</th>` +
    `<th>PPR Points</th></tr></thead><tbody>${body}</tbody></table>`
  )
}

/** Puts real content in the initial HTML for crawlers. React replaces it on load. */
function staticContent(): Plugin {
  return {
    name: 'static-content',
    transformIndexHtml(html) {
      const rows: PlayerSeason[] = JSON.parse(readFileSync('public/data/fantasy_data.json', 'utf8'))
      const { startYear, endYear } = dataMeta

      const content =
        `<main style="max-width:56rem;margin:0 auto;padding:1.5rem 1rem">` +
        `<h1>Historical Fantasy Football Stats</h1>` +
        `<p>Compare NFL fantasy football stats from ${startYear}-${endYear}. Rank every QB, RB, WR, ` +
        `and TE season with PPR, half-PPR, standard, or your own custom scoring.</p>` +
        leaderTable(`${endYear} Fantasy Football Leaders`, rows.filter((row) => row.year === endYear)) +
        leaderTable('Best Fantasy Seasons of All Time', rows) +
        `<p><a href="/mcp">Connect an AI agent with the fantasy football MCP server</a></p>` +
        `</main>`

      return html.replace('<!--static-content-->', content)
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare(), staticContent()],
})
