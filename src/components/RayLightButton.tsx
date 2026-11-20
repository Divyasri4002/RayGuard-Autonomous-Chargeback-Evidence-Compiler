import React from 'react';
import { Link } from 'react-router-dom';

interface RayLightButtonProps {
  children: React.ReactNode;
  to?: string;
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
  variant?: 'primary' | 'surface' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  ariaLabel?: string;
}

/**
 * Lexicon Primary & Surface Action Control
 * Palette: #F97316 primary, #EA580C hover/accent, #191C21 surface, #27272A border, 8px radius.
 */
export function RayLightButton({
  children,
  to,
  onClick,
  type = 'button',
  disabled = false,
  variant = 'primary',
  size = 'md',
  className = '',
  ariaLabel,
}: RayLightButtonProps) {
  const sizeClasses =
    size === 'sm'
      ? 'px-3.5 py-1.5 text-xs'
      : size === 'lg'
        ? 'px-6 py-3 text-sm'
        : 'px-4 py-2 text-sm';

  const variantClasses =
    variant === 'primary'
      ? 'bg-[#EA580C] hover:bg-[#C2410C] text-white font-semibold border border-[#EA580C] hover:border-[#C2410C] shadow-sm'
      : variant === 'surface'
        ? 'bg-[#FFFDF9] hover:bg-[#F3EDE2] text-[#1C1917] font-medium border border-[#E2D8C8] hover:border-[#EA580C]/60'
        : 'bg-[#F3EDE2] hover:bg-[#EAE2D3] text-[#57534E] hover:text-[#1C1917] font-medium border border-[#E2D8C8]';

  const baseClasses = `group relative inline-flex items-center justify-center gap-2 rounded-lg whitespace-nowrap shrink-0 transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#EA580C] disabled:opacity-50 disabled:pointer-events-none cursor-pointer ${sizeClasses} ${variantClasses} ${className}`;

  if (to) {
    return (
      <Link to={to} className={baseClasses} aria-label={ariaLabel}>
        <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
      </Link>
    );
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={baseClasses}
      aria-label={ariaLabel}
    >
      <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
    </button>
  );
}
