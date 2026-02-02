const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
app.use(express.json());

// CORS (set FRONTEND_URL on Render later; "*" ok while testing)
app.use(cors({ origin: process.env.FRONTEND_URL || "*" }));

const ADMIN_KEY = process.env.ADMIN_KEY || "admin123";

// ===== Poll definitions =====
const polls = {
  businessName: {
    id: "businessName",
    title: "Select a name for our business",
    description: "Vote for the best business name",
    options: ["Local CHAAT", "The Local CHAAT HOUSE", "CHAAT MASTI"],
  },
  taglines: {
    id: "taglines",
    title: "Select a tagline",
    description: "Vote for the best tagline",
    options: [
      "PANIPURI and More",
      "Paniprui and Beyond",
      "Feels like Desi",
      "with local flavors",
      "pakka original",
      "crave for more",
    ],
  },
};

// ===== Postgres connection =====
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is missing. Set it in Render env vars.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Render Postgres typically requires SSL; this works reliably in hosted envs.
  ssl: { rejectUnauthorized: false },
});

// ===== DB init (create tables + seed vote rows) =====
async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS submissions (
      device_id TEXT PRIMARY KEY,
      business_name_index INT NOT NULL,
      tagline_index INT NOT NULL,              -- -1 means custom tagline
      custom_tagline TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS vote_counts (
      poll_id TEXT NOT NULL,
      option_index INT NOT NULL,
      count INT NOT NULL DEFAULT 0,
      PRIMARY KEY (poll_id, option_index)
    );
  `);

  // seed rows for each predefined option
  for (const poll of Object.values(polls)) {
    for (let i = 0; i < poll.options.length; i++) {
      await pool.query(
        `INSERT INTO vote_counts (poll_id, option_index, count)
         VALUES ($1, $2, 0)
         ON CONFLICT (poll_id, option_index) DO NOTHING`,
        [poll.id, i]
      );
    }
  }

  console.log("DB initialized");
}

initDb().catch((e) => {
  console.error("DB init error:", e);
});

// ===== Routes =====

// Health check
app.get("/", (req, res) => res.send("CHAAT Poll API running"));

// Get poll definition
app.get("/api/polls/:pollId", (req, res) => {
  const poll = polls[req.params.pollId];
  if (!poll) return res.status(404).json({ message: "Poll not found" });
  res.json(poll);
});

// Submit BOTH votes at once (one device only)
app.post("/api/submit", async (req, res) => {
  try {
    const { deviceId, businessNameIndex, taglineIndex, customTagline } = req.body;

    if (!deviceId || typeof deviceId !== "string" || deviceId.length < 6) {
      return res.status(400).json({ message: "Invalid deviceId" });
    }

    const bnPoll = polls.businessName;
    const tgPoll = polls.taglines;

    if (
      typeof businessNameIndex !== "number" ||
      businessNameIndex < 0 ||
      businessNameIndex >= bnPoll.options.length
    ) {
      return res.status(400).json({ message: "Invalid business name selection" });
    }

    // taglineIndex: 0..N-1 (predefined) OR -1 for custom
    if (
      typeof taglineIndex !== "number" ||
      taglineIndex < -1 ||
      taglineIndex >= tgPoll.options.length
    ) {
      return res.status(400).json({ message: "Invalid tagline selection" });
    }

    const cleanedCustom = (customTagline || "").trim();
    if (taglineIndex === -1 && !cleanedCustom) {
      return res.status(400).json({ message: "Please enter your custom tagline" });
    }

    // Insert submission (device_id is PK => blocks duplicates)
    await pool.query(
      `INSERT INTO submissions (device_id, business_name_index, tagline_index, custom_tagline)
       VALUES ($1, $2, $3, $4)`,
      [deviceId, businessNameIndex, taglineIndex, cleanedCustom || null]
    );

    // Update vote counts (business always predefined)
    await pool.query(
      `UPDATE vote_counts SET count = count + 1
       WHERE poll_id=$1 AND option_index=$2`,
      ["businessName", businessNameIndex]
    );

    // Tagline predefined only if taglineIndex >= 0
    if (taglineIndex >= 0) {
      await pool.query(
        `UPDATE vote_counts SET count = count + 1
         WHERE poll_id=$1 AND option_index=$2`,
        ["taglines", taglineIndex]
      );
    }

    res.json({ message: "Thanks for voting!" });
  } catch (e) {
    // Duplicate device vote => primary key violation
    if (e && e.code === "23505") {
      return res.status(409).json({ message: "You already voted on this device. Thank you!" });
    }
    console.error("Submit error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

// Admin results (protected)
app.get("/api/admin/results", async (req, res) => {
  try {
    if (req.query.key !== ADMIN_KEY) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // counts for businessName
    const bnRows = await pool.query(
      `SELECT option_index, count FROM vote_counts
       WHERE poll_id='businessName'
       ORDER BY option_index`
    );

    // counts for taglines (predefined only)
    const tgRows = await pool.query(
      `SELECT option_index, count FROM vote_counts
       WHERE poll_id='taglines'
       ORDER BY option_index`
    );

    const bnCounts = bnRows.rows.map((r) => r.count);
    const tgCounts = tgRows.rows.map((r) => r.count);

    // Pair summary from submissions table
    const pairRows = await pool.query(`
      SELECT business_name_index, tagline_index, custom_tagline, COUNT(*)::int AS count
      FROM submissions
      GROUP BY business_name_index, tagline_index, custom_tagline
      ORDER BY count DESC;
    `);

    const pairSummary = pairRows.rows.map((r) => {
      const name = polls.businessName.options[r.business_name_index];
      const tagline =
        r.tagline_index >= 0
          ? polls.taglines.options[r.tagline_index]
          : `Custom: ${r.custom_tagline}`;
      return { label: `${name} + ${tagline}`, count: r.count };
    });

    const total = await pool.query(`SELECT COUNT(*)::int AS c FROM submissions`);

    res.json({
      businessName: { ...polls.businessName, counts: bnCounts },
      taglines: { ...polls.taglines, counts: tgCounts },
      pairSummary,
      totalSubmissions: total.rows[0].c,
    });
  } catch (e) {
    console.error("Admin results error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
