import { COL_PCT } from '../../lib/geometry'
import { stampDataUri } from '../../lib/quotation'

// Table D - the tall signature box. Three columns at 84 | 1677 | 1900 | 2418
// px. This box starts 19 px further left than every other table.
//
// The stamp slot is left empty when the company profile has no upload. There is
// deliberately no bundled fallback image: a checked-in ATS stamp would be
// printed on every other company's quotations.
export default function SignatureBlock({ quotation }) {
  const c = quotation.company ?? {}
  const stampSrc = c.stampImage ? stampDataUri(c.stampImage) : ''

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
              {stampSrc && (
                <div className="qp-stamp">
                  <img src={stampSrc} alt={`${c.name} stamp`} />
                </div>
              )}
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