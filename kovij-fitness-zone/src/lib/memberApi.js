import axios from "axios";
import { API_ORIGIN } from "../shared/lib/apiBase";

const base = API_ORIGIN;

export const memberApi = axios.create({
  baseURL: `${base}/api`,
  headers: { "Content-Type": "application/json" },
});

memberApi.interceptors.request.use((config) => {
  const t = localStorage.getItem("memberToken");
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});
