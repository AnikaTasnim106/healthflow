// ============================================================
//  Doctors.jsx
//  Same pattern as Patients.jsx.
//  The department dropdown needs GET /api/departments.
// ============================================================

import { useState, useEffect } from 'react';
import { getDoctors, createDoctor, deleteDoctor, getDepartments } from '../api';

const taka = (n) => `\u09F3${Number(n || 0).toLocaleString('en-IN')}`;

export default function Doctors() {
  const [doctors, setDoctors] = useState([]);
  const [depts, setDepts]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [showForm, setShowForm] = useState(false);

  const emptyForm = {
    name: '', specialization: '', phone: '', consult_fee: '', dept_id: '',
    email: '', password: '',
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
      setError('Could not reach the server. Check that the backend is running on port 5000.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // dept_id is a foreign key, so the options must come from the
  // database. Hardcoding them would break on any FK mismatch.
  async function loadDepartments() {
    try {
      const res = await getDepartments();
      setDepts(res.data);
    } catch (err) {
      console.warn('Departments endpoint not available yet');
    }
  }

  async function handleAdd() {
    if (!form.name.trim())  { setError('Enter a name to add the doctor.'); return; }
    if (!form.dept_id)      { setError('Choose a department.'); return; }
    try {
      // email dile password o lagbe — backend eo check ache
      if ((form.email && !form.password) || (!form.email && form.password)) {
        setError('To create a login, fill in both email and password.');
        return;
      }

      await createDoctor({
        ...form,
        consult_fee: Number(form.consult_fee) || 0,
        dept_id: Number(form.dept_id),
      });
      setForm(emptyForm);
      setShowForm(false);
      loadDoctors();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not add this doctor.');
    }
  }

  async function handleDelete(id, name) {
    if (!window.confirm(`Remove ${name} from the directory?`)) return;
    try {
      await deleteDoctor(id);
      loadDoctors();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not remove this doctor.');
    }
  }

  return (
    <div>
      <div className="page-top">
        <h2>Doctors</h2>
        <span className="count">
          {loading ? '\u2014' : `${doctors.length} on staff`}
        </span>
      </div>

      <div className="toolbar">
        <span style={{ flex: 1 }} />
        <button
          className="btn primary"
          onClick={() => setShowForm(!showForm)}
          disabled={depts.length === 0}
          title={depts.length === 0 ? 'Departments endpoint not available yet' : ''}
        >
          {showForm ? 'Close' : 'Add doctor'}
        </button>
      </div>

      {error && (
        <div className="alert">
          <span>{error}</span>
          <button className="x" onClick={() => setError('')}>Dismiss</button>
        </div>
      )}

      {showForm && (
        <div className="form">
          <div className="form-title">New doctor</div>
          <div className="fields">
            <label>
              Full name
              <input value={form.name} placeholder="Dr. Full Name"
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label>
              Specialization
              <input value={form.specialization} placeholder="Interventional Cardiology"
                onChange={(e) => setForm({ ...form, specialization: e.target.value })} />
            </label>
            <label>
              Department
              <select value={form.dept_id}
                onChange={(e) => setForm({ ...form, dept_id: e.target.value })}>
                <option value="">Choose one</option>
                {depts.map((d) => (
                  <option key={d.dept_id} value={d.dept_id}>{d.dept_name}</option>
                ))}
              </select>
            </label>
            <label>
              Phone
              <input value={form.phone} placeholder="01711000000"
                onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </label>
            <label>
              Consultation fee
              <input type="number" min="0" value={form.consult_fee} placeholder="1000"
                onChange={(e) => setForm({ ...form, consult_fee: e.target.value })} />
            </label>
          </div>

          {/* Login account — optional. Dile backend ek transaction e
              doctor row ar app_user row duitai banay, role 'doctor'
              hardcode kore. */}
          <div className="form-title" style={{ marginTop: 20 }}>
            Login account &mdash; optional
          </div>
          <div className="fields">
            <label>
              Email
              <input type="email" value={form.email} placeholder="doctor@healthflow.com"
                onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </label>
            <label>
              Password
              <input type="password" value={form.password} placeholder="At least 8 characters"
                onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </label>
          </div>
          <p className="gate-note">
            Leave both blank to add the doctor without a login. You can add
            one later from the database.
          </p>
          <div className="form-actions">
            <button className="btn" onClick={() => { setShowForm(false); setForm(emptyForm); }}>
              Cancel
            </button>
            <button className="btn primary" onClick={handleAdd}>Save doctor</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading">Loading directory</div>
      ) : doctors.length === 0 ? (
        <div className="empty">
          <p>No doctors on staff.</p>
          <p className="hint">Add the first doctor to build the directory.</p>
        </div>
      ) : (
        <div className="records">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Doctor</th>
                <th>Department</th>
                <th>Phone</th>
                <th className="right">Fee</th>
                <th className="right">Action</th>
              </tr>
            </thead>
            <tbody>
              {doctors.map((d) => (
                <tr key={d.doctor_id}>
                  <td><span className="id">D-{String(d.doctor_id).padStart(3, '0')}</span></td>
                  <td>
                    <div className="name">{d.name}</div>
                    <div className="sub">{d.specialization || 'General practice'}</div>
                  </td>
                  <td><span className="stamp mute">{d.dept_name}</span></td>
                  <td><span className="data">{d.phone || '\u2014'}</span></td>
                  <td className="right"><span className="amount">{taka(d.consult_fee)}</span></td>
                  <td className="right">
                    <button className="btn ghost sm"
                      onClick={() => handleDelete(d.doctor_id, d.name)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}