// Renders the preview at exactly A4 @ 300 dpi (2488 x 3513) so the output can
// be pixel-diffed against FORTIS HOSPITAL_page-0001.jpg.
//   A4 at 96 dpi = 793.7 x 1122.5 css px; scale = 2488 / 793.7 = 3.134
import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

const here = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(here, '..', '.render')
fs.mkdirSync(outDir, { recursive: true })

const url = process.argv[2] ?? 'http://localhost:5173/'
const tag = process.argv[3] ?? 'shot'

const CSS_W = 793.7
const CSS_H = 1122.5
const SCALE = 2488 / CSS_W

const browser = await chromium.launch()
const page = await browser.newPage({
  viewport: { width: Math.round(CSS_W) + 40, height: Math.round(CSS_H) },
  deviceScaleFactor: SCALE,
})
await page.goto(url, { waitUntil: 'networkidle' })
await page.waitForSelector('.qp-sheet')
await page.evaluate(() => document.fonts.ready)
await page.waitForTimeout(400)

const sheet = await page.$('.qp-sheet')
// hide the app chrome so it cannot overlap the captured sheet
await page.addStyleTag({ content: '.no-print{display:none !important}' })
await page.evaluate(() => {
  const w = document.querySelector('.qp-sheet-wrap')
  if (w) { w.style.padding = '0'; w.style.background = 'none' }
})
await sheet.scrollIntoViewIfNeeded()
await page.waitForTimeout(300)
const box = await sheet.boundingBox()
const shot = await sheet.screenshot({ scale: 'device' })
fs.writeFileSync(path.join(outDir, `${tag}.png`), shot)
console.log('wrote', path.join(outDir, `${tag}.png`), 'css box', box)

await browser.close()