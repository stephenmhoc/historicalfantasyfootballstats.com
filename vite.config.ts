import { readFileSync, readdirSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { cloudflare } from '@cloudflare/vite-plugin'
import dataMeta from './src/generated/dataMeta.json'
import { buildCsvFiles } from './src/seo/csv'
import { siteFooter } from './src/seo/footer'
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
    enforce: 'post',
    transformIndexHtml(html) {
      return html.replace('<!--static-content-->', homepageContent(loadSeoData()))
    },
    generateBundle(_, bundle) {
      if (this.environment.name !== 'client') return

      const widget = Object.values(bundle).find((file) => file.type === 'chunk' && file.name === 'scoring')
      if (widget?.type !== 'chunk') throw new Error('The scoring widget was not built')
      // The stylesheet lands on a chunk shared with the homepage, so look through imports too.
      const chunks = [widget, ...widget.imports.map((name) => bundle[name])]
      const styles = chunks.flatMap((file) => (file.type === 'chunk' ? [...(file.viteMetadata?.importedCss ?? [])] : []))
      if (styles.length === 0) throw new Error('The scoring widget has no stylesheet')
      const assets = { scripts: [widget.fileName], styles }

      const data = loadSeoData()
      const pages = buildPages(data, assets)
      const emit = (fileName: string, source: string) => this.emitFile({ type: 'asset', fileName, source })

      for (const page of pages) emit(`${page.path.slice(1)}.html`, page.html)
      emit('sitemap.xml', buildSitemap(pages, data))
      emit('llms.txt', buildLlmsTxt(data))
      for (const { fileName, source } of buildCsvFiles(data)) emit(fileName, source)

      // Written over the copies from public/, so these share the footer too.
      for (const file of ['mcp.html', '404.html']) {
        emit(file, readFileSync(`public/${file}`, 'utf8').replace('<!--site-footer-->', siteFooter(data.meta.endYear)))
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare(), seoPages()],
  environments: {
    client: {
      build: {
        rollupOptions: {
          input: { main: 'index.html', scoring: 'src/seo/scoringWidget.tsx' },
        },
      },
    },
  },
})
