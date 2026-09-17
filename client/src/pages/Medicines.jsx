import { useState, useEffect } from 'react';
import { useAuth } from '../auth';
import {
  getMedicines, getLowStock, createMedicine,
  updateMedicine, adjustStock, deleteMedicine,
} from '../api';

const taka = (n) => `\u09F3${Number(n || 0).toLocaleString('en-IN')}`;

const LOW = 1500;

export default function Medicines() {
  const { user } = useAuth();
  const isAdmin = user.role === 'admin';
  const canRestock = isAdmin || user.role === 'receptionist';

  const [meds, setMeds]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [notice, setNotice]   = useState('');
  const [search, setSearch]   = useState('');
  const [onlyLow, setOnlyLow] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId]     = useState(null);
  const emptyForm = { name: '', unit_price: '', stock_qty: '' };
  const [form, setForm] = useState(emptyForm);

  const [stockId, setStockId]   = useState(null);
  const [stockQty, setStockQty] = useState('');

  useEffect(() => { loadMeds(); }, [search, onlyLow]);

  async function loadMeds() {
    try {
      setLoading(true);
      setError('');
      const res = onlyLow ? await getLowStock() : await getMedicines(search);
      setMeds(res.data);
    } catch (err) {
      setError('Could not reach the server. Check that the backend is running on port 5000.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function startEdit(m) {
    setEditId(m.med_id);
    setForm({
      name: m.name || '',
      unit_price: m.unit_price != null ? String(m.unit_price) : '',
      stock_qty: '',
    });
    setShowForm(true);
    setStockId(null);
    setError('');
  }

  function closeForm() {
    setShowForm(false);
    setEditId(null);
    setForm(emptyForm);
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Enter a medicine name.'); return; }
    try {
      setError('');
      if (editId) {
        await updateMedicine(editId, { name: form.name, unit_price: form.unit_price });
        setNotice('Changes saved.');
      } else {
        await createMedicine(form);
        setNotice('Medicine added.');
      }
      closeForm();
      loadMeds();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save this medicine.');
    }
  }

  async function handleStock(m) {
    const qty = Number(stockQty);
    if (!qty) { setError('Enter a quantity.'); return; }
    try {
      setError('');
      const res = await adjustStock(m.med_id, qty);
      setStockId(null);
      setStockQty('');
      setNotice(`${m.name} stock is now ${res.data.stock_qty}.`);
      loadMeds();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not update the stock.');
    }
  }

  async function handleDelete(m) {
    if (!window.confirm(`Remove ${m.name} from the catalog?`)) return;
    try {
      setError('');
      await deleteMedicine(m.med_id);
      setNotice(`${m.name} removed.`);
      loadMeds();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not remove this medicine.');
    }
  }

  const lowCount = meds.filter((m) => Number(m.stock_qty) < LOW).length;

  return (
    <div>
      <div className="page-top">
        <h2>Medicines</h2>
        <span className="count">
          {loading ? '\u2014'
            : `${meds.length} in catalog${lowCount ? ` \u00b7 ${lowCount} low` : ''}`}
        </span>
      </div>

      <div className="toolbar">
        <input
          className="search"
          placeholder="Search medicines"
          value={search}
          disabled={onlyLow}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className={onlyLow ? 'btn primary' : 'btn'}
          onClick={() => { setOnlyLow(!onlyLow); setSearch(''); }}>
          {onlyLow ? 'Showing low stock' : 'Show low stock'}
        </button>
        {isAdmin && (
          <button className="btn primary"
            onClick={() => (showForm ? closeForm() : setShowForm(true))}>
            {showForm ? 'Close' : 'Add medicine'}
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
            {editId ? `Edit medicine M-${String(editId).padStart(3, '0')}` : 'New medicine'}
          </div>
          <div className="fields">
            <label>
              Name
              <input value={form.name} placeholder="Napa 500mg"
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label>
              Unit price
              <input type="number" min="0" step="0.01" value={form.unit_price} placeholder="1.50"
                onChange={(e) => setForm({ ...form, unit_price: e.target.value })} />
            </label>
            {!editId && (
              <label>
                Opening stock
                <input type="number" min="0" value={form.stock_qty} placeholder="1000"
                  onChange={(e) => setForm({ ...form, stock_qty: e.target.value })} />
              </label>
            )}
          </div>
          {editId && (
            <p className="gate-note">
              Stock is changed with the Restock button, not here.
            </p>
          )}
          <div className="form-actions">
            <button className="btn" onClick={closeForm}>Cancel</button>
            <button className="btn primary" onClick={handleSave}>
              {editId ? 'Save changes' : 'Save medicine'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading">Loading catalog</div>
      ) : meds.length === 0 ? (
        <div className="empty">
          <p>{onlyLow ? 'No medicine is running low.' : 'No medicines in the catalog.'}</p>
          <p className="hint">
            {onlyLow ? 'Every item is above the reorder level.' : 'Add the first medicine to get started.'}
          </p>
        </div>
      ) : (
        <div className="records">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Medicine</th>
                <th className="right">Unit price</th>
                <th className="right">In stock</th>
                <th>Level</th>
                {canRestock && <th className="right">Action</th>}
              </tr>
            </thead>
            <tbody>
              {meds.map((m) => {
                const qty = Number(m.stock_qty);
                const level = qty === 0 ? 'flag' : qty < LOW ? 'hold' : 'clear';
                const levelText = qty === 0 ? 'Out of stock' : qty < LOW ? 'Low' : 'In stock';
                const editingStock = stockId === m.med_id;

                return (
                  <tr key={m.med_id}>
                    <td><span className="id">M-{String(m.med_id).padStart(3, '0')}</span></td>
                    <td><span className="name">{m.name}</span></td>
                    <td className="right"><span className="amount">{taka(m.unit_price)}</span></td>
                    <td className="right"><span className="data">{qty.toLocaleString()}</span></td>
                    <td><span className={`stamp ${level}`}>{levelText}</span></td>
                    {canRestock && (
                      <td className="right">
                        {editingStock ? (
                          <div className="pay-form" style={{ justifyContent: 'flex-end' }}>
                            <input type="number" autoFocus placeholder="e.g. 500"
                              value={stockQty} style={{ maxWidth: 110 }}
                              onChange={(e) => setStockQty(e.target.value)} />
                            <button className="btn primary sm"
                              onClick={() => handleStock(m)}>Add</button>
                            <button className="btn ghost sm"
                              onClick={() => { setStockId(null); setStockQty(''); }}>
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <>
                            <button className="btn sm"
                              onClick={() => { setStockId(m.med_id); setStockQty(''); setShowForm(false); }}>
                              Restock
                            </button>
                            {isAdmin && (
                              <>
                                {' '}
                                <button className="btn sm" onClick={() => startEdit(m)}>Edit</button>
                                {' '}
                                <button className="btn ghost sm"
                                  onClick={() => handleDelete(m)}>Remove</button>
                              </>
                            )}
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}