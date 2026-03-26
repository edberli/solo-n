import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

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
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let errorMessage = "發生未知的錯誤。";
      let isFirestoreError = false;

      try {
        if (this.state.error?.message) {
          const parsed = JSON.parse(this.state.error.message);
          if (parsed.operationType) {
            isFirestoreError = true;
            errorMessage = "資料庫權限不足或連線失敗。請確認您已登入，或重新整理頁面。";
          }
        }
      } catch (e) {
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-bg-dark p-4">
          <div className="bg-surface p-8 rounded-3xl max-w-md w-full text-center border border-border-color shadow-2xl">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="text-red-500" size={32} />
            </div>
            <h2 className="text-xl font-bold text-primary mb-4">
              {isFirestoreError ? '資料庫錯誤' : '系統發生錯誤'}
            </h2>
            <p className="text-secondary mb-8 text-sm">
              {errorMessage}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-primary text-bg-dark py-3 rounded-xl font-medium uppercase tracking-widest hover:bg-primary/90 transition-colors"
            >
              重新整理頁面
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
