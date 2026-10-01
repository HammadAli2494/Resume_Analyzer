import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { errorMessage } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { FadeIn } from "../components/Motion";

const fieldClass = "w-full rounded-xl bg-surface-900 border border-surface-600 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-accent/50";

export default function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(() => {
    const notice = sessionStorage.getItem("auth_notice") || "";
    if (notice) sessionStorage.removeItem("auth_notice");
    return notice;
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "login") {
        await login(email, password);
        toast.success("Signed in");
      } else {
        await register(name, email, password);
        toast.success("Account created");
      }
      navigate("/jobs");
    } catch (err) {
      const message = errorMessage(err, "Incorrect email or password.");
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <FadeIn className="max-w-md mx-auto glass rounded-2xl p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">{mode === "login" ? "Sign in" : "Create an account"}</h1>
        <p className="text-sm text-gray-400 mt-2">Save jobs, screen resumes against those jobs, and review the results later.</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === "register" && (
          <label className="block text-sm text-gray-300">
            Name
            <input className={`${fieldClass} mt-1`} value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
        )}
        <label className="block text-sm text-gray-300">
          Email
          <input type="email" className={`${fieldClass} mt-1`} value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label className="block text-sm text-gray-300">
          Password
          <input type="password" minLength={8} className={`${fieldClass} mt-1`} value={password} onChange={(event) => setPassword(event.target.value)} required />
        </label>
        {error && <p className="text-danger text-sm" role="alert">{error}</p>}
        <button type="submit" disabled={loading} className="w-full py-3 rounded-xl bg-accent text-white font-semibold disabled:opacity-50">
          {loading ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
        </button>
      </form>
      <button
        type="button"
        className="text-sm text-accent hover:underline"
        onClick={() => {
          setMode(mode === "login" ? "register" : "login");
          setError("");
        }}
      >
        {mode === "login" ? "Need an account? Register" : "Already have an account? Sign in"}
      </button>
    </FadeIn>
  );
}
