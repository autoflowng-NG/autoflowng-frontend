import { Component, ReactNode } from "react";

export class LandingErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ color: "white", padding: 32, fontFamily: "monospace", background: "#040606" }}>
          <h2 style={{ color: "#00C896" }}>Landing Error</h2>
          <pre style={{ color: "#FB7185", whiteSpace: "pre-wrap" }}>
            {(this.state.error as Error).message}
            {"\n\n"}
            {(this.state.error as Error).stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
