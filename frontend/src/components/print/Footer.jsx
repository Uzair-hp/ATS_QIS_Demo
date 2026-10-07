import { COLORS } from '../../lib/geometry'

// Full-bleed footer strip: three overlapping rounded boxes on a common
// gradient, with a bright rule along the bottom edge.
export default function Footer({ quotation }) {
  const c = quotation.company ?? {}

  return (
    <div className="qp-footer">
      <div className="qp-footer-band" />
      <div className="qp-footer-box qp-footer-a">{c.email}</div>
      <div className="qp-footer-box qp-footer-b">{c.website}</div>
      <div className="qp-footer-box qp-footer-c">
        <div>{c.phones}</div>
        <div>{c.address}</div>
      </div>
      <div className="qp-footer-rule" style={{ background: COLORS.footerRule }} />
    </div>
  )
}