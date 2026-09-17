import { useState, useEffect } from 'react';
import { useAuth } from '../auth';
import {
  getAppointments, bookAppointment, updateApptStatus,
  getPatients, getDoctors, getAvailableSlots, billVisit,
} from '../api';

const stampOf = (status) => {
  if (status === 'Completed') return 'clear';
  if (status === 'Scheduled') return 'hold';
  if (status === 'Cancelled') return 'flag';
  return 'mute';
};

const prettyTime = (t) => {
  if (!t) return '\u2014';
  const [h, m] = t.split(':');
  const hour = Number(h);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${String(h12).padStart(2, '0')}:${m} ${suffix}`;
};

const prettyDate = (d) => {
  if (!d) return '\u2014';
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
};

export default function Appointments() {
  const { user } = useAuth();
  const canBill = user.role === 'admin' || user.role === 'receptionist';

  const [appts, setAppts]       = useState([]);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors]   = useState([]);
  const [slots, setSlots]       = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [notice, setNotice]   = useState('');
  const [showForm, setShowForm] = useState(false);

  const [filterDate, setFilterDate]     = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const emptyForm = {
    patient_id: '', doctor_id: '', appt_date: '',
    schedule_id: '', time_slot: '',
  };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { loadAppointments(); }, [filterDate, filterStatus]);
  useEffect(() => { loadDropdowns(); }, []);

  useEffect(() => {
    if (!form.doctor_id || !form.appt_date) {
      setSlots([]);
      return;
    }
    loadSlots(form.doctor_id, form.appt_date);
  }, [form.doctor_id, form.appt_date]);

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
      console.error('Could not load patient or doctor lists', err);
    }
  }

  async function loadSlots(doctorId, date) {
    try {
      setSlotsLoading(true);
      setSlots([]);
      setForm((f) => ({ ...f, schedule_id: '', time_slot: '' }));
      const res = await getAvailableSlots(doctorId, date);
      setSlots(res.data.slots || []);
    } catch (err) {
      setSlots([]);
      setError(err.response?.data?.error || 'Could not load available slots.');
    } finally {
      setSlotsLoading(false);
    }
  }

  function pickSlot(value) {
    if (!value) {
      setForm({ ...form, schedule_id: '', time_slot: '' });
      return;
    }
    const [scheduleId, timeSlot] = value.split('|');
    setForm({ ...form, schedule_id: scheduleId, time_slot: timeSlot });
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
      setSlots([]);
      setShowForm(false);
      setNotice('Appointment booked.');
      loadAppointments();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not book this appointment.');
    }
  }

  async function handleBillVisit(a) {
    if (!window.confirm(
      `Bill this visit for ${a.patient_name}? The consultation fee and any lab tests from that day will be added.`
    )) return;
    try {
      setError('');
      const res = await billVisit(a.appt_id);
      const b = res.data;
      setNotice(
        `Visit billed on B-${String(b.bill_id).padStart(3, '0')} for ${b.patient_name} — ` +
        `${b.items.length} item(s), total \u09F3${Number(b.total_amount).toLocaleString('en-IN')}.`
      );
      loadAppointments();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not bill this visit.');
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

  const slotHint = () => {
    if (!form.doctor_id) return 'Choose a doctor first';
    if (!form.appt_date) return 'Choose a date first';
    if (slotsLoading)    return 'Checking the schedule\u2026';
    if (slots.length === 0) return 'No free slots that day';
    return 'Choose a slot';
  };

  return (
    <div>
      <div className="page-top">
        <h2>Appointments</h2>
        <span className="count">
          {loading ? '\u2014' : `${appts.length} appointment${appts.length === 1 ? '' : 's'}`}
          {(filterDate || filterStatus) && ' matching'}
        </span>
      </div>

      <div className="toolbar">
        <input className="search" type="date" value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)} />
        <select className="search" style={{ flex: '0 0 170px' }}
          value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
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
                onChange={(e) => setForm({ ...form, doctor_id: e.target.value })}>
                <option value="">Choose a doctor</option>
                {doctors.map((d) => (
                  <option key={d.doctor_id} value={d.doctor_id}>
                    {d.name} &middot; {d.dept_name}
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
              Available slot
              <select
                value={form.time_slot ? `${form.schedule_id}|${form.time_slot}` : ''}
                disabled={slots.length === 0}
                onChange={(e) => pickSlot(e.target.value)}>
                <option value="">{slotHint()}</option>
                {slots.map((s) => (
                  <option key={`${s.schedule_id}-${s.slot_time}`}
                    value={`${s.schedule_id}|${s.slot_time}`}>
                    {prettyTime(s.slot_time)}
                    {s.chamber_no ? ` \u00b7 ${s.chamber_no}` : ''}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {form.doctor_id && form.appt_date && !slotsLoading && slots.length === 0 && (
            <p className="gate-note">
              This doctor has no active chamber hours on that day, or every
              slot is already taken. Try another date.
            </p>
          )}

          <div className="form-actions">
            <button className="btn"
              onClick={() => { setShowForm(false); setForm(emptyForm); setSlots([]); }}>
              Cancel
            </button>
            <button className="btn primary" onClick={handleBook}>
              Book appointment
            </button>
          </div>
        </div>
      )}

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
                    ) : a.status === 'Completed' && canBill ? (
                      <button className="btn sm" onClick={() => handleBillVisit(a)}>
                        Bill visit
                      </button>
                    ) : (
                      <span className="sub">&mdash;</span>
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