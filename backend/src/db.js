const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle client", err);
  process.exit(-1);
});

/**
 * Execute a query against the database.
 * @param {string} text - SQL query text
 * @param {any[]} params - Query parameters
 * @returns {Promise<import("pg").QueryResult>}
 */
const query = (text, params) => pool.query(text, params);

/**
 * Get a client from the pool for transactions.
 * @returns {Promise<import("pg").PoolClient>}
 */
const getClient = () => pool.connect();

module.exports = { pool, query, getClient };
