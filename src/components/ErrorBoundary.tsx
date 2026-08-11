import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center', 
          height: '100%', 
          padding: '2rem',
          textAlign: 'center',
          color: 'var(--text-color)'
        }}>
          <AlertTriangle size={64} style={{ color: '#ef4444', marginBottom: '1rem' }} />
          <h2 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Oops! Something went wrong.</h2>
          <p style={{ color: 'var(--text-muted)', maxWidth: '500px', marginBottom: '2rem' }}>
            {this.state.error?.message || "An unexpected error occurred in the application renderer. If this persists, please try resetting your session."}
          </p>
          <button className="btn btn-primary" onClick={this.handleReload}>
            <RefreshCcw size={18} /> Reload Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
