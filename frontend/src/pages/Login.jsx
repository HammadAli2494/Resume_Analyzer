import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "login") {
        await login(username, password);
      } else {
        await register(username, password, email);
      }
      navigate("/dashboard");
    } catch (err) {
      const data = err.response?.data;
      setError(
        data?.error ||
          data?.detail ||
          (typeof data === "object" ? JSON.stringify(data) : null) ||
          "Authentication failed"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto glass rounded-2xl p-8 space-y-6">
      <h2 className="text-xl font-bold text-white">
        {mode === "login" ? "Recruiter login" : "Create account"}
      </h2>
      <p className="text-sm text-gray-500">
        Sign in to create jobs, batch-screen resumes, and export rankings.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          required
          className="w-full rounded-xl bg-surface-900 border border-surface-600 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-accent/50"
        />
        {mode === "register" && (
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email (optional)"
            className="w-full rounded-xl bg-surface-900 border border-surface-600 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-accent/50"
          />
        )}
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password (min 8 chars)"
          required
          minLength={8}
          className="w-full rounded-xl bg-surface-900 border border-surface-600 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-accent/50"
        />
        {error && <p className="text-danger text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl bg-accent text-white font-semibold disabled:opacity-50"
        >
          {loading ? "Please wait…" : mode === "login" ? "Login" : "Register"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => setMode(mode === "login" ? "register" : "login")}
        className="text-sm text-accent hover:underline"
      >
        {mode === "login" ? "Need an account? Register" : "Already have an account? Login"}
      </button>

      <Link to="/" className="block text-center text-sm text-gray-500 hover:text-gray-300">
        ← Continue without login (Quick Analyze)
      </Link>
    </div>
  );
}
