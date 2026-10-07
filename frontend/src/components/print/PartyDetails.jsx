import { COL_PCT } from '../../lib/geometry'
import { formatDate } from '../../lib/quotation'

// Table A - the bordered block holding the "TO" party details on the left and
// the document meta on the right. Four columns at
// 103 | 1170 | 1677 | 2053 | 2418 px.
export default function PartyDetails({ quotation }) {
  const { client = {} } = quotation

  return (
    <table className="qp-table qp-info">
      <colgroup>
        {COL_PCT.info.map((w, i) => (
          <col key={i} style={{ width: w }} />
        ))}
      </colgroup>
      <tbody>
        <tr>
          <td className="qp-to" rowSpan={4}>
            <div className="qp-to-line">TO,</div>
            <div className="qp-to-line">{client.name}</div>
            {client.address ? <div className="qp-to-line">{client.address}</div> : null}
          </td>
          <td className="qp-invoice-label" colSpan={2}>
            {quotation.docLabel} {quotation.invoiceNo}
          </td>
          <td className="qp-date">
            <div>Date:-</div>
            <div>{formatDate(quotation.date)}</div>
          </td>
        </tr>

        <tr>
          <td />
          <td className="qp-meta" colSpan={2}>
            Voucher no&nbsp;&nbsp;{quotation.voucherNo}
          </td>
        </tr>

        <tr>
          <td />
          <td className="qp-meta" colSpan={2}>
            PaymentTerm:{quotation.paymentTerm}
          </td>
        </tr>

        <tr>
          <td />
          <td className="qp-meta" colSpan={2}>
            <mark className="qp-mark">Delivery :-</mark> {quotation.delivery}
          </td>
        </tr>

        <tr>
          <td className="qp-kindattn" colSpan={2}>
            K/A: {client.kindAttn}
          </td>
          <td className="qp-gstno" colSpan={2}>
            <span className="qp-serif">GSTNO.</span> {client.gstNo}
          </td>
        </tr>
      </tbody>
    </table>
  )
}