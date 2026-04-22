import React from 'react';
import { RefreshCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  label?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[ErrorBoundary: ${this.props.label ?? 'unknown'}]`, error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 px-6 text-center">
          <div className="text-4xl">😬</div>
          <p className="font-bold text-slate-700 text-base">
            Something went wrong{this.props.label ? ` in ${this.props.label}` : ''}.
          </p>
          <p className="text-slate-400 text-sm">
            Your data is safe. Try refreshing this screen.
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: undefined })}
            className="flex items-center gap-2 px-4 py-2 bg-teal-500 text-white rounded-xl text-sm font-bold"
          >
            <RefreshCw className="w-4 h-4" /> Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
