const { Router } = require("express");
const { masterPool, slavePool } = require("../db");

const router = Router();
const NODE_ID = process.env.NODE_ID || "api-node-unknown";

// ── POST /products ─────────────────────────────────────────────────
// Writes to the MASTER database
router.post("/", async (req, res) => {
  const { name, price } = req.body;

  if (!name || price === undefined || price === null) {
    return res.status(400).json({ error: "name and price are required" });
  }

  const parsedPrice = parseFloat(price);
  if (isNaN(parsedPrice) || parsedPrice < 0) {
    return res.status(400).json({ error: "price must be a non-negative number" });
  }

  try {
    const [result] = await masterPool.execute(
      "INSERT INTO products (name, price) VALUES (?, ?)",
      [name.trim(), parsedPrice]
    );

    return res.status(201).json({
      message:      "Product created successfully",
      processed_by: NODE_ID,
      written_to:   "mysql-master",
      product: {
        id:    result.insertId,
        name:  name.trim(),
        price: parsedPrice,
      },
    });
  } catch (err) {
    console.error("[POST /products] Error:", err.message);
    return res.status(500).json({ error: "Database write failed" });
  }
});

// ── GET /products ──────────────────────────────────────────────────
// Reads from the SLAVE database
router.get("/", async (req, res) => {
  try {
    const [rows] = await slavePool.execute(
      "SELECT id, name, price, created_at FROM products ORDER BY id DESC"
    );

    return res.status(200).json({
      processed_by: NODE_ID,
      read_from:    "mysql-slave",
      count:        rows.length,
      products:     rows,
    });
  } catch (err) {
    console.error("[GET /products] Error:", err.message);
    return res.status(500).json({ error: "Database read failed" });
  }
});

module.exports = router;
