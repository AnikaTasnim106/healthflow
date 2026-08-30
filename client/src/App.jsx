// ============================================================
//  App.jsx — shell + navigation
//  Notun page banale duita jayga te add korte hobe:
//    1. import
//    2. NAV array
// ============================================================

import { useState } from 'react';
import Patients from './pages/Patients';
import Doctors from './pages/Doctors';
import Appointments from './pages/Appointments';
import './App.css';

const NAV = [
  { id: 'patients', label: 'Patients', component: Patients },
  { id: 'doctors',  label: 'Doctors',  component: Doctors },
  { id: 'appointments', label: 'Appointments', component: Appointments },
  // { id: 'billing',      label: 'Billing',      component: Billing },
];

export default function App() {
  const [active, setActive] = useState('patients');
  const Active = NAV.find((n) => n.id === active).component;

  return (
    <div className="app">
      <aside className="rail">
        <div className="rail-brand">
          <span className="mark">HealthFlow</span>
          <span className="sub">Records</span>
        </div>

        <div className="rail-label">Registry</div>
        {NAV.map((n) => (
          <button
            key={n.id}
            className={active === n.id ? 'rail-link on' : 'rail-link'}
            onClick={() => setActive(n.id)}
          >
            {n.label}
          </button>
        ))}
      </aside>

      <main className="page">
        <Active />
      </main>
    </div>
  );
}