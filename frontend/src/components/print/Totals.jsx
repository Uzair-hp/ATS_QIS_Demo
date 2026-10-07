import { COL_PCT } from '../../lib/geometry'
import { formatAmount, formatSubtotal, roundRupee } from '../../lib/quotation'

// Table C - the block under the items. Four columns at
// 103 | 1677 | 1900 | 2166 | 2418 px. The second column is always empty in
// the target; it is reproduced because it is visible.
export default function Totals({ totals }) {
  return (
    <table className="qp-table qp-totals">
      <colgroup>
        {COL_PCT.totals.map((w, i) => (
          <col key={i} style={{ width: w }} />
        ))}
      </colgroup>
      <tbody>
        <tr>
          <td />
          <td />
          <td className="qp-tot-label">SUBTOTAL</td>
          <td className="qp-tot-value qp-serif">{formatSubtotal(totals.subtotal)}</td>
        </tr>

        {/* Discount row renders only when there is a discount, so a
            no-discount quotation keeps its measured two-row geometry. */}
        {totals.hasDiscount && (
          <tr>
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
          <tr>
            <td />
            <td />
            <td className="qp-tot-label">NET</td>
            <td className="qp-tot-value qp-serif">{formatAmount(totals.net)}</td>
          </tr>
        )}

        <tr>
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