import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("UI crash:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <section className="panel" style={{ padding: "2rem" }}>
          <h1>Something broke</h1>
          <p className="muted">{this.state.error.message}</p>
          <button type="button" className="btn primary" onClick={() => window.location.assign("/")}>
            Reload home
          </button>
        </section>
      );
    }
    return this.props.children;
  }
}
