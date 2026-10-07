// Produces the print PDF through the same path as the "Print / Save as PDF"
// button, then reports the page count and page size.
import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

const here = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(here, '..', '.render')
const url = process.argv[2] ?? 'http://localhost:5173/'
const tag = process.argv[3] ?? 'print'

const browser = await chromium.launch()
const page = await browser.newPage()
await page.goto(url, { waitUntil: 'networkidle' })
await page.waitForSelector('.qp-sheet')
await page.evaluate(() => document.fonts.ready)

// emulate print media so the capture matches what the printer sees
await page.emulateMedia({ media: 'print' })
await page.addStyleTag({ content: '.no-print{display:none !important}' })
await page.waitForTimeout(300)

const sheet = await page.$('.qp-sheet')
const pdf = await page.pdf({
  width: '210mm',
  height: '297mm',
  printBackground: true,
  margin: { top: '0', right: '0', bottom: '0', left: '0' },
  pageRanges: '1-10',
})
fs.writeFileSync(path.join(outDir, `${tag}.pdf`), pdf)
await sheet.screenshot({ path: path.join(outDir, `${tag}.png`), scale: 'device' })

const bodyH = await page.evaluate(
  () => document.querySelector('.qp-sheet').getBoundingClientRect().height,
)
console.log('sheet css height mm:', (bodyH / 96 * 25.4).toFixed(2))
console.log('wrote', path.join(outDir, `${tag}.pdf`))
await browser.close()