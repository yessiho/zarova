'use client';

import { useState } from 'react';

interface ZarovaLogoProps {
  size?: number;
  showText?: boolean;
  className?: string;
  variant?: 'dark' | 'light';
}

export default function ZarovaLogo({
  size = 40,
  showText = true,
  className = '',
  variant = 'dark',
}: ZarovaLogoProps) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  const showPng = imgLoaded && !imgError;
  const radius = Math.round(size * 0.2);

  return (
    <div
      className={`zarova-logo-wrap ${className}`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}
    >
      {/* Icon mark */}
      <div style={{ width: size, height: size, flexShrink: 0, position: 'relative' }}>

        {/* PNG — always in DOM so it can load; hidden until loaded */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/zarova-logo.png"
          alt="Zarova"
          width={size}
          height={size}
          onLoad={() => setImgLoaded(true)}
          onError={() => setImgError(true)}
          style={{
            width: size,
            height: size,
            borderRadius: radius,
            objectFit: 'cover',
            display: showPng ? 'block' : 'none',
          }}
        />

        {/* SVG fallback — shown while PNG loading or on error */}
        {!showPng && (
          <svg
            aria-hidden="true"
            viewBox="0 0 40 40"
            width={size}
            height={size}
            style={{ display: 'block', borderRadius: radius }}
          >
            <defs>
              <linearGradient id="zarova-gold" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#F5D98B" />
                <stop offset="50%" stopColor="#C9A43C" />
                <stop offset="100%" stopColor="#9A7528" />
              </linearGradient>
            </defs>
            <rect width="40" height="40" rx={radius} fill="#0D1B3E" />
            <text
              x="20"
              y="28"
              textAnchor="middle"
              fontFamily="Georgia, serif"
              fontWeight="700"
              fontSize="26"
              fill="url(#zarova-gold)"
              letterSpacing="-1"
            >
              Z
            </text>
          </svg>
        )}
      </div>

      {/* Wordmark */}
      {showText && (
        <span
          style={{
            fontWeight: 700,
            fontSize: size * 0.55,
            letterSpacing: '-0.5px',
            color: variant === 'light' ? '#ffffff' : '#0D1B3E',
            lineHeight: 1,
          }}
        >
          Zarova
        </span>
      )}
    </div>
  );
}
