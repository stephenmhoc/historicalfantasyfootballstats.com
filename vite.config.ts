import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { cloudflare } from '@cloudflare/vite-plugin'
import dataMeta from './src/generated/dataMeta.json'

// Substituted into index.html, so the page metadata follows the data.
process.env.VITE_DATA_RANGE = `${dataMeta.startYear}-${dataMeta.endYear}`

export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare()],
})
