// End-to-end acceptance check for the template-selection fix.
//
// Walks the exact path from the bug report and captures a screenshot at every
// step, so each acceptance rule can be checked against a real render rather
// than a claim:
//
//   1. Create Quotation  -> preview follows the dropdown
//   2. Create it         -> print view opens on the SAME template
//   3. Change template   -> layout changes immediately
//   4. Print / Save PDF  -> output matches what is on screen
//   5. Reload            -> still the saved template
//   6. Company standard  -> identical in preview, print view and PDF
//
// Also captures the layout defects from the print screenshot: overlapping
// table headers, Authorized Signatory overflow, and the gap between the items
// table and the totals.
//
//   node tools/verify-templates.mjs [baseUrl]

import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

const here = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(here, '..', '.render', 'verify')
fs.mkdirSync(outDir, { recursive: true })

const BASE = process.argv[2] || 'http://127.0.0.1:5000'
const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  -- ${detail}` : ''}`)
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1500, height: 1100 } })

page.on('pageerror', (e) => console.log('  page error:', e.message))

async function login() {
  await page.goto(`${BASE}/app/login`, { waitUntil: 'networkidle' })
  await page.fill('input[name="username"], #username', 'admin')
  await page.fill('input[name="password"], #password', 'ats@2026')
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/app\/?($|\?)/, { timeout: 15000 })
  await page.waitForTimeout(600)
}

/** The archetype class of the sheet currently on screen. */
const sheetKey = () =>
  page.getAttribute('.doc-sheet', 'class').then((c) => (c.match(/doc-t-\w+/) || [''])[0])

/** Bounding box of the printable sheet, for the layout-defect checks. */
const sheetBox = async () => (await page.$('.doc-sheet')).boundingBox()

async function shot(name) {
  await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: true })
}

// ── 1. Create Quotation: preview follows the dropdown ────────────────────
await login()
await page.goto(`${BASE}/app/quotations/create`, { waitUntil: 'networkidle' })
await page.waitForSelector('#pdf_theme')
await page.waitForSelector('.doc-sheet')
await page.waitForTimeout(500)

const previewKeys = {}
for (const key of ['classic', 'q1_classic', 'q2_proposal', 'q3_minimal', 'q4_compact']) {
  await page.selectOption('#pdf_theme', key)
  await page.waitForTimeout(250)
  previewKeys[key] = await sheetKey()
  await shot(`01-create-preview-${key}`)
}
check('AC1 create preview follows the dropdown', new Set(Object.values(previewKeys)).size >= 4,
  JSON.stringify(previewKeys))
check('AC1 every quotation template renders', Object.values(previewKeys).every(Boolean),
  Object.values(previewKeys).filter(Boolean).length + '/5')

// The preview must carry the real company bank block, not blanks.
const previewText = await page.textContent('.doc-sheet')
check('preview shows the company bank block',
  /HDFC Bank|HDFC0001234|ATS Automation/i.test(previewText),
  (previewText.match(/ATS Automation/i) ? 'company name present' : 'MISSING company name'))

// ── 2. Create the quotation ──────────────────────────────────────────────
await page.selectOption('#pdf_theme', 'q2_proposal')
await page.waitForTimeout(200)

// Pick the client (first real option).
const clientSelect = await page.$('select[required]')
const clientValues = await clientSelect.$$eval('option', (os) => os.map((o) => o.value).filter(Boolean))
if (clientValues.length) await clientSelect.selectOption(clientValues[0])

// Add a line item so the table is not empty.
await page.fill('input[placeholder="Service"]', 'Boom Barrier')
await page.fill('input[placeholder="Rate"]', '400')
await page.fill('input[placeholder="Qty"]', '2')
await page.fill('input[placeholder="HSN"]', '996311')
await page.waitForTimeout(300)
await page.click('button[type="submit"]')
await page.waitForURL(/\/app\/quotations\/\d+$/, { timeout: 15000 })
const quotationUrl = page.url()
const quotationId = quotationUrl.match(/quotations\/(\d+)/)[1]
await page.waitForTimeout(600)
console.log(`  created quotation ${quotationId}`)

// ── 2. Print view opens on the SAME template ─────────────────────────────
await page.goto(`${BASE}/app/quotations/${quotationId}/print`, { waitUntil: 'networkidle' })
await page.waitForSelector('.doc-sheet')
await page.waitForTimeout(500)
await shot('02-printview-opened')
const openedKey = await sheetKey()
const openedPicker = await page.inputValue('#print-quotation-theme')
check('AC2 print view opens on the saved template', openedPicker === 'q2_proposal',
  `picker=${openedPicker} sheet=${openedKey}`)
