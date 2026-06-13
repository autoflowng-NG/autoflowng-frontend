/**
 * AutoFlowNG — Cloudflare Turnstile Widget (Phase 10F)
 *
 * Drop-in React component that injects the Turnstile script and renders the
 * challenge widget.  The resolved token is passed to `onSuccess` and should
 * be included in the form submission as `cf-turnstile-response` (or
 * `turnstileToken`) so the backend middleware can verify it.
 *
 * Usage:
 *   <TurnstileWidget onSuccess={(token) => setTurnstileToken(token)} />
 *
 * Environment variable required (Vite):
 *   VITE_CLOUDFLARE_TURNSTILE_SITE_KEY  — your Turnstile site key
 *   Leave unset in development to render a dev-mode placeholder.
 */

import React, { useEffect, useRef, useId } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (el: string | HTMLElement, options: TurnstileOptions) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
    onTurnstileLoad?: () => void;
  }
}

interface TurnstileOptions {
  sitekey: string;
  callback: (token: string) => void;
  'expired-callback'?: () => void;
  'error-callback'?: () => void;
  theme?: 'light' | 'dark' | 'auto';
  size?: 'normal' | 'compact';
  language?: string;
}

interface TurnstileWidgetProps {
  onSuccess: (token: string) => void;
  onExpired?: () => void;
  onError?: () => void;
  theme?: 'light' | 'dark' | 'auto';
  size?: 'normal' | 'compact';
  className?: string;
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad&render=explicit';
const SITE_KEY   = import.meta.env.VITE_CLOUDFLARE_TURNSTILE_SITE_KEY as string | undefined;

let scriptLoaded = false;
let scriptLoading = false;
const loadCallbacks: Array<() => void> = [];

function loadTurnstileScript(onLoad: () => void) {
  if (scriptLoaded) { onLoad(); return; }
  loadCallbacks.push(onLoad);
  if (scriptLoading) return;
  scriptLoading = true;

  window.onTurnstileLoad = () => {
    scriptLoaded = true;
    loadCallbacks.forEach(cb => cb());
    loadCallbacks.length = 0;
  };

  const script = document.createElement('script');
  script.src   = SCRIPT_SRC;
  script.async = true;
  script.defer = true;
  document.head.appendChild(script);
}

const TurnstileWidget: React.FC<TurnstileWidgetProps> = ({
  onSuccess,
  onExpired,
  onError,
  theme    = 'auto',
  size     = 'normal',
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef  = useRef<string | null>(null);
  const uid          = useId().replace(/:/g, '');

  useEffect(() => {
    // Dev mode: no site key configured — render placeholder and auto-resolve
    if (!SITE_KEY) {
      if (import.meta.env.DEV) {
        console.warn('[TurnstileWidget] VITE_CLOUDFLARE_TURNSTILE_SITE_KEY not set — using dev bypass token');
        onSuccess('dev-bypass-token');
      } else if (import.meta.env.PROD) {
        // Fail closed in production — do not silently bypass bot protection
        console.error('[TurnstileWidget] VITE_CLOUDFLARE_TURNSTILE_SITE_KEY is not set in production. Bot protection is disabled.');
        onError?.();
      }
      return;
    }

    function renderWidget() {
      if (!containerRef.current || widgetIdRef.current !== null) return;
      widgetIdRef.current = window.turnstile!.render(containerRef.current, {
        sitekey: SITE_KEY!,
        callback: onSuccess,
        'expired-callback': onExpired,
        'error-callback': onError,
        theme,
        size,
      });
    }

    loadTurnstileScript(() => {
      if (window.turnstile) {
        renderWidget();
      } else {
        // Turnstile not yet injected into window — poll briefly
        const t = setInterval(() => {
          if (window.turnstile) { clearInterval(t); renderWidget(); }
        }, 50);
        setTimeout(() => clearInterval(t), 5000);
      }
    });

    return () => {
      if (widgetIdRef.current !== null && window.turnstile) {
        try { window.turnstile.remove(widgetIdRef.current); } catch {}
        widgetIdRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  // Dev placeholder / Prod error
  if (!SITE_KEY) {
    if (import.meta.env.DEV) {
      return (
        <div
          className={className}
          style={{
            padding: '8px 12px',
            border: '1px dashed #f59e0b',
            borderRadius: 6,
            background: '#fef3c7',
            color: '#92400e',
            fontSize: 12,
            fontFamily: 'monospace',
            display: 'inline-block',
          }}
        >
          ⚠️ Turnstile dev mode — challenge bypassed
        </div>
      );
    } else if (import.meta.env.PROD) {
      return (
        <div className="text-red-500 text-sm border border-red-500 rounded p-2">
          ⚠ Security check unavailable. Please reload the page or contact support.
        </div>
      );
    }
  }

  return <div ref={containerRef} id={`turnstile-${uid}`} className={className} />;
};

export default TurnstileWidget;
