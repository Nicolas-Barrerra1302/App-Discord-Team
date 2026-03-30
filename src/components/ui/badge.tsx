import { cn } from "@/lib/utils";

// uipro: two-tier badge system — Cyberpunk Terminal Neon.
// Tier 1 — Quiet Luxury (muted tints): structural UI only (forms, roles).
// Tier 2 — True Neon LED: transparent bg + solid 100% border + 100% text + glow text-shadow.
// Rule: bg fills muddy neon text over Carbon Black. Neon = border + text-shadow only.
const variantStyles: Record<string, string> = {
  // ── Tier 1: Quiet Luxury — structural / non-gamification badges ──────
  default:     "bg-accent/20 text-accent",
  success:     "bg-success/20 text-success",
  warning:     "bg-warning/20 text-warning",
  danger:      "bg-danger/20 text-danger",
  info:        "bg-info/20 text-info",
  outline:     "border border-border text-text-muted bg-transparent",
  gold:        "bg-transparent text-accent border border-accent [text-shadow:0_0_6px_currentColor]",

  // ── Status variants — True Neon LED (transparent bg, solid border, glow)
  // uipro: No fill. 100% vibrant text + 1px solid neon border + text-shadow glow.
  pending:     "bg-transparent text-status-pending border border-status-pending [text-shadow:0_0_8px_currentColor]",
  in_progress: "bg-transparent text-status-in_progress border border-status-in_progress [text-shadow:0_0_8px_currentColor]",
  completed:   "bg-transparent text-status-completed border border-status-completed [text-shadow:0_0_8px_currentColor]",
  blocked:     "bg-transparent text-status-blocked border border-status-blocked [text-shadow:0_0_8px_currentColor]",

  // ── Priority variants — True Neon LED
  low:         "bg-transparent text-priority-low border border-priority-low/60",
  medium:      "bg-transparent text-priority-medium border border-priority-medium [text-shadow:0_0_6px_currentColor]",
  high:        "bg-transparent text-priority-high border border-priority-high [text-shadow:0_0_8px_currentColor]",
  urgent:      "bg-transparent text-priority-urgent border border-priority-urgent [text-shadow:0_0_10px_currentColor] animate-pulse",

  // ── Tier 2: Neon Traffic Light — gamification / scoring / alerts ─────
  // uipro: Transparent bg + full-opacity border + text-shadow = physical LED glow
  "success-neon": "bg-transparent text-success-neon border border-success-neon [text-shadow:0_0_8px_currentColor]",
  "warning-neon": "bg-transparent text-warning-neon border border-warning-neon [text-shadow:0_0_8px_currentColor]",
  "danger-neon":  "bg-transparent text-danger-neon border border-danger-neon [text-shadow:0_0_8px_currentColor]",
  "electric-blue":"bg-transparent text-electric-blue border border-electric-blue [text-shadow:0_0_8px_currentColor]",

  // Semantic alias — gamification points display
  points: "bg-transparent text-success-neon border border-success-neon font-mono tabular-nums [text-shadow:0_0_8px_currentColor]",
};

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: keyof typeof variantStyles;
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold transition-colors",
        variantStyles[variant] ?? variantStyles.default,
        className,
      )}
      {...props}
    />
  );
}
