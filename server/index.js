// ============================================================
//  index.js — Express server entry point
//  Cholate: npm run dev   (server folder theke)
// ============================================================

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// ---------- Middleware ----------
app.use(cors());              // React (port 5173) theke request allow kore
app.use(express.json());      // JSON body parse kore

// Prottekta request terminal e log kore — debug korte kaje lage
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// ---------- Routes ----------
app.use('/api/patients',     require('./routes/patients'));
app.use('/api/departments',  require('./routes/departments'));
app.use('/api/doctors',      require('./routes/doctors'));
app.use('/api/appointments', require('./routes/appointments'));
app.use('/api/billing',      require('./routes/billing'));
app.use('/api/admissions',   require('./routes/admissions'));
app.use('/api/prescriptions', require('./routes/prescriptions'));
app.use('/api/labtests', require('./routes/labtests'));

// Health check — browser e localhost:5000 e gele eta dekhabe
app.get('/', (req, res) => {
  res.json({ message: 'HealthFlow API is running 🏥' });
});

// ---------- 404 ----------
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ---------- Error handler ----------
// Kono route e error hole ekhane ashe. Ekhane thakle prottek route e
// try-catch er bhitor manually response pathate hoy na.
app.use((err, req, res, next) => {
  console.error('❌', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
