/**
 * AnimatedRoutes — wraps wouter Switch with AnimatePresence
 * so pages animate in/out on every route change.
 */
import { AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import type { ReactNode } from "react";

interface AnimatedRoutesProps {
  children: ReactNode;
}

export function AnimatedRoutes({ children }: AnimatedRoutesProps) {
  const [location] = useLocation();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <div key={location} style={{ width: "100%", minHeight: "100%" }}>
        {children}
      </div>
    </AnimatePresence>
  );
}
