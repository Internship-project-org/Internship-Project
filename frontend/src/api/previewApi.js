import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

export async function previewSavedQuery(queryId, params = {}) {
  if (!queryId) throw new Error('Save the query before previewing it.');
  const response = await api.post(`/query-preview/${encodeURIComponent(queryId)}/preview`, { params });
  return response.data;
}

export default api;
