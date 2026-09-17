import { useState, useEffect } from 'react';
import { useAuth } from '../auth';
import {
  getDepartments, createDepartment, updateDepartment, deleteDepartment,
} from '../api';

export default function Departments() {
  const { user } = useAuth();
  const isAdmin = user.role === 'admin';

  const [depts, setDepts]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [notice, setNotice]   = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId]     = useState(null);
  const emptyForm = { dept_name: '', location: '' };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { loadDepts(); }, []);

  async function loadDepts() {
    try {
      setLoading(true);
      setError('');
      const res = await getDepartments();
      setDepts(res.data);
    } catch (err) {
      setError('Could not load departments.');
    } finally {
      setLoading(false);
    }
  }

  function startEdit(d) {
    setEditId(d.dept_id);
    setForm({ dept_name: d.dept_name || '', location: d.location || '' });
    setShowForm(true);
    setError('');
  }

  function closeForm() {
    setShowForm(false);
    setEditId(null);
    setForm(emptyForm);
  }

  async function handleSave() {
    if (!form.dept_name.trim()) { setError('Enter a department name.'); return; }
    try {
      setError('');
      if (editId) {
        await updateDepartment(editId, form);
        setNotice('Department updated.');
      } else {
        await createDepartment(form);
        setNotice('Department added.');
      }
      closeForm();
      loadDepts();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save this department.');
    }
  }

  async function handleDelete(d) {
    if (!window.confirm(`Remove ${d.dept_name}?`)) return;
    try {
      setError('');
      await deleteDepartment(d.dept_id);
      setNotice(`${d.dept_name} removed.`);
      loadDepts();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not remove this department.');
    }
  }

  return (
    <div>
      <div className="page-top">
        <h2>Departments</h2>
        <span className="count">
          {loading ? '\u2014' : `${depts.length} department${depts.length === 1 ? '' : 's'}`}
        </span>
      </div>

      <div className="toolbar">
        <span style={{ flex: 1 }} />
        {isAdmin && (
          <button className="btn primary"
            onClick={() => (showForm ? closeForm() : setShowForm(true))}>
            {showForm ? 'Close' : 'Add department'}
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
            {editId ? `Edit department` : 'New department'}
          </div>
          <div className="fields">
            <label>
              Name
              <input value={form.dept_name} placeholder="Cardiology"
                onChange={(e) => setForm({ ...form, dept_name: e.target.value })} />
            </label>
            <label>
              Location
              <input value={form.location} placeholder="Block A, 3rd Floor"
                onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </label>
          </div>
          <div className="form-actions">
            <button className="btn" onClick={closeForm}>Cancel</button>
            <button className="btn primary" onClick={handleSave}>
              {editId ? 'Save changes' : 'Add department'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading">Loading departments</div>
      ) : depts.length === 0 ? (
        <div className="empty">
          <p>No departments set up.</p>
          <p className="hint">Add one so doctors can be assigned to it.</p>
        </div>
      ) : (
        <div className="records">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Department</th>
                <th>Location</th>
                <th className="right">Doctors</th>
                {isAdmin && <th className="right">Action</th>}
              </tr>
            </thead>
            <tbody>
              {depts.map((d) => (
                <tr key={d.dept_id}>
                  <td><span className="id">{String(d.dept_id).padStart(2, '0')}</span></td>
                  <td><span className="name">{d.dept_name}</span></td>
                  <td>{d.location || <span className="sub">&mdash;</span>}</td>
                  <td className="right"><span className="data">{d.doctor_count}</span></td>
                  {isAdmin && (
                    <td className="right">
                      <button className="btn sm" onClick={() => startEdit(d)}>Edit</button>
                      {' '}
                      <button className="btn ghost sm"
                        onClick={() => handleDelete(d)}>Remove</button>
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