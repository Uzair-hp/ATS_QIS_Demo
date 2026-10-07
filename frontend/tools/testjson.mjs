// Tests the paste-JSON loader: full payload, partial payload, bad JSON,
// wrong shape, and that the loaded data drives the rendered sheet.
import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage()
const errs = []
page.on('pageerror', (e) => errs.push(e.message))
page.on('console', (m) => m.type() === 'error' && errs.push(m.text()))
await page.goto(process.argv[2] ?? 'http://localhost:5173/', { waitUntil: 'networkidle' })
await page.waitForSelector('.qp-sheet')

const ok = (label, cond, extra = '') =>
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`)

const box = await page.$('.json-box')
const type = async (text) => {
  await box.fill(text)
  await page.click('button:has-text("Load JSON")')
  await page.waitForTimeout(250)
}
const sheetText = () => page.$eval('.qp-sheet', (e) => e.textContent)
const statusText = () => page.$eval('.status', (e) => e.textContent).catch(() => '')
const rows = () => page.$$eval('.qp-items tbody tr', (r) => r.length)

// --- a real-looking payload ---------------------------------------------
await type(JSON.stringify({
  title: 'BOOM BARRIER',
  docLabel: 'QUOTATION NO:-',
  invoiceNo: 'Q-0042',
  date: '2026-08-14',
  voucherNo: 'V-77',
  paymentTerm: '50% Advance, 50% on install',
  delivery: 'PLOT 42, MIDC ANDHERI EAST',
  gstPercent: 18,
  client: {
    name: 'Sunrise Builders Pvt Ltd',
    address: 'Andheri East, Mumbai 400069',
    kindAttn: 'MR. DESHPANDE',
    gstNo: '27AABCX1234M1Z9',
  },
  items: [
    { description: 'Boom barrier 6m', hsn: '84289010', qty: 2, rate: 45000 },
    { description: 'Installation', hsn: '', qty: 1, rate: 8000 },
  ],
  company: {
    name: 'ATS AUTOMATION',
    gstin: '27BTHPT0851K1Z9',
    bank: 'HDFC BANK',
    branch: 'KANDIVALI (E)',
    accountNo: '50200097301710',
    ifsc: 'HDFC0000182',
    msme: 'UDYAM-MH-170148612',
    email: 'info@atsautomation.in',
    website: 'www.atsautomation.in',
    phones: '+91-9967399864 | +91-8454068378',
    address: 'Main St, Nallasopara East, Vasai Virar, Maharashtra 401209',
  },
}))

const t = await sheetText()
ok('full payload: title rendered', t.includes('BOOM BARRIER'))
ok('full payload: doc label rendered', t.includes('QUOTATION NO:-'), t.slice(0, 0))
ok('full payload: invoice no rendered', t.includes('Q-0042'))
ok('full payload: date reformatted DD/MM/YYYY', t.includes('14/08/2026'))
ok('full payload: voucher no rendered', t.includes('V-77'))
ok('full payload: client rendered', t.includes('Sunrise Builders Pvt Ltd'))
ok('full payload: 2 item rows', (await rows()) === 2, `${await rows()}`)
ok('full payload: subtotal = 2*45000 + 8000 = 98000', t.includes('98000/-/-'))
ok('full payload: gst = 17640', t.includes('17640/-'))
ok('full payload: grand total = 115640', t.includes('115640/-'))
ok('full payload: status ok', (await statusText()).startsWith('Loaded 2 item'))
ok('full payload: company bank block', t.includes('A/C No.:50200097301710'))

// --- partial payload: only the fields you care about ---------------------
await type(JSON.stringify({
  title: 'PARTIAL TEST',
  gstPercent: 5,
  items: [{ description: 'One line', qty: 3, rate: 100 }],
}))
const p = await sheetText()
ok('partial: no crash, title rendered', p.includes('PARTIAL TEST'))
ok('partial: missing hsn tolerated', (await rows()) === 1)
ok('partial: subtotal 300', p.includes('300/-/-'))
ok('partial: gst 5% = 15', p.includes('15/-'))
ok('partial: grand 315', p.includes('315/-'))
ok('partial: company name blank, no "undefined"', !p.includes('undefined'))
ok('partial: status ok', (await statusText()).startsWith('Loaded 1 item'))

// --- edits still work after loading --------------------------------------
await page.$eval('.app-form input', (i) => {
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  set.call(i, 'EDITED TITLE')
  i.dispatchEvent(new Event('input', { bubbles: true }))
})
await page.waitForTimeout(200)
ok('edits still apply after a JSON load',
   (await sheetText()).includes('EDITED TITLE'))

// --- round trip: copy current back out -----------------------------------
await page.click('button:has-text("Copy current as JSON")')
await page.waitForTimeout(300)
const round = JSON.parse(await page.$eval('.json-box', (e) => e.value))
ok('round trip: title survives', round.title === 'EDITED TITLE', round.title)
ok('round trip: normalised to full shape',
   ['subject'].every(() => true) &&
   round.client && round.company && Array.isArray(round.items) &&
   round.docLabel !== undefined && round.gstPercent === 5)

// --- bad JSON ------------------------------------------------------------
await type('{ this is not json')
ok('bad JSON: error shown', (await statusText()).includes('Invalid JSON'), await statusText())
ok('bad JSON: previous quotation kept', (await sheetText()).includes('EDITED TITLE'))

// --- wrong shape ---------------------------------------------------------
await type('[1,2,3]')
ok('array payload: error shown', (await statusText()).includes('Expected a JSON object'),
   await statusText())

await type(JSON.stringify({ title: 'X', items: 'nope' }))
ok('bad items type: error shown', (await statusText()).includes('"items" must be an array'),
   await statusText())

await type(JSON.stringify({ title: 'EMPTY', items: [] }))
ok('empty items: renders without crashing',
   (await sheetText()).includes('EMPTY') && (await rows()) === 0)
ok('empty items: totals are 0', (await sheetText()).includes('0/-/-'))

// --- reset ---------------------------------------------------------------
await page.click('button:has-text("Reset to sample")')
await page.waitForTimeout(250)
ok('reset: sample restored', (await sheetText()).includes('GARAGE DOOR'))
ok('reset: sample totals restored', (await sheetText()).includes('79557/-/-'))
ok('reset: json box refilled with sample',
   JSON.parse(await page.$eval('.json-box', (e) => e.value)).title === 'GARAGE DOOR')

ok('no console / page errors', errs.length === 0, errs.slice(0, 2).join(' | '))
await browser.close()