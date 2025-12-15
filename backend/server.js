
const express = require('express');
const morgan = require('morgan');
const { Pool } = require('pg');
const client = require('prom-client');

const app = express();
app.use(express.json());
app.use(morgan('combined'));

// Prometheus metrics
const register = new client.Registry();
client.collectDefaultMetrics({ register });
const httpRequestCounter = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status']
});
register.registerMetric(httpRequestCounter);

// Database pool
const dbConfig = {
  host: process.env.DB_HOST || 'postgres',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'appdb',
  user: process.env.DB_USER || 'appuser',
  password: process.env.DB_PASSWORD || 'apppassword',
  max: 10,
  idleTimeoutMillis: 30000
};
const pool = new Pool(dbConfig);

async function readyCheck() {
  const client = await pool.connect();
  await client.query('SELECT 1');
  client.release();
}

// Metrics middleware
app.use((req, res, next) => {
  res.on('finish', () => {
    httpRequestCounter.inc({ method: req.method, route: req.path, status: res.statusCode });
  });
  next();
});

app.get('/healthz', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/readyz', async (req, res) => {
  try {
    await readyCheck();
    res.json({ ready: true });
  } catch (e) {
    res.status(500).json({ ready: false, error: e.message });
  }
});

// CRUD
app.get('/api/items', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, created_at FROM items ORDER BY id');
    res.json(result.rows);
  } catch (e) {
    console.error('DB error:', e);
    res.status(500).json({ error: 'Database query failed' });
  }
});

app.post('/api/items', async (req, res) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    const result = await pool.query('INSERT INTO items(name) VALUES($1) RETURNING id, name, created_at', [name]);
    res.status(201).json(result.rows[0]);
  } catch (e) {
    console.error('DB error:', e);
    res.status(500).json({ error: 'Insert failed' });
  }
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

constconst port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Backend listening on port ${port}`);

