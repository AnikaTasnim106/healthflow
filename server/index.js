// ============================================================
//  index.js — Express server entry point (FINAL, sob route shoho)
//  Cholate: npm run dev   (server folder theke)
// ============================================================

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// ---------- Middleware ----------
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// ---------- Routes ----------
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/patients',      require('./routes/patients'));
app.use('/api/departments',   require('./routes/departments'));
app.use('/api/doctors',       require('./routes/doctors'));
app.use('/api/appointments',  require('./routes/appointments'));
app.use('/api/billing',       require('./routes/billing'));
app.use('/api/admissions',    require('./routes/admissions'));
app.use('/api/prescriptions', require('./routes/prescriptions'));
app.use('/api/labtests',      require('./routes/labtests'));
app.use('/api/medicines',     require('./routes/medicines'));

app.get('/', (req, res) => {
  res.json({ message: 'HealthFlow API is running 🏥' });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error('❌', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});