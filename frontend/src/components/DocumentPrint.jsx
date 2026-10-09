import Header from './print/Header'
import PartyDetails from './print/PartyDetails'
import ItemsTable from './print/ItemsTable'
import Totals from './print/Totals'
import BankDetails from './print/BankDetails'
import SignatureBlock from './print/SignatureBlock'
import Footer from './print/Footer'
import { computeTotals } from '../lib/quotation'

/**
 * Renders the A4 document sheet from a single `document` object. The same
 * layout serves quotations and invoices - the mapper decides the only real
 * differences (docLabel, voucherNo, title).
 *
 * No value is hardcoded here: every figure, label and contact detail comes from
 * props, and every total is derived in `computeTotals`.
 */
export default function DocumentPrint({ document }) {
  const totals = computeTotals(document)

  return (
    <div className="qp-sheet-wrap">
      <div className="qp-sheet">
        <div className="qp-watermark" aria-hidden="true" />

        <Header quotation={document} />

        <div className="qp-title-area">
          <h1 className="qp-title">{document.title}</h1>
        </div>

        <div className="qp-sec qp-sec-info">
          <PartyDetails quotation={document} />
        </div>

        <div className="qp-sec qp-sec-items">
          <ItemsTable lines={totals.lines} />
        </div>

        <div className="qp-sec qp-sec-totals">
          <Totals totals={totals} />
          <BankDetails quotation={document} totals={totals} />
        </div>

        <div className="qp-sec qp-sec-sig">
          <SignatureBlock quotation={document} />
        </div>

        <Footer quotation={document} />
      </div>
    </div>
  )
}
