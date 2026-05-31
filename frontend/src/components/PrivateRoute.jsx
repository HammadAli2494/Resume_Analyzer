import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function PrivateRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <p className="text-gray-500 py-12 text-center">Loading…</p>;
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: "protected" }} />;
  }
  return children;
}
