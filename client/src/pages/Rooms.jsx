import { useState, useEffect } from 'react';
import { useAuth } from '../auth';
import {
  getRooms, getRoomSummary, createRoom,
  updateRoom, setRoomStatus, deleteRoom,
} from '../api';

const taka = (n) => `\u09F3${Number(n || 0).toLocaleString('en-IN')}`;

const prettyDate = (d) => {
  if (!d) return '\u2014';
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
};

const TYPES = ['General', 'Semi-Private', 'Private', 'ICU', 'CCU'];

const stampOf = (s) => {
  if (s === 'Available') return 'clear';
  if (s === 'Occupied') return 'hold';
  return 'mute';
};

export default function Rooms() {
  const { user } = useAuth();
  const isAdmin = user.role === 'admin';

  const [rooms, setRooms]     = useState([]);
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [notice, setNotice]   = useState('');

  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType]     = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editNo, setEditNo]     = useState(null);
  const emptyForm = { room_no: '', room_type: 'General', daily_charge: '' };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { loadAll(); }, [filterStatus, filterType]);

  async function loadAll() {
    try {
      setLoading(true);
      setError('');
      const [r, s] = await Promise.all([
        getRooms({ status: filterStatus || undefined, type: filterType || undefined }),
        getRoomSummary(),
      ]);
      setRooms(r.data);
      setSummary(s.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load rooms.');
    } finally {
      setLoading(false);
    }
  }

  function startEdit(r) {
    setEditNo(r.room_no);
    setForm({
      room_no: r.room_no,
      room_type: r.room_type,
      daily_charge: String(r.daily_charge),
    });
    setShowForm(true);
    setError('');
  }

  function closeForm() {
    setShowForm(false);
    setEditNo(null);
    setForm(emptyForm);
  }

  async function handleSave() {
    try {
      setError('');
      if (editNo) {
        await updateRoom(editNo, {
          room_type: form.room_type,
          daily_charge: form.daily_charge,
        });
        setNotice('Room updated.');
      } else {
        await createRoom(form);
        setNotice('Room added.');
      }
      closeForm();
      loadAll();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save this room.');
    }
  }

  async function handleStatus(r, status) {
    try {
      setError('');
      await setRoomStatus(r.room_no, status);
      setNotice(
        status === 'Maintenance'
          ? `${r.room_no} is now under maintenance.`
          : `${r.room_no} is back in service.`
      );
      loadAll();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not change the room status.');
    }
  }

  async function handleDelete(r) {
    if (!window.confirm(`Remove room ${r.room_no}?`)) return;
    try {
      setError('');
      await deleteRoom(r.room_no);
      setNotice(`Room ${r.room_no} removed.`);
      loadAll();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not remove this room.');
    }
  }

  const totals = summary.reduce(
    (acc, s) => ({
      total: acc.total + Number(s.total),
      available: acc.available + Number(s.available),
    }),
    { total: 0, available: 0 }
  );

  return (
    <div>
      <div className="page-top">
        <h2>Rooms</h2>
        <span className="count">
          {loading ? '\u2014' : `${totals.available} of ${totals.total} free`}
        </span>
      </div>

      {summary.length > 0 && (
        <div className="records" style={{ marginBottom: 18 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Type</th>
                <th className="right">Total</th>
                <th className="right">Available</th>
                <th className="right">Occupied</th>
                <th className="right">Maintenance</th>
                <th className="right">Daily charge</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((s) => (
                <tr key={s.room_type}>
                  <td><span className="name">{s.room_type}</span></td>
                  <td className="right"><span className="data">{s.total}</span></td>
                  <td className="right">
                    <span className="data" style={{
                      color: Number(s.available) === 0 ? 'var(--flag)' : 'var(--clear)',
                    }}>
                      {s.available}
                    </span>
                  </td>
                  <td className="right"><span className="data">{s.occupied}</span></td>
                  <td className="right"><span className="data">{s.maintenance}</span></td>
                  <td className="right">
                    <span className="amount">
                      {Number(s.min_charge) === Number(s.max_charge)
                        ? taka(s.min_charge)
                        : `${taka(s.min_charge)} \u2013 ${taka(s.max_charge)}`}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="toolbar">
        <select className="search" style={{ flex: '0 0 170px' }}
          value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="Available">Available</option>
          <option value="Occupied">Occupied</option>
          <option value="Maintenance">Maintenance</option>
        </select>
        <select className="search" style={{ flex: '0 0 170px' }}
          value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option value="">All types</option>
          {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <span style={{ flex: 1 }} />
        {isAdmin && (
          <button className="btn primary"
            onClick={() => (showForm ? closeForm() : setShowForm(true))}>
            {showForm ? 'Close' : 'Add room'}
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
          <div className="form-title">
            {editNo ? `Edit room ${editNo}` : 'New room'}
          </div>
          <div className="fields">
            <label>
              Room number
              <input value={form.room_no} placeholder="A-104" disabled={!!editNo}
                onChange={(e) => setForm({ ...form, room_no: e.target.value })} />
            </label>
            <label>
              Type
              <select value={form.room_type}
                onChange={(e) => setForm({ ...form, room_type: e.target.value })}>
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label>
              Daily charge
              <input type="number" min="1" value={form.daily_charge} placeholder="1500"
                onChange={(e) => setForm({ ...form, daily_charge: e.target.value })} />
            </label>
          </div>
          {editNo && (
            <p className="gate-note">
              Changing the daily charge affects bills generated from now on.
              Bills already issued keep the rate they were charged at.
            </p>
          )}
          <div className="form-actions">
            <button className="btn" onClick={closeForm}>Cancel</button>
            <button className="btn primary" onClick={handleSave}>
              {editNo ? 'Save changes' : 'Add room'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading">Loading rooms</div>
      ) : rooms.length === 0 ? (
        <div className="empty">
          <p>No rooms match these filters.</p>
          <p className="hint">Try a different status or type.</p>
        </div>
      ) : (
        <div className="records">
          <table className="table">
            <thead>
              <tr>
                <th>Room</th>
                <th>Type</th>
                <th className="right">Daily charge</th>
                <th>Status</th>
                <th>Occupant</th>
                <th className="right">Action</th>
              </tr>
            </thead>
            <tbody>
              {rooms.map((r) => (
                <tr key={r.room_no}>
                  <td><span className="id">{r.room_no}</span></td>
                  <td><span className="name">{r.room_type}</span></td>
                  <td className="right"><span className="amount">{taka(r.daily_charge)}</span></td>
                  <td><span className={`stamp ${stampOf(r.status)}`}>{r.status}</span></td>
                  <td>
                    {r.patient_name ? (
                      <>
                        <div className="name">{r.patient_name}</div>
                        <div className="sub">since {prettyDate(r.admit_date)}</div>
                      </>
                    ) : (
                      <span className="sub">&mdash;</span>
                    )}
                  </td>
                  <td className="right">
                    {r.status === 'Available' && (
                      <button className="btn sm"
                        onClick={() => handleStatus(r, 'Maintenance')}>
                        Maintenance
                      </button>
                    )}
                    {r.status === 'Maintenance' && (
                      <button className="btn sm"
                        onClick={() => handleStatus(r, 'Available')}>
                        Back in service
                      </button>
                    )}
                    {isAdmin && (
                      <>
                        {' '}
                        <button className="btn sm" onClick={() => startEdit(r)}>Edit</button>
                        {r.status !== 'Occupied' && (
                          <>
                            {' '}
                            <button className="btn ghost sm"
                              onClick={() => handleDelete(r)}>Remove</button>
                          </>
                        )}
                      </>
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