// ============================================================
//  auth.jsx
//
//  Duita jinis ei file e:
//
//  1. AuthProvider — ke login kora ache seta puro app er jonno
//     ek jaygay rakhe. Jekono component <useAuth()> diye seta
//     pete pare, props diye pathate hoy na.
//
//  2. NAV_BY_ROLE — kon role kon page dekhbe.
//
//     ⚠️ EI TA SHUDHU PRESENTATION. Guideline e clearly lekha:
//     "Hiding a button on the frontend is presentation, not
//     security." Asol check backend er middleware e hote hobe —
//     ei list ta shudhu user ke ojotha page dekhay na.
// ============================================================

import { createContext, useContext, useState, useEffect } from 'react';
import { apiLogin, apiLogout, apiMe, getToken, clearToken } from './api';

// ------------------------------------------------------------
//  Role onujayi kon tab dekhabe
// ------------------------------------------------------------
export const NAV_BY_ROLE = {
  admin: [
    'patients', 'doctors', 'schedule', 'appointments',
    'admissions', 'prescriptions', 'labtests', 'billing',
  ],
  receptionist: [
    'patients', 'appointments', 'admissions', 'billing',
  ],
  doctor: [
    'appointments', 'schedule', 'patients', 'prescriptions', 'labtests',
  ],
  patient: [
    'myrecords',
  ],
};

export const ROLE_LABEL = {
  admin:        'Administrator',
  receptionist: 'Front desk',
  doctor:       'Doctor',
  patient:      'Patient',
};


const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  // Page refresh korle token ekhono ache kina dekhe, ar thakle
  // /me diye jene ney ke login kora ache. Backend na thakle
  // ei call ta fail kore — tokhon shudhu logged-out obostha.
  useEffect(() => {
    async function restore() {
      if (!getToken()) { setLoading(false); return; }
      try {
        const u = await apiMe();
        setUser(u);
      } catch {
        clearToken();
      } finally {
        setLoading(false);
      }
    }
    restore();
  }, []);

  async function login(email, password) {
    const u = await apiLogin(email, password);
    setUser(u);
    return u;
  }

  async function logout() {
    await apiLogout();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}