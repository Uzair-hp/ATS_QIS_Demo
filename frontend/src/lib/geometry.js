// All geometry below was measured from `FORTIS HOSPITAL_page-0001.jpg` at 300 dpi.
//   page      : 2488 x 3513 px  ->  210 x 297 mm (A4), scale = 11.845 px/mm
//   content   : x 103 .. 2418 px ->  left 8.696 mm, width 195.443 mm
//   sig block : x 84  .. 2418 px ->  left 7.092 mm (19 px wider on the left)
//
// Column x-positions found by scanning for full-height vertical rules.
// Row y-positions found by scanning for horizontal rules.

export const PX_PER_MM = 11.845

export const mm = (px) => +(px / PX_PER_MM).toFixed(3)

export const PAGE = {
  widthMm: 210,
  heightMm: 297,
  contentLeftMm: mm(103),
  contentWidthMm: mm(2418 - 103),
  sigBlockLeftMm: mm(84),
}

/** Vertical bands, measured as [startPx, endPx] from the top of the page. */
export const ROWS = {
  banner: [0, 203],
  titleArea: [203, 576],
  info: [
    [576, 679], // TO / INVOICENO / Date      103 px
    [679, 732], // Voucher no                  53 px
    [732, 785], // PaymentTerm                 53 px
    [785, 910], // Delivery (2 lines)         125 px
    [910, 970], // K/A + GSTNO                 60 px
  ],
  itemsHeader: [970, 1095], // 125 px
  items: [
    [1095, 1395], // 300 px
    [1395, 1520], // 125 px
    [1520, 1642], // 122 px
  ],
  totals: [
    [1642, 1708], // SUBTOTAL       66 px
    [1708, 1833], // GST @18%      125 px
    [1833, 1893], // GSTNO          60 px
    [1893, 2309], // company + grand total 416 px
  ],
  sigBox: [2309, 3094], // 785 px incl. the double rule
  sigLines: [3094, 3437], // 343 px
  footer: [3437, 3503], // 66 px
}

/**
 * Column widths as a percentage of the 2315 px content box, for each of the
 * four independent tables. The three grids deliberately do NOT line up with
 * each other (items end a RATE/AMOUNT split at 1947 px, the totals block
 * splits at 1900/2166 px) — that is what the source document does.
 */
export const COLS = {
  // table A - party / meta block, rules at 103 | 1170 | 1677 | 2053 | 2418
  info: [
    { x0: 103, x1: 1170 }, // 46.09 %  TO block (rowspan 4)
    { x0: 1170, x1: 1677 }, // 21.90 %  blank / part of K/A row
    { x0: 1677, x1: 2053 }, // 16.22 %  part of INVOICENO / label / GSTNO
    { x0: 2053, x1: 2418 }, // 15.77 %  Date
  ],
  // table B - items, rules at 103 | 401 | 1170 | 1377 | 1677 | 1947 | 2418
  items: [
    { x0: 103, x1: 401 }, // 12.87 %  SR. NO.
    { x0: 401, x1: 1170 }, // 33.22 %  Particular
    { x0: 1170, x1: 1377 }, //  8.94 %  HSN NO.
    { x0: 1377, x1: 1677 }, // 12.96 %  QTY.
    { x0: 1677, x1: 1947 }, // 11.66 %  RATE
    { x0: 1947, x1: 2418 }, // 20.35 %  AMOUNT
  ],
  // table C - totals, rules at 103 | 1677 | 1900 | 2166 | 2418
  totals: [
    { x0: 103, x1: 1677 }, // 67.99 %  merged left
    { x0: 1677, x1: 1900 }, //  9.63 %  empty
    { x0: 1900, x1: 2166 }, // 11.49 %  label
    { x0: 2166, x1: 2418 }, // 10.89 %  value
  ],
  // table D - signature, rules at 84 | 1677 | 1900 | 2418 (total 2334 px)
  signature: [
    { x0: 84, x1: 1677 },
    { x0: 1677, x1: 1900 },
    { x0: 1900, x1: 2418 },
  ],
}

const pct = (cols, totalPx) =>
  cols.map((c) => `${((c.x1 - c.x0) / totalPx) * 100}%`)

const CONTENT_PX = COLS.info[COLS.info.length - 1].x1 - COLS.info[0].x0 // 2315
const SIG_PX = COLS.signature[COLS.signature.length - 1].x1 - COLS.signature[0].x0 // 2334

export const COL_PCT = {
  info: pct(COLS.info, CONTENT_PX),
  items: pct(COLS.items, CONTENT_PX),
  totals: pct(COLS.totals, CONTENT_PX),
  signature: pct(COLS.signature, SIG_PX),
}

export const rowMm = ([a, b]) => mm(b - a)

/** Colours sampled from the target image. */
export const COLORS = {
  title: '#00ACEC',
  maroon: '#5F1F1F',
  mark: '#FFFF00',
  bannerNavy: '#15578F',
  bannerNavy2: '#1D6EA6',
  bannerLight: '#3699D0',
  footerA: '#228AC1',
  footerB: '#1D6EA6',
  footerC: '#155687',
  footerC2: '#0F467E',
  footerRule: '#3F9BDA',
}