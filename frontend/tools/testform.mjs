// Exercises the form: add/remove item rows, live totals, field edits,
// the reset button and the react-to-print button.
import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage()
const errs = []
page.on('pageerror', (e) => errs.push(e.message))
page.on('console', (m) => m.type() === 'error' && errs.push(m.text()))
await page.goto(process.argv[2] ?? 'http://localhost:5173/', { waitUntil: 'networkidle' })
await page.waitForSelector('.qp-sheet')

const text = (sel) => page.$eval(sel, (e) => e.textContent.trim())
const rowCount = () => page.$$eval('.qp-items tbody tr', (r) => r.length)
const ok = (label, cond, extra = '') =>
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`)

// --- initial sample ------------------------------------------------------
ok('sample: 3 item rows', (await rowCount()) === 3)
ok('sample: subtotal 79557/-/-', (await text('.qp-totals .qp-tot-value')) === '79557/-/-',
   await text('.qp-totals .qp-tot-value'))
ok('sample: gst 14320/-',
   (await text('.qp-totals tr:nth-child(2) .qp-tot-value')) === '14320/-',
   await text('.qp-totals tr:nth-child(2) .qp-tot-value'))
ok('sample: grand total 93877/-', (await text('.qp-grand-value')) === '93877/-',
   await text('.qp-grand-value'))
ok('sample: date DD/MM/YYYY',
   (await text('.qp-date')).includes('27/05/2026'), await text('.qp-date'))
ok('sample: GST arithmetic',
   (await text('.qp-grand-value')).replace(/\D+/g, '') === '93877')

// --- add a row ----------------------------------------------------------
await page.click('button:has-text("+ Add item")')
ok('add item: 4 rows', (await rowCount()) === 4)
ok('add item: totals unchanged (blank row adds 0)',
   (await text('.qp-totals .qp-tot-value')) === '79557/-/-',
   await text('.qp-totals .qp-tot-value'))

// --- edit the new row: live totals --------------------------------------
const rows = await page.$$('.item-row')
const last = rows[rows.length - 1]
await last.$eval('input[type=number]', (i) => {
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  set.call(i, '3')
  i.dispatchEvent(new Event('input', { bubbles: true }))
})
const rates = await last.$$('input[type=number]')
await rates[1].evaluate((i) => {
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  set.call(i, '500')
  i.dispatchEvent(new Event('input', { bubbles: true }))
})
await page.waitForTimeout(150)
ok('live totals: subtotal 79557 + 1500 = 81057',
   (await text('.qp-totals .qp-tot-value')) === '81057/-/-',
   await text('.qp-totals .qp-tot-value'))
ok('live totals: gst = round(81057 * 0.18) = 14590',
   (await text('.qp-totals tr:nth-child(2) .qp-tot-value')) === '14590/-',
   await text('.qp-totals tr:nth-child(2) .qp-tot-value'))
ok('live totals: grand = 95647',
   (await text('.qp-grand-value')) === '95647/-', await text('.qp-grand-value'))

// --- description / hsn / rate round trip --------------------------------
const firstDesc = await page.$eval('.qp-items tbody tr:first-child .qp-particular',
  (e) => e.textContent)
ok('particular text present', firstDesc.includes('Garage Door Size'), firstDesc.slice(0, 40))

// --- remove the row -----------------------------------------------------
await page.click('.item-row:last-of-type button:has-text("Remove")')
await page.waitForTimeout(150)
ok('remove item: back to 3 rows', (await rowCount()) === 3)
ok('remove item: totals restored',
   (await text('.qp-grand-value')) === '93877/-', await text('.qp-grand-value'))

// --- change gst percent -------------------------------------------------
await page.$eval('input[type=number][value="18"]', (i) => {
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  set.call(i, '5')
  i.dispatchEvent(new Event('input', { bubbles: true }))
}).catch(async () => {
  const el = await page.$('.app-form fieldset:first-of-type input[type=number]')
  await el.$eval((i) => {
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    set.call(i, '5'); i.dispatchEvent(new Event('input', { bubbles: true }))
  })
})
await page.waitForTimeout(150)
ok('gst 5%: gst = round(79557 * 0.05) = 3978',
   (await text('.qp-totals tr:nth-child(2) .qp-tot-value')) === '3978/-',
   await text('.qp-totals tr:nth-child(2) .qp-tot-value'))

// --- company field ------------------------------------------------------
await page.$eval('input[value="ATS AUTOMATION"]', (i) => {
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  set.call(i, 'ATS TEST CO'); i.dispatchEvent(new Event('input', { bubbles: true }))
})
await page.waitForTimeout(120)
ok('company name flows into CompanyName line',
   (await text('.qp-company')).startsWith('CompanyName-ATS TEST CO'),
   (await text('.qp-company')).slice(0, 30))

// --- reset --------------------------------------------------------------
await page.click('button:has-text("Reset to sample")')
await page.waitForTimeout(150)
ok('reset: subtotal back to 79557/-/-',
   (await text('.qp-totals .qp-tot-value')) === '79557/-/-',
   await text('.qp-totals .qp-tot-value'))

// --- print button builds a print iframe with the sheet in it -----------
// react-to-print builds a hidden iframe, fills it, prints, then removes it,
// so poll quickly for it rather than checking after it is already gone.
let sawPrintFrame = false
const poll = setInterval(async () => {
  const frames = page.frames().filter((f) => f !== page.mainFrame())
  for (const f of frames) {
    try { if (await f.$('.qp-sheet')) sawPrintFrame = true } catch { /* detached */ }
  }
}, 50)
await page.click('button:has-text("Print / Save as PDF")')
await page.waitForTimeout(2500)
clearInterval(poll)
ok('Print button builds a print frame containing the sheet', sawPrintFrame)

ok('no console / page errors', errs.length === 0, errs.join(' | '))
await browser.close()

