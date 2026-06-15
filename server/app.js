require('dotenv').config();
const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const path        = require('path');

const app = express();

const defaultClient = (process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/$/, '');
const devAlternate  = 'http://localhost:3001';
const allowedOrigins = [defaultClient, devAlternate];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Vary', 'Origin');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Security
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (e.g., curl, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET','HEAD','PUT','PATCH','POST','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','Accept','Origin','X-Requested-With'],
}));
app.options('*', cors({
  origin: allowedOrigins,
  credentials: true,
}));

// Rate limiting (disabled in development)
// app.use('/api/applicants', rateLimit({ windowMs: 15 * 60 * 1000, max: 30, message: 'Too many requests' }));
// app.use('/api/payments/submit', rateLimit({ windowMs: 60 * 60 * 1000, max: 10 }));
// app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 20 }));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/applicants', require('./routes/applicants'));
app.use('/api/payments',   require('./routes/payments'));

// Health check
app.get('/api/health', (req, res) => res.json({
  status: 'ok', time: new Date().toISOString(),
  env: process.env.NODE_ENV,
  db:  process.env.DATABASE_URL ? 'remote' : 'local',
  jwt: process.env.JWT_SECRET   ? 'set'    : 'MISSING',
}));

// Error handler
app.use((err, req, res, _next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: `File too large. Maximum size: ${process.env.MAX_FILE_SIZE_MB || 5}MB` });
  }
  if (err.message && err.message.includes('Only JPG')) {
    return res.status(400).json({ error: err.message });
  }
  console.error(`[${req.method}] ${req.path} — Unhandled error:`, err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;