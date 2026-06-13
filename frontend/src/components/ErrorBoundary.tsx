import { Component, type ReactNode, type ErrorInfo } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
  /** Optional label for debugging (e.g. "Dashboard", "Workflows") */
  section?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.(error, info);
    // eslint-disable-next-line no-console
    console.error(`[ErrorBoundary:${this.props.section ?? "unknown"}]`, error, info);
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback)  return this.props.fallback;

    const { error } = this.state;
    const section   = this.props.section ?? "This section";

    return (
      <div
        style={{
          minHeight:      "60vh",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          padding:        "40px 24px",
        }}
      >
        <div
          style={{
            maxWidth:     480,
            width:        "100%",
            background:   "linear-gradient(135deg, rgba(251,113,133,0.05), rgba(8,11,22,0.98))",
            border:       "1px solid rgba(251,113,133,0.18)",
            borderRadius: 20,
            padding:      "36px 32px",
            boxShadow:    "0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(251,113,133,0.08)",
            position:     "relative",
            overflow:     "hidden",
          }}
        >
          {/* Glow sweep */}
          <div style={{
            position:   "absolute", top: 0, left: 0, right: 0, height: 1,
            background: "linear-gradient(90deg, transparent, rgba(251,113,133,0.3), transparent)",
          }} />

          {/* Icon */}
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: "rgba(251,113,133,0.1)", border: "1px solid rgba(251,113,133,0.22)",
            display: "flex", alignItems: "center", justifyContent: "center",
            marginBottom: 20, fontSize: 22,
          }}>
            ⚡
          </div>

          <div style={{
            fontSize: 10, fontWeight: 800, color: "#FB7185", letterSpacing: "0.08em",
            fontFamily: "'DM Mono',monospace", marginBottom: 10,
          }}>
            RENDER ERROR
          </div>

          <div style={{
            fontSize: 18, fontWeight: 800, color: "#E8EEFF",
            fontFamily: "'Syne',sans-serif", marginBottom: 8, lineHeight: 1.3,
          }}>
            {section} encountered a problem
          </div>

          <div style={{
            fontSize: 13, color: "rgba(232,238,255,0.45)", lineHeight: 1.6,
            fontFamily: "'DM Sans',sans-serif", marginBottom: 24,
          }}>
            An unexpected error stopped this section from rendering. The rest of the
            platform is unaffected.
          </div>

          {/* Error message */}
          {error?.message && (
            <div style={{
              background:   "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 10, padding: "10px 14px", marginBottom: 24,
              fontFamily:   "'DM Mono',monospace", fontSize: 11, color: "rgba(251,113,133,0.7)",
              wordBreak:    "break-word",
            }}>
              {error.message}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={this.reset}
              style={{
                flex:         1,
                padding:      "10px 16px",
                background:   "rgba(251,113,133,0.1)",
                border:       "1px solid rgba(251,113,133,0.25)",
                borderRadius: 10, cursor: "pointer",
                color:        "#FB7185", fontWeight: 700, fontSize: 13,
                fontFamily:   "'DM Sans',sans-serif", transition: "all 0.15s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(251,113,133,0.2)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(251,113,133,0.1)")}
            >
              Try again
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding:      "10px 16px",
                background:   "rgba(255,255,255,0.04)",
                border:       "1px solid rgba(255,255,255,0.08)",
                borderRadius: 10, cursor: "pointer",
                color:        "rgba(232,238,255,0.5)", fontWeight: 600, fontSize: 13,
                fontFamily:   "'DM Sans',sans-serif", transition: "all 0.15s",
              }}
              onMouseEnter={e => (e.currentTarget.style.color = "#E8EEFF")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(232,238,255,0.5)")}
            >
              Reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}

/** Lightweight inline version for smaller sections */
export function InlineError({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div style={{
      padding:      "20px",
      background:   "rgba(251,113,133,0.05)",
      border:       "1px solid rgba(251,113,133,0.15)",
      borderRadius: 12,
      display:      "flex", alignItems: "center", gap: 12,
    }}>
      <span style={{ fontSize: 18 }}>⚠️</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, color: "#E8EEFF", fontWeight: 600, fontFamily: "'DM Sans',sans-serif" }}>
          {message || "Something went wrong"}
        </div>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            background: "rgba(251,113,133,0.1)", border: "1px solid rgba(251,113,133,0.2)",
            borderRadius: 8, padding: "6px 12px", color: "#FB7185",
            fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
          }}
        >
          Retry
        </button>
      )}
    </div>
  );
}
