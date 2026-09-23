import { useState, useEffect } from 'react';
import {
  getReportMonths, getReportSummary, getReportDepartments,
  getReportRevenueSources, getReportMonthly, getReportTopDoctors,
} from '../api';

const money = (n) => '\u09F3' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

function Stat({ label, value, note, tone }) {
  const colour = tone === 'bad' ? 'var(--flag)'
    : tone === 'good' ? 'var(--clear)'
    : tone === 'warn' ? 'var(--hold)'
    : 'var(--ink)';
  return (
    <div style={{
      background: 'var(--chart)', border: '1px solid var(--rule)',
      borderRadius: 'var(--r)', padding: '12px 14px', borderLeft: `3px solid ${colour}`,
    }}>
      <div style={{
        fontFamily: 'var(--cond)', fontSize: 10.5, letterSpacing: 1.2,
        textTransform: 'uppercase', color: 'var(--ink-soft)', marginBottom: 6,
      }}>{label}</div>
      <div style={{
        fontFamily: 'var(--display)', fontSize: 23, fontWeight: 700,
        letterSpacing: '-0.6px', color: colour, lineHeight: 1.1,
      }}>{value}</div>
      {note && (
        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-faint)', marginTop: 4 }}>
          {note}
        </div>
      )}
    </div>
  );
}

