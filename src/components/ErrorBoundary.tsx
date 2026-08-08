import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

const AUTO_RECOVER_MAX = 3;
const AUTO_RECOVER_WINDOW_MS = 10000;

// Without this, an uncaught render error anywhere in the tree unmounts the
// whole app and leaves a blank white screen with no way back except a full
// reload. This catches it and offers a recoverable in-app reload instead.
//
// One specific, known error class - "Failed to execute 'insertBefore' /
// 'removeChild' ... not a child of this node" - happens when Framework7's
// own vanilla-JS popup/DOM handling and React's reconciliation touch
// overlapping DOM in the same tick. The app's actual data/state is
// unaffected when this happens (it's a one-off render commit glitch, not a
// data problem), so for this specific error class the boundary silently
// resets and lets React re-render from scratch instead of forcing a full
// page reload - capped so a genuinely broken render can't loop forever.
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };
  recoveryTimestamps: number[] = [];

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled render error', error, info.componentStack);

    const isDomRace = error.name === 'NotFoundError' && /insertBefore|removeChild|appendChild/.test(error.message);
    if (!isDomRace) return;

    const now = Date.now();
    this.recoveryTimestamps = this.recoveryTimestamps.filter((t) => now - t < AUTO_RECOVER_WINDOW_MS);
    if (this.recoveryTimestamps.length >= AUTO_RECOVER_MAX) return;
    this.recoveryTimestamps.push(now);
    this.setState({ error: null });
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            padding: 24,
            textAlign: 'center',
            gap: 12,
          }}
        >
          <p style={{ fontWeight: 700, fontSize: 17 }}>Something went wrong.</p>
          <p style={{ opacity: 0.7, fontSize: 14 }}>{this.state.error.message}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 20px',
              borderRadius: 10,
              border: 'none',
              background: '#007aff',
              color: '#fff',
              fontWeight: 600,
              fontSize: 15,
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
