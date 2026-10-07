import { COL_PCT } from '../../lib/geometry'

// Table D - the tall signature box. Three columns at 84 | 1677 | 1900 | 2418
// px. This box starts 19 px further left than every other table.
export default function SignatureBlock({ quotation }) {
  const c = quotation.company ?? {}

  return (
    <>
      <table className="qp-table qp-sigbox">
        <colgroup>
          {COL_PCT.signature.map((w, i) => (
            <col key={i} style={{ width: w }} />
          ))}
        </colgroup>
        <tbody>
          <tr>
            <td />
            <td />
            <td className="qp-sigcell">
              <div className="qp-for">
                <span className="qp-maroon">For</span> {c.name}
              </div>
              <div className="qp-stamp">
                <img src="/assets/stamp.png" alt={`${c.name} stamp`} />
              </div>
              <div className="qp-signatory">Authorized Signatory</div>
            </td>
          </tr>
        </tbody>
      </table>

      <div className="qp-siglines">
        <div className="qp-sigline">
          <span>Signature</span>
          <i />
        </div>
        <div className="qp-sigline qp-sigline-name">
          <span>Person Name:</span>
        </div>
      </div>
    </>
  )
}