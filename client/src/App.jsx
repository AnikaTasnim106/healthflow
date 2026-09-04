// ============================================================
//  App.jsx — auth gate + role-aware navigation
//
//  Login kora na thakle Login screen, thakle role onujayi
//  nav ar page.
//
//  ⚠️ Ei nav filter ta SHUDHU presentation. Guideline:
//     "Hiding a button on the frontend is presentation, not
//     security." Asol check backend er middleware e.
// ============================================================

import { useState } from 'react';
import { AuthProvider, useAuth, NAV_BY_ROLE, ROLE_LABEL } from './auth';

import Login from './pages/Login';
import MyRecords from './pages/MyRecords';
import Patients from './pages/Patients';
import Doctors from './pages/Doctors';
import Appointments from './pages/Appointments';
import Admissions from './pages/Admissions';
import Prescriptions from './pages/Prescriptions';
import LabTests from './pages/LabTests';
import Billing from './pages/Billing';

import './App.css';

// sob page ek jaygay. auth.jsx er NAV_BY_ROLE ei id gulo dhore.
const PAGES = {
  myrecords:     { label: 'My Records',    component: MyRecords },
  patients:      { label: 'Patients',      component: Patients },
  doctors:       { label: 'Doctors',       component: Doctors },
  appointments:  { label: 'Appointments',  component: Appointments },
  admissions:    { label: 'Admissions',    component: Admissions },
  prescriptions: { label: 'Prescriptions', component: Prescriptions },
  labtests:      { label: 'Lab Tests',     component: LabTests },
  billing:       { label: 'Billing',       component: Billing },
};

function Shell() {
  const { user, loading, logout } = useAuth();

  // ei role ta ki ki page dekhbe
  const allowed = user ? (NAV_BY_ROLE[user.role] || []) : [];
  const [active, setActive] = useState(null);

  if (loading) {
    return <div className="gate"><div className="loading">Loading</div></div>;
  }

  if (!user) return <Login />;

  const current = (active && allowed.includes(active)) ? active : allowed[0];
  const Active = current ? PAGES[current].component : null;

  return (
    <div className="app">
      <aside className="rail">
        <div className="rail-brand">
          <span className="mark">HealthFlow</span>
          <span className="sub">Records</span>
        </div>

        <div className="rail-label">Menu</div>
        {allowed.map((id) => (
          <button
            key={id}
            className={current === id ? 'rail-link on' : 'rail-link'}
            onClick={() => setActive(id)}
          >
            {PAGES[id].label}
          </button>
        ))}

        <div className="rail-user">
          <div className="rail-user-name">{user.name}</div>
          <div className="rail-user-role">{ROLE_LABEL[user.role] || user.role}</div>
          <button className="rail-signout" onClick={logout}>Sign out</button>
        </div>
      </aside>

      <main className="page">
        {Active ? <Active /> : (
          <div className="empty">
            <p>Nothing is available for this role yet.</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}