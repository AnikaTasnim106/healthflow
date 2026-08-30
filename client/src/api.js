// ============================================================
//  api.js — backend er sathe kotha bolar ek matro jayga
//  Kono component e direct axios import korbe na, ekhan theke nibe.
// ============================================================

import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api',
});

// ---------- PATIENTS ----------
export const getPatients   = (search = '') => api.get('/patients', { params: { search } });
export const getPatient    = (id)          => api.get(`/patients/${id}`);
export const createPatient = (data)        => api.post('/patients', data);
export const updatePatient = (id, data)    => api.put(`/patients/${id}`, data);
export const deletePatient = (id)          => api.delete(`/patients/${id}`);

// ---------- DEPARTMENTS ----------
export const getDepartments = () => api.get('/departments');

// ---------- DOCTORS ----------
export const getDoctors        = ()   => api.get('/doctors');
export const getDoctor         = (id) => api.get(`/doctors/${id}`);
export const getDoctorSchedule = (id) => api.get(`/doctors/${id}/schedule`);
export const createDoctor      = (data)     => api.post('/doctors', data);
export const updateDoctor      = (id, data) => api.put(`/doctors/${id}`, data);
export const deleteDoctor      = (id)       => api.delete(`/doctors/${id}`);

// ---------- APPOINTMENTS ----------
export const getAppointments  = (params = {}) => api.get('/appointments', { params });
export const getAppointment   = (id)          => api.get(`/appointments/${id}`);
export const bookAppointment  = (data)        => api.post('/appointments', data);
export const updateApptStatus = (id, status)  => api.patch(`/appointments/${id}/status`, { status });

// ---------- BILLING ----------
export const getBills   = ()         => api.get('/billing');
export const getBill    = (id)       => api.get(`/billing/${id}`);
export const getDueBills = ()        => api.get('/billing/due');
export const createBill = (data)     => api.post('/billing', data);
export const addPayment = (id, data) => api.post(`/billing/${id}/payment`, data);

// ---------- ADMISSIONS ----------
export const getAdmissions    = ()         => api.get('/admissions');
export const getAdmission     = (id)       => api.get(`/admissions/${id}`);
export const getAvailableRooms = ()        => api.get('/admissions/available-rooms');
export const admitPatient     = (data)     => api.post('/admissions', data);
export const dischargePatient = (id, data) => api.patch(`/admissions/${id}/discharge`, data);

// ---------- LAB TESTS ----------
export const getTestCatalog   = ()   => api.get('/labtests/catalog');
export const getPendingTests  = ()   => api.get('/labtests/pending');
export const getPatientTests  = (id) => api.get(`/labtests/patient/${id}`);
export const assignTest       = (data) => api.post('/labtests', data);
export const addTestResult    = (patientId, testId, testDate, result) =>
  api.patch(`/labtests/${patientId}/${testId}/${testDate}`, { result });

// ---------- MEDICINES ----------
export const getMedicines = () => api.get('/medicines');
export const getLowStock  = () => api.get('/medicines/low-stock');

// ---------- PRESCRIPTIONS ----------
export const getPrescription        = (id) => api.get(`/prescriptions/${id}`);
export const getPatientPrescriptions = (id) => api.get(`/prescriptions/patient/${id}`);
export const createPrescription     = (data) => api.post('/prescriptions', data);

export default api;