"use client";

import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class WatchErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("Watch view error:", error, errorInfo);

    // Log to database
    fetch("/api/error-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error_message: `[WatchErrorBoundary] ${error.message}`,
        error_stack: error.stack || "",
        component_name: "WatchErrorBoundary",
        url: typeof window !== "undefined" ? window.location.href : "",
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      }),
    }).catch((logErr) => console.error("Failed to log error:", logErr));
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{
            background:
              "linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)",
          }}
        >
          <div className="text-center p-8">
            <div
              className="mx-auto mb-6"
              style={{
                width: "min(90vw, 90vh)",
                height: "min(90vw, 90vh)",
                maxWidth: "400px",
                maxHeight: "400px",
                borderRadius: "50%",
                background:
                  "linear-gradient(135deg, #1e3a8a 0%, #3b0764 50%, #831843 100%)",
                boxShadow:
                  "inset 0 0 60px rgba(0,0,0,0.5), 0 0 30px rgba(0,0,0,0.3)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "2rem",
              }}
            >
              <div className="text-red-400 text-6xl mb-4">⚠️</div>
              <div className="text-white text-lg font-semibold mb-2">
                Watch Error
              </div>
              <div className="text-cyan-200 text-xs mb-4 max-w-[200px] line-clamp-3">
                {this.state.error?.message || "Something went wrong"}
              </div>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-full text-sm font-medium"
                style={{
                  background:
                    "linear-gradient(135deg, #06b6d4 0%, #8b5cf6 100%)",
                  color: "white",
                }}
              >
                Reload
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
