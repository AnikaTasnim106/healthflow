// ============================================================
//  LabTests.jsx
//
//  Ei page ta patient_test table er upor kaj kore — jeta amader
//  M:N junction table (patient <-> lab_test), ar tar PK holo
//  (patient_id, test_id, test_date) — teen ta column mile.
//
//  Ei jonno result add korte tin tai lagbe, shudhu ekta id na.
//
//  Duita view:
//    Pending  — jei test er result ekhono ashe nai
//    History  — ek patient er sob test, result shoho
// ============================================================

import { useState, useEffect } from 'react';
import {
  getPendingTests, getTestCatalog, getPatientTests,
  assignTest, addTestResult, getPatients, getDoctors,
} from '../api';

const taka = (n) => `\u09F3${Number(n || 0).toLocaleString('en-IN')}`;

const prettyDate = (d) => {
  if (!d) return '\u2014';
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
};

// PATCH er URL e date lage — '2026-07-04' format e
const isoDate = (d) => new Date(d).toISOString().slice(0, 10);

export default function LabTests() {
  const [view, setView] = useState('pending');       // 'pending' | 'history'

  const [pending, setPending]   = useState([]);
  const [catalog, setCatalog]   = useState([]);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors]   = useState([]);

  const [historyId, setHistoryId] = useState('');
  const [history, setHistory]     = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [notice, setNotice]   = useState('');
  const [showForm, setShowForm] = useState(false);

  // kon row e result likha hocche + ki likha hocche
  const [editKey, setEditKey]   = useState(null);
  const [resultText, setResultText] = useState('');

  const emptyForm = { patient_id: '', test_id: '', doctor_id: '', test_date: '' };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { loadAll(); }, []);

  // patient select korle tar history ane
  useEffect(() => {
    if (!historyId) { setHistory([]); return; }
    getPatientTests(historyId)
      .then((r) => setHistory(r.data))
      .catch(() => setHistory([]));
  }, [historyId]);

  async function loadAll() {
    try {
      setLoading(true);
      setError('');
      const [pe, c, p, d] = await Promise.all([
        getPendingTests(), getTestCatalog(), getPatients(''), getDoctors(),
      ]);
      setPending(pe.data);
      setCatalog(c.data);
      setPatients(p.data);
      setDoctors(d.data);
    } catch (err) {
      setError('Could not reach the server. Check that the backend is running on port 5000.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAssign() {
    if (!form.patient_id) { setError('Choose a patient.'); return; }
    if (!form.test_id)    { setError('Choose a test.'); return; }
    try {
      setError('');
      await assignTest({
        patient_id: Number(form.patient_id),
        test_id: Number(form.test_id),
        doctor_id: form.doctor_id ? Number(form.doctor_id) : null,
        test_date: form.test_date || null,
      });
      setForm(emptyForm);
      setShowForm(false);
      setNotice('Test ordered.');
      loadAll();
    } catch (err) {
      // 409 = eki patient, eki test, eki date already ache (composite PK)
      setError(err.response?.data?.error || 'Could not order this test.');
    }
  }

  async function handleSaveResult(row) {
    if (!resultText.trim()) { setError('Enter a result.'); return; }
    try {
      setError('');
      await addTestResult(
        row.patient_id, row.test_id, isoDate(row.test_date), resultText.trim()
      );
      setEditKey(null);
      setResultText('');
      setNotice('Result recorded.');
      loadAll();
      if (historyId) {
        const r = await getPatientTests(historyId);
        setHistory(r.data);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save this result.');
    }
  }

  const rowKey = (r) => `${r.patient_id}-${r.test_id}-${isoDate(r.test_date)}`;

  return (
    <div>
      <div className="page-top">
        <h2>Lab Tests</h2>
        <span className="count">
          {loading ? '\u2014' : `${pending.length} awaiting result${pending.length === 1 ? '' : 's'}`}
        </span>
      </div>

      <div className="toolbar">
        <button className={view === 'pending' ? 'btn primary' : 'btn'}
          onClick={() => setView('pending')}>
          Pending
        </button>
        <button className={view === 'history' ? 'btn primary' : 'btn'}
          onClick={() => setView('history')}>
          Patient history
        </button>
        <span style={{ flex: 1 }} />
        <button className="btn primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Close' : 'Order a test'}
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

      {/* ---------- order form ---------- */}
      {showForm && (
        <div className="form">
          <div className="form-title">Order a lab test</div>
          <div className="fields">
            <label>
              Patient
              <select value={form.patient_id}
                onChange={(e) => setForm({ ...form, patient_id: e.target.value })}>
                <option value="">Choose a patient</option>
                {patients.map((p) => (
                  <option key={p.patient_id} value={p.patient_id}>{p.name}</option>
                ))}
              </select>
            </label>

            <label>
              Test
              <select value={form.test_id}
                onChange={(e) => setForm({ ...form, test_id: e.target.value })}>
                <option value="">Choose a test</option>
                {catalog.map((t) => (
                  <option key={t.test_id} value={t.test_id}>
                    {t.test_name} &middot; {taka(t.cost)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Suggested by
              <select value={form.doctor_id}
                onChange={(e) => setForm({ ...form, doctor_id: e.target.value })}>
                <option value="">Not specified</option>
                {doctors.map((d) => (
                  <option key={d.doctor_id} value={d.doctor_id}>{d.name}</option>
                ))}
              </select>
            </label>

            <label>
              Test date
              <input type="date" value={form.test_date}
                onChange={(e) => setForm({ ...form, test_date: e.target.value })} />
            </label>
          </div>

          <div className="form-actions">
            <button className="btn"
              onClick={() => { setShowForm(false); setForm(emptyForm); }}>
              Cancel
            </button>
            <button className="btn primary" onClick={handleAssign}>Order test</button>
          </div>
        </div>
      )}

      {/* ---------- PENDING ---------- */}
      {view === 'pending' && (
        loading ? (
          <div className="loading">Loading pending tests</div>
        ) : pending.length === 0 ? (
          <div className="empty">
            <p>No tests awaiting results.</p>
            <p className="hint">Every ordered test has a result recorded.</p>
          </div>
        ) : (
          <div className="records">
            <table className="table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Test</th>
                  <th>Ordered</th>
                  <th>Suggested by</th>
                  <th className="right">Result</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((r) => {
                  const key = rowKey(r);
                  const editing = editKey === key;
                  return (
                    <tr key={key}>
                      <td><span className="name">{r.patient_name}</span></td>
                      <td>{r.test_name}</td>
                      <td><span className="data">{prettyDate(r.test_date)}</span></td>
                      <td><span className="sub">{r.suggested_by || '\u2014'}</span></td>
                      <td className="right">
                        {editing ? (
                          <div className="pay-form" style={{ justifyContent: 'flex-end' }}>
                            <input
                              autoFocus
                              placeholder="e.g. Hb 11.8 g/dL, WBC normal"
                              value={resultText}
                              onChange={(e) => setResultText(e.target.value)}
                              style={{ minWidth: 220 }}
                            />
                            <button className="btn primary sm"
                              onClick={() => handleSaveResult(r)}>Save</button>
                            <button className="btn ghost sm"
                              onClick={() => { setEditKey(null); setResultText(''); }}>
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button className="btn sm"
                            onClick={() => { setEditKey(key); setResultText(''); }}>
                            Add result
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* ---------- HISTORY ---------- */}
      {view === 'history' && (
        <>
          <div className="toolbar">
            <select className="search" value={historyId}
              onChange={(e) => setHistoryId(e.target.value)}>
              <option value="">Choose a patient to see their test history</option>
              {patients.map((p) => (
                <option key={p.patient_id} value={p.patient_id}>{p.name}</option>
              ))}
            </select>
          </div>

          {!historyId ? (
            <div className="empty">
              <p>No patient selected.</p>
              <p className="hint">Pick a patient above to see every test they have had.</p>
            </div>
          ) : history.length === 0 ? (
            <div className="empty">
              <p>No tests on record for this patient.</p>
              <p className="hint">Order a test to start their history.</p>
            </div>
          ) : (
            <div className="records">
              <table className="table">
                <thead>
                  <tr>
                    <th>Test</th>
                    <th>Date</th>
                    <th>Suggested by</th>
                    <th>Result</th>
                    <th className="right">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={`${h.test_id}-${isoDate(h.test_date)}`}>
                      <td><span className="name">{h.test_name}</span></td>
                      <td><span className="data">{prettyDate(h.test_date)}</span></td>
                      <td><span className="sub">{h.suggested_by || '\u2014'}</span></td>
                      <td>
                        {h.result
                          ? h.result
                          : <span className="stamp hold">Awaiting</span>}
                      </td>
                      <td className="right"><span className="amount">{taka(h.cost)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}