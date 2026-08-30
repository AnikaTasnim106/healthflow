// ============================================================
//  Admissions.jsx
//
//  Duita jinis ei page ta dekhay:
//
//  1. Admit korle backend ek TRANSACTION e admission insert
//     kore AR room er status 'Occupied' kore. Ekta fail korle
//     duitai rollback.
//  2. Occupied room e abar admit korar chesta korle 409 ashe —
//     schema er uq_room_active partial unique index fire kore.
//     (Ek room e ekbare ekta-i active admission thakte pare.)
// ============================================================

import { useState, useEffect } from 'react';
import {
  getAdmissions, getAvailableRooms, admitPatient,
  dischargePatient, getPatients,
} from '../api';

const taka = (n) => `\u09F3${Number(n || 0).toLocaleString('en-IN')}`;

const prettyDate = (d) => {
  if (!d) return '\u2014';
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
};

// admit theke discharge (ba aaj) porjonto koto din
function daysStayed(admit, discharge) {
  if (!admit) return 0;
  const start = new Date(admit);
  const end = discharge ? new Date(discharge) : new Date();
  const days = Math.floor((end - start) / 86400000);
  return days < 1 ? 1 : days;            // ek diner kom holeo 1 din dhora hoy
}

export default function Admissions() {
  const [admissions, setAdmissions] = useState([]);
  const [rooms, setRooms]           = useState([]);
  const [patients, setPatients]     = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [notice, setNotice]   = useState('');
  const [showForm, setShowForm] = useState(false);
  const [onlyActive, setOnlyActive] = useState(false);

  const emptyForm = { patient_id: '', room_no: '', admit_date: '' };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    try {
      setLoading(true);
      setError('');
      const [a, r, p] = await Promise.all([
        getAdmissions(), getAvailableRooms(), getPatients(''),
      ]);
      setAdmissions(a.data);
      setRooms(r.data);
      setPatients(p.data);
    } catch (err) {
      setError('Could not reach the server. Check that the backend is running on port 5000.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdmit() {
    if (!form.patient_id) { setError('Choose a patient.'); return; }
    if (!form.room_no)    { setError('Choose a room.'); return; }

    try {
      setError('');
      await admitPatient({
        patient_id: Number(form.patient_id),
        room_no: form.room_no,
        admit_date: form.admit_date || null,
      });
      setForm(emptyForm);
      setShowForm(false);
      setNotice('Patient admitted.');
      loadAll();                          // room list o refresh hobe
    } catch (err) {
      // 409 = room ta already occupied
      setError(err.response?.data?.error || 'Could not admit this patient.');
    }
  }

  async function handleDischarge(id, name, room) {
    if (!window.confirm(`Discharge ${name} from room ${room}?`)) return;
    try {
      setError('');
      await dischargePatient(id, {});     // date na dile backend CURRENT_DATE dhorbe
      setNotice(`${name} discharged. Room ${room} is now available.`);
      loadAll();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not discharge this patient.');
    }
  }

  const shown = onlyActive
    ? admissions.filter((a) => !a.discharge_date)
    : admissions;

  const activeCount = admissions.filter((a) => !a.discharge_date).length;

  return (
    <div>
      <div className="page-top">
        <h2>Admissions</h2>
        <span className="count">
          {loading ? '\u2014'
            : `${activeCount} in ward \u00b7 ${rooms.length} room${rooms.length === 1 ? '' : 's'} free`}
        </span>
      </div>

      <div className="toolbar">
        <span style={{ flex: 1 }} />
        <button className={onlyActive ? 'btn primary' : 'btn'}
          onClick={() => setOnlyActive(!onlyActive)}>
          {onlyActive ? 'Showing in ward' : 'Show in ward only'}
        </button>
        <button className="btn primary"
          onClick={() => setShowForm(!showForm)}
          disabled={rooms.length === 0}
          title={rooms.length === 0 ? 'No rooms available' : ''}>
          {showForm ? 'Close' : 'Admit patient'}
        </button>
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

      {/* ---------- admit form ---------- */}
      {showForm && (
        <div className="form">
          <div className="form-title">Admit a patient</div>
          <div className="fields">
            <label>
              Patient
              <select value={form.patient_id}
                onChange={(e) => setForm({ ...form, patient_id: e.target.value })}>
                <option value="">Choose a patient</option>
                {patients.map((p) => (
                  <option key={p.patient_id} value={p.patient_id}>
                    {p.name} &middot; {p.phone || 'no phone'}
                  </option>
                ))}
              </select>
            </label>

            {/* shudhu available room dekhay — backend er
                GET /admissions/available-rooms theke ashe */}
            <label>
              Room
              <select value={form.room_no}
                onChange={(e) => setForm({ ...form, room_no: e.target.value })}>
                <option value="">Choose an available room</option>
                {rooms.map((r) => (
                  <option key={r.room_no} value={r.room_no}>
                    {r.room_no} &middot; {r.room_type} &middot; {taka(r.daily_charge)}/day
                  </option>
                ))}
              </select>
            </label>

            <label>
              Admit date
              <input type="date" value={form.admit_date}
                onChange={(e) => setForm({ ...form, admit_date: e.target.value })} />
            </label>
          </div>

          <div className="form-actions">
            <button className="btn"
              onClick={() => { setShowForm(false); setForm(emptyForm); }}>
              Cancel
            </button>
            <button className="btn primary" onClick={handleAdmit}>Admit</button>
          </div>
        </div>
      )}

      {/* ---------- list ---------- */}
      {loading ? (
        <div className="loading">Loading admissions</div>
      ) : shown.length === 0 ? (
        <div className="empty">
          <p>{onlyActive ? 'No patients currently in the ward.' : 'No admissions recorded.'}</p>
          <p className="hint">
            {rooms.length === 0
              ? 'No rooms are free right now.'
              : 'Admit a patient to get started.'}
          </p>
        </div>
      ) : (
        <div className="records">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Patient</th>
                <th>Room</th>
                <th>Admitted</th>
                <th>Discharged</th>
                <th className="right">Days</th>
                <th className="right">Room cost</th>
                <th className="right">Action</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((a) => {
                const active = !a.discharge_date;
                const days = daysStayed(a.admit_date, a.discharge_date);
                const cost = days * Number(a.daily_charge || 0);

                return (
                  <tr key={a.admission_id}>
                    <td>
                      <span className="id">
                        ADM-{String(a.admission_id).padStart(3, '0')}
                      </span>
                    </td>
                    <td><span className="name">{a.patient_name}</span></td>
                    <td>
                      <div className="data">{a.room_no}</div>
                      <div className="sub">{a.room_type}</div>
                    </td>
                    <td><span className="data">{prettyDate(a.admit_date)}</span></td>
                    <td>
                      {active
                        ? <span className="stamp hold">In ward</span>
                        : <span className="data">{prettyDate(a.discharge_date)}</span>}
                    </td>
                    <td className="right"><span className="data">{days}</span></td>
                    <td className="right"><span className="amount">{taka(cost)}</span></td>
                    <td className="right">
                      {active ? (
                        <button className="btn sm"
                          onClick={() => handleDischarge(
                            a.admission_id, a.patient_name, a.room_no)}>
                          Discharge
                        </button>
                      ) : (
                        <span className="stamp clear">Closed</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}