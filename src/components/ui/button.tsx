import { forwardRef } from "react";
import { cn } from "@/lib/utils";

// uipro: OLED Dark Mode — high-contrast on deep black.
// "default" uses Copper Gold → text-background (dark) for 8.5:1 contrast.
// "electric" + "success" use neon fills → dark text for 9:1+ contrast.
// "danger" uses muted terracotta → white text for 7.3:1 contrast.
// Hover: neon glow via shadow-neon-* (uipro: "minimal glow, 150-300ms").
const variantStyles: Record<string, string> = {
  // ── Quiet Luxury primary — Copper Gold with gold glow on hover
  default:
    "bg-accent hover:bg-accent-hover hover:shadow-neon-gold text-background font-semibold",

  // ── Electric CTA — high-contrast blue, pops on Carbon Black
  electric:
    "bg-electric-blue hover:brightness-110 hover:shadow-neon-blue text-background font-semibold",

  // ── Positive action — neon green for task completion / KPI submit
  success:
    "bg-success-neon hover:brightness-110 hover:shadow-neon-success text-background font-semibold",

  // ── Structural secondary — quiet, dark surface
  secondary:
    "bg-card-secondary hover:bg-card-elevated text-text",

  // ── Ghost — no fill, subtle hover
  ghost:
    "bg-transparent hover:bg-white/5 text-text",

  // ── Outline — Grey Blue border, structural
  outline:
    "border border-border bg-transparent hover:bg-white/5 text-text",

  // ── Destructive — muted terracotta, white text (7.3:1 contrast)
  danger:
    "bg-danger hover:bg-danger/80 hover:shadow-neon-danger text-white",
};

const sizeStyles: Record<string, string> = {
  default: "h-10 px-4 py-2 text-sm",
  sm:      "h-8 px-3 text-xs",
  lg:      "h-12 px-6 text-base",
  icon:    "h-10 w-10 p-0",
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variantStyles;
  size?: keyof typeof sizeStyles;
  isLoading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", isLoading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          // Base: layout + shape + transitions
          // uipro: "smooth transitions 150-300ms" + "cursor-pointer on clickable"
          "inline-flex items-center justify-center gap-2 rounded-lg font-medium",
          "transition-all duration-200",
          "cursor-pointer",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
          "active:scale-95",
          "disabled:pointer-events-none disabled:opacity-50",
          variantStyles[variant] ?? variantStyles.default,
          sizeStyles[size] ?? sizeStyles.default,
          className,
        )}
        disabled={disabled || isLoading}
        aria-busy={isLoading || undefined}
        aria-disabled={disabled || isLoading || undefined}
        {...props}
      >
        {isLoading && (
          <>
            <svg
              className="h-4 w-4 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span className="sr-only">Cargando</span>
          </>
        )}
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";

export { Button };
export type { ButtonProps };
