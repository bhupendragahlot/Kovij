import axios from "axios";

const base = import.meta.env.VITE_API_BASE_URL || "";

export const memberApi = axios.create({
  baseURL: `${base}/api`,
  headers: { "Content-Type": "application/json" },
});

memberApi.interceptors.request.use((config) => {
  const t = localStorage.getItem("memberToken");
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});
