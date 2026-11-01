import { readFileSync, readdirSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { cloudflare } from '@cloudflare/vite-plugin'
import dataMeta from './src/generated/dataMeta.json'
import { buildLlmsTxt, buildPages, buildSitemap, homepageContent, type SeoData } from './src/seo/pages'

// Substituted into index.html, so the page metadata follows the data.
process.env.VITE_DATA_RANGE = `${dataMeta.startYear}-${dataMeta.endYear}`

function loadSeoData(): SeoData {
  const readJson = (file: string) => JSON.parse(readFileSync(file, 'utf8'))
  const weeklyDir = 'public/data/weekly'

  return {
    rows: readJson('public/data/fantasy_data.json'),
    weekly: readdirSync(weeklyDir).flatMap((file) => readJson(`${weeklyDir}/${file}`)),
    meta: dataMeta,
  }
}

/** Generates the crawlable pages from the same data and scoring as the site. */
function seoPages(): Plugin {
  return {
    name: 'seo-pages',
    transformIndexHtml(html) {
      return html.replace('<!--static-content-->', homepageContent(loadSeoData()))
    },
    generateBundle() {
      if (this.environment.name !== 'client') return

      const data = loadSeoData()
      const pages = buildPages(data)
      const emit = (fileName: string, source: string) => this.emitFile({ type: 'asset', fileName, source })

      for (const page of pages) emit(`${page.path.slice(1)}.html`, page.html)
      emit('sitemap.xml', buildSitemap(pages, data))
      emit('llms.txt', buildLlmsTxt(data))
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare(), seoPages()],
})
