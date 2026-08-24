

import { useState } from 'react';
import Patients from './pages/Patients';
import './App.css';

const TABS = [
  { id: 'patients', label: 'Patients', component: Patients },
  // { id: 'doctors',      label: 'Doctors',      component: Doctors },
  // { id: 'appointments', label: 'Appointments', component: Appointments },
  // { id: 'billing',      label: 'Billing',      component: Billing },
];

export default function App() {
  const [active, setActive] = useState('patients');

  const Active = TABS.find(t => t.id === active).component;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="mark">HF</span>
          <div>
            <h1>HealthFlow</h1>
            <p>Hospital Management System</p>
          </div>
        </div>
      </header>

      <nav className="tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={active === t.id ? 'tab active' : 'tab'}
            onClick={() => setActive(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="content">
        <Active />
      </main>
    </div>
  );
}
