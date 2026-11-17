import React from 'react';

const mark = require('../../../../assets/xenocare-mark.png');

export type XenoCareLogoVariant = 'brand' | 'white';

interface XenoCareLogoProps {
  /** Brand = navy wordmark with the orange accent; white = light on dark. */
  variant?: XenoCareLogoVariant;
  /** Show only the XenoCare mark, without the wordmark. */
  compact?: boolean;
  /** Rendered height in pixels; the lockup scales with it. */
  height?: number;
  className?: string;
}

/**
 * XenoCare brand lockup: the interlocking mark plus the XENOCARE wordmark,
 * with the vendor initial in the brand accent. Text is live type (not an
 * image) so it stays crisp at every size and never falls back to old art.
 */
export default function XenoCareLogo({
  variant = 'brand',
  compact = false,
  height = 32,
  className = '',
}: XenoCareLogoProps) {
  if (compact) {
    return (
      <img
        src={mark}
        alt="XenoCare"
        draggable={false}
        className={className}
        style={{ height: '100%', width: '100%', objectFit: 'contain' }}
      />
    );
  }

  return (
    <span
      className={`inline-flex select-none items-center ${
        variant === 'white' ? 'text-white' : 'text-[#11151C]'
      } ${className}`}
      style={{ height }}
      role="img"
      aria-label="XenoCare"
    >
      <img
        src={mark}
        alt=""
        aria-hidden="true"
        draggable={false}
        style={{ height: '100%', width: 'auto', flexShrink: 0 }}
      />
      <span
        className="font-display font-extrabold uppercase"
        style={{
          fontSize: height * 0.5,
          lineHeight: 1,
          letterSpacing: '0.005em',
          marginLeft: height * 0.24,
        }}
      >
        X<span style={{ color: '#E9783F' }}>E</span>NOCARE
      </span>
    </span>
  );
}
