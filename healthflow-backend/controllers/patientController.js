// Patient table er jonno CRUD operations
// Ei pattern follow kore tumi baki shob entity (Doctor, Appointment, Bill etc)
// er jonno controller banate parbe - just table name ar columns change korte hobe

const pool = require('../config/db');

// GET /api/patients -> shob patient dekhabe
const getAllPatients = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM Patient ORDER BY Patient_ID');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/patients/:id -> ekta specific patient dekhabe
const getPatientById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM Patient WHERE Patient_ID = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Patient paoa jayni' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/patients -> notun patient add korbe
const createPatient = async (req, res) => {
  try {
    const { name, address, dob, gender, blood_group, phone } = req.body;

    const result = await pool.query(
      `INSERT INTO Patient (Name, Address, DOB, Gender, Blood_Group, Phone)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, address, dob, gender, blood_group, phone]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// PUT /api/patients/:id -> patient info update korbe
const updatePatient = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, address, dob, gender, blood_group, phone } = req.body;

    const result = await pool.query(
      `UPDATE Patient SET Name=$1, Address=$2, DOB=$3, Gender=$4, Blood_Group=$5, Phone=$6
       WHERE Patient_ID=$7 RETURNING *`,
      [name, address, dob, gender, blood_group, phone, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Patient paoa jayni' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/patients/:id -> patient delete korbe
const deletePatient = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM Patient WHERE Patient_ID = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Patient paoa jayni' });
    }
    res.json({ message: 'Patient delete kora hoyeche' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getAllPatients,
  getPatientById,
  createPatient,
  updatePatient,
  deletePatient,
};
