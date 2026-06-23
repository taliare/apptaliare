import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  fallbackMessage?: string;
  resetKey?: string | number;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info);
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, error: null });
    }
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (this.state.hasError) {
      return (
        <Card className="p-6 text-center space-y-3">
          <div className="flex justify-center">
            <AlertTriangle className="h-8 w-8 text-amber-500" />
          </div>
          <p className="text-sm text-muted-foreground">
            {this.props.fallbackMessage || 'Ocorreu um erro ao carregar este conteúdo. Tente novamente.'}
          </p>
          <Button size="sm" variant="outline" onClick={this.reset}>
            Tentar novamente
          </Button>
        </Card>
      );
    }
    return this.props.children;
  }
}
