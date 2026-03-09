import axios from "axios";

// Use environment variable if available, otherwise use production backend
const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ||
  "https://student-learning-recovery-backend.onrender.com";

const api = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    "Content-Type": "application/json",
  },
});

// Attach JWT token automatically
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

export default api;