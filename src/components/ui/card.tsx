import { forwardRef } from "react";
import { cn } from "@/lib/utils";

// uipro: Card variant hierarchy.
// "default"  — Quiet Luxury base: Carbon surface + Grey Blue border. Flat, minimal.
// "elevated" — Lifted surface with structural shadow. For modals, dropdowns.
// "accent"   — Copper Gold inner border hint. For featured/highlighted content.
// "neon"     — Electric Blue border + glow. Strictly for gamification panels,
//              achievement cards, points leaderboards.
const cardVariantStyles: Record<string, string> = {
  default:  "bg-card-secondary border border-border",
  elevated: "bg-card border border-border shadow-card",
  accent:   "bg-card-secondary border border-accent/40 shadow-inner-accent",
  neon:     "bg-card-secondary border border-electric-blue/40 shadow-neon-blue",
};

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: keyof typeof cardVariantStyles;
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "default", ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-xl text-text",
        cardVariantStyles[variant] ?? cardVariantStyles.default,
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = "Card";

const CardHeader = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
  ),
);
CardHeader.displayName = "CardHeader";

const CardTitle = forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("font-semibold leading-none tracking-tight text-text-heading", className)} {...props} />
  ),
);
CardTitle.displayName = "CardTitle";

const CardContent = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  ),
);
CardContent.displayName = "CardContent";

export { Card, CardHeader, CardTitle, CardContent };
export type { CardProps };