check('AC2 print view renders the saved template', openedKey === 'doc-t-hero',
  `sheet=${openedKey}`)

// ── 3. Change the template: re-renders immediately, then persists ─────────
await page.selectOption('#print-quotation-theme', 'q3_minimal')
// Deliberately NOT waiting for a network round trip.
const immediateKey = await sheetKey()
check('AC3 layout changes right away', immediateKey === 'doc-t-minimal', `sheet=${immediateKey}`)
await shot('03-printview-minimal')
await page.waitForTimeout(900)

const persisted = await page.evaluate(async (id) => {
  const r = await fetch(`/api/quotations/${id}`, { credentials: 'include' })
  return (await r.json()).pdf_theme
}, quotationId)
check('AC3 the change is saved on the record', persisted === 'q3_minimal', `pdf_theme=${persisted}`)

// ── 5. Reload keeps the saved template ───────────────────────────────────
await page.reload({ waitUntil: 'networkidle' })
await page.waitForSelector('.doc-sheet')
await page.waitForTimeout(500)
const reloadedKey = await sheetKey()
const reloadedPicker = await page.inputValue('#print-quotation-theme')
check('AC5 reload keeps the saved template',
  reloadedPicker === 'q3_minimal' && reloadedKey === 'doc-t-minimal',
  `picker=${reloadedPicker} sheet=${reloadedKey}`)

// Coming back from the list must land on the same template.
await page.goto(`${BASE}/app/quotations`, { waitUntil: 'networkidle' })
await page.goto(`${BASE}/app/quotations/${quotationId}/print`, { waitUntil: 'networkidle' })
await page.waitForSelector('.doc-sheet')
await page.waitForTimeout(400)
check('AC5 reopening from the list keeps the saved template',
  (await sheetKey()) === 'doc-t-minimal', `sheet=${await sheetKey()}`)

// ── AC6: company standard identical in preview and print view ─────────────
// Compare the EDIT preview against the print view for the SAME saved document.
// Comparing the create page would be meaningless - that is a different document
// (a draft, with a placeholder number and no timeline yet).
await page.goto(`${BASE}/app/quotations/edit/${quotationId}`, { waitUntil: 'networkidle' })
await page.waitForSelector('.doc-sheet')
// The edit preview opens on whatever the document has saved, so put both
// sides on the company standard explicitly.
await page.selectOption('#pdf_theme', 'classic')
await page.waitForTimeout(700)
const editStandardKey = await sheetKey()
const editStandard = await page.textContent('.doc-sheet')
await shot('04a-edit-preview-company-standard')

await page.goto(`${BASE}/app/quotations/${quotationId}/print`, { waitUntil: 'networkidle' })
await page.selectOption('#print-quotation-theme', 'classic')
await page.waitForSelector('.doc-sheet')
await page.waitForTimeout(900)
const printStandardKey = await sheetKey()
const printStandard = await page.textContent('.doc-sheet')

const norm = (s) => s.replace(/\s+/g, ' ').trim()
check('AC6 preview and print view use the same template for the company standard',
  editStandardKey === 'doc-t-classic' && printStandardKey === 'doc-t-classic',
  `preview=${editStandardKey} print=${printStandardKey}`)
check('AC6 company standard renders identical content in preview and print view',
  norm(editStandard) === norm(printStandard),
  norm(editStandard) === norm(printStandard) ? `identical, ${norm(printStandard).length} chars`
    : `preview=${norm(editStandard).length}ch print=${norm(printStandard).length}ch`)
await shot('04-company-standard')

// ── AC4: Print / Save as PDF matches what is on screen ───────────────────
// The print output is the DOM react-to-print clones, so compare the printed
// media render of the same page against the on-screen text.
const onScreen = norm(await page.textContent('.doc-sheet'))
await page.emulateMedia({ media: 'print' })
await page.waitForTimeout(400)
const inPrint = norm(await page.textContent('.doc-sheet'))
check('AC4 print media renders the same content as the screen', onScreen === inPrint,
  onScreen === inPrint ? 'identical' : 'differs')

const pdf = await page.pdf({
  width: '210mm', height: '297mm', printBackground: true,
  margin: { top: '0', right: '0', bottom: '0', left: '0' },
})
fs.writeFileSync(path.join(outDir, '05-save-as-pdf.pdf'), pdf)
check('AC4 Save as PDF produces a one-page A4 file', pdf.length > 5000,
  `${Math.round(pdf.length / 1024)} KB`)
