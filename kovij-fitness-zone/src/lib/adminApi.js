import axios from "axios";
import { API_ORIGIN } from "../shared/lib/apiBase";

const base = API_ORIGIN;

export const adminApi = axios.create({
  baseURL: `${base}/api`,
  headers: { "Content-Type": "application/json" },
});

adminApi.interceptors.request.use((config) => {
  const t = localStorage.getItem("token");
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});