function Bars({ rows, max, format }) {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {rows.map((r) => (
        <div key={r.label}>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            fontSize: 12.5, marginBottom: 4,
          }}>
            <span style={{ fontWeight: 600 }}>{r.label}</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--ink-soft)' }}>
              {format ? format(r.value) : r.value}
            </span>
          </div>
          <div style={{ background: 'var(--rule-soft)', borderRadius: 2, height: 14 }}>
            <div style={{
              width: max > 0 ? `${Math.max((r.value / max) * 100, r.value > 0 ? 2 : 0)}%` : '0%',
              background: r.colour || 'var(--spine)',
              height: '100%', borderRadius: 2,
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Panel({ title, hint, children }) {
  return (
    <div style={{
      background: 'var(--chart)', border: '1px solid var(--rule)',
      borderRadius: 'var(--r)', padding: '14px 16px 16px',
    }}>
      <div style={{
        fontFamily: 'var(--cond)', fontSize: 11, letterSpacing: 1.2,
        textTransform: 'uppercase', color: 'var(--ink-soft)',
        borderBottom: '1px solid var(--rule-soft)', paddingBottom: 8, marginBottom: 12,
      }}>
        {title}
        {hint && (
          <span style={{ textTransform: 'none', letterSpacing: 0, marginLeft: 8, color: 'var(--ink-faint)' }}>
            {hint}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

export default function Reports() {
  const [months, setMonths]   = useState([]);
  const [month, setMonth]     = useState('');
  const [summary, setSummary] = useState(null);
  const [depts, setDepts]     = useState([]);
  const [sources, setSources] = useState([]);
  const [monthly, setMonthly] = useState([]);
  const [topDocs, setTopDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => { loadMonths(); }, []);
  useEffect(() => { if (month) loadReport(month); }, [month]);

  async function loadMonths() {
    try {
      const res = await getReportMonths();
      const list = res.data.length ? res.data : [new Date().toISOString().slice(0, 7)];
      setMonths(list);
      setMonth(list[0]);
    } catch (err) {
      setError('Could not load report data.');
      setLoading(false);
    }
  }

  async function loadReport(m) {
    try {
      setLoading(true);
      setError('');
      const [s, d, r, mo, td] = await Promise.all([
        getReportSummary(m),
        getReportDepartments(m),
        getReportRevenueSources(m),
        getReportMonthly(),
        getReportTopDoctors(m),
      ]);
      setSummary(s.data);
      setDepts(d.data.departments);
      setSources(r.data.sources);
      setMonthly(mo.data);
      setTopDocs(td.data.doctors);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load the report.');
    } finally {
      setLoading(false);
    }
  }

  const short = (m) => {
    if (!m) return '';
    const [y, mm] = m.split('-');
    const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                   'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${names[Number(mm) - 1]} ${y}`;
  };

  const sourceRows = sources.map((s) => ({ label: s.source, value: Number(s.amount) }));
  const sourceMax  = Math.max(...sourceRows.map((r) => r.value), 0);

  const monthlyMax = Math.max(
    ...monthly.map((m) => Math.max(Number(m.billed), Number(m.collected))), 0
  );

  const short_ = short;

  return (
    <div>
      <div className="page-top">
        <h2>Reports</h2>
        <span className="count">{month ? short_(month) : '\u2014'}</span>
      </div>

      <div className="toolbar">
        <span style={{ fontFamily: 'var(--cond)', fontSize: 12, letterSpacing: 0.7,
                       textTransform: 'uppercase', color: 'var(--ink-soft)' }}>
          Month
        </span>
        <select className="search" style={{ maxWidth: 180 }}
          value={month} onChange={(e) => setMonth(e.target.value)}>
          {months.map((m) => <option key={m} value={m}>{short_(m)}</option>)}
        </select>
        <span style={{ flex: 1 }} />
        <button className="btn" onClick={() => month && loadReport(month)}>Refresh</button>
      </div>

      {error && (
        <div className="alert">
          <span>{error}</span>
          <button className="x" onClick={() => setError('')}>Dismiss</button>
        </div>
      )}

      {loading ? (
        <div className="loading">Loading report</div>
      ) : !summary ? (
        <div className="empty"><p>No report data yet.</p></div>
      ) : (
        <div style={{ display: 'grid', gap: 18 }}>

          <div style={{
            display: 'grid', gap: 12,
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          }}>
            <Stat label="Billed this month" value={money(summary.month_billed)} />
            <Stat label="Collected this month" value={money(summary.month_collected)} tone="good" />
            <Stat label="Outstanding due (all time)" value={money(summary.total_due)} tone="bad"
                  note={`${summary.unpaid_bills} unpaid bill(s)`} />
            <Stat label="Appointments" value={summary.month_appointments}
                  note={`${summary.month_patients} patients seen`} />
            <Stat label="Admissions this month" value={summary.month_admissions}
                  note={`${summary.current_admissions} currently admitted`} />
            <Stat label="Rooms occupied"
                  value={`${summary.occupied_rooms} / ${summary.total_rooms}`} />
            <Stat label="Doctors" value={summary.total_doctors}
                  note={`${summary.total_patients} registered patients`} />
            <Stat label="Low stock medicines" value={summary.low_stock_medicines}
                  tone={Number(summary.low_stock_medicines) > 0 ? 'warn' : 'good'}
                  note="below 1500 units" />
          </div>

          <div style={{
            display: 'grid', gap: 14,
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          }}>
            <Panel title="Income by source" hint={short_(month)}>
              <Bars rows={sourceRows} max={sourceMax} format={money} />
            </Panel>

            <Panel title="Billed vs collected" hint="last months">
              <div style={{ display: 'grid', gap: 12 }}>
                {monthly.map((m) => (
                  <div key={m.month}>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between',
                      fontSize: 12.5, marginBottom: 4,
                    }}>
                      <span style={{ fontWeight: 600 }}>{short_(m.month)}</span>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--ink-soft)' }}>
                        {money(m.collected)} / {money(m.billed)}
                      </span>
                    </div>
                    <div style={{ background: 'var(--rule-soft)', borderRadius: 2, height: 10, marginBottom: 3 }}>
                      <div style={{
                        width: monthlyMax > 0 ? `${(Number(m.billed) / monthlyMax) * 100}%` : '0%',
                        background: 'var(--spine)', height: '100%', borderRadius: 2,
                      }} />
                    </div>
                    <div style={{ background: 'var(--rule-soft)', borderRadius: 2, height: 10 }}>
                      <div style={{
                        width: monthlyMax > 0 ? `${(Number(m.collected) / monthlyMax) * 100}%` : '0%',
                        background: 'var(--clear)', height: '100%', borderRadius: 2,
                      }} />
                    </div>
                  </div>
                ))}
                <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-faint)' }}>
                  dark = billed &nbsp;·&nbsp; green = collected
                </div>
              </div>
            </Panel>
          </div>

          <div>
            <div style={{
              fontFamily: 'var(--cond)', fontSize: 11, letterSpacing: 1.2,
              textTransform: 'uppercase', color: 'var(--ink-soft)', marginBottom: 8,
            }}>
              Department summary &mdash; {short_(month)}
            </div>
            <div className="records">
              <table className="table">
                <thead>
                  <tr>
                    <th>Department</th>
                    <th className="right">Doctors</th>
                    <th className="right">Appointments</th>
                    <th className="right">Patients</th>
                    <th className="right">Completed</th>
                    <th className="right">Consultation income</th>
                    <th className="right">Load / doctor</th>
                    <th>Staffing</th>
                  </tr>
                </thead>
                <tbody>
                  {depts.map((d) => (
                    <tr key={d.dept_id}>
                      <td><span className="name">{d.dept_name}</span></td>
                      <td className="right"><span className="data">{d.doctor_count}</span></td>
                      <td className="right"><span className="data">{d.appointment_count}</span></td>
                      <td className="right"><span className="data">{d.patient_count}</span></td>
                      <td className="right"><span className="data">{d.completed_count}</span></td>
                      <td className="right"><span className="data">{money(d.consult_revenue)}</span></td>
                      <td className="right"><span className="data">{d.load_per_doctor ?? '\u2014'}</span></td>
                      <td>
                        {d.needs_more_doctors ? (
                          <span style={{
                            fontFamily: 'var(--cond)', fontSize: 11, letterSpacing: 0.6,
                            textTransform: 'uppercase', color: 'var(--flag)',
                            background: 'var(--flag-pale)', padding: '2px 7px', borderRadius: 2,
                          }}>Needs more doctors</span>
                        ) : (
                          <span style={{
                            fontFamily: 'var(--cond)', fontSize: 11, letterSpacing: 0.6,
                            textTransform: 'uppercase', color: 'var(--clear)',
                            background: 'var(--clear-pale)', padding: '2px 7px', borderRadius: 2,
                          }}>Adequate</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-faint)', marginTop: 6 }}>
              Load / doctor = appointments &divide; doctors. A department is flagged when its load is
              above the hospital average, or when it has no doctor assigned.
            </div>
          </div>

          <div>
            <div style={{
              fontFamily: 'var(--cond)', fontSize: 11, letterSpacing: 1.2,
              textTransform: 'uppercase', color: 'var(--ink-soft)', marginBottom: 8,
            }}>
              Busiest doctors &mdash; {short_(month)}
            </div>
            <div className="records">
              <table className="table">
                <thead>
                  <tr>
                    <th>Doctor</th>
                    <th>Department</th>
                    <th className="right">Appointments</th>
                    <th className="right">Completed</th>
                    <th className="right">Consultation income</th>
                  </tr>
                </thead>
                <tbody>
                  {topDocs.map((d) => (
                    <tr key={d.doctor_id}>
                      <td><span className="name">{d.name}</span></td>
                      <td>{d.dept_name}</td>
                      <td className="right"><span className="data">{d.appointment_count}</span></td>
                      <td className="right"><span className="data">{d.completed_count}</span></td>
                      <td className="right"><span className="data">{money(d.revenue)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{
            fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--ink-soft)',
            background: 'var(--hold-pale)', border: '1px solid #e8dcc0',
            borderLeft: '3px solid var(--hold)', borderRadius: 'var(--r)', padding: '10px 12px',
          }}>
            Note: the database records income only. Hospital expenses (salaries, purchase cost of
            medicines, utilities) are not stored, so net profit cannot be derived &mdash; this report
            shows billed, collected and outstanding amounts instead.
          </div>

        </div>
      )}
    </div>
  );
}