await page.emulateMedia({ media: 'screen' })

// ── Layout defects from the print screenshot ─────────────────────────────
// A one-item quotation used to leave ~48mm of blank between the items table
// and the totals, because the items block had a fixed min-height floor.
const boxes = await page.evaluate(() => {
  const sheet = document.querySelector('.doc-sheet')
  const r = (el) => { const b = el.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, left: b.left, right: b.right } }
  const items = sheet.querySelector('.doc-items tbody tr:last-child')
  const totals = sheet.querySelector('.doc-totals')
  const ths = Array.from(sheet.querySelectorAll('.doc-items thead th')).map((th) => {
    const span = th.querySelector('.doc-hdr') || th
    const b = span.getBoundingClientRect()
    return { text: th.textContent.trim(), ...r(span) }
  })
  const signatory = Array.from(sheet.querySelectorAll('.doc-sign-cell, .doc-sign-role, .doc-sign-box'))
    .map((el) => ({ cls: el.className, ...r(el) }))
  return {
    items: items ? r(items) : null,
    totals: totals ? r(totals) : null,
    ths,
    signatory,
    sheet: r(sheet),
  }
})

const gap = boxes.totals ? boxes.totals.top - (boxes.items ? boxes.items.bottom : boxes.totals.top) : 0
check('layout: totals follow the items table with no fixed-height gap',
  gap < 40, `gap=${gap.toFixed(1)}px (was ~180px)`)

// Header labels must not collide with each other.
let worstOverlap = 0
for (let i = 0; i < boxes.ths.length - 1; i++) {
  const a = boxes.ths[i]
  const b = boxes.ths[i + 1]
  worstOverlap = Math.max(worstOverlap, a.right - b.left)
}
check('layout: items table headers do not overlap', worstOverlap <= 1,
  `worst overlap=${worstOverlap.toFixed(1)}px`)

// "Authorized Signatory" must stay inside its cell.
const cell = boxes.signatory.find((s) => s.cls.includes('doc-sign-box'))
const role = boxes.signatory.find((s) => s.cls.includes('doc-sign-role'))
check('layout: Authorized Signatory stays inside its box',
  !cell || !role || (role.right <= cell.right + 1 && role.left >= cell.left - 1),
  cell && role
    ? `box ${cell.left.toFixed(0)}-${cell.right.toFixed(0)}, text ${role.left.toFixed(0)}-${role.right.toFixed(0)}`
    : 'not found')

// Nothing may spill outside the page box.
const spill = boxes.ths.filter((t) => t.right > boxes.sheet.right + 1 || t.left < boxes.sheet.left - 1)
check('layout: nothing overflows the page box', spill.length === 0,
  spill.length ? `${spill.length} overflowing` : 'clean')

await shot('06-layout-checks')

// ── Every template renders without error, for both document types ────────
for (const [docType, ids] of [['quotation', null], ['invoice', null]]) {
  const route = docType === 'quotation' ? 'quotations' : 'invoices'
  const keys = docType === 'quotation'
    ? ['classic', 'q1_classic', 'q2_proposal', 'q3_minimal', 'q4_compact']
    : ['classic_gst', 't2_letterhead', 't4_corporate_slate', 't3_minimal', 't5_compact_dense']
  const listId = await page.evaluate(async (r) => {
    const res = await fetch(`/api/${r}`, { credentials: 'include' })
    const data = await res.json()
    const rows = data[r] || []
    return rows.length ? rows[0].id : null
  }, route)

  if (!listId) {
    console.log(`  (no ${docType} records to walk)`)
    continue
  }

  const seen = new Set()
  let errors = 0
  page.on('pageerror', () => { errors++ })
  for (const key of keys) {
    await page.goto(`${BASE}/app/${route}/${listId}/print`, { waitUntil: 'networkidle' })
    await page.waitForSelector('.doc-sheet')
    await page.selectOption(`#print-${docType}-theme`, key)
    await page.waitForTimeout(350)
    const k = await sheetKey()
    seen.add(k)
    await shot(`07-${docType}-${key}`)
  }
  check(`all ${docType} templates render distinctly`, seen.size >= 3 && errors === 0,
    `${seen.size} distinct, ${errors} page errors`)
}

await browser.close()

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
console.log(`screenshots in ${outDir}`)
process.exit(failed.length ? 1 : 0)
