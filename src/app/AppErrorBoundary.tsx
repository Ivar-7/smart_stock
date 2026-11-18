import { Component, type ErrorInfo, type ReactNode } from 'react';
import { logDiagnosticError } from '../shared/errors';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class AppErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    message: '',
  };

  public static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const appErr = logDiagnosticError(error, 'AppErrorBoundary');
    return {
      hasError: true,
      message: appErr.userMessage,
    };
  }

  public componentDidCatch(error: Error, info: ErrorInfo): void {
    logDiagnosticError(error, 'AppErrorBoundary.componentDidCatch', {
      componentStack: info.componentStack?.slice(0, 200) ?? '',
    });
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="bg-canvas text-ink flex min-h-screen items-center justify-center p-6">
        <div className="bg-panel border-edge w-full max-w-md rounded-2xl border p-8 text-center">
          <p className="text-ink-muted text-xs font-medium tracking-widest uppercase">
            Smart Stock Recovery
          </p>
          <h1 className="text-ink mt-2 text-lg font-semibold">Something unexpected happened</h1>
          <p className="text-ink-secondary mt-2 text-sm leading-relaxed">
            {this.state.message || 'An unexpected rendering issue interrupted this view.'}
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            className="bg-contrast-bg text-contrast-ink mt-6 inline-flex h-10 cursor-pointer items-center justify-center rounded-lg px-5 text-sm font-medium transition-opacity hover:opacity-90"
          >
            Reload Smart Stock
          </button>
        </div>
      </div>
    );
  }
}
