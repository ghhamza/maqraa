// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { Component, type ComponentType, type ErrorInfo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "./Button";

export interface ErrorFallbackProps {
  error: Error;
  reset: () => void;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Custom fallback component. Rendered as JSX so it can use hooks. */
  fallback?: ComponentType<ErrorFallbackProps>;
  /** Extra context tag included in the console.error log (e.g. "live-session"). */
  scope?: string;
  /** Called after the user clicks "Try again" — useful for re-fetching, navigating away, etc. */
  onReset?: () => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    const tag = this.props.scope ? `[ErrorBoundary:${this.props.scope}]` : "[ErrorBoundary]";
    console.error(tag, error, info.componentStack);
  }

  reset = (): void => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    const Fallback = this.props.fallback ?? DefaultErrorFallback;
    return <Fallback error={error} reset={this.reset} />;
  }
}

function DefaultErrorFallback({ error, reset }: ErrorFallbackProps) {
  const { t } = useTranslation();
  return (
    <div
      role="alert"
      className="flex min-h-[60dvh] w-full flex-col items-center justify-center gap-4 px-6 py-10 text-center"
    >
      <h1 className="text-xl font-semibold">{t("errorBoundary.title")}</h1>
      <p className="max-w-md text-sm text-muted-foreground">{t("errorBoundary.description")}</p>
      {import.meta.env.DEV && (
        <pre className="max-w-full overflow-auto rounded bg-muted p-2 text-start text-xs text-muted-foreground">
          {error.message}
        </pre>
      )}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button variant="secondary" onClick={reset}>
          {t("errorBoundary.tryAgain")}
        </Button>
        <Button onClick={() => window.location.reload()}>{t("errorBoundary.reload")}</Button>
      </div>
    </div>
  );
}
