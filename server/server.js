const express = require("express");
const cors = require("cors");

const app = express();
app.use(express.json());

// CORS: allow your frontend on Render (set FRONTEND_URL later); "*" is fine for now
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "*",
  })
);

const ADMIN_KEY = process.env.ADMIN_KEY || "admin123";

// Poll definitions
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

// In-memory counts (NO DB)
const votes = {
  businessName: Array(polls.businessName.options.length).fill(0),
  taglines: Array(polls.taglines.options.length).fill(0),
};

// One submission per device
// deviceId -> { businessNameIndex, taglineIndex, customTagline, createdAt }
const submissionsByDevice = new Map();

// Pair summary counts
// label "Name + Tagline" -> count
const pairCounts = new Map();

// Health check (useful on Render)
app.get("/", (req, res) => {
  res.send("CHAAT Poll API is running");
});

// Get poll definition
app.get("/api/polls/:pollId", (req, res) => {
  const poll = polls[req.params.pollId];
  if (!poll) return res.status(404).json({ message: "Poll not found" });
  res.json(poll);
});

// Submit BOTH votes at once (one device only)
app.post("/api/submit", (req, res) => {
  const { deviceId, businessNameIndex, taglineIndex, customTagline } = req.body;

  if (!deviceId || typeof deviceId !== "string" || deviceId.length < 6) {
    return res.status(400).json({ message: "Invalid deviceId" });
  }

  // block duplicate device vote
  if (submissionsByDevice.has(deviceId)) {
    return res
      .status(409)
      .json({ message: "You already voted on this device. Thank you!" });
  }

  const bnPoll = polls.businessName;
  const tgPoll = polls.taglines;

  // validate business name
  if (
    typeof businessNameIndex !== "number" ||
    businessNameIndex < 0 ||
    businessNameIndex >= bnPoll.options.length
  ) {
    return res.status(400).json({ message: "Invalid business name selection" });
  }

  // taglineIndex: 0..N-1 or -1 for custom
  if (
    typeof taglineIndex !== "number" ||
    taglineIndex < -1 ||
    taglineIndex >= tgPoll.options.length
  ) {
    return res.status(400).json({ message: "Invalid tagline selection" });
  }

  if (taglineIndex === -1 && !customTagline?.trim()) {
    return res.status(400).json({ message: "Please enter your custom tagline" });
  }

  // update counts
  votes.businessName[businessNameIndex] += 1;
  if (taglineIndex >= 0) votes.taglines[taglineIndex] += 1;

  // save submission
  submissionsByDevice.set(deviceId, {
    businessNameIndex,
    taglineIndex,
    customTagline: customTagline?.trim() || null,
    createdAt: new Date().toISOString(),
  });

  const chosenName = bnPoll.options[businessNameIndex];
  const chosenTagline =
    taglineIndex >= 0
      ? tgPoll.options[taglineIndex]
      : `Custom: ${customTagline.trim()}`;

  const pairLabel = `${chosenName} + ${chosenTagline}`;
  pairCounts.set(pairLabel, (pairCounts.get(pairLabel) || 0) + 1);

  res.json({ message: "Thanks for voting!" });
});

// Admin results (protected)
app.get("/api/admin/results", (req, res) => {
  if (req.query.key !== ADMIN_KEY) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const pairs = [];
  for (const [label, count] of pairCounts.entries()) {
    pairs.push({ label, count });
  }
  pairs.sort((a, b) => b.count - a.count);

  res.json({
    businessName: { ...polls.businessName, counts: votes.businessName },
    taglines: { ...polls.taglines, counts: votes.taglines },
    pairSummary: pairs,
    totalSubmissions: submissionsByDevice.size,
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
