// ============================================================
//  Billing.jsx
//
//  Ei page ta duita jinis extra kore:
//
//  1. Ekta bill row e click korle DETAIL khule — bill_item ar
//     payment list ashe. bill_item amader WEAK ENTITY, tar
//     partial key item_no ekhane dekha jay.
//  2. Notun bill banate ekadhik item line add kora jay. Backend
//     e oita ekta TRANSACTION e insert hoy — bill + sob item
//     ekshathe, ekta fail korle sob rollback.
// ============================================================

import { useState, useEffect, Fragment } from 'react';
import { getBills, getBill, createBill, addPayment, getPatients } from '../api';

const taka = (n) => `\u09F3${Number(n || 0).toLocaleString('en-IN')}`;

const prettyDate = (d) => {
  if (!d) return '\u2014';
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
};

const stampOf = (status) => {
  if (status === 'Paid') return 'clear';
  if (status === 'Partial') return 'hold';
  return 'flag';                      // Unpaid
};

export default function Billing() {
  const [bills, setBills]       = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [onlyDue, setOnlyDue]   = useState(false);

  // kon bill ta khola ache + tar detail
  const [openId, setOpenId]   = useState(null);
  const [detail, setDetail]   = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // payment form
  const [payForm, setPayForm] = useState({ method: 'Cash', paid_amount: '' });

  // notun bill form
  const [showForm, setShowForm] = useState(false);
  const emptyForm = {
    patient_id: '',
    items: [{ description: '', amount: '' }],
  };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { loadBills(); }, []);
  useEffect(() => {
    getPatients('').then((r) => setPatients(r.data)).catch(() => {});
  }, []);

  async function loadBills() {
    try {
      setLoading(true);
      setError('');
      const res = await getBills();
      setBills(res.data);
    } catch (err) {
      setError('Could not reach the server. Check that the backend is running on port 5000.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // row e click korle detail ane (ba bondho kore)
  async function toggleDetail(id) {
    if (openId === id) { setOpenId(null); setDetail(null); return; }
    setOpenId(id);
    setDetail(null);
    setPayForm({ method: 'Cash', paid_amount: '' });
    try {
      setDetailLoading(true);
      const res = await getBill(id);
      setDetail(res.data);
    } catch (err) {
      setError('Could not load the bill details.');
    } finally {
      setDetailLoading(false);
    }
  }

  async function handlePayment(billId) {
    const amount = Number(payForm.paid_amount);
    if (!amount || amount <= 0) { setError('Enter a payment amount.'); return; }
    try {
      setError('');
      await addPayment(billId, { method: payForm.method, paid_amount: amount });
      setPayForm({ method: 'Cash', paid_amount: '' });
      const res = await getBill(billId);   // detail refresh
      setDetail(res.data);
      loadBills();                          // list e status/due refresh
    } catch (err) {
      setError(err.response?.data?.error || 'Could not record this payment.');
    }
  }

  // ---------- notun bill er item line ----------
  const addItemRow = () =>
    setForm({ ...form, items: [...form.items, { description: '', amount: '' }] });

  const removeItemRow = (i) =>
    setForm({ ...form, items: form.items.filter((_, idx) => idx !== i) });

  const setItem = (i, key, value) => {
    const items = [...form.items];
    items[i] = { ...items[i], [key]: value };
    setForm({ ...form, items });
  };

  const formTotal = form.items.reduce((sum, it) => sum + (Number(it.amount) || 0), 0);

  async function handleCreate() {
    if (!form.patient_id) { setError('Choose a patient.'); return; }
    const items = form.items
      .filter((it) => it.description.trim() && Number(it.amount) > 0)
      .map((it) => ({ description: it.description.trim(), amount: Number(it.amount) }));

    if (items.length === 0) { setError('Add at least one line item.'); return; }

    try {
      setError('');
      await createBill({ patient_id: Number(form.patient_id), items });
      setForm(emptyForm);
      setShowForm(false);
      loadBills();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create this bill.');
    }
  }

  const shown = onlyDue ? bills.filter((b) => b.pay_status !== 'Paid') : bills;

  return (
    <div>
      <div className="page-top">
        <h2>Billing</h2>
        <span className="count">
          {loading ? '\u2014' : `${shown.length} bill${shown.length === 1 ? '' : 's'}`}
          {onlyDue && ' outstanding'}
        </span>
      </div>

      <div className="toolbar">
        <span style={{ flex: 1 }} />
        <button className={onlyDue ? 'btn primary' : 'btn'}
          onClick={() => setOnlyDue(!onlyDue)}>
          {onlyDue ? 'Showing due only' : 'Show due only'}
        </button>
        <button className="btn primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Close' : 'New bill'}
        </button>
      </div>

      {error && (
        <div className="alert">
          <span>{error}</span>
          <button className="x" onClick={() => setError('')}>Dismiss</button>
        </div>
      )}

      {/* ---------- new bill form ---------- */}
      {showForm && (
        <div className="form">
          <div className="form-title">New bill</div>

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
          </div>

          <div className="form-title" style={{ marginTop: 20 }}>Line items</div>

          {form.items.map((it, i) => (
            <div key={i} className="item-row">
              <span className="item-no">{i + 1}</span>
              <input
                placeholder="Description (e.g. Room charge, 4 days)"
                value={it.description}
                onChange={(e) => setItem(i, 'description', e.target.value)}
              />
              <input
                type="number" min="0" placeholder="Amount"
                value={it.amount}
                onChange={(e) => setItem(i, 'amount', e.target.value)}
              />
              <button className="btn ghost sm"
                disabled={form.items.length === 1}
                onClick={() => removeItemRow(i)}>
                Remove
              </button>
            </div>
          ))}

          <div className="item-foot">
            <button className="btn sm" onClick={addItemRow}>+ Add line</button>
            <span className="item-total">
              Total <strong className="amount">{taka(formTotal)}</strong>
            </span>
          </div>

          <div className="form-actions">
            <button className="btn"
              onClick={() => { setShowForm(false); setForm(emptyForm); }}>
              Cancel
            </button>
            <button className="btn primary" onClick={handleCreate}>Create bill</button>
          </div>
        </div>
      )}

      {/* ---------- list ---------- */}
      {loading ? (
        <div className="loading">Loading bills</div>
      ) : shown.length === 0 ? (
        <div className="empty">
          <p>{onlyDue ? 'No outstanding bills.' : 'No bills issued.'}</p>
          <p className="hint">
            {onlyDue ? 'Everything is settled.' : 'Create the first bill to get started.'}
          </p>
        </div>
      ) : (
        <div className="records">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Patient</th>
                <th>Issued</th>
                <th className="right">Total</th>
                <th className="right">Paid</th>
                <th className="right">Due</th>
                <th>Status</th>
                <th className="right"></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((b) => (
                <Fragment key={b.bill_id}>
                  <tr>
                    <td><span className="id">B-{String(b.bill_id).padStart(3, '0')}</span></td>
                    <td><span className="name">{b.patient_name}</span></td>
                    <td><span className="data">{prettyDate(b.issue_date)}</span></td>
                    <td className="right"><span className="amount">{taka(b.total_amount)}</span></td>
                    <td className="right"><span className="amount">{taka(b.amount_paid)}</span></td>
                    <td className="right">
                      <span className="amount"
                        style={{ color: Number(b.due) > 0 ? 'var(--flag)' : 'var(--ink-soft)' }}>
                        {taka(b.due)}
                      </span>
                    </td>
                    <td><span className={`stamp ${stampOf(b.pay_status)}`}>{b.pay_status}</span></td>
                    <td className="right">
                      <button className="btn sm" onClick={() => toggleDetail(b.bill_id)}>
                        {openId === b.bill_id ? 'Hide' : 'Details'}
                      </button>
                    </td>
                  </tr>

                  {/* ---------- expanded detail ---------- */}
                  {openId === b.bill_id && (
                    <tr className="detail-row">
                      <td colSpan={8}>
                        {detailLoading || !detail ? (
                          <div className="loading">Loading details</div>
                        ) : (
                          <div className="detail">
                            {/* bill_item — WEAK ENTITY.
                                item_no shudhu ei bill er moddhe unique. */}
                            <div className="detail-block">
                              <div className="detail-head">Line items</div>
                              <table className="mini">
                                <thead>
                                  <tr>
                                    <th>Item no</th>
                                    <th>Description</th>
                                    <th className="right">Amount</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {detail.items.map((it) => (
                                    <tr key={it.item_no}>
                                      <td><span className="id">{it.item_no}</span></td>
                                      <td>{it.description}</td>
                                      <td className="right">
                                        <span className="amount">{taka(it.amount)}</span>
                                      </td>
                                    </tr>
                                  ))}
                                  <tr className="mini-total">
                                    <td colSpan={2}>Total</td>
                                    <td className="right">
                                      <span className="amount">{taka(detail.total_amount)}</span>
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>

                            <div className="detail-block">
                              <div className="detail-head">Payments</div>
                              {detail.payments.length === 0 ? (
                                <p className="sub">No payments recorded yet.</p>
                              ) : (
                                <table className="mini">
                                  <thead>
                                    <tr>
                                      <th>Date</th>
                                      <th>Method</th>
                                      <th className="right">Amount</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {detail.payments.map((p) => (
                                      <tr key={p.payment_id}>
                                        <td><span className="data">{prettyDate(p.pay_date)}</span></td>
                                        <td><span className="stamp mute">{p.method}</span></td>
                                        <td className="right">
                                          <span className="amount">{taka(p.paid_amount)}</span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}

                              {/* payment add — backend e transaction e
                                  payment insert + pay_status recalculate hoy */}
                              {detail.pay_status !== 'Paid' && (
                                <div className="pay-form">
                                  <select value={payForm.method}
                                    onChange={(e) => setPayForm({ ...payForm, method: e.target.value })}>
                                    {['Cash', 'Card', 'bKash', 'Nagad', 'Bank'].map((m) => (
                                      <option key={m} value={m}>{m}</option>
                                    ))}
                                  </select>
                                  <input type="number" min="1" placeholder="Amount"
                                    value={payForm.paid_amount}
                                    onChange={(e) => setPayForm({ ...payForm, paid_amount: e.target.value })}
                                  />
                                  <button className="btn primary sm"
                                    onClick={() => handlePayment(b.bill_id)}>
                                    Record payment
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}