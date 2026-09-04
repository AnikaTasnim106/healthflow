// ============================================================
//  MyRecords.jsx
//  Patient role er landing page.
//
//  Ei page ta shudhu req.user er nijer patient_id diye request
//  kore. Kintu asol suraksha ekhane na — backend er
//  requireOwnPatient middleware e. Keu URL palte onno kono id
//  chaileo server 403 dibe.
// ============================================================

import { useState, useEffect } from 'react';
import { useAuth } from '../auth';
import {
  getPatient, getPatientPrescriptions, getPatientTests, getBills,
} from '../api';

const taka = (n) => `\u09F3${Number(n || 0).toLocaleString('en-IN')}`;

const prettyDate = (d) => {
  if (!d) return '\u2014';
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
};

const apptStamp = (s) => {
  if (s === 'Completed') return 'clear';
  if (s === 'Scheduled') return 'hold';
  if (s === 'Cancelled') return 'flag';
  return 'mute';
};

const billStamp = (s) => {
  if (s === 'Paid') return 'clear';
  if (s === 'Partial') return 'hold';
  return 'flag';
};

export default function MyRecords() {
  const { user } = useAuth();

  const [profile, setProfile] = useState(null);
  const [prescriptions, setPrescriptions] = useState([]);
  const [tests, setTests] = useState([]);
  const [bills, setBills] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { loadMine(); }, [user?.patient_id]);

  async function loadMine() {
    if (!user?.patient_id) {
      setError('This account is not linked to a patient record.');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError('');
      const id = user.patient_id;

      // Promise.allSettled — ekta endpoint fail korleo baki gulo dekhabe
      const [p, pr, t, b] = await Promise.allSettled([
        getPatient(id),
        getPatientPrescriptions(id),
        getPatientTests(id),
        getBills(),
      ]);

      if (p.status === 'fulfilled')  setProfile(p.value.data);
      if (pr.status === 'fulfilled') setPrescriptions(pr.value.data);
      if (t.status === 'fulfilled')  setTests(t.value.data);
      if (b.status === 'fulfilled')  setBills(b.value.data);

      if (p.status === 'rejected') {
        setError('Could not load your record.');
      }
    } catch (err) {
      setError('Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }

  const appointments = profile?.appointments || [];

  if (loading) return <div className="loading">Loading your records</div>;

  return (
    <div>
      <div className="page-top">
        <h2>My Records</h2>
        <span className="count">
          {profile ? `P-${String(profile.patient_id).padStart(3, '0')}` : '\u2014'}
        </span>
      </div>

      {error && (
        <div className="alert">
          <span>{error}</span>
          <button className="x" onClick={() => setError('')}>Dismiss</button>
        </div>
      )}

      {/* ---------- profile ---------- */}
      {profile && (
        <div className="form" style={{ marginBottom: 22 }}>
          <div className="form-title">Personal details</div>
          <div className="mine-grid">
            <div><span className="sub">Name</span><div className="name">{profile.name}</div></div>
            <div><span className="sub">Blood group</span>
              <div><span className="blood">{profile.blood_group || '\u2014'}</span></div></div>
            <div><span className="sub">Phone</span>
              <div className="data">{profile.phone || '\u2014'}</div></div>
            <div><span className="sub">Address</span>
              <div>{profile.address || '\u2014'}</div></div>
          </div>
        </div>
      )}

      {/* ---------- appointments ---------- */}
      <div className="form" style={{ marginBottom: 22 }}>
        <div className="form-title">Appointments</div>
        {appointments.length === 0 ? (
          <p className="sub">No appointments on record.</p>
        ) : (
          <table className="mini">
            <thead>
              <tr><th>Date</th><th>Doctor</th><th>Department</th><th>Status</th></tr>
            </thead>
            <tbody>
              {appointments.map((a) => (
                <tr key={a.appt_id}>
                  <td><span className="data">{prettyDate(a.appt_date)}</span></td>
                  <td>{a.doctor_name}</td>
                  <td>{a.dept_name}</td>
                  <td><span className={`stamp ${apptStamp(a.status)}`}>{a.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ---------- prescriptions ---------- */}
      <div className="form" style={{ marginBottom: 22 }}>
        <div className="form-title">Prescriptions</div>
        {prescriptions.length === 0 ? (
          <p className="sub">No prescriptions on record.</p>
        ) : (
          <table className="mini">
            <thead>
              <tr><th>Date</th><th>Prescribed by</th><th>Diagnosis</th></tr>
            </thead>
            <tbody>
              {prescriptions.map((pr) => (
                <tr key={pr.presc_id}>
                  <td><span className="data">{prettyDate(pr.presc_date)}</span></td>
                  <td>{pr.doctor_name}</td>
                  <td>{pr.diagnosis || <span className="sub">Not recorded</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ---------- lab tests ---------- */}
      <div className="form" style={{ marginBottom: 22 }}>
        <div className="form-title">Lab tests</div>
        {tests.length === 0 ? (
          <p className="sub">No lab tests on record.</p>
        ) : (
          <table className="mini">
            <thead>
              <tr><th>Test</th><th>Date</th><th>Result</th></tr>
            </thead>
            <tbody>
              {tests.map((t) => (
                <tr key={`${t.test_id}-${t.test_date}`}>
                  <td><span className="name">{t.test_name}</span></td>
                  <td><span className="data">{prettyDate(t.test_date)}</span></td>
                  <td>{t.result || <span className="stamp hold">Awaiting</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ---------- bills ---------- */}
      <div className="form">
        <div className="form-title">Bills</div>
        {bills.length === 0 ? (
          <p className="sub">No bills on record.</p>
        ) : (
          <table className="mini">
            <thead>
              <tr>
                <th>Issued</th>
                <th className="right">Total</th>
                <th className="right">Due</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {bills.map((b) => (
                <tr key={b.bill_id}>
                  <td><span className="data">{prettyDate(b.issue_date)}</span></td>
                  <td className="right"><span className="amount">{taka(b.total_amount)}</span></td>
                  <td className="right"><span className="amount">{taka(b.due)}</span></td>
                  <td><span className={`stamp ${billStamp(b.pay_status)}`}>{b.pay_status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}