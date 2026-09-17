import { useState, useEffect } from 'react';
import { getPharmacyQueue, dispenseMedicines, getPatients } from '../api';

const taka = (n) => `\u09F3${Number(n || 0).toLocaleString('en-IN')}`;

const prettyDate = (d) => {
  if (!d) return '\u2014';
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
};

function suggestQty(frequency, duration) {
  const perDay = String(frequency || '')
    .split('+')
    .map((x) => Number(x.trim()))
    .filter((x) => !Number.isNaN(x))
    .reduce((a, b) => a + b, 0);

  const days = Number(String(duration || '').match(/\d+/)?.[0] || 0);

  if (!perDay || !days) return '';
  return String(perDay * days);
}

export default function Pharmacy() {
  const [lines, setLines]       = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [notice, setNotice]     = useState('');

  const [patientId, setPatientId] = useState('');
  const [showAll, setShowAll]     = useState(false);

  const [openPresc, setOpenPresc] = useState(null);
  const [qty, setQty]             = useState({});
  const [charge, setCharge]       = useState(true);
  const [busy, setBusy]           = useState(false);

  useEffect(() => { loadQueue(); }, [patientId, showAll]);
  useEffect(() => {
    getPatients('').then((r) => setPatients(r.data)).catch(() => {});
  }, []);

  async function loadQueue() {
    try {
      setLoading(true);
      setError('');
      const res = await getPharmacyQueue({
        patient_id: patientId || undefined,
        pending: showAll ? 'false' : undefined,
      });
      setLines(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load the pharmacy queue.');
    } finally {
      setLoading(false);
    }
  }

  const grouped = lines.reduce((acc, l) => {
    (acc[l.presc_id] = acc[l.presc_id] || []).push(l);
    return acc;
  }, {});

  function openCounter(prescId, rows) {
    if (openPresc === prescId) { setOpenPresc(null); return; }
    setOpenPresc(prescId);
    setError('');
    const seed = {};
    rows.filter((r) => !r.is_dispensed).forEach((r) => {
      seed[r.med_id] = suggestQty(r.frequency, r.duration);
    });
    setQty(seed);
  }

  async function handleDispense(prescId, rows) {
    const payload = rows
      .filter((r) => !r.is_dispensed)
      .map((r) => ({ med_id: r.med_id, quantity: Number(qty[r.med_id]) }))
      .filter((r) => r.quantity > 0);

    if (payload.length === 0) {
      setError('Enter a quantity for at least one medicine.');
      return;
    }

    try {
      setBusy(true);
      setError('');
      const res = await dispenseMedicines({
        presc_id: prescId,
        lines: payload,
        charge_to_bill: charge,
      });
      const d = res.data;
      setNotice(
        `Dispensed ${d.items.length} medicine${d.items.length === 1 ? '' : 's'} ` +
        `to ${d.patient_name}, ${taka(d.total)}` +
        (d.bill_id ? ` — added to bill B-${String(d.bill_id).padStart(3, '0')}.` : '.')
      );
      setOpenPresc(null);
      loadQueue();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not dispense these medicines.');
    } finally {
      setBusy(false);
    }
  }

  const prescIds = Object.keys(grouped);

  return (
    <div>
      <div className="page-top">
        <h2>Pharmacy</h2>
        <span className="count">
          {loading ? '\u2014'
            : `${prescIds.length} prescription${prescIds.length === 1 ? '' : 's'}${showAll ? '' : ' waiting'}`}
        </span>
      </div>

      <div className="toolbar">
        <select className="search" value={patientId}
          onChange={(e) => setPatientId(e.target.value)}>
          <option value="">All patients</option>
          {patients.map((p) => (
            <option key={p.patient_id} value={p.patient_id}>{p.name}</option>
          ))}
        </select>
        <button className={showAll ? 'btn primary' : 'btn'}
          onClick={() => setShowAll(!showAll)}>
          {showAll ? 'Showing all' : 'Show dispensed too'}
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

      {loading ? (
        <div className="loading">Loading pharmacy queue</div>
      ) : prescIds.length === 0 ? (
        <div className="empty">
          <p>Nothing waiting at the counter.</p>
          <p className="hint">
            Every prescribed medicine has been dispensed, or patients are filling
            them outside the hospital.
          </p>
        </div>
      ) : (
        prescIds.map((pid) => {
          const rows = grouped[pid];
          const head = rows[0];
          const pending = rows.filter((r) => !r.is_dispensed);
          const isOpen = String(openPresc) === String(pid);

          return (
            <div className="form" key={pid} style={{ marginBottom: 16 }}>
              <div className="form-title" style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', gap: 12, flexWrap: 'wrap',
              }}>
                <span>
                  RX-{String(pid).padStart(3, '0')} &middot; {head.patient_name}
                  &nbsp;&middot;&nbsp; {prettyDate(head.presc_date)}
                  &nbsp;&middot;&nbsp; {head.doctor_name}
                </span>
                {pending.length > 0 && (
                  <button className="btn sm" onClick={() => openCounter(pid, rows)}>
                    {isOpen ? 'Close' : `Dispense (${pending.length})`}
                  </button>
                )}
              </div>

              <table className="mini">
                <thead>
                  <tr>
                    <th>Medicine</th>
                    <th>Dosage</th>
                    <th>Course</th>
                    <th className="right">Price</th>
                    <th className="right">In stock</th>
                    <th>Status</th>
                    {isOpen && <th className="right">Quantity</th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.med_id}>
                      <td><span className="name">{r.medicine_name}</span></td>
                      <td><span className="data">{r.dosage}</span></td>
                      <td>
                        <span className="data">{r.frequency}</span>
                        <span className="sub"> &middot; {r.duration}</span>
                      </td>
                      <td className="right">
                        <span className="amount">
                          {taka(r.is_dispensed ? r.dispensed_price : r.current_price)}
                        </span>
                      </td>
                      <td className="right"><span className="data">{r.stock_qty}</span></td>
                      <td>
                        {r.is_dispensed
                          ? <span className="stamp clear">
                              Dispensed &times;{r.dispensed_qty}
                            </span>
                          : Number(r.stock_qty) === 0
                            ? <span className="stamp flag">Out of stock</span>
                            : <span className="stamp hold">Waiting</span>}
                      </td>
                      {isOpen && (
                        <td className="right">
                          {r.is_dispensed ? (
                            <span className="sub">&mdash;</span>
                          ) : (
                            <input type="number" min="0" style={{
                              width: 90, padding: '5px 8px',
                              border: '1px solid var(--rule)',
                              borderRadius: 'var(--r)',
                              fontFamily: 'var(--sans)', fontSize: 13,
                            }}
                              value={qty[r.med_id] ?? ''}
                              onChange={(e) => setQty({ ...qty, [r.med_id]: e.target.value })}
                            />
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>

              {isOpen && (
                <>
                  <p className="gate-note" style={{ marginTop: 12 }}>
                    Quantity is worked out from the course, for example 1+0+1 for
                    7 days is 14 units. Change it if the patient wants only part
                    of the course, or is buying the rest elsewhere.
                  </p>
                  <div className="form-actions" style={{
                    justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <label style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      fontSize: 13.5, color: 'var(--ink-soft)',
                    }}>
                      <input type="checkbox" checked={charge}
                        onChange={(e) => setCharge(e.target.checked)} />
                      Add to the patient&rsquo;s bill
                    </label>
                    <span>
                      <button className="btn" onClick={() => setOpenPresc(null)}>
                        Cancel
                      </button>
                      {' '}
                      <button className="btn primary" disabled={busy}
                        onClick={() => handleDispense(pid, rows)}>
                        {busy ? 'Dispensing\u2026' : 'Dispense'}
                      </button>
                    </span>
                  </div>
                </>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}