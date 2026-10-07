import React from 'react';

type BadgeVariant =
  | 'success' |'error' |'warning' |'info' |'neutral' |'accent' |'primary';

interface BadgeProps {
  label?: string;
  children?: React.ReactNode;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  /** Kept for call-site compatibility; the classic style shows status as coloured text only. */
  dot?: boolean;
}

// Status as plain coloured text — colour only where the status means something
const variantClasses: Record<BadgeVariant, string> = {
  success: 'text-positive font-bold',
  error: 'text-negative font-bold',
  warning: 'text-warning font-bold',
  info: 'text-info',
  neutral: 'text-foreground',
  accent: 'text-foreground',
  primary: 'text-foreground font-bold',
};

export default function Badge({ label, children, variant = 'neutral', size = 'sm' }: BadgeProps) {
  return (
    <span className={`whitespace-nowrap ${variantClasses[variant]} ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>
      {children ?? label}
    </span>
  );
}
