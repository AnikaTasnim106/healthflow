import { useState, useEffect } from 'react';
import { useAuth } from '../auth';
import {
  getDoctors, createDoctor, updateDoctor, deleteDoctor, getDepartments,
} from '../api';

const taka = (n) => `\u09F3${Number(n || 0).toLocaleString('en-IN')}`;

export default function Doctors() {
  const { user } = useAuth();
  const isAdmin = user.role === 'admin';

  const [doctors, setDoctors] = useState([]);
  const [depts, setDepts]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [notice, setNotice]   = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId]     = useState(null);
  const [search, setSearch]     = useState('');

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

  async function loadDepartments() {
    try {
      const res = await getDepartments();
      setDepts(res.data);
    } catch (err) {
      console.warn('Departments endpoint not available');
    }
  }

  function startEdit(d) {
    setEditId(d.doctor_id);
    setForm({
      name:           d.name || '',
      specialization: d.specialization || '',
      phone:          d.phone || '',
      consult_fee:    d.consult_fee != null ? String(d.consult_fee) : '',
      dept_id:        depts.find((x) => x.dept_name === d.dept_name)?.dept_id || '',
      email: '', password: '',
    });
    setShowForm(true);
    setError('');
  }

  function closeForm() {
    setShowForm(false);
    setEditId(null);
    setForm(emptyForm);
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Enter a name.'); return; }
    if (!form.dept_id)     { setError('Choose a department.'); return; }

    if (!editId && ((form.email && !form.password) || (!form.email && form.password))) {
      setError('To create a login, fill in both email and password.');
      return;
    }

    try {
      setError('');
      const payload = {
        name: form.name,
        specialization: form.specialization,
        phone: form.phone,
        consult_fee: Number(form.consult_fee) || 0,
        dept_id: Number(form.dept_id),
      };

      if (editId) {
        await updateDoctor(editId, payload);
        setNotice('Changes saved.');
      } else {
        await createDoctor({ ...payload, email: form.email, password: form.password });
        setNotice(form.email ? 'Doctor added with a login account.' : 'Doctor added.');
      }
      closeForm();
      loadDoctors();
    } catch (err) {
      setError(err.response?.data?.error ||
        (editId ? 'Could not save the changes.' : 'Could not add this doctor.'));
    }
  }

  async function handleDelete(id, name) {
    if (!window.confirm(`Remove ${name} from the directory?`)) return;
    try {
      setError('');
      await deleteDoctor(id);
      setNotice(`${name} removed.`);
      loadDoctors();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not remove this doctor.');
    }
  }

  const shown = search.trim()
    ? doctors.filter((d) => {
        const q = search.toLowerCase();
        return (d.name || '').toLowerCase().includes(q)
            || (d.specialization || '').toLowerCase().includes(q)
            || (d.dept_name || '').toLowerCase().includes(q);
      })
    : doctors;

  return (
    <div>
      <div className="page-top">
        <h2>Doctors</h2>
        <span className="count">
          {loading ? '\u2014' : `${shown.length} on staff`}
          {search.trim() && ' matching'}
        </span>
      </div>

      <div className="toolbar">
        <input
          className="search"
          placeholder="Search by name, specialization or department"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {isAdmin && (
          <button className="btn primary"
            onClick={() => (showForm ? closeForm() : setShowForm(true))}
            disabled={depts.length === 0}
            title={depts.length === 0 ? 'Departments endpoint not available' : ''}>
            {showForm ? 'Close' : 'Add doctor'}
          </button>
        )}
      </div>

      {error && (
        <div className="alert">
          <span>{error}</span>
          <button className="x" onClick={() => setError('')}>Dismiss</button>
        </div>
      )}
      {notice && (
        <div className="alert" style={{
          background: 'var(--clear-pale)', borderColor: '#c8ddd0',
          borderLeftColor: 'var(--clear)', color: 'var(--clear)',
        }}>
          <span>{notice}</span>
          <button className="x" style={{ color: 'var(--clear)' }}
            onClick={() => setNotice('')}>Dismiss</button>
        </div>
      )}

      {showForm && (
        <div className="form">
          <div className="form-title">
            {editId
              ? `Edit doctor D-${String(editId).padStart(3, '0')}`
              : 'New doctor'}
          </div>

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

          {!editId && (
            <>
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
                Leave both blank to add the doctor without a login.
              </p>
            </>
          )}

          <div className="form-actions">
            <button className="btn" onClick={closeForm}>Cancel</button>
            <button className="btn primary" onClick={handleSave}>
              {editId ? 'Save changes' : 'Save doctor'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading">Loading directory</div>
      ) : shown.length === 0 ? (
        <div className="empty">
          <p>{search.trim() ? 'No doctors match that search.' : 'No doctors on staff.'}</p>
          <p className="hint">
            {search.trim() ? 'Try a different name or department.' : 'Add the first doctor to build the directory.'}
          </p>
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
                {isAdmin && <th className="right">Action</th>}
              </tr>
            </thead>
            <tbody>
              {shown.map((d) => (
                <tr key={d.doctor_id}>
                  <td><span className="id">D-{String(d.doctor_id).padStart(3, '0')}</span></td>
                  <td>
                    <div className="name">{d.name}</div>
                    <div className="sub">{d.specialization || 'General practice'}</div>
                  </td>
                  <td><span className="stamp mute">{d.dept_name}</span></td>
                  <td><span className="data">{d.phone || '\u2014'}</span></td>
                  <td className="right"><span className="amount">{taka(d.consult_fee)}</span></td>
                  {isAdmin && (
                    <td className="right">
                      <button className="btn sm" onClick={() => startEdit(d)}>Edit</button>
                      {' '}
                      <button className="btn ghost sm"
                        onClick={() => handleDelete(d.doctor_id, d.name)}>
                        Remove
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}