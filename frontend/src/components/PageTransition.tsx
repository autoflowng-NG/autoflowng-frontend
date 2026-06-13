import { motion, AnimatePresence } from "framer-motion";
import type { ReactNode } from "react";

/* ─── Variant presets ────────────────────────────────────────────── */

const VARIANTS = {
  /** Default — slide up + fade (used for most pages) */
  slide: {
    initial:  { opacity: 0, y: 28, scale: 0.98 },
    animate:  { opacity: 1, y: 0,  scale: 1 },
    exit:     { opacity: 0, y: -16, scale: 0.98 },
  },
  /** Right-to-left slide (used for detail / builder pages) */
  push: {
    initial:  { opacity: 0, x: 40, scale: 0.97 },
    animate:  { opacity: 1, x: 0,  scale: 1 },
    exit:     { opacity: 0, x: -24, scale: 0.97 },
  },
  /** Radial bloom — used for auth pages (Landing → Login) */
  bloom: {
    initial:  { opacity: 0, scale: 0.94 },
    animate:  { opacity: 1, scale: 1 },
    exit:     { opacity: 0, scale: 1.03 },
  },
  /** Fade only — used for overlays / modals */
  fade: {
    initial:  { opacity: 0 },
    animate:  { opacity: 1 },
    exit:     { opacity: 0 },
  },
};

const TRANSITION = {
  default: { type: "spring", stiffness: 340, damping: 32, mass: 0.8 },
  slow:    { type: "spring", stiffness: 200, damping: 28, mass: 1.0 },
  snappy:  { type: "spring", stiffness: 460, damping: 36, mass: 0.6 },
};

type VariantKey = keyof typeof VARIANTS;
type TransitionKey = keyof typeof TRANSITION;

interface PageTransitionProps {
  children: ReactNode;
  variant?: VariantKey;
  speed?: TransitionKey;
  className?: string;
  style?: React.CSSProperties;
}

/** Wrap a page in this for cinematic enter/exit transitions */
export function PageTransition({
  children,
  variant = "slide",
  speed = "default",
  className,
  style,
}: PageTransitionProps) {
  const v = VARIANTS[variant];
  return (
    <motion.div
      initial={v.initial}
      animate={v.animate}
      exit={v.exit}
      transition={TRANSITION[speed]}
      className={className}
      style={{ width: "100%", minHeight: "100%", ...style }}
    >
      {children}
    </motion.div>
  );
}

/* ─── Staggered children ─────────────────────────────────────────── */

interface StaggerProps {
  children: ReactNode;
  delay?: number;      // initial delay before stagger begins (seconds)
  stagger?: number;    // per-child delay (seconds)
  y?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function Stagger({
  children,
  delay = 0.05,
  stagger = 0.07,
  y = 20,
  className,
  style,
}: StaggerProps) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { delayChildren: delay, staggerChildren: stagger } },
      }}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  y = 20,
  style,
}: { children: ReactNode; y?: number; style?: React.CSSProperties }) {
  return (
    <motion.div
      variants={{
        hidden:  { opacity: 0, y },
        visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 340, damping: 30 } },
      }}
      style={style}
    >
      {children}
    </motion.div>
  );
}

/* ─── Animated counter (numbers count up) ───────────────────────── */
export { motion, AnimatePresence };
