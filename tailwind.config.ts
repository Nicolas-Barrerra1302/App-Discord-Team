import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1rem",
    },
    extend: {
      colors: {
        // ── Backgrounds ──────────────────────────────────────────
        // uipro: OLED Dark Mode — deep black for power efficiency + premium feel
        background: {
          DEFAULT: "#0C0C0C",   // Carbon Black — the foundation
          secondary: "#111114", // Near-black with a whisper of warmth
          elevated: "#161619",  // Surface lift — barely perceptible
        },
        card: {
          DEFAULT: "#141418",   // Dark mineral — structural warmth
          secondary: "#1A1A1F", // Resting surface for widgets
          elevated: "#1F1F28",  // Raised state — hover / modal backdrop
        },
        border: {
          DEFAULT: "#2E3A48",   // Grey Blue — architectural, not decorative
          subtle: "#1C2530",    // Hairline — inner card structure
          accent: "#CBA35C",    // Copper Gold — focus rings / highlighted borders
        },

        // ── Brand Accent — Copper Gold ────────────────────────────
        // uipro: "Premium dark + gold accent" — primary power color
        accent: {
          DEFAULT: "#CBA35C",  // Copper Gold — authority, warmth, premium
          hover: "#D4AF6E",    // Lighter: polished, approachable
          soft: "#B8924A",     // Deeper: burnished, restrained
          muted: "#8A6A38",    // Subdued: structural accent
        },

        // ── Secondary Highlight — Soft Violet ────────────────────
        // uipro: iridescent touch from Liquid Glass — used sparingly
        violet: {
          DEFAULT: "#A695FF",  // Soft Violet — executive, refined
          soft: "#7B6BD4",     // Deeper: elevated surfaces
          muted: "#A695FF",    // Used with /20 opacity for badges
        },

        // ── Semantic States — Quiet Luxury palette ────────────────
        // uipro: aged, lived-in tones for structural UI
        success: "#3D7A5C",   // Deep emerald — resolved, settled
        warning: "#A0784A",   // Dusty amber brass — measured concern
        danger:  "#8A4040",   // Muted terracotta — stopped, not alarming
        info:    "#3A5A78",   // Deep slate — measured, authoritative

        // ── Text ─────────────────────────────────────────────────
        text: {
          DEFAULT: "#D4D0C8",  // Warm off-white — not clinical stark white
          muted:   "#6B6A72",  // Subdued: metadata, captions
          heading: "#F5F0E8",  // Warm near-white — headings, titles
          accent:  "#CBA35C",  // Gold emphasis inline text
          subtle:  "#3E3E45",  // Near-invisible — decorative dividers
        },

        // ── Status (task states) — vivid neon, LED indicators ───────
        // uipro: OLED Dark Mode "vibrant neon accents" — glowing LED on Carbon Black
        status: {
          pending:     "#FFB000",  // Vivid amber — awaiting, energized
          in_progress: "#38BFF5",  // Electric blue — active, focused
          completed:   "#00FF7F",  // Neon green — resolved, achieved
          blocked:     "#FF004D",  // Laser red — halted, critical
        },

        // ── Priority — bright neon escalation ────────────────────
        // uipro: gamification urgency — neon tier for high-stakes tasks
        priority: {
          low:    "#64748B",  // Slate — low noise, operational
          medium: "#FFD740",  // Electric amber — measured urgency
          high:   "#FF8C00",  // Vivid orange — heightened attention
          urgent: "#B026FF",  // Vivid violet — maximum urgency
        },

        // ── Roles — hierarchical authority palette ────────────────
        role: {
          super_admin: "#CBA35C",  // Copper Gold — highest authority
          ceo:         "#A695FF",  // Soft Violet — executive voice
          member:      "#4A5560",  // Slate — operational, neutral
        },

        // ── Bonus event types ────────────────────────────────────
        bonus: {
          positive: "#3D7A5C",  // Deep emerald — earned
          negative: "#7A3D3D",  // Muted burgundy — penalized
          streak:   "#CBA35C",  // Copper Gold — momentum
          purple:   "#A695FF",  // Soft Violet — special events
        },

        // ── Neon "Traffic Light" — gamification / scoring / alerts ──
        // uipro: OLED Dark Mode — "vibrant neon accents on deep black"
        // STRICTLY reserved: points display, streaks, scoring, critical alerts
        "success-neon": "#00E676",  // Neon green — positive points, achievements
        "warning-neon": "#FFD740",  // Electric amber — mid-score, caution
        "danger-neon":  "#FF5252",  // Neon red — penalties, critical alerts

        // ── Electric CTAs — high-contrast action colors ───────────
        // uipro: standout CTAs that pop against Carbon Black
        "electric-blue":   "#38BFF5",  // Electric blue — primary alt CTA
        "electric-violet": "#A695FF",  // Soft Violet alias — CTA secondary
      },

      // ── Box Shadows — Quiet Luxury base + Neon Glow gamification ─
      // uipro: Skeuomorphism multi-layer for structure (barely-there);
      //        OLED "minimal glow" for gamification/CTAs
      boxShadow: {
        // Structural — Quiet Luxury (not theatrical)
        card:           "0 1px 3px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.025)",
        "card-hover":   "0 4px 20px rgba(0,0,0,0.65), inset 0 1px 0 rgba(203,163,92,0.06)",
        elevated:       "0 8px 40px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.04)",
        inner:          "inset 0 1px 0 rgba(255,255,255,0.04)",
        "inner-accent": "inset 0 1px 0 rgba(203,163,92,0.08)",
        "gold-border":  "0 0 0 1px rgba(203,163,92,0.20)",
        // Neon Glow — reserved for gamification elements & electric CTAs
        "neon-gold":    "0 0 20px rgba(203,163,92,0.30), 0 0 40px rgba(203,163,92,0.10)",
        "neon-success": "0 0 16px rgba(0,230,118,0.35), 0 0 40px rgba(0,230,118,0.12)",
        "neon-warning": "0 0 16px rgba(255,215,64,0.35), 0 0 40px rgba(255,215,64,0.10)",
        "neon-danger":  "0 0 16px rgba(255,82,82,0.35), 0 0 40px rgba(255,82,82,0.12)",
        "neon-blue":    "0 0 16px rgba(56,191,245,0.35), 0 0 40px rgba(56,191,245,0.12)",
        "neon-violet":  "0 0 16px rgba(166,149,255,0.30), 0 0 40px rgba(166,149,255,0.10)",
      },

      // ── Background Images — Copper Gold gradients ─────────────────
      // uipro: Liquid Glass gradient fluidity — applied to CTAs and accent surfaces
      backgroundImage: {
        "gradient-gold":           "linear-gradient(135deg, #B8924A 0%, #CBA35C 50%, #D4AF6E 100%)",
        "gradient-gold-subtle":    "linear-gradient(180deg, rgba(203,163,92,0.06) 0%, transparent 100%)",
        "gradient-gold-horizontal":"linear-gradient(90deg, #B8924A, #D4AF6E)",
        "gradient-card":           "linear-gradient(180deg, #1F1F28 0%, #141418 100%)",
        "gradient-surface":        "linear-gradient(135deg, #1A1A1F 0%, #111114 100%)",
        "gradient-structural":     "linear-gradient(180deg, rgba(46,58,72,0.12) 0%, transparent 100%)",
      },
    },
  },
  plugins: [],
};
export default config;
