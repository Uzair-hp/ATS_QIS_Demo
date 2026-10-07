import Header from './print/Header'
import PartyDetails from './print/PartyDetails'
import ItemsTable from './print/ItemsTable'
import Totals from './print/Totals'
import BankDetails from './print/BankDetails'
import SignatureBlock from './print/SignatureBlock'
import Footer from './print/Footer'
import { computeTotals } from '../lib/quotation'

/**
 * Renders the A4 quotation/invoice sheet from a single `quotation` object.
 * No value is hardcoded here - every figure, label and contact detail comes
 * from props, and every total is derived in `computeTotals`.
 */
export default function QuotationPrint({ quotation }) {
  const totals = computeTotals(quotation)

  return (
    <div className="qp-sheet-wrap">
      <div className="qp-sheet">
        <div className="qp-watermark" aria-hidden="true" />

        <Header quotation={quotation} />

        <div className="qp-title-area">
          <h1 className="qp-title">{quotation.title}</h1>
        </div>

        <div className="qp-sec qp-sec-info">
          <PartyDetails quotation={quotation} />
        </div>

        <div className="qp-sec qp-sec-items">
          <ItemsTable lines={totals.lines} />
        </div>

        <div className="qp-sec qp-sec-totals">
          <Totals totals={totals} />
          <BankDetails quotation={quotation} totals={totals} />
        </div>

        <div className="qp-sec qp-sec-sig">
          <SignatureBlock quotation={quotation} />
        </div>

        <Footer quotation={quotation} />
      </div>
    </div>
  )
}