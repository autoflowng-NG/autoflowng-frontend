import { Component, ReactNode } from "react";

interface Props { children: ReactNode; }
interface State { hasError: boolean; }

export class LandingErrorBoundary extends Component<Props, State> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">AutoFlowNG</h1>
          <p className="text-gray-400">Something went wrong. <a href="/" className="text-amber-500">Reload</a></p>
        </div>
      </div>;
    }
    return this.props.children;
  }
}
