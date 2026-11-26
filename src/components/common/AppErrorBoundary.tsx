import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw, Compass } from 'lucide-react';
import { ErrorReporter } from '../../core/errorHandler';
import { ErrorPage } from './ErrorPage';

interface AppErrorBoundaryProps {
  children: ReactNode;
  scopeName?: string;
  onResetNavigate?: () => void;
  resetKey?: string | number;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = {
    hasError: false,
    errorMessage: '',
  };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Erro inesperado de renderização.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    ErrorReporter.report(error, {
      scope: this.props.scopeName || 'root',
      componentStack: info.componentStack?.slice(0, 400),
    });
  }

  componentDidUpdate(prevProps: AppErrorBoundaryProps): void {
    if (
      this.state.hasError &&
      prevProps.resetKey !== this.props.resetKey
    ) {
      this.setState({ hasError: false, errorMessage: '' });
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  private handleFallbackNavigate = () => {
    this.setState({ hasError: false, errorMessage: '' });
    this.props.onResetNavigate?.();
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    // Falha do app inteiro (sem escopo de módulo): mostra a página de erro.
    if (!this.props.scopeName) {
      return (
        <ErrorPage
          code="500"
          title="Algo inesperado aconteceu"
          description="Não foi possível carregar o sistema agora. Recarregue a página; seus dados locais permanecem salvos."
          detail={this.state.errorMessage}
          onHome={() => {
            window.location.href = '/dashboard';
          }}
          onRetry={() => window.location.reload()}
        />
      );
    }

    return (
      <div
        role="alert"
        className="w-full max-w-lg mx-auto my-4 sm:my-6 bg-white rounded-3xl border border-rose-200 shadow-lg pk-card-pad text-left space-y-3 pk-fade-enter"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-black text-slate-900">
              {this.props.scopeName
                ? `Falha temporária em ${this.props.scopeName}`
                : 'Algo inesperado aconteceu'}
            </h2>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              O módulo encontrou uma inconsistência momentânea, mas seus dados locais permanecem protegidos.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            onClick={this.handleRetry}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-[#9A3412] hover:bg-[#EA580C] text-white text-xs font-bold flex items-center gap-1.5 transition"
          >
            <RotateCcw className="w-3.5 h-3.5 shrink-0" />
            <span>Tentar novamente</span>
          </button>

          {this.props.onResetNavigate && (
            <button
              type="button"
              onClick={this.handleFallbackNavigate}
              className="min-h-[40px] px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-bold flex items-center gap-1.5 transition"
            >
              <Compass className="w-3.5 h-3.5 shrink-0" />
              <span>Voltar ao Pátio</span>
            </button>
          )}
        </div>
      </div>
    );
  }
}
