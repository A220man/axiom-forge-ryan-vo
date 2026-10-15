import { LucideIcon, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

interface GradeBadgeProps {
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

const gradeIcons: Record<'A' | 'B' | 'C' | 'D' | 'F', LucideIcon> = {
  A: CheckCircle,
  B: CheckCircle,
  C: AlertTriangle,
  D: AlertTriangle,
  F: XCircle,
};

const gradeLabels: Record<'A' | 'B' | 'C' | 'D' | 'F', string> = {
  A: 'Excellent',
  B: 'Good',
  C: 'Acceptable',
  D: 'Poor',
  F: 'Failing',
};

export function GradeBadge({ grade, size = 'md', showIcon = true }: GradeBadgeProps) {
  const sizes = {
    sm: { width: 28, height: 28, fontSize: '0.875rem', iconSize: 14 },
    md: { width: 48, height: 48, fontSize: '1.5rem', iconSize: 24 },
    lg: { width: 72, height: 72, fontSize: '2rem', iconSize: 32 },
  };

  const { width, height, fontSize, iconSize } = sizes[size];
  const Icon = gradeIcons[grade];

  return (
    <div className="flex items-center gap-2" title={`${grade}: ${gradeLabels[grade]}`}>
      <div
        className={`grade-badge grade-${grade} flex-shrink-0`}
        style={{ width, height, fontSize }}
        role="img"
        aria-label={`Grade ${grade}: ${gradeLabels[grade]}`}
      >
        {showIcon && <Icon size={iconSize} />}
        {!showIcon && grade}
      </div>
      {size !== 'sm' && (
        <span className="font-medium text-sm capitalize">{gradeLabels[grade].toLowerCase()}</span>
      )}
    </div>
  );
}