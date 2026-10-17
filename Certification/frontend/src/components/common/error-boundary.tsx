"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isProduction } from "@/config/env";

interface Props {
  children: ReactNode;
  /** Change this key to force a boundary reset on navigation. */
  resetKey?: string;
}

interface State {
  error: Error | null;
}

/**
 * Top-level React error boundary. Never surfaces raw error text to users;
 * logs to the console (and, in production, would ship to an APM sink).
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  override componentDidUpdate(prevProps: Props) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  override render() {
    if (this.state.error) {
      return (
        <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-6 py-24 text-center" role="alert">
          <div className="rounded-full bg-destructive/10 p-4 text-destructive" aria-hidden="true">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
          <p className="text-muted-foreground">
            An unexpected error occurred while displaying this page. Your session and data are unaffected. Please try
            again; if the problem persists, contact support.
          </p>
          {isProduction ? null : <pre className="max-w-full overflow-auto rounded bg-muted p-3 text-left text-xs">{this.state.error.message}</pre>}
          <div className="flex gap-2">
            <Button onClick={() => window.location.reload()}>Reload page</Button>
            <Button variant="outline" onClick={() => this.setState({ error: null })}>
              Try again
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
