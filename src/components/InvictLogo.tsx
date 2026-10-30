import React from 'react';

interface InvictLogoProps {
  className?: string;
  variant?: 'full' | 'isotype' | 'horizontal' | 'badge' | 'official';
  theme?: 'dark' | 'light' | 'white' | 'color';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showSubtitle?: boolean;
  interactive?: boolean;
}

export const InvictLogo: React.FC<InvictLogoProps> = ({
  className = '',
  variant = 'horizontal',
  theme = 'dark',
  size = 'md',
  showSubtitle = true,
  interactive = false,
}) => {
  const brandRed = '#BE2629';
  const brandBlack = '#111111';
  const textColor = theme === 'light' ? '#111111' : '#FFFFFF';
  const subtextColor = theme === 'light' ? '#222222' : '#CBD5E1';

  const sizeMap = {
    xs: { symbolSize: 24, textScale: 'text-xs', subtextScale: 'text-[7px]' },
    sm: { symbolSize: 34, textScale: 'text-sm font-extrabold', subtextScale: 'text-[9px]' },
    md: { symbolSize: 48, textScale: 'text-xl font-black', subtextScale: 'text-[10px]' },
    lg: { symbolSize: 64, textScale: 'text-3xl font-black', subtextScale: 'text-[12px]' },
    xl: { symbolSize: 96, textScale: 'text-5xl font-black', subtextScale: 'text-[15px]' },
  };

  const { symbolSize, textScale, subtextScale } = sizeMap[size];

  const renderEmblem = () => (
    <svg
      width={symbolSize}
      height={symbolSize}
      viewBox="0 0 160 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0 drop-shadow-md select-none"
    >
      {/* Left Leaves */}
      <g fill={brandRed}>
        <path d="M 46 36 C 42 22 28 14 18 20 C 14 28 20 40 32 44 C 38 42 42 39 46 36 Z" />
        <path d="M 40 56 C 24 50 10 56 6 66 C 12 76 26 76 38 68 C 40 64 40 60 40 56 Z" />
        <path d="M 46 76 C 30 80 18 88 18 100 C 26 106 38 102 48 90 C 49 84 48 80 46 76 Z" />
        <path d="M 46 44 C 40 56 40 76 46 88 C 42 96 34 104 26 108 C 22 108 28 102 34 96 C 34 76 36 56 46 44 Z" />
      </g>
      {/* Right Leaves */}
      <g fill={brandRed}>
        <path d="M 114 36 C 118 22 132 14 142 20 C 146 28 140 40 128 44 C 122 42 118 39 114 36 Z" />
        <path d="M 120 56 C 136 50 150 56 154 66 C 148 76 134 76 122 68 C 120 64 120 60 120 56 Z" />
        <path d="M 114 76 C 130 80 142 88 142 100 C 134 106 122 102 112 90 C 111 84 112 80 114 76 Z" />
        <path d="M 114 44 C 120 56 120 76 114 88 C 118 96 126 104 134 108 C 138 108 132 102 126 96 C 126 76 124 56 114 44 Z" />
      </g>
      {/* Central Globe */}
      <circle cx="80" cy="60" r="32" fill={brandRed} />
      <ellipse cx="80" cy="60" rx="9" ry="28" fill={brandBlack} />
      <circle cx="80" cy="60" r="30" stroke="#FFFFFF" strokeWidth="5.5" fill="none" />
      <line x1="50" y1="60" x2="110" y2="60" stroke="#FFFFFF" strokeWidth="5.5" strokeLinecap="round" />
      <ellipse cx="80" cy="60" rx="19" ry="30" stroke="#FFFFFF" strokeWidth="5.5" fill="none" />
    </svg>
  );

  if (variant === 'isotype') {
    return (
      <div className={`inline-flex items-center justify-center ${className}`}>
        {renderEmblem()}
      </div>
    );
  }

  if (variant === 'badge') {
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#141722] border border-[#2b354d] shadow-sm ${className}`}>
        {renderEmblem()}
        <div className="flex flex-col">
          <span className="font-black text-white text-xs tracking-wider">INVICT</span>
          <span className="text-[8px] font-bold text-slate-300 tracking-widest uppercase">Security Solutions</span>
        </div>
      </div>
    );
  }

  if (variant === 'full') {
    return (
      <div className={`flex flex-col items-center text-center gap-2.5 ${className}`}>
        {renderEmblem()}
        <div className="flex flex-col items-center">
          <h1
            className={`font-black tracking-[0.08em] uppercase leading-none font-sans ${textScale}`}
            style={{ color: textColor }}
          >
            INVICT
          </h1>
          {showSubtitle && (
            <span
              className={`font-black tracking-[0.24em] uppercase mt-1 text-slate-300 ${subtextScale}`}
              style={{ color: subtextColor }}
            >
              SECURITY SOLUTIONS
            </span>
          )}
        </div>
      </div>
    );
  }

  if (variant === 'official') {
    return (
      <div className={`inline-flex items-center gap-3 sm:gap-4 ${className}`}>
        {renderEmblem()}
        <div className="h-9 w-0.5 bg-[#BE2629] rounded-full hidden sm:block" />
        <div className="flex flex-col justify-center select-none">
          <span
            className={`font-black tracking-[0.06em] uppercase leading-none ${textScale}`}
            style={{ color: textColor }}
          >
            INVICT
          </span>
          {showSubtitle && (
            <span
              className={`font-black tracking-[0.22em] uppercase mt-1 ${subtextScale}`}
              style={{ color: subtextColor }}
            >
              SECURITY SOLUTIONS
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      {renderEmblem()}
      <div className="flex flex-col justify-center select-none">
        <span
          className={`font-black tracking-[0.05em] uppercase leading-none ${textScale}`}
          style={{ color: textColor }}
        >
          INVICT
        </span>
        {showSubtitle && (
          <span
            className={`font-extrabold tracking-[0.22em] uppercase mt-0.5 ${subtextScale}`}
            style={{ color: subtextColor }}
          >
            SECURITY SOLUTIONS
          </span>
        )}
      </div>
    </div>
  );
};
