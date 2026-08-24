

import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api',
});


export const getPatients   = (search = '') => api.get('/patients', { params: { search } });
export const getPatient    = (id)          => api.get(`/patients/${id}`);
export const createPatient = (data)        => api.post('/patients', data);
export const updatePatient = (id, data)    => api.put(`/patients/${id}`, data);
export const deletePatient = (id)          => api.delete(`/patients/${id}`);


export const getDoctors        = ()   => api.get('/doctors');
export const getDoctor         = (id) => api.get(`/doctors/${id}`);
export const getDoctorSchedule = (id) => api.get(`/doctors/${id}/schedule`);
export const createDoctor      = (data)     => api.post('/doctors', data);
export const updateDoctor      = (id, data) => api.put(`/doctors/${id}`, data);
export const deleteDoctor      = (id)       => api.delete(`/doctors/${id}`);


export const getAppointments  = (params = {}) => api.get('/appointments', { params });
export const getAppointment   = (id)          => api.get(`/appointments/${id}`);
export const bookAppointment  = (data)        => api.post('/appointments', data);
export const updateApptStatus = (id, status)  => api.patch(`/appointments/${id}/status`, { status });

export const getBills   = ()         => api.get('/billing');
export const getBill    = (id)       => api.get(`/billing/${id}`);
export const getDueBills = ()        => api.get('/billing/due');
export const createBill = (data)     => api.post('/billing', data);
export const addPayment = (id, data) => api.post(`/billing/${id}/payment`, data);

export default api;