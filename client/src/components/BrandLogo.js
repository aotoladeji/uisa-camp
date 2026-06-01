import React from 'react';
import uiBrandLogo from '../assets/ui-brand-logo.jpeg';

export default function BrandLogo({ width = 220, compact = false, darkBackground = false }) {
  const textColor = darkBackground ? 'rgba(255,255,255,0.7)' : 'var(--text-3)';
  const logoWidth = compact ? Math.min(width, 180) : width;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 8 : 10 }}>
      <div style={{ width: logoWidth, maxWidth: '100%', flexShrink: 0, lineHeight: 0 }}>
        <img
          src={uiBrandLogo}
          alt="University of Ibadan"
          style={{ width: '100%', height: 'auto', objectFit: 'contain', display: 'block' }}
        />
      </div>
      {compact ? null : (
        <div style={{ fontSize: 11, color: textColor, letterSpacing: '.4px' }}>
          SPORTS ACADEMY CAMP PORTAL
        </div>
      )}
    </div>
  );
}