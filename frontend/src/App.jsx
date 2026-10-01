import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import { AuthProvider } from "./context/AuthContext";
import Layout from "./components/Layout";
import PrivateRoute from "./components/PrivateRoute";
import RecruiterDashboard from "./pages/RecruiterDashboard";
import JobDetail from "./pages/JobDetail";
import History from "./pages/History";
import Login from "./pages/Login";
import { api } from "./api/client";

export default function App() {
  if (!api.defaults.baseURL) {
    return (
      <p className="max-w-lg mx-auto p-8 text-gray-200">
        This application is not configured. Set the API address before building the frontend.
      </p>
    );
  }

  return (
    <AuthProvider>
      <BrowserRouter>
        <ToastContainer position="top-right" theme="dark" autoClose={3200} />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/jobs" replace />} />
            <Route path="jobs" element={<PrivateRoute><RecruiterDashboard /></PrivateRoute>} />
            <Route path="jobs/:jobId" element={<PrivateRoute><JobDetail /></PrivateRoute>} />
            <Route path="history" element={<PrivateRoute><History /></PrivateRoute>} />
            <Route path="evaluation" element={<Navigate to="/jobs" replace />} />
            <Route path="dashboard" element={<Navigate to="/jobs" replace />} />
            <Route path="*" element={<Navigate to="/jobs" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
