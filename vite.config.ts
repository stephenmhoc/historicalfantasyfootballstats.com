import { readFileSync, readdirSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { cloudflare } from '@cloudflare/vite-plugin'
import dataMeta from './src/generated/dataMeta.json'
import { buildCsvFiles } from './src/seo/csv'
import { siteFooter } from './src/seo/footer'
import { buildLlmsTxt, buildPages, buildSitemap, defaultViewScript, homepageContent, homepageHeader, type SeoData } from './src/seo/pages'

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

const FOOTER_CSS_LINK = '<link rel="stylesheet" href="/footer.css" />'

function inlineFooterCss(html: string) {
  return html.replace(FOOTER_CSS_LINK, `<style>${readFileSync('public/footer.css', 'utf8')}</style>`)
}

/** Generates the crawlable pages from the same data and scoring as the site. */
function seoPages(): Plugin {
  return {
    name: 'seo-pages',
    enforce: 'post',
    transformIndexHtml(html) {
      const data = loadSeoData()
      return html
        .replace('<!--static-header-->', homepageHeader(data))
        .replace('<!--static-content-->', homepageContent(data))
        .replace('<!--default-view-->', defaultViewScript(data))
    },
    generateBundle(_, bundle) {
      if (this.environment.name !== 'client') return

      const loader = Object.values(bundle).find((file) => file.type === 'chunk' && file.name === 'scoring')
      if (loader?.type !== 'chunk') throw new Error('The scoring loader was not built')
      const footerCss = readFileSync('public/footer.css', 'utf8')
      const assets = { scripts: [loader.fileName], css: readFileSync('public/pages.css', 'utf8') + footerCss }

      const data = loadSeoData()
      const pages = buildPages(data, assets)
      const emit = (fileName: string, source: string) => this.emitFile({ type: 'asset', fileName, source })

      for (const page of pages) emit(`${page.path.slice(1)}.html`, page.html)
      emit('sitemap.xml', buildSitemap(pages, data))
      emit('llms.txt', buildLlmsTxt(data))
      for (const { fileName, source } of buildCsvFiles(data)) emit(fileName, source)

      // Written over the copies from public/, so these share the footer too.
      for (const file of ['mcp.html', '404.html']) {
        emit(file, inlineFooterCss(readFileSync(`public/${file}`, 'utf8')).replace('<!--site-footer-->', siteFooter(data.meta.endYear)))
      }

      // Inlined so the homepage text paints without waiting on a stylesheet.
      const home = bundle['index.html']
      if (home?.type !== 'asset') throw new Error('index.html was not built')
      home.source = inlineFooterCss(String(home.source)).replace(
        /<link rel="stylesheet"[^>]*href="\/(assets\/[^"]+\.css)"[^>]*>/,
        (_, name) => {
          const css = bundle[name]
          if (css?.type !== 'asset') throw new Error(`${name} was not built`)
          return `<style>${css.source}</style>`
        },
      )
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare(), seoPages()],
  environments: {
    client: {
      build: {
        target: 'es2022',
        rollupOptions: {
          input: { main: 'index.html', scoring: 'src/seo/scoringLoader.ts' },
        },
      },
    },
  },
})
