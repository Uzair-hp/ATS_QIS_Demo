import { describe, expect, it } from 'vitest'
import {
  amountInWords,
  amountWordsLabel,
  computeTotals,
  formatDate,
  stampDataUri,
} from '../quotation.js'

// These fixtures mirror backend/tests/test_calc_totals.py. The print sheet
// recomputes totals in the browser instead of trusting the API, so the two
// implementations must agree to the paisa.
const q = (over = {}) => ({
  gstPercent: 0,
  discount: 0,
  discountType: 'flat',
  items: [],
  ...over,
})

describe('computeTotals', () => {
  it('returns zeroed totals for a quotation with no items', () => {
    const t = computeTotals(q())
    expect(t.subtotal).toBe(0)
    expect(t.net).toBe(0)
    expect(t.gst).toBe(0)
    expect(t.grandTotal).toBe(0)
    expect(t.lines).toEqual([])
  })

  it('applies a flat discount before GST', () => {
    const t = computeTotals(q({
      gstPercent: 18, discount: 20, items: [{ qty: 2, rate: 100 }],
    }))
    expect(t.subtotal).toBe(200)
    expect(t.discount).toBe(20)
    expect(t.net).toBe(180)
    expect(t.gst).toBe(32.4)
    expect(t.grandTotal).toBe(212.4)
  })

  it('applies a percent discount to the subtotal', () => {
    const t = computeTotals(q({
      gstPercent: 18, discount: 10, discountType: 'percent',
      items: [{ qty: 2, rate: 100 }],
    }))
    expect(t.discount).toBe(20)
    expect(t.net).toBe(180)
    expect(t.grandTotal).toBe(212.4)
  })

  it('produces no GST when the rate is zero', () => {
    const t = computeTotals(q({ items: [{ qty: 1, rate: 100 }] }))
    expect(t.gst).toBe(0)
    expect(t.grandTotal).toBe(100)
  })

  it('clamps the net at zero rather than going negative', () => {
    const t = computeTotals(q({
      gstPercent: 18, discount: 150, items: [{ qty: 1, rate: 100 }],
    }))
    expect(t.net).toBe(0)
    expect(t.grandTotal).toBe(0)
  })

  // The backend sums per-line 2dp amounts and keeps the decimals. Rounding that
  // sum to whole rupees before applying GST is what made printed quotations
  // disagree with the stored total_amount.
  it('keeps fractional rupees through to the grand total', () => {
    const t = computeTotals(q({
      gstPercent: 18, items: [{ qty: 3, rate: 33.33 }],
    }))
    expect(t.subtotal).toBe(99.99)
    expect(t.net).toBe(99.99)
    expect(t.gst).toBe(18)
    expect(t.grandTotal).toBe(117.99)
  })

  it('sums multiple fractional lines without losing paise', () => {
    const t = computeTotals(q({
      gstPercent: 18,
      items: [{ qty: 1, rate: 33.33 }, { qty: 1, rate: 33.33 }],
    }))
    expect(t.subtotal).toBe(66.66)
    expect(t.grandTotal).toBe(78.66)
  })

  it('rounds each line amount to 2dp before summing', () => {
    const t = computeTotals(q({ items: [{ qty: 10, rate: 0.07 }] }))
    expect(t.lines[0].amount).toBe(0.7)
    expect(t.subtotal).toBe(0.7)
  })

  it('numbers rows serially from one', () => {
    const t = computeTotals(q({
      items: [{ qty: 1, rate: 10 }, { qty: 1, rate: 20 }],
    }))
    expect(t.lines.map((l) => l.srNo)).toEqual([1, 2])
  })

  it('treats a missing qty as zero, so a rate without a quantity adds nothing', () => {
    const t = computeTotals(q({
      items: [{ qty: null, rate: 100 }, { qty: 1, rate: 50 }, {}],
    }))
    expect(t.subtotal).toBe(50)
  })

  it('reports hasDiscount for a percent discount that rounds to a non-zero amount', () => {
    const t = computeTotals(q({
      gstPercent: 18, discount: 5, discountType: 'percent',
      items: [{ qty: 1, rate: 1000 }],
    }))
    expect(t.discount).toBe(50)
    expect(t.hasDiscount).toBe(true)
  })

  it('keeps the raw percent alongside the computed amount', () => {
    const t = computeTotals(q({
      gstPercent: 18, discount: 12.5, discountType: 'percent',
      items: [{ qty: 1, rate: 1000 }],
    }))
    expect(t.discountPercent).toBe(12.5)
    expect(t.discount).toBe(125)
  })

  it('falls back to the server totals when they are supplied', () => {
    // The API already returns the authoritative figures for a stored quotation.
    // The print sheet must prefer them over recomputing.
    const t = computeTotals({
      ...q({
        gstPercent: 18,
        items: [{ qty: 3, rate: 33.33 }],
      }),
      subTotal: 99.99,
      discountAmount: 0,
      gstAmount: 18,
      totalAmount: 117.99,
    })
    expect(t.subtotal).toBe(99.99)
    expect(t.gst).toBe(18)
    expect(t.grandTotal).toBe(117.99)
  })
})

