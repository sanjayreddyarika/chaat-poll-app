import { useEffect, useMemo, useState } from "react";

const DEVICE_KEY = "chaat_poll_device_id_v1";
const VOTED_KEY = "chaat_poll_voted_v1";

// Render: set REACT_APP_API_URL=https://your-backend.onrender.com
// Local: leave it empty, proxy will handle relative /api calls
const API = process.env.REACT_APP_API_URL || "";

function getOrCreateDeviceId() {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = "dev_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

export default function CombinedPolls() {
  const deviceId = useMemo(() => getOrCreateDeviceId(), []);
  const [businessPoll, setBusinessPoll] = useState(null);
  const [taglinePoll, setTaglinePoll] = useState(null);

  const [businessNameIndex, setBusinessNameIndex] = useState(null);
  const [taglineIndex, setTaglineIndex] = useState(null);
  const [customTagline, setCustomTagline] = useState("");

  const [msg, setMsg] = useState("");
  const [hasVoted, setHasVoted] = useState(localStorage.getItem(VOTED_KEY) === "true");

  useEffect(() => {
    fetch(`${API}/api/polls/businessName`).then((r) => r.json()).then(setBusinessPoll);
    fetch(`${API}/api/polls/taglines`).then((r) => r.json()).then(setTaglinePoll);
  }, []);

  async function submitVote() {
    setMsg("");

    if (hasVoted) {
      setMsg("You already voted on this device. Thank you!");
      return;
    }

    if (businessNameIndex === null || taglineIndex === null) {
      setMsg("Please select 1 business name and 1 tagline.");
      return;
    }

    if (taglineIndex === -1 && !customTagline.trim()) {
      setMsg("Please enter your custom tagline.");
      return;
    }

    const res = await fetch(`${API}/api/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId,
        businessNameIndex,
        taglineIndex,
        customTagline,
      }),
    });

    const data = await res.json();

    if (res.ok) {
      localStorage.setItem(VOTED_KEY, "true");
      setHasVoted(true);
    }

    setMsg(data.message || "Done");
  }

  if (!businessPoll || !taglinePoll) return <div>Loading…</div>;

  const cardStyle = {
    marginTop: 16,
    padding: 16,
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    background: "#fff",
  };

  const rowStyle = {
    display: "flex",
    gap: 10,
    alignItems: "center",
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid #f1f5f9",
    marginTop: 8,
  };

  return (
    <div>
      <div style={{ color: "#475569" }}>Vote once per device 👇</div>

      <div style={cardStyle}>
        <h3 style={{ margin: 0, color: "#0f766e" }}>{businessPoll.title}</h3>
        <p style={{ color: "#334155", marginTop: 8 }}>{businessPoll.description}</p>

        {businessPoll.options.map((opt, i) => (
          <label key={opt} style={rowStyle}>
            <input
              type="radio"
              name="businessName"
              disabled={hasVoted}
              checked={businessNameIndex === i}
              onChange={() => setBusinessNameIndex(i)}
            />
            <span>{opt}</span>
          </label>
        ))}
      </div>

      <div style={cardStyle}>
        <h3 style={{ margin: 0, color: "#0f766e" }}>{taglinePoll.title}</h3>
        <p style={{ color: "#334155", marginTop: 8 }}>{taglinePoll.description}</p>

        {taglinePoll.options.map((opt, i) => (
          <label key={opt} style={rowStyle}>
            <input
              type="radio"
              name="tagline"
              disabled={hasVoted}
              checked={taglineIndex === i}
              onChange={() => setTaglineIndex(i)}
            />
            <span>{opt}</span>
          </label>
        ))}

        <label style={rowStyle}>
          <input
            type="radio"
            name="tagline"
            disabled={hasVoted}
            checked={taglineIndex === -1}
            onChange={() => setTaglineIndex(-1)}
          />
          <span>Any other (please specify)</span>
        </label>

        {taglineIndex === -1 && (
          <input
            type="text"
            disabled={hasVoted}
            value={customTagline}
            onChange={(e) => setCustomTagline(e.target.value)}
            placeholder="Enter your tagline"
            style={{
              width: "100%",
              padding: 10,
              marginTop: 10,
              borderRadius: 10,
              border: "1px solid #d1d5db",
            }}
          />
        )}
      </div>

      <button
        onClick={submitVote}
        disabled={hasVoted}
        style={{
          width: "100%",
          padding: 12,
          marginTop: 16,
          borderRadius: 10,
          border: "none",
          background: hasVoted ? "#94a3b8" : "#0f766e",
          color: "white",
          cursor: hasVoted ? "not-allowed" : "pointer",
          fontSize: 15,
        }}
      >
        Submit Vote
      </button>

      {msg && <div style={{ marginTop: 10, fontWeight: 600 }}>{msg}</div>}
    </div>
  );
}
