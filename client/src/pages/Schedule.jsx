// ============================================================
//  Schedule.jsx
//
//  Doctor nijer chamber time thik kore. Admin je kono doctor er
//  schedule dekhte ar palte pare.
//
//  ⚠️ Doctor er doctor_id token theke ashe (useAuth), URL ba
//     form theke na. Ar backend eo requireOwnSchedule check
//     kore — tai onner schedule e hat dewa jabe na.
// ============================================================

import { useState, useEffect } from 'react';
import { useAuth } from '../auth';
import {
  getDoctors, getFullSchedule, addScheduleSlot,
  toggleScheduleSlot, deleteScheduleSlot,
} from '../api';

const DAYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday',
              'Wednesday', 'Thursday', 'Friday'];

// '17:00:00' → '05:00 PM'
const prettyTime = (t) => {
  if (!t) return '\u2014';
  const [h, m] = t.split(':');
  const hour = Number(h);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${String(h12).padStart(2, '0')}:${m} ${suffix}`;
};

export default function Schedule() {
  const { user } = useAuth();
  const isAdmin = user.role === 'admin';

  // doctor hole nijer id, admin hole dropdown theke
  const [doctorId, setDoctorId] = useState(
    user.role === 'doctor' ? String(user.doctor_id) : ''
  );
  const [doctors, setDoctors] = useState([]);
  const [slots, setSlots]     = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [notice, setNotice]   = useState('');
  const [showForm, setShowForm] = useState(false);

  const emptyForm = {
    day_of_week: 'Saturday', start_time: '', end_time: '',
    chamber_no: '', slot_duration: 15, max_patients: 20,
  };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (isAdmin) getDoctors().then((r) => setDoctors(r.data)).catch(() => {});
  }, [isAdmin]);

  useEffect(() => {
    if (!doctorId) { setSlots([]); setLoading(false); return; }
    loadSlots();
  }, [doctorId]);

  async function loadSlots() {
    try {
      setLoading(true);
      setError('');
      // all=true — off kora slot gulo o dekhabo
      const res = await getFullSchedule(doctorId);
      setSlots(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load the schedule.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    if (!form.start_time || !form.end_time) {
      setError('Enter both a start and an end time.'); return;
    }
    try {
      setError('');
      await addScheduleSlot(doctorId, {
        ...form,
        slot_duration: Number(form.slot_duration) || 15,
        max_patients:  Number(form.max_patients) || 20,
      });
      setForm(emptyForm);
      setShowForm(false);
      setNotice('Slot added.');
      loadSlots();
    } catch (err) {
      // 409 = uq_doc_day_slot, 400 = chk_sched_time
      setError(err.response?.data?.error || 'Could not add this slot.');
    }
  }

  async function handleToggle(slot) {
    try {
      setError('');
      await toggleScheduleSlot(doctorId, slot.schedule_id, !slot.is_active);
      loadSlots();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not change this slot.');
    }
  }

  async function handleDelete(slot) {
    if (!window.confirm(
      `Remove the ${slot.day_of_week} ${prettyTime(slot.start_time)} slot?`
    )) return;
    try {
      setError('');
      await deleteScheduleSlot(doctorId, slot.schedule_id);
      setNotice('Slot removed.');
      loadSlots();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not remove this slot.');
    }
  }

  const activeCount = slots.filter((s) => s.is_active).length;

  return (
    <div>
      <div className="page-top">
        <h2>{isAdmin ? 'Doctor Schedules' : 'My Schedule'}</h2>
        <span className="count">
          {loading ? '\u2014' : `${activeCount} active slot${activeCount === 1 ? '' : 's'}`}
        </span>
      </div>

      <div className="toolbar">
        {isAdmin ? (
          <select className="search" value={doctorId}
            onChange={(e) => setDoctorId(e.target.value)}>
            <option value="">Choose a doctor</option>
            {doctors.map((d) => (
              <option key={d.doctor_id} value={d.doctor_id}>
                {d.name} &middot; {d.dept_name}
              </option>
            ))}
          </select>
        ) : (
          <span style={{ flex: 1 }} />
        )}
        <button className="btn primary"
          onClick={() => setShowForm(!showForm)}
          disabled={!doctorId}>
          {showForm ? 'Close' : 'Add a slot'}
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

      {/* ---------- add form ---------- */}
      {showForm && (
        <div className="form">
          <div className="form-title">New chamber slot</div>
          <div className="fields">
            <label>
              Day
              <select value={form.day_of_week}
                onChange={(e) => setForm({ ...form, day_of_week: e.target.value })}>
                {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>
            <label>
              Start time
              <input type="time" value={form.start_time}
                onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
            </label>
            <label>
              End time
              <input type="time" value={form.end_time}
                onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
            </label>
            <label>
              Chamber
              <input value={form.chamber_no} placeholder="A-301"
                onChange={(e) => setForm({ ...form, chamber_no: e.target.value })} />
            </label>
            <label>
              Minutes per patient
              <input type="number" min="5" value={form.slot_duration}
                onChange={(e) => setForm({ ...form, slot_duration: e.target.value })} />
            </label>
            <label>
              Max patients
              <input type="number" min="1" value={form.max_patients}
                onChange={(e) => setForm({ ...form, max_patients: e.target.value })} />
            </label>
          </div>
          <div className="form-actions">
            <button className="btn"
              onClick={() => { setShowForm(false); setForm(emptyForm); }}>
              Cancel
            </button>
            <button className="btn primary" onClick={handleAdd}>Add slot</button>
          </div>
        </div>
      )}

      {/* ---------- list ---------- */}
      {!doctorId ? (
        <div className="empty">
          <p>No doctor selected.</p>
          <p className="hint">Pick a doctor above to see their chamber hours.</p>
        </div>
      ) : loading ? (
        <div className="loading">Loading schedule</div>
      ) : slots.length === 0 ? (
        <div className="empty">
          <p>No chamber hours set.</p>
          <p className="hint">Add a slot so patients can book appointments.</p>
        </div>
      ) : (
        <div className="records">
          <table className="table">
            <thead>
              <tr>
                <th>Day</th>
                <th>Hours</th>
                <th>Chamber</th>
                <th className="right">Per patient</th>
                <th className="right">Max</th>
                <th>Status</th>
                <th className="right">Action</th>
              </tr>
            </thead>
            <tbody>
              {slots.map((s) => (
                <tr key={s.schedule_id}>
                  <td><span className="name">{s.day_of_week}</span></td>
                  <td>
                    <span className="data">
                      {prettyTime(s.start_time)} &ndash; {prettyTime(s.end_time)}
                    </span>
                  </td>
                  <td><span className="data">{s.chamber_no || '\u2014'}</span></td>
                  <td className="right"><span className="data">{s.slot_duration} min</span></td>
                  <td className="right"><span className="data">{s.max_patients}</span></td>
                  <td>
                    <span className={s.is_active ? 'stamp clear' : 'stamp mute'}>
                      {s.is_active ? 'Active' : 'Off'}
                    </span>
                  </td>
                  <td className="right">
                    <button className="btn sm" onClick={() => handleToggle(s)}>
                      {s.is_active ? 'Turn off' : 'Turn on'}
                    </button>
                    {' '}
                    <button className="btn ghost sm" onClick={() => handleDelete(s)}>
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