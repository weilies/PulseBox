"use client";

import React from "react";
import { logger } from "@/lib/logger";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 3000;

export class ErrorBoundary extends React.Component<Props, State> {
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger?.error("component_error", error.message, {
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });

    // Auto-retry if under max retries
    if (this.state.retryCount < MAX_RETRIES) {
      this.retryTimer = setTimeout(() => {
        this.setState((prev) => ({
          hasError: false,
          error: null,
          retryCount: prev.retryCount + 1,
        }));
      }, RETRY_DELAY_MS);
    }
  }

  componentWillUnmount() {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
    }
  }

  handleRetry = () => {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
    }
    this.setState({ hasError: false, error: null, retryCount: 0 });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isAutoRetrying = this.state.retryCount < MAX_RETRIES;

      return (
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="mx-auto max-w-md text-center">
            <h2 className="text-lg font-semibold text-destructive">
              Something went wrong
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {this.state.error?.message || "An unexpected error occurred."}
            </p>
            {isAutoRetrying && (
              <p className="mt-1 text-xs text-muted-foreground">
                Auto-retrying... (attempt {this.state.retryCount + 1}/
                {MAX_RETRIES})
              </p>
            )}
            <button
              onClick={this.handleRetry}
              className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