describe('amount in words', () => {
  // Ported from the retired Jinja macro. It shipped on every themed PDF and
  // would have been a silent regression if dropped with the templates.
  it('reads whole rupees', () => {
    expect(amountInWords(115640)).toBe('One Lakh Fifteen Thousand Six Hundred and Forty Rupees Only')
  })

  it('uses crore and lakh segmentation', () => {
    expect(amountInWords(10000000)).toBe('One Crore Rupees Only')
    // Compound tens are hyphenated, as the retired Jinja macro rendered them,
    // so old and new documents read the same.
    expect(amountInWords(12345678)).toBe('One Crore Twenty-Three Lakh Forty-Five Thousand Six Hundred and Seventy-Eight Rupees Only')
  })

  it('handles the zero and small cases', () => {
    expect(amountInWords(0)).toBe('Zero Rupees Only')
    expect(amountInWords(19)).toBe('Nineteen Rupees Only')
    expect(amountInWords(20)).toBe('Twenty Rupees Only')
    expect(amountInWords(100)).toBe('One Hundred Rupees Only')
    expect(amountInWords(101)).toBe('One Hundred and One Rupees Only')
  })

  it('ignores paise, and the label appends them when there are any', () => {
    expect(amountWordsLabel(944)).toBe('Nine Hundred and Forty-Four Rupees Only')
    expect(amountWordsLabel(944.5)).toBe('Nine Hundred and Forty-Four Rupees Only and 50 Paise Only')
  })
})

describe('formatDate', () => {
  it('converts ISO to dd/mm/yyyy', () => {
    expect(formatDate('2026-05-27')).toBe('27/05/2026')
  })

  it('accepts a full ISO timestamp', () => {
    expect(formatDate('2026-05-27T14:03:11.482')).toBe('27/05/2026')
  })

  it('returns an empty string for no date', () => {
    expect(formatDate('')).toBe('')
    expect(formatDate(null)).toBe('')
  })
})

describe('stampDataUri', () => {
  it('returns an empty string when there is no stamp', () => {
    expect(stampDataUri('')).toBe('')
    expect(stampDataUri(null)).toBe('')
  })

  it('sniffs png, jpeg, gif and webp magic bytes', () => {
    expect(stampDataUri('iVBORw0KGgoAAAA')).toMatch(/^data:image\/png;base64,/)
    expect(stampDataUri('/9j/4AAQSk')).toMatch(/^data:image\/jpeg;base64,/)
    expect(stampDataUri('R0lGODlhAQAB')).toMatch(/^data:image\/gif;base64,/)
    expect(stampDataUri('UklGRhIAAABXRUJQ')).toMatch(/^data:image\/webp;base64,/)
  })

  it('sniffs svg', () => {
    expect(stampDataUri('PHN2ZyB4bWxucz0i')).toMatch(/^data:image\/svg\+xml;base64,/)
  })

  it('defaults to png for an unrecognised payload', () => {
    expect(stampDataUri('QUJD')).toMatch(/^data:image\/png;base64,/)
  })

  it('prefers the recorded MIME type over sniffing', () => {
    // The backend stores the type it sniffed from the upload's magic bytes.
    expect(stampDataUri('QUJD', 'image/svg+xml')).toBe('data:image/svg+xml;base64,QUJD')
  })
})
