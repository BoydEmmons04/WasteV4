import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

// Without this, an uncaught render error anywhere in the tree unmounts the
// whole app and leaves a blank white screen with no way back except a full
// reload. This catches it and offers a recoverable in-app reload instead.
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled render error', error, info.componentStack);
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
