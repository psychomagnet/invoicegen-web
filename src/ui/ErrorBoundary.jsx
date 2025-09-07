import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    // You could also POST this to your logs
    console.error("UI crashed:", error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 16, maxWidth: 900, margin: "24px auto" }}>
          <h2>Something went wrong</h2>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              background: "#111",
              color: "#eee",
              padding: 12,
              borderRadius: 8,
              overflowX: "auto",
            }}
          >
            {String(this.state.error?.stack || this.state.error)}
          </pre>
          <p style={{ color: "#666" }}>
            If this persists, copy the error above and share it here and I’ll patch it.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
