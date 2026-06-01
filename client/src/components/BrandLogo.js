import React from 'react';

const OFFICIAL_UI_LOGO_URL = 'https://www.ui.edu.ng/sites/default/files/WhatsApp%20Image%202023-08-11%20at%201.55.09%20PM.jpeg';

export default function BrandLogo({ width = 220, compact = false, darkBackground = false }) {
  const textColor = darkBackground ? 'rgba(255,255,255,0.7)' : 'var(--text-3)';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 8 : 10 }}>
      <img
        src={OFFICIAL_UI_LOGO_URL}
        alt="University of Ibadan"
        style={{ width, maxWidth: '100%', height: 'auto', objectFit: 'contain', display: 'block' }}
      />
      {compact ? null : (
        <div style={{ fontSize: 11, color: textColor, letterSpacing: '.4px' }}>
          SPORTS ACADEMY CAMP PORTAL
        </div>
      )}
    </div>
  );
}