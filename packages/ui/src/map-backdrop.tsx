// Decorative streets only: no location requests, map provider or delivery data.
export function MapBackdrop() {
  return <div className="map-backdrop" aria-hidden="true">
    <svg viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
      <defs>
        <pattern id="city-blocks" width="126" height="94" patternUnits="userSpaceOnUse" patternTransform="rotate(-17)">
          <rect width="126" height="94" fill="#eceee8" />
          <rect x="9" y="10" width="108" height="74" rx="5" fill="#e1e4dd" stroke="#d7dbd3" />
          <path d="M47 10v74M83 10v74M9 47h108" stroke="#eceee7" strokeWidth="3" />
          <path d="M0 0h126M0 0v94" stroke="#fff" strokeWidth="12" />
        </pattern>
        <filter id="map-soften"><feGaussianBlur stdDeviation=".6" /></filter>
      </defs>
      <g filter="url(#map-soften)">
        <rect width="1600" height="1000" fill="url(#city-blocks)" />
        <path d="M-40 160 300 95l210 50 55 120-130 90-280-30-140 35ZM1120 750l180-65 220 70 100 220-390 45-150-120Z" fill="#ccdcbf" stroke="#dae5d2" strokeWidth="12" />
        <path d="M1360-50c-80 150-250 170-190 330s-95 205-55 360-115 260-75 420" fill="none" stroke="#cbdedc" strokeWidth="54" />
        <path d="M-100 785 350 596 520 602 950 386 1700 148M140-50l285 350 226 72 90 250 310 167 260 255" fill="none" stroke="#d4d4c8" strokeWidth="28" />
        <path d="M-100 785 350 596 520 602 950 386 1700 148M140-50l285 350 226 72 90 250 310 167 260 255" fill="none" stroke="#fffdf0" strokeWidth="20" />
        <path d="M-50 450 360 380 540 280l520-30 550 290M-40 945 485 790 805 820l370-162 460 25M850-40 860 260 650 590l-30 470" fill="none" stroke="#d7dad2" strokeWidth="17" />
        <path d="M-50 450 360 380 540 280l520-30 550 290M-40 945 485 790 805 820l370-162 460 25M850-40 860 260 650 590l-30 470" fill="none" stroke="#fff" strokeWidth="12" />
        <g fill="#929c8d" fontFamily="sans-serif" fontSize="12" letterSpacing="2">
          <text x="240" y="500" transform="rotate(-17 240 500)">CENTRO</text>
          <text x="1190" y="430" transform="rotate(-17 1190 430)">SETOR LESTE</text>
          <text x="400" y="885" transform="rotate(-17 400 885)">SETOR SUL</text>
          <text x="1260" y="880">PARQUE</text>
        </g>
      </g>
    </svg>
    <div className="map-backdrop__shade" />
  </div>;
}
