import React, { Component } from 'react';
import { AlertTriangle, RefreshCw, Home, ChevronDown, ChevronUp } from 'lucide-react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    // Keep a console error trace for local inspection
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
  }

  resetErrorBoundary = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        if (typeof this.props.fallback === 'function') {
          return this.props.fallback(this.state.error, this.resetErrorBoundary);
        }
        return this.props.fallback;
      }

      const isCompact = this.props.compact;

      if (isCompact) {
        return (
          <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-4 text-xs text-rose-800 space-y-2">
            <div className="flex items-center space-x-2 font-semibold">
              <AlertTriangle className="h-4 w-4 text-rose-600 flex-shrink-0" />
              <span>{this.props.title || 'Component failed to render'}</span>
            </div>
            <p className="text-[11px] text-rose-700">{this.state.error?.message || 'An unexpected error occurred.'}</p>
            <div className="flex items-center space-x-2 pt-1">
              <button
                type="button"
                onClick={this.resetErrorBoundary}
                className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white font-medium text-[11px] transition"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Retry
              </button>
            </div>
          </div>
        );
      }

      return (
        <div className="min-h-[340px] flex items-center justify-center p-6">
          <div className="max-w-xl w-full bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden p-6 sm:p-8 space-y-5">
            <div className="flex items-start space-x-4">
              <div className="h-12 w-12 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center flex-shrink-0 text-rose-600">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                  {this.props.title || 'Unable to display this view'}
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  A client-side error occurred while rendering this interface. Your data remains secure on the server.
                </p>
              </div>
            </div>

            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-700 font-mono break-words">
              <span className="font-semibold text-rose-700">Error:</span>{' '}
              {this.state.error?.message || 'Unknown runtime error'}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={this.resetErrorBoundary}
                className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs transition shadow-sm cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Try Again</span>
              </button>

              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs transition cursor-pointer"
              >
                <span>Reload Page</span>
              </button>

              <a
                href="/dashboard"
                className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 font-medium text-xs transition"
              >
                <Home className="h-3.5 w-3.5" />
                <span>Return to Dashboard</span>
              </a>
            </div>

            {/* Collapsible Error Stack Details */}
            {this.state.errorInfo && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => this.setState((prev) => ({ showDetails: !prev.showDetails }))}
                  className="inline-flex items-center space-x-1 text-[11px] text-slate-400 hover:text-slate-600 font-medium"
                >
                  {this.state.showDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  <span>{this.state.showDetails ? 'Hide' : 'Show'} technical diagnostic details</span>
                </button>

                {this.state.showDetails && (
                  <pre className="mt-2 p-3 bg-slate-900 text-slate-200 rounded-lg text-[10px] font-mono overflow-x-auto max-h-48 leading-relaxed">
                    {this.state.error?.stack || String(this.state.error)}
                    {'\n\nComponent Stack:'}
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
