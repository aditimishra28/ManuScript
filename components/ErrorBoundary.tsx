import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Terminal } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught system error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 font-sans text-slate-200">
          <div className="max-w-xl w-full bg-slate-900 border border-rose-900/50 rounded-xl shadow-2xl p-8 relative overflow-hidden">
            {/* Background warning stripes */}
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-rose-600 via-amber-500 to-rose-600"></div>
            
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="w-20 h-20 bg-rose-900/20 rounded-full flex items-center justify-center border border-rose-500/30">
                <AlertTriangle className="w-10 h-10 text-rose-500 animate-pulse" />
              </div>
              
              <div>
                <h1 className="text-2xl font-bold text-white mb-2">System Interface Malfunction</h1>
                <p className="text-slate-400">
                  The dashboard encountered a critical rendering error. Safety protocols have paused the display to prevent data corruption.
                </p>
              </div>

              <div className="w-full bg-black/50 rounded p-4 text-left border border-slate-800">
                <div className="flex items-center gap-2 text-xs font-mono text-slate-500 mb-2 border-b border-slate-800 pb-2">
                    <Terminal className="w-3 h-3" /> System Log
                </div>
                <code className="text-xs font-mono text-rose-400 break-all">
                  {this.state.error?.toString() || "Unknown Error"}
                </code>
              </div>

              <button 
                onClick={this.handleReset}
                className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
              >
                <RefreshCw className="w-4 h-4" /> Reboot Interface
              </button>
            </div>
            
            <div className="mt-8 text-center text-[10px] text-slate-600">
                Error Code: 0xCRASH_RENDER_FAIL <br/>
                Please contact IT Support if this persists.
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;