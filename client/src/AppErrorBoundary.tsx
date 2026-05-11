import React from "react";

type Props = { children: React.ReactNode };

type State = { error: Error | null };

/**
 * Evita tela totalmente branca quando algum componente quebra no runtime.
 */
export class AppErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-6">
          <div className="max-w-lg rounded-xl border border-red-200 bg-white p-6 shadow-sm space-y-4">
            <h1 className="text-lg font-semibold text-red-800">Erro ao carregar a página</h1>
            <p className="text-sm text-slate-600 break-words">{this.state.error.message}</p>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                className="rounded-lg bg-emerald-700 px-4 py-2 text-white text-sm font-medium hover:bg-emerald-800"
                onClick={() => window.location.reload()}
              >
                Recarregar
              </button>
              <a href="/" className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                Ir ao início
              </a>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
