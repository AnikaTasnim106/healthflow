// ============================================================
//  Patients.jsx
//  Reference page — state, useEffect, async handlers, JSX.
// ============================================================

import { useState, useEffect } from 'react';
import { getPatients, createPatient, updatePatient, deletePatient } from '../api';

// Blood group family drives the chart spine colour on each row.
function spineOf(bg) {
  if (!bg) return '';
  if (bg.startsWith('AB')) return 'ab';
  return bg[0].toLowerCase();
}

function age(dob) {
  if (!dob) return '—';
  const years = (Date.now() - new Date(dob)) / 31557600000;
  return `${Math.floor(years)}y`;
}

export default function Patients() {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [search, setSearch]     = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId]     = useState(null);   // null = notun, id = edit

  const emptyForm = {
    name: '', dob: '', gender: 'M',
    phone: '', address: '', blood_group: 'A+',
  };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { loadPatients(); }, [search]);

  async function loadPatients() {
    try {
      setLoading(true);
      setError('');
      const res = await getPatients(search);
      setPatients(res.data);
    } catch (err) {
      setError('Could not reach the server. Check that the backend is running on port 5000.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // ekta form, duita kaj — editId null hole create, na hole update
  async function handleSave() {
    if (!form.name.trim()) { setError('Enter a name to register the patient.'); return; }
    try {
      setError('');
      if (editId) {
        await updatePatient(editId, form);
      } else {
        await createPatient(form);
      }
      closeForm();
      loadPatients();
    } catch (err) {
      setError(err.response?.data?.error ||
        (editId ? 'Could not save the changes.' : 'Could not register this patient.'));
    }
  }

  // Edit e click korle form e existing data bhore dey.
  // dob DB theke ISO timestamp e ashe, <input type="date"> ke
  // 'YYYY-MM-DD' lage — tai kete nite hoy.
  function startEdit(p) {
    setEditId(p.patient_id);
    setForm({
      name:        p.name || '',
      dob:         p.dob ? String(p.dob).slice(0, 10) : '',
      gender:      p.gender || 'M',
      phone:       p.phone || '',
      address:     p.address || '',
      blood_group: p.blood_group || 'A+',
    });
    setShowForm(true);
    setError('');
  }

  function closeForm() {
    setShowForm(false);
    setEditId(null);
    setForm(emptyForm);
  }

  async function handleDelete(id, name) {
    if (!window.confirm(`Remove ${name} from the registry?`)) return;
    try {
      await deletePatient(id);
      loadPatients();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not remove this patient.');
    }
  }

  return (
    <div>
      <div className="page-top">
        <h2>Patients</h2>
        <span className="count">
          {loading ? '—' : `${patients.length} record${patients.length === 1 ? '' : 's'}`}
          {search && ' matching'}
        </span>
      </div>

      <div className="toolbar">
        <input
          className="search"
          placeholder="Search by name or phone"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="btn primary"
          onClick={() => (showForm ? closeForm() : setShowForm(true))}>
          {showForm ? 'Close' : 'Register patient'}
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
          <div className="form-title">
            {editId ? `Edit patient record P-${String(editId).padStart(3, '0')}` : 'New patient record'}
          </div>
          <div className="fields">
            <label>
              Full name
              <input value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label>
              Date of birth
              <input type="date" value={form.dob}
                onChange={(e) => setForm({ ...form, dob: e.target.value })} />
            </label>
            <label>
              Gender
              <select value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                <option value="M">Male</option>
                <option value="F">Female</option>
                <option value="O">Other</option>
              </select>
            </label>
            <label>
              Blood group
              <select value={form.blood_group}
                onChange={(e) => setForm({ ...form, blood_group: e.target.value })}>
                {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map((bg) => (
                  <option key={bg} value={bg}>{bg}</option>
                ))}
              </select>
            </label>
            <label>
              Phone
              <input value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </label>
            <label>
              Address
              <input value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </label>
          </div>
          <div className="form-actions">
            <button className="btn" onClick={closeForm}>Cancel</button>
            <button className="btn primary" onClick={handleSave}>
              {editId ? 'Save changes' : 'Save record'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading">Loading records</div>
      ) : patients.length === 0 ? (
        <div className="empty">
          <p>{search ? 'No patients match that search.' : 'No patients on file.'}</p>
          <p className="hint">
            {search ? 'Try a different name or phone number.' : 'Register the first patient to get started.'}
          </p>
        </div>
      ) : (
        <div className="records">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Patient</th>
                <th>Blood</th>
                <th>Age</th>
                <th>Phone</th>
                <th>Address</th>
                <th className="right">Action</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((p) => (
                <tr key={p.patient_id} data-spine={spineOf(p.blood_group)}>
                  <td><span className="id">P-{String(p.patient_id).padStart(3, '0')}</span></td>
                  <td>
                    <div className="name">{p.name}</div>
                    <div className="sub">{p.gender === 'M' ? 'Male' : p.gender === 'F' ? 'Female' : 'Other'}</div>
                  </td>
                  <td><span className="blood">{p.blood_group || '—'}</span></td>
                  <td><span className="data">{age(p.dob)}</span></td>
                  <td><span className="data">{p.phone || '—'}</span></td>
                  <td>{p.address || '—'}</td>
                  <td className="right">
                    <button className="btn sm" onClick={() => startEdit(p)}>Edit</button>
                    {' '}
                    <button className="btn ghost sm"
                      onClick={() => handleDelete(p.patient_id, p.name)}>
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