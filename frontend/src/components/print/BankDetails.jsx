import { COL_PCT } from '../../lib/geometry'
import { formatAmount } from '../../lib/quotation'

// The two rows of table C that sit under the totals: the company GSTIN line,
// then the company/bank block sharing its row with "Grand Total".
export default function BankDetails({ quotation, totals }) {
  const c = quotation.company ?? {}

  return (
    <table className="qp-table qp-totals qp-totals-cont">
      <colgroup>
        {COL_PCT.totals.map((w, i) => (
          <col key={i} style={{ width: w }} />
        ))}
      </colgroup>
      <tbody>
        <tr>
          <td className="qp-company-gstin" colSpan={4}>
            GSTNO-{c.gstin}
          </td>
        </tr>
        <tr className="qp-dbl">
          <td className="qp-company">
            <div>CompanyName-{c.name}.</div>
            <div>Bank Details: {c.bank}.</div>
            <div>Branch: {c.branch}</div>
            <div>A/C No.:{c.accountNo}</div>
            <div>IFSC Code: {c.ifsc}.</div>
            <div>MSME:{c.msme}</div>
          </td>
          <td />
          <td className="qp-grand-label">
            Grand
            <br />
            Total
          </td>
          <td className="qp-grand-value qp-serif">{formatAmount(totals.grandTotal)}</td>
        </tr>
      </tbody>
    </table>
  )
}