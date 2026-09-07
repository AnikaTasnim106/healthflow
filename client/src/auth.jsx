

import { createContext, useContext, useState, useEffect } from 'react';
import { apiLogin, apiLogout, apiMe, getToken, clearToken } from './api';

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