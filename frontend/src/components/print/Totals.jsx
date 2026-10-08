import { COL_PCT } from '../../lib/geometry'
import { formatAmount, formatSubtotal, roundRupee } from '../../lib/quotation'

// Table C - the block under the items. Four columns at
// 103 | 1677 | 1900 | 2166 | 2418 px. The second column is always empty in
// the target; it is reproduced because it is visible.
//
// The measured row heights and vertical nudges in print.css are keyed off
// these class names rather than :nth-child, because a quotation with a discount
// renders four rows instead of two and a positional rule would then land on the
// wrong label.
export default function Totals({ totals }) {
  return (
    <table className="qp-table qp-totals">
      <colgroup>
        {COL_PCT.totals.map((w, i) => (
          <col key={i} style={{ width: w }} />
        ))}
      </colgroup>
      <tbody>
        <tr className="qp-row-subtotal">
          <td />
          <td />
          <td className="qp-tot-label">SUBTOTAL</td>
          <td className="qp-tot-value qp-serif">{formatSubtotal(totals.subtotal)}</td>
        </tr>

        {totals.hasDiscount && (
          <tr className="qp-row-discount">
            <td />
            <td />
            <td className="qp-tot-label">
              DISCOUNT
              {totals.discountType === 'percent' ? ` (${roundRupee(totals.discountPercent ?? 0)}%)` : ''}
            </td>
            <td className="qp-tot-value qp-serif">- {formatAmount(totals.discount)}</td>
          </tr>
        )}

        {totals.hasDiscount && (
          <tr className="qp-row-net">
            <td />
            <td />
            <td className="qp-tot-label">NET</td>
            <td className="qp-tot-value qp-serif">{formatAmount(totals.net)}</td>
          </tr>
        )}

        <tr className="qp-row-gst">
          <td />
          <td />
          <td className="qp-tot-label">
            GST@{totals.gstPercent}
            <br />%
          </td>
          <td className="qp-tot-value qp-serif">{formatAmount(totals.gst)}</td>
        </tr>
      </tbody>
    </table>
  )
}