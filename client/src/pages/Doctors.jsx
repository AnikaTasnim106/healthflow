
import { useState, useEffect } from 'react';
import { getDoctors, createDoctor, deleteDoctor, getDepartments } from '../api';

export default function Doctors() {
  const [doctors, setDoctors] = useState([]);
  const [depts, setDepts]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [showForm, setShowForm] = useState(false);

  const emptyForm = {
    name: '', specialization: '', phone: '',
    consult_fee: '', dept_id: ''
  };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    loadDoctors();
    loadDepartments();
  }, []);

  async function loadDoctors() {
    try {
      setLoading(true);
      setError('');
      const res = await getDoctors();
      setDoctors(res.data);
    } catch (err) {
      setError('Could not load doctors. Is the server running?');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadDepartments() {
    try {
      const res = await getDepartments();
      setDepts(res.data);
    } catch (err) {
      // Endpoint may not exist yet — the list still works without it.
      console.warn('Departments endpoint not available yet');
    }
  }

  async function handleAdd() {
    if (!form.name.trim()) {
      setError('Name is required');
      return;
    }
    if (!form.dept_id) {
      setError('Please select a department');
      return;
    }
    try {
      await createDoctor({
        ...form,
        consult_fee: Number(form.consult_fee) || 0,
        dept_id: Number(form.dept_id),
      });
      setForm(emptyForm);
      setShowForm(false);
      loadDoctors();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not add doctor');
    }
  }

  async function handleDelete(id, name) {
    if (!window.confirm(`Delete ${name}?`)) return;
    try {
      await deleteDoctor(id);
      loadDoctors();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not delete doctor');
    }
  }
  return (
    <div>
      <div className="page-head">
        <h2>Doctors</h2>
        <button
          className="btn"
          onClick={() => setShowForm(!showForm)}
          disabled={depts.length === 0}
          title={depts.length === 0 ? 'Departments endpoint not available yet' : ''}
        >
          {showForm ? 'Cancel' : '+ New doctor'}
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {/* ---------- ADD FORM ---------- */}
      {showForm && (
        <div className="card form-grid">
          <label>
            Name
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Dr. Full Name"
            />
          </label>

          <label>
            Specialization
            <input
              value={form.specialization}
              onChange={(e) => setForm({ ...form, specialization: e.target.value })}
              placeholder="e.g. Interventional Cardiology"
            />
          </label>

          <label>
            Department
            <select
              value={form.dept_id}
              onChange={(e) => setForm({ ...form, dept_id: e.target.value })}
            >
              <option value="">Select department</option>
              {depts.map((d) => (
                <option key={d.dept_id} value={d.dept_id}>
                  {d.dept_name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Phone
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="01711000000"
            />
          </label>

          <label>
            Consultation fee
            <input
              type="number"
              min="0"
              value={form.consult_fee}
              onChange={(e) => setForm({ ...form, consult_fee: e.target.value })}
              placeholder="1000"
            />
          </label>

          <button className="btn primary" onClick={handleAdd}>
            Save doctor
          </button>
        </div>
      )}

      {/* ---------- LIST ---------- */}
      {loading ? (
        <p className="muted">Loading...</p>
      ) : doctors.length === 0 ? (
        <p className="muted">No doctors found.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Specialization</th>
              <th>Department</th>
              <th>Phone</th>
              <th>Fee</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {doctors.map((d) => (
              <tr key={d.doctor_id}>
                <td>{d.doctor_id}</td>
                <td><strong>{d.name}</strong></td>
                <td>{d.specialization}</td>
                <td>{d.dept_name}</td>
                <td>{d.phone}</td>
                <td>৳{Number(d.consult_fee).toLocaleString()}</td>
                <td>
                  <button
                    className="btn danger sm"
                    onClick={() => handleDelete(d.doctor_id, d.name)}
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
