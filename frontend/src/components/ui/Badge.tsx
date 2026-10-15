import type { ForwardRefExoticComponent, RefAttributes, SVGProps } from 'react';

export type LucideIcon = ForwardRefExoticComponent<Omit<SVGProps<SVGSVGElement>, 'ref'> & RefAttributes<SVGSVGElement> & { size?: string | number }>;

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  Icon?: LucideIcon;
  className?: string;
}

export function Badge({ children, variant = 'neutral', Icon, className = '' }: BadgeProps) {
  const variants = {
    success: 'badge-success',
    warning: 'badge-warning',
    danger: 'badge-danger',
    info: 'badge-info',
    neutral: 'badge-neutral',
  };

  return (
    <span className={`${variants[variant]} ${className}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>
      {Icon && <Icon size={12} aria-hidden={true} />}
      {children}
    </span>
  );
}