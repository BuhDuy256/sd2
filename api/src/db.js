const mysql = require("mysql2/promise");

const baseConfig = {
  port:     parseInt(process.env.DB_PORT  || "3306", 10),
  user:     process.env.DB_USER           || "appuser",
  password: process.env.DB_PASSWORD       || "apppass",
  database: process.env.DB_NAME          || "productsdb",
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  enableKeepAlive:    true,
  keepAliveInitialDelay: 0,
};

const masterPool = mysql.createPool({
  ...baseConfig,
  host: process.env.MASTER_HOST || "mysql-master",
});

const slavePool = mysql.createPool({
  ...baseConfig,
  host: process.env.SLAVE_HOST || "mysql-slave",
});

async function waitForDb(pool, label, retries = 20, delayMs = 3000) {
  for (let i = 1; i <= retries; i++) {
    try {
      const conn = await pool.getConnection();
      await conn.ping();
      conn.release();
      console.log(`[db] Connected to ${label}`);
      return;
    } catch (err) {
      console.log(`[db] ${label} not ready (attempt ${i}/${retries}): ${err.message}`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error(`[db] Could not connect to ${label} after ${retries} attempts`);
}

async function initDb() {
  await waitForDb(masterPool, "MySQL Master");
  await waitForDb(slavePool,  "MySQL Slave");
}

module.exports = { masterPool, slavePool, initDb };
