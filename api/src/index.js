const express = require("express");
const { initDb } = require("./db");
const productsRouter = require("./routes/products");

const app  = express();
const PORT = parseInt(process.env.PORT || "3000", 10);
const NODE_ID = process.env.NODE_ID || "api-node-unknown";

app.use(express.json());

// ── Health check (used by Nginx and Docker healthcheck) ───────────
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", node: NODE_ID });
});

// ── API routes ────────────────────────────────────────────────────
app.use("/products", productsRouter);

// ── 404 catch-all ─────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// ── Startup ───────────────────────────────────────────────────────
(async () => {
  try {
    await initDb();
    app.listen(PORT, () => {
      console.log(`[${NODE_ID}] Listening on port ${PORT}`);
    });
  } catch (err) {
    console.error("Startup failed:", err.message);
    process.exit(1);
  }
})();
