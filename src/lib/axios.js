import axios from "axios";

const BASE_URL =
  import.meta.env.MODE === "development"
    ? "http://localhost:5001/api"
    : "https://chat-backend-opco.onrender.com/api"; // <-- your Render backend

// export const axiosInstance = axios.create({
//   baseURL: "https://chat-backend-opco.onrender.com/api",
//   withCredentials: true,
// });
export const axiosInstance = axios.create({
  baseURL: import.meta.env.MODE === "development"
    ? "http://localhost:5001/api"
    : "https://chat-backend-opco.onrender.com/api",
  withCredentials: true
});
