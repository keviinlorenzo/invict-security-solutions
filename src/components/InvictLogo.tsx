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

  // Versión del emblema según el tono del fondo (manual de marca):
  // fondo oscuro -> blanco; fondo claro -> color (rojo/negro).
  const emblemSrc =
    theme === 'light' || theme === 'color'
      ? '/brand/invict-emblem-color.png'
      : '/brand/invict-emblem-white.png';

  const renderEmblem = () => (
    <img
      src={emblemSrc}
      alt="INVICT Security Solutions"
      width={symbolSize}
      style={{ width: symbolSize, height: 'auto' }}
      className="shrink-0 select-none object-contain"
      draggable={false}
    />
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
