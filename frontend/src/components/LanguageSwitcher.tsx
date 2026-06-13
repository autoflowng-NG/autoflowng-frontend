/**
 * AutoFlowNG — Language Switcher (Update-001)
 *
 * Displays flag + language name in native script.
 * Saves to localStorage immediately, to account if logged in.
 *
 * Usage:
 *   <LanguageSwitcher />
 *   <LanguageSwitcher compact />  // icon-only for collapsed sidebar
 */

import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES, setLanguage } from "../i18n";
import { Globe } from "lucide-react";

interface LanguageSwitcherProps {
  compact?: boolean;
  onSaveToAccount?: (lang: string) => Promise<void>;
}

export function LanguageSwitcher({ compact = false, onSaveToAccount }: LanguageSwitcherProps) {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const currentLang = SUPPORTED_LANGUAGES.find(l => l.code === i18n.language) ?? SUPPORTED_LANGUAGES[0];

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function handleSelect(langCode: string) {
    setOpen(false);
    await setLanguage(
      langCode,
      onSaveToAccount ? () => onSaveToAccount(langCode) : undefined
    );
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(v => !v)}
        title="Change language"
        style={{
          display: "flex",
          alignItems: "center",
          gap: compact ? 0 : 6,
          background: "transparent",
          border: "1px solid rgba(255,255,255,0.09)",
          borderRadius: 8,
          padding: compact ? "6px 8px" : "6px 10px",
          color: "rgba(232,238,255,0.6)",
          fontSize: 12,
          cursor: "pointer",
          fontFamily: "'DM Mono',monospace",
          whiteSpace: "nowrap",
          transition: "all 0.15s",
        }}
        aria-label="Select language"
        aria-expanded={open}
      >
        {compact ? (
          <Globe size={13} />
        ) : (
          <>
            <Globe size={12} />
            <span>{currentLang.flag}</span>
            <span>{currentLang.nativeLabel}</span>
          </>
        )}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 6px)",
            left: 0,
            background: "rgba(8,11,22,0.98)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 10,
            padding: "6px 0",
            minWidth: 160,
            zIndex: 1000,
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          }}
          role="menu"
        >
          {SUPPORTED_LANGUAGES.map(lang => {
            const isActive = lang.code === i18n.language;
            return (
              <button
                key={lang.code}
                onClick={() => handleSelect(lang.code)}
                role="menuitem"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  background: isActive ? "rgba(0,200,150,0.08)" : "transparent",
                  border: "none",
                  padding: "8px 14px",
                  color: isActive ? "#00C896" : "rgba(232,238,255,0.7)",
                  fontSize: 13,
                  cursor: "pointer",
                  fontFamily: "'DM Sans',sans-serif",
                  textAlign: "left",
                  transition: "background 0.12s",
                }}
                onMouseEnter={e => {
                  if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.04)";
                }}
                onMouseLeave={e => {
                  if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                }}
              >
                <span style={{ fontSize: 16 }}>{lang.flag}</span>
                <span style={{ flex: 1 }}>{lang.nativeLabel}</span>
                {isActive && (
                  <span style={{ fontSize: 10, color: "#00C896", fontFamily: "'DM Mono',monospace" }}>✓</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
