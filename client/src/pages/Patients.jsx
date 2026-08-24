import { useState, useEffect } from 'react';
import { getPatients, createPatient, deletePatient } from '../api';

export default function Patients() {
  
  const [patients, setPatients] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [search, setSearch]     = useState('');
  const [showForm, setShowForm] = useState(false);

  const emptyForm = {
    name: '', dob: '', gender: 'M',
    phone: '', address: '', blood_group: 'A+'
  };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    loadPatients();
  }, [search]);

  async function loadPatients() {
    try {
      setLoading(true);
      setError('');
      const res = await getPatients(search);
      setPatients(res.data);
    } catch (err) {
      setError('Could not load patients. Is the server running?');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    if (!form.name.trim()) {
      setError('Name is required');
      return;
    }
    try {
      await createPatient(form);
      setForm(emptyForm);
      setShowForm(false);
      loadPatients();          
    } catch (err) {
      setError(err.response?.data?.error || 'Could not add patient');
    }
  }

  async function handleDelete(id, name) {
    if (!window.confirm(`Delete ${name}?`)) return;
    try {
      await deletePatient(id);
      loadPatients();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not delete patient');
    }
  }

  return (
    <div>
      <div className="page-head">
        <h2>Patients</h2>
        <button className="btn" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ New patient'}
        </button>
      </div>

      <input
        className="search"
        placeholder="Search by name or phone..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {error && <div className="error">{error}</div>}

      {/* ---------- ADD FORM ---------- */}
      {showForm && (
        <div className="card form-grid">
          <label>
            Name
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>

          <label>
            Date of birth
            <input
              type="date"
              value={form.dob}
              onChange={(e) => setForm({ ...form, dob: e.target.value })}
            />
          </label>

          <label>
            Gender
            <select
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value })}
            >
              <option value="M">Male</option>
              <option value="F">Female</option>
              <option value="O">Other</option>
            </select>
          </label>

          <label>
            Blood group
            <select
              value={form.blood_group}
              onChange={(e) => setForm({ ...form, blood_group: e.target.value })}
            >
              {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(bg => (
                <option key={bg} value={bg}>{bg}</option>
              ))}
            </select>
          </label>

          <label>
            Phone
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </label>

          <label>
            Address
            <input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </label>

          <button className="btn primary" onClick={handleAdd}>
            Save patient
          </button>
        </div>
      )}

      {/* ---------- LIST ---------- */}
      {loading ? (
        <p className="muted">Loading...</p>
      ) : patients.length === 0 ? (
        <p className="muted">No patients found.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Gender</th>
              <th>Blood</th>
              <th>Phone</th>
              <th>Address</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {patients.map((p) => (
              <tr key={p.patient_id}>
                <td>{p.patient_id}</td>
                <td><strong>{p.name}</strong></td>
                <td>{p.gender}</td>
                <td>{p.blood_group}</td>
                <td>{p.phone}</td>
                <td>{p.address}</td>
                <td>
                  <button
                    className="btn danger sm"
                    onClick={() => handleDelete(p.patient_id, p.name)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
