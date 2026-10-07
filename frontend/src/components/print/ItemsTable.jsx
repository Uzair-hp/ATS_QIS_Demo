import { COL_PCT } from '../../lib/geometry'
import { formatAmount } from '../../lib/quotation'

// Table B - the items grid. Six columns at
// 103 | 401 | 1170 | 1377 | 1677 | 1947 | 2418 px.
export default function ItemsTable({ lines }) {
  return (
    <table className="qp-table qp-items">
      <colgroup>
        {COL_PCT.items.map((w, i) => (
          <col key={i} style={{ width: w }} />
        ))}
      </colgroup>
      <thead>
        <tr className="qp-dbl-t qp-dbl">
          <th scope="col">
            <span className="qp-hdr">
              SR.
              <br />
              NO.
            </span>
          </th>
          <th scope="col">
            <span className="qp-hdr">Particular</span>
          </th>
          <th scope="col">
            <span className="qp-hdr">
              HSN
              <br />
              NO.
            </span>
          </th>
          <th scope="col">
            <span className="qp-hdr">QTY.</span>
          </th>
          <th scope="col">
            <span className="qp-hdr">RATE</span>
          </th>
          <th scope="col">
            <span className="qp-hdr">AMOUNT</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {lines.map((line, i) => (
          <tr key={line.srNo} className={i < lines.length - 1 ? 'qp-dbl' : undefined}>
            <td className="qp-sr">{line.srNo}.</td>
            <td className="qp-particular">{line.description}</td>
            <td className="qp-num qp-serif">{line.hsn}</td>
            <td className="qp-num qp-serif">{line.qty}</td>
            <td className="qp-num qp-serif">{line.rate}</td>
            <td className="qp-num qp-serif">{formatAmount(line.amount)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}