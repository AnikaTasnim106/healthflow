// ============================================================
//  Appointments.jsx
//
//  Same pattern as Patients.jsx — state, useEffect, async
//  handlers, JSX. Duita extra jinis ache:
//
//  1. Booking form e patient ar doctor dropdown lage, tai ei
//     page load hole tinta jinis ane — appointment, patient,
//     doctor.
//  2. Doctor select korle tar schedule ane, jate kon din kon
//     somoy tini boshen seta dekha jay.
// ============================================================

import { useState, useEffect } from 'react';
import {
  getAppointments, bookAppointment, updateApptStatus,
  getPatients, getDoctors, getDoctorSchedule,
} from '../api';

// Status onujayi stamp er rong
const stampOf = (status) => {
  if (status === 'Completed') return 'clear';
  if (status === 'Scheduled') return 'hold';
  if (status === 'Cancelled') return 'flag';
  return 'mute';                       // No-Show
};

// '17:20:00' → '05:20 PM'
const prettyTime = (t) => {
  if (!t) return '\u2014';
  const [h, m] = t.split(':');
  const hour = Number(h);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${String(h12).padStart(2, '0')}:${m} ${suffix}`;
};

// '2026-07-04T00:00:00.000Z' → '04 Jul 2026'
const prettyDate = (d) => {
  if (!d) return '\u2014';
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
};

export default function Appointments() {
  const [appts, setAppts]     = useState([]);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors]   = useState([]);
  const [schedule, setSchedule] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [notice, setNotice]   = useState('');
  const [showForm, setShowForm] = useState(false);

  // filter
  const [filterDate, setFilterDate]     = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const emptyForm = {
    patient_id: '', doctor_id: '', schedule_id: '',
    appt_date: '', time_slot: '',
  };
  const [form, setForm] = useState(emptyForm);

  // filter palte gele list abar ane
  useEffect(() => { loadAppointments(); }, [filterDate, filterStatus]);

  // dropdown er data — shudhu ekbar
  useEffect(() => { loadDropdowns(); }, []);

  // doctor select korle tar schedule ane
  useEffect(() => {
    if (!form.doctor_id) { setSchedule([]); return; }
    getDoctorSchedule(form.doctor_id)
      .then((res) => setSchedule(res.data))
      .catch(() => setSchedule([]));
  }, [form.doctor_id]);

  async function loadAppointments() {
    try {
      setLoading(true);
      setError('');
      const params = {};
      if (filterDate)   params.date   = filterDate;
      if (filterStatus) params.status = filterStatus;

      const res = await getAppointments(params);
      setAppts(res.data);
    } catch (err) {
      setError('Could not reach the server. Check that the backend is running on port 5000.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadDropdowns() {
    try {
      const [p, d] = await Promise.all([getPatients(''), getDoctors()]);
      setPatients(p.data);
      setDoctors(d.data);
    } catch (err) {
      console.error('Could not load patient/doctor lists', err);
    }
  }

  async function handleBook() {
    if (!form.patient_id) { setError('Choose a patient.'); return; }
    if (!form.doctor_id)  { setError('Choose a doctor.'); return; }
    if (!form.appt_date)  { setError('Choose a date.'); return; }
    if (!form.time_slot)  { setError('Choose a time slot.'); return; }

    try {
      setError('');
      await bookAppointment({
        patient_id:  Number(form.patient_id),
        doctor_id:   Number(form.doctor_id),
        schedule_id: form.schedule_id ? Number(form.schedule_id) : null,
        appt_date:   form.appt_date,
        time_slot:   form.time_slot,
      });
      setForm(emptyForm);
      setShowForm(false);
      setNotice('Appointment booked.');
      loadAppointments();
    } catch (err) {
      // 409 = uq_doc_slot constraint fire korlo (same doctor, same date+time)
      setError(err.response?.data?.error || 'Could not book this appointment.');
    }
  }

  async function handleStatus(id, status) {
    try {
      setError('');
      await updateApptStatus(id, status);
      loadAppointments();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not update the status.');
    }
  }

  const clearFilters = () => { setFilterDate(''); setFilterStatus(''); };

  return (
    <div>
      <div className="page-top">
        <h2>Appointments</h2>
        <span className="count">
          {loading ? '\u2014' : `${appts.length} appointment${appts.length === 1 ? '' : 's'}`}
          {(filterDate || filterStatus) && ' matching'}
        </span>
      </div>

      {/* ---------- filters ---------- */}
      <div className="toolbar">
        <input
          className="search"
          type="date"
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
        />
        <select
          className="search"
          style={{ flex: '0 0 170px' }}
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="Scheduled">Scheduled</option>
          <option value="Completed">Completed</option>
          <option value="Cancelled">Cancelled</option>
          <option value="No-Show">No-Show</option>
        </select>
        {(filterDate || filterStatus) && (
          <button className="btn" onClick={clearFilters}>Clear</button>
        )}
        <button className="btn primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Close' : 'Book appointment'}
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

      {/* ---------- booking form ---------- */}
      {showForm && (
        <div className="form">
          <div className="form-title">Book an appointment</div>
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

            <label>
              Doctor
              <select value={form.doctor_id}
                onChange={(e) => setForm({
                  ...form, doctor_id: e.target.value, schedule_id: '',
                })}>
                <option value="">Choose a doctor</option>
                {doctors.map((d) => (
                  <option key={d.doctor_id} value={d.doctor_id}>
                    {d.name} &middot; {d.dept_name}
                  </option>
                ))}
              </select>
            </label>

            {/* doctor select korle tar weekly schedule dekhay.
                schedule_id appointment table e ekta FK. */}
            <label>
              Chamber slot
              <select value={form.schedule_id}
                disabled={schedule.length === 0}
                onChange={(e) => setForm({ ...form, schedule_id: e.target.value })}>
                <option value="">
                  {form.doctor_id
                    ? (schedule.length ? 'Choose a slot' : 'No active schedule')
                    : 'Choose a doctor first'}
                </option>
                {schedule.map((s) => (
                  <option key={s.schedule_id} value={s.schedule_id}>
                    {s.day_of_week} &middot; {prettyTime(s.start_time)}–{prettyTime(s.end_time)}
                    {s.chamber_no ? ` \u00b7 ${s.chamber_no}` : ''}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Date
              <input type="date" value={form.appt_date}
                onChange={(e) => setForm({ ...form, appt_date: e.target.value })} />
            </label>

            <label>
              Time slot
              <input type="time" value={form.time_slot}
                onChange={(e) => setForm({ ...form, time_slot: e.target.value })} />
            </label>
          </div>

          <div className="form-actions">
            <button className="btn"
              onClick={() => { setShowForm(false); setForm(emptyForm); }}>
              Cancel
            </button>
            <button className="btn primary" onClick={handleBook}>
              Book appointment
            </button>
          </div>
        </div>
      )}

      {/* ---------- list ---------- */}
      {loading ? (
        <div className="loading">Loading appointments</div>
      ) : appts.length === 0 ? (
        <div className="empty">
          <p>{(filterDate || filterStatus)
            ? 'No appointments match these filters.'
            : 'No appointments booked.'}</p>
          <p className="hint">{(filterDate || filterStatus)
            ? 'Try a different date or status.'
            : 'Book the first appointment to get started.'}</p>
        </div>
      ) : (
        <div className="records">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Patient</th>
                <th>Doctor</th>
                <th>Date</th>
                <th>Time</th>
                <th>Status</th>
                <th className="right">Action</th>
              </tr>
            </thead>
            <tbody>
              {appts.map((a) => (
                <tr key={a.appt_id}>
                  <td><span className="id">A-{String(a.appt_id).padStart(3, '0')}</span></td>
                  <td>
                    <div className="name">{a.patient_name}</div>
                    <div className="sub">{a.phone || '\u2014'}</div>
                  </td>
                  <td>
                    <div className="name">{a.doctor_name}</div>
                    <div className="sub">{a.dept_name}</div>
                  </td>
                  <td><span className="data">{prettyDate(a.appt_date)}</span></td>
                  <td><span className="data">{prettyTime(a.time_slot)}</span></td>
                  <td><span className={`stamp ${stampOf(a.status)}`}>{a.status}</span></td>
                  <td className="right">
                    {a.status === 'Scheduled' ? (
                      <>
                        <button className="btn sm"
                          onClick={() => handleStatus(a.appt_id, 'Completed')}>
                          Complete
                        </button>
                        {' '}
                        <button className="btn ghost sm"
                          onClick={() => handleStatus(a.appt_id, 'Cancelled')}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <span className="sub">—</span>
                    )}
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