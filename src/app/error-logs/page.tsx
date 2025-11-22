"use client";

import { useEffect, useState } from "react";

interface ErrorLog {
  id: string;
  error_message: string;
  error_stack: string | null;
  component_name: string | null;
  user_agent: string | null;
  url: string | null;
  created_at: string;
}

export default function ErrorLogsPage() {
  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const res = await fetch("/api/error-logs");
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error("Failed to fetch logs:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a1628] p-4 flex items-center justify-center">
        <div className="text-[#38bdf8]">Loading logs...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a1628] p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-[#38bdf8]">Error Logs</h1>
          <button
            onClick={fetchLogs}
            className="px-4 py-2 bg-[#38bdf8] text-white rounded-lg text-sm"
          >
            Refresh
          </button>
        </div>

        {logs.length === 0 ? (
          <div className="neo-card p-8 text-center">
            <div className="text-[hsl(var(--text-muted))]">No errors logged yet</div>
          </div>
        ) : (
          <div className="space-y-4">
            {logs.map((log) => (
              <div key={log.id} className="neo-card p-4 space-y-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="text-red-400 font-semibold mb-1">
                      {log.error_message}
                    </div>
                    {log.component_name && (
                      <div className="text-xs text-[#38bdf8] mb-2">
                        Component: {log.component_name}
                      </div>
                    )}
                    <div className="text-xs text-[hsl(var(--text-muted))]">
                      {new Date(log.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>

                {log.error_stack && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-[#38bdf8] hover:underline">
                      Stack trace
                    </summary>
                    <pre className="mt-2 text-xs bg-black/30 p-3 rounded overflow-x-auto text-gray-300">
                      {log.error_stack}
                    </pre>
                  </details>
                )}

                {log.url && (
                  <div className="text-xs text-[hsl(var(--text-muted))] truncate">
                    URL: {log.url}
                  </div>
                )}

                {log.user_agent && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-xs text-[hsl(var(--text-muted))] hover:underline">
                      User agent
                    </summary>
                    <div className="mt-1 text-xs text-gray-400">{log.user_agent}</div>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
