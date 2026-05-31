import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Layout from "./components/Layout";
import PrivateRoute from "./components/PrivateRoute";
import QuickAnalyze from "./pages/QuickAnalyze";
import RecruiterDashboard from "./pages/RecruiterDashboard";
import JobDetail from "./pages/JobDetail";
import DataLabeling from "./pages/DataLabeling";
import ModelEvaluation from "./pages/ModelEvaluation";
import Login from "./pages/Login";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<Layout />}>
            <Route index element={<QuickAnalyze />} />
            <Route path="labeling" element={<DataLabeling />} />
            <Route path="evaluation" element={<ModelEvaluation />} />
            <Route
              path="jobs"
              element={
                <PrivateRoute>
                  <RecruiterDashboard />
                </PrivateRoute>
              }
            />
            <Route
              path="jobs/:jobId"
              element={
                <PrivateRoute>
                  <JobDetail />
                </PrivateRoute>
              }
            />
            <Route path="dashboard" element={<Navigate to="/jobs" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
