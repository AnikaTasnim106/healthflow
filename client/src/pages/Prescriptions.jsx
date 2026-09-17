import { useState, useEffect } from 'react';
import { useAuth } from '../auth';
import {
  getPatients, getAppointments, getMedicines, createMedicine,
  getPatientPrescriptions, getPrescription, createPrescription,
} from '../api';

const prettyDate = (d) => {
  if (!d) return '\u2014';
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
};

export default function Prescriptions() {
  const { user } = useAuth();
  const canWrite = user.role === 'doctor' || user.role === 'admin';

  const [patients, setPatients]   = useState([]);
  const [medicines, setMedicines] = useState([]);

  const [patientId, setPatientId] = useState('');
  const [list, setList]           = useState([]);
  const [appts, setAppts]         = useState([]);

  const [openId, setOpenId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [notice, setNotice]   = useState('');
  const [showForm, setShowForm] = useState(false);

  const emptyRow = { med_id: '', typed: '', newPrice: '', dosage: '', frequency: '', duration: '' };
  const emptyForm = { appt_id: '', diagnosis: '', medicines: [{ ...emptyRow }] };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    getPatients('').then((r) => setPatients(r.data)).catch(() => {});
    loadMedicines();
  }, []);

  useEffect(() => {
    if (!patientId) { setList([]); setAppts([]); return; }
    loadForPatient();
  }, [patientId]);

  async function loadMedicines() {
    try {
      const r = await getMedicines('');
      setMedicines(r.data);
    } catch {
      console.warn('Medicines endpoint not available');
    }
  }

  async function loadForPatient() {
    try {
      setLoading(true);
      setError('');
      setOpenId(null);
      setDetail(null);

      const [pr, ap] = await Promise.all([
        getPatientPrescriptions(patientId),
        getAppointments({}),
      ]);
      setList(pr.data);
      setAppts(ap.data.filter((a) => String(a.patient_id) === String(patientId)));
    } catch (err) {
      setError('Could not load prescriptions for this patient.');
    } finally {
      setLoading(false);
    }
  }

  async function toggleDetail(id) {
    if (openId === id) { setOpenId(null); setDetail(null); return; }
    setOpenId(id);
    setDetail(null);
    try {
      setDetailLoading(true);
      const res = await getPrescription(id);
      setDetail(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load this prescription.');
    } finally {
      setDetailLoading(false);
    }
  }

  const addMedRow = () =>
    setForm({ ...form, medicines: [...form.medicines, { ...emptyRow }] });

  const removeMedRow = (i) =>
    setForm({ ...form, medicines: form.medicines.filter((_, idx) => idx !== i) });

  const setMed = (i, patch) => {
    const meds = [...form.medicines];
    meds[i] = { ...meds[i], ...patch };
    setForm({ ...form, medicines: meds });
  };

  function onTypeMedicine(i, value) {
    const match = medicines.find(
      (m) => m.name.toLowerCase() === value.trim().toLowerCase()
    );
    setMed(i, { typed: value, med_id: match ? String(match.med_id) : '' });
  }

  async function addToCatalog(i) {
    const row = form.medicines[i];
    const name = row.typed.trim();
    if (!name) { setError('Type a medicine name first.'); return; }

    try {
      setError('');
      const res = await createMedicine({
        name,
        unit_price: row.newPrice || 0,
        stock_qty: 0,
      });
      const created = res.data;
      setMedicines([...medicines, created].sort((a, b) => a.name.localeCompare(b.name)));
      setMed(i, { med_id: String(created.med_id), typed: created.name, newPrice: '' });
      setNotice(`${created.name} added to the catalog. The pharmacy still has to stock it.`);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not add this medicine to the catalog.');
    }
  }

  async function handleCreate() {
    if (!form.appt_id) {
      setError('Choose the appointment this prescription belongs to.');
      return;
    }

    const unknown = form.medicines.find((m) => m.typed.trim() && !m.med_id);
    if (unknown) {
      setError(`"${unknown.typed.trim()}" is not in the catalog yet — add it first.`);
      return;
    }

    const meds = form.medicines
      .filter((m) => m.med_id && m.dosage.trim() && m.frequency.trim() && m.duration.trim())
      .map((m) => ({
        med_id: Number(m.med_id),
        dosage: m.dosage.trim(),
        frequency: m.frequency.trim(),
        duration: m.duration.trim(),
      }));

    if (meds.length === 0) {
      setError('Add at least one medicine with dosage, frequency and duration.');
      return;
    }

    try {
      setError('');
      await createPrescription({
        appt_id: Number(form.appt_id),
        diagnosis: form.diagnosis.trim() || null,
        medicines: meds,
      });
      setForm(emptyForm);
      setShowForm(false);
      setNotice('Prescription saved.');
      loadForPatient();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save this prescription.');
    }
  }

  return (
    <div>
      <div className="page-top">
        <h2>Prescriptions</h2>
        <span className="count">
          {patientId ? (loading ? '\u2014' : `${list.length} on record`) : 'Select a patient'}
        </span>
      </div>

      <div className="toolbar">
        <select className="search" value={patientId}
          onChange={(e) => { setPatientId(e.target.value); setShowForm(false); }}>
          <option value="">Choose a patient</option>
          {patients.map((p) => (
            <option key={p.patient_id} value={p.patient_id}>{p.name}</option>
          ))}
        </select>
        {canWrite && (
          <button className="btn primary"
            onClick={() => setShowForm(!showForm)}
            disabled={!patientId}>
            {showForm ? 'Close' : 'Write prescription'}
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
          <div className="form-title">Write a prescription</div>

          <div className="fields">
            <label>
              Appointment
              <select value={form.appt_id}
                onChange={(e) => setForm({ ...form, appt_id: e.target.value })}>
                <option value="">Choose an appointment</option>
                {appts.map((a) => (
                  <option key={a.appt_id} value={a.appt_id}>
                    {prettyDate(a.appt_date)} &middot; {a.doctor_name} &middot; {a.status}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ gridColumn: 'span 2' }}>
              Diagnosis
              <input value={form.diagnosis}
                placeholder="Hypertension with mild LV hypertrophy"
                onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} />
            </label>
          </div>

          <div className="form-title" style={{ marginTop: 20 }}>
            Medicines &mdash; dosage, frequency and duration
          </div>

          <datalist id="medicine-options">
            {medicines.map((m) => (
              <option key={m.med_id} value={m.name} />
            ))}
          </datalist>

          {form.medicines.map((m, i) => {
            const typed = m.typed.trim();
            const isNew = typed && !m.med_id;

            return (
              <div key={i}>
                <div className="med-row">
                  <span className="item-no">{i + 1}</span>
                  <input
                    list="medicine-options"
                    placeholder="Type or pick a medicine"
                    value={m.typed}
                    onChange={(e) => onTypeMedicine(i, e.target.value)}
                  />
                  <input placeholder="Dosage (500mg)" value={m.dosage}
                    onChange={(e) => setMed(i, { dosage: e.target.value })} />
                  <input placeholder="Frequency (1+0+1)" value={m.frequency}
                    onChange={(e) => setMed(i, { frequency: e.target.value })} />
                  <input placeholder="Duration (7 days)" value={m.duration}
                    onChange={(e) => setMed(i, { duration: e.target.value })} />
                  <button className="btn ghost sm"
                    disabled={form.medicines.length === 1}
                    onClick={() => removeMedRow(i)}>
                    Remove
                  </button>
                </div>

                {isNew && (
                  <div className="pay-form" style={{ margin: '0 0 12px 34px' }}>
                    <span className="sub" style={{ alignSelf: 'center' }}>
                      &ldquo;{typed}&rdquo; is not in the catalog
                    </span>
                    <input type="number" min="0" step="0.01"
                      placeholder="Unit price"
                      style={{ maxWidth: 130 }}
                      value={m.newPrice}
                      onChange={(e) => setMed(i, { newPrice: e.target.value })} />
                    <button className="btn sm" onClick={() => addToCatalog(i)}>
                      Add to catalog
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          <div className="item-foot">
            <button className="btn sm" onClick={addMedRow}>+ Add medicine</button>
            <span className="item-total">
              {form.medicines.length} medicine{form.medicines.length === 1 ? '' : 's'}
            </span>
          </div>

          <p className="gate-note">
            A medicine that is not in the catalog can be added right here. It
            starts with zero stock, so the patient buys it outside until the
            pharmacy stocks it.
          </p>

          <div className="form-actions">
            <button className="btn"
              onClick={() => { setShowForm(false); setForm(emptyForm); }}>
              Cancel
            </button>
            <button className="btn primary" onClick={handleCreate}>
              Save prescription
            </button>
          </div>
        </div>
      )}

      {!patientId ? (
        <div className="empty">
          <p>No patient selected.</p>
          <p className="hint">Pick a patient above to see everything prescribed to them.</p>
        </div>
      ) : loading ? (
        <div className="loading">Loading prescriptions</div>
      ) : list.length === 0 ? (
        <div className="empty">
          <p>No prescriptions on record for this patient.</p>
          <p className="hint">Write one against a completed appointment.</p>
        </div>
      ) : (
        <div className="records">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Date</th>
                <th>Prescribed by</th>
                <th>Diagnosis</th>
                <th className="right"></th>
              </tr>
            </thead>
            <tbody>
              {list.map((pr) => (
                <tr key={pr.presc_id}
                    style={openId === pr.presc_id ? { background: '#f2f6f7' } : undefined}>
                  <td><span className="id">RX-{String(pr.presc_id).padStart(3, '0')}</span></td>
                  <td><span className="data">{prettyDate(pr.presc_date)}</span></td>
                  <td><span className="name">{pr.doctor_name}</span></td>
                  <td>{pr.diagnosis || <span className="sub">Not recorded</span>}</td>
                  <td className="right">
                    <button className="btn sm" onClick={() => toggleDetail(pr.presc_id)}>
                      {openId === pr.presc_id ? 'Hide' : 'Open'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {openId && (
        <div className="form" style={{ marginTop: 18 }}>
          {detailLoading || !detail ? (
            <div className="loading">Loading prescription</div>
          ) : (
            <>
              <div className="form-title">
                RX-{String(detail.presc_id).padStart(3, '0')} &middot;{' '}
                {detail.patient_name} &middot; {prettyDate(detail.presc_date)}
              </div>

              <p style={{ margin: '0 0 16px', fontSize: 14 }}>
                <span className="sub">Diagnosis</span><br />
                {detail.diagnosis || 'Not recorded'}
              </p>

              <table className="mini">
                <thead>
                  <tr>
                    <th>Medicine</th>
                    <th>Dosage</th>
                    <th>Frequency</th>
                    <th>Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.medicines.map((m) => (
                    <tr key={m.med_id}>
                      <td><span className="name">{m.name}</span></td>
                      <td><span className="data">{m.dosage}</span></td>
                      <td><span className="data">{m.frequency}</span></td>
                      <td><span className="data">{m.duration}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
    </div>
  );
}