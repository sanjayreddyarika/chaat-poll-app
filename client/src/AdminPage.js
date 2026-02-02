import { useState } from "react";

// Render: set REACT_APP_API_URL=https://your-backend.onrender.com
// Local: leave it empty, proxy will handle relative /api calls
const API = process.env.REACT_APP_API_URL || "";

export default function AdminPage() {
  const [key, setKey] = useState("");
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  const load = async () => {
    setErr("");
    setData(null);

    const res = await fetch(`${API}/api/admin/results?key=${encodeURIComponent(key)}`);
    const json = await res.json();

    if (!res.ok) {
      setErr(json.message || "Error");
      return;
    }
    setData(json);
  };

  return (
    <div>
      <h3>Admin Results</h3>

      <input
        type="password"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        placeholder="Enter Admin Key"
        style={{
          width: "100%",
          padding: 10,
          borderRadius: 8,
          border: "1px solid #ccc",
          marginBottom: 10,
        }}
      />

      <button
        onClick={load}
        style={{
          width: "100%",
          padding: 12,
          borderRadius: 8,
          background: "#0f766e",
          color: "#fff",
          border: "none",
          cursor: "pointer",
        }}
      >
        View Results
      </button>

      {err && <p style={{ color: "red" }}>{err}</p>}

      {data && (
        <div style={{ marginTop: 16 }}>
          <p>
            <b>Total submissions:</b> {data.totalSubmissions}
          </p>

          <h4>{data.businessName.title}</h4>
          <ul>
            {data.businessName.options.map((opt, i) => (
              <li key={opt}>
                {opt} — <b>{data.businessName.counts[i]}</b>
              </li>
            ))}
          </ul>

          <h4>{data.taglines.title} (Predefined)</h4>
          <ul>
            {data.taglines.options.map((opt, i) => (
              <li key={opt}>
                {opt} — <b>{data.taglines.counts[i]}</b>
              </li>
            ))}
          </ul>

          <h4>Selected Pairs (Name + Tagline)</h4>
          {data.pairSummary.length === 0 ? (
            <p>No votes yet.</p>
          ) : (
            <ul>
              {data.pairSummary.map((p, idx) => (
                <li key={idx}>
                  {p.label} — <b>{p.count}</b>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
