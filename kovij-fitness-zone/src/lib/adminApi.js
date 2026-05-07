import axios from "axios";

const base = import.meta.env.VITE_API_BASE_URL || "";

export const adminApi = axios.create({
  baseURL: `${base}/api`,
  headers: { "Content-Type": "application/json" },
});

adminApi.interceptors.request.use((config) => {
  const t = localStorage.getItem("token");
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});
