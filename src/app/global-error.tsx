"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <div
          style={{
            display: "flex",
            minHeight: "100vh",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <div style={{ maxWidth: "400px", textAlign: "center" }}>
            <h2 style={{ fontSize: "18px", fontWeight: 600, color: "#dc2626" }}>
              Critical Error
            </h2>
            <p style={{ marginTop: "8px", fontSize: "14px", color: "#6b7280" }}>
              {error.message || "The application encountered a critical error."}
            </p>
            <button
              onClick={reset}
              style={{
                marginTop: "16px",
                padding: "8px 16px",
                fontSize: "14px",
                fontWeight: 500,
                color: "#fff",
                backgroundColor: "#2563eb",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
              }}
            >
              Reload
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
