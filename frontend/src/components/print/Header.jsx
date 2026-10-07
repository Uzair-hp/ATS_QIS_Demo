import { COLORS, PAGE } from '../../lib/geometry'

// Full-bleed blue banner. The swoosh, the light band and the white logo card
// are all CSS/SVG - no bitmap assets exist for them.
export default function Header({ quotation }) {
  return (
    <div className="qp-banner">
      <svg
        className="qp-banner-art"
        viewBox="0 0 2100 340"
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <linearGradient id="qpBannerNavy" x1="0" y1="0" x2="1" y2="0.3">
            <stop offset="0%" stopColor={COLORS.bannerNavy} />
            <stop offset="100%" stopColor={COLORS.bannerNavy2} />
          </linearGradient>
        </defs>
        {/* navy field, bottom edge on the diagonal from 29.4mm down-left to 4.6mm right */}
        <polygon points="0,0 2100,0 2100,46 0,294" fill="url(#qpBannerNavy)" />
        {/* light band hugging that diagonal, tapering thicker to the right */}
        <polygon points="0,294 2100,46 2100,124 0,326" fill={COLORS.bannerLight} />
        {/* small navy wedge that drops below the band at the far left */}
        <polygon points="0,326 128,300 0,408" fill={COLORS.bannerNavy} />
      </svg>

      <div className="qp-logo-card">
        <img src="/assets/logo.png" alt={quotation.company?.name ?? 'ATS Automation'} />
      </div>
    </div>
  )
}

export const bannerHeightMm = 17.139
export const logoCardLeftMm = PAGE.contentLeftMm - 2.7