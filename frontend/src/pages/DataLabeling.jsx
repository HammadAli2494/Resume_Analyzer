import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  createTrainingPair,
  exportAndTrain,
  fetchTrainingPairs,
  fetchTrainingStats,
  importTrainingCSV,
} from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function DataLabeling() {
  const { isAuthenticated } = useAuth();
  const [stats, setStats] = useState(null);
  const [pairs, setPairs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [training, setTraining] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [form, setForm] = useState({
    resume_text: "",
    job_text: "",
    label: "1",
    role: "",
  });

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [s, p] = await Promise.all([
        fetchTrainingStats(),
        fetchTrainingPairs({ verified: true, limit: 20 }),
      ]);
      setStats(s);
      setPairs(Array.isArray(p) ? p : p.results || []);
    } catch (e) {
      setError(e.response?.data?.error || "Failed to load training data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!isAuthenticated) return setMsg("Login required to add labels");
    setMsg("");
    try {
      await createTrainingPair({
        ...form,
        label: Number(form.label),
        is_verified: true,
      });
      setForm({ resume_text: "", job_text: "", label: "1", role: "" });
      setMsg("Label saved");
      load();
    } catch (e) {
      setMsg(e.response?.data?.error || "Save failed");
    }
  };

  const handleImport = async () => {
    if (!csvFile) return setMsg("Select a CSV file");
    if (!isAuthenticated) return setMsg("Login required to import");
    setTraining(true);
    setMsg("");
    try {
      const r = await importTrainingCSV(csvFile);
      setMsg(`Imported ${r.created} pairs (${r.skipped} skipped)`);
      load();
    } catch (e) {
      setMsg(e.response?.data?.error || "Import failed");
    } finally {
      setTraining(false);
    }
  };

  const handleTrain = async () => {
    if (!isAuthenticated) return setMsg("Login required to train");
    setTraining(true);
    setMsg("");
    try {
      const r = await exportAndTrain();
      setMsg(
        `Trained ${r.model_name} on ${r.exported_rows} real rows — F1=${r.test_metrics.f1}`
      );
      load();
    } catch (e) {
      setMsg(e.response?.data?.error || "Training failed");
    } finally {
      setTraining(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white">Real Data Labeling</h2>
        <p className="text-sm text-gray-500 mt-1">
          Build a verified resume–job dataset for production ML (not synthetic-only demo).
        </p>
      </div>

      {loading && <p className="text-gray-500">Loading…</p>}
      {error && <p className="text-danger">{error}</p>}

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Verified total" value={stats.total_verified} />
          <StatCard label="Good fit (1)" value={stats.label_1} />
          <StatCard label="Not fit (0)" value={stats.label_0} />
          <StatCard
            label="Ready to train"
            value={stats.ready_for_training ? "Yes" : `Need ${stats.min_required_for_training}`}
            highlight={stats.ready_for_training}
          />
        </div>
      )}

      {!isAuthenticated && (
        <p className="text-sm text-warning">
          <Link to="/login" className="text-accent underline">Login</Link> to add labels, import CSV, or train.
        </p>
      )}

      <form onSubmit={handleCreate} className="glass rounded-2xl p-6 space-y-4">
        <h3 className="text-sm font-medium text-gray-400">Add manual label</h3>
        <input
          type="text"
          placeholder="Role (optional)"
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value })}
          className="w-full rounded-lg bg-surface-900 border border-surface-600 px-3 py-2 text-sm text-white"
        />
        <textarea
          placeholder="Resume text"
          rows={4}
          required
          value={form.resume_text}
          onChange={(e) => setForm({ ...form, resume_text: e.target.value })}
          className="w-full rounded-lg bg-surface-900 border border-surface-600 px-3 py-2 text-sm text-white"
        />
        <textarea
          placeholder="Job description text"
          rows={4}
          required
          value={form.job_text}
          onChange={(e) => setForm({ ...form, job_text: e.target.value })}
          className="w-full rounded-lg bg-surface-900 border border-surface-600 px-3 py-2 text-sm text-white"
        />
        <div className="flex flex-wrap gap-4 items-center">
          <label className="text-sm text-gray-400">
            Label{" "}
            <select
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              className="ml-2 rounded bg-surface-900 border border-surface-600 px-2 py-1 text-white"
            >
              <option value="1">1 — good fit</option>
              <option value="0">0 — not a fit</option>
            </select>
          </label>
          <button
            type="submit"
            disabled={!isAuthenticated}
            className="px-5 py-2 rounded-xl bg-accent text-white text-sm disabled:opacity-50"
          >
            Save label
          </button>
        </div>
      </form>

      {isAuthenticated && (
        <div className="glass rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-medium text-gray-400">Import CSV</h3>
          <p className="text-xs text-gray-500">
            Columns: <code className="text-accent">resume_text, job_text, label</code> (optional: role)
          </p>
          <input
            type="file"
            accept=".csv"
            onChange={(e) => setCsvFile(e.target.files?.[0])}
            className="text-sm text-gray-400"
          />
          <button
            type="button"
            onClick={handleImport}
            disabled={training || !csvFile}
            className="px-5 py-2 rounded-xl bg-surface-700 text-white text-sm disabled:opacity-50"
          >
            Import CSV
          </button>
        </div>
      )}

      {isAuthenticated && (
        <div className="glass rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-medium text-gray-400">Train on real data</h3>
          <p className="text-xs text-gray-500">
            Exports verified pairs to <code className="text-accent">ml/data/processed/resume_job_pairs.csv</code> and runs training (min 50 verified rows).
          </p>
          <button
            type="button"
            onClick={handleTrain}
            disabled={training || !stats?.ready_for_training}
            className="px-6 py-2 rounded-xl bg-success/80 text-white text-sm disabled:opacity-50"
          >
            {training ? "Training…" : "Train on real data"}
          </button>
        </div>
      )}

      {msg && <p className="text-sm text-success">{msg}</p>}

      <div className="glass rounded-2xl p-6">
        <h3 className="text-sm font-medium text-gray-400 mb-4">Recent verified pairs</h3>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {pairs.length ? (
            pairs.map((p) => (
              <div key={p.id} className="rounded-lg bg-surface-900 p-3 text-sm border border-surface-600">
                <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                  <span className="font-mono text-accent">label={p.label}</span>
                  {p.role && <span>{p.role}</span>}
                  <span>{p.source}</span>
                </div>
                <p className="text-gray-400 mt-1 truncate">{p.resume_text}</p>
                <p className="text-gray-500 text-xs mt-1 truncate">{p.job_text}</p>
              </div>
            ))
          ) : (
            <p className="text-gray-500">No verified pairs yet. Run import_seed_data or add labels.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, highlight }) {
  return (
    <div
      className={`glass rounded-xl p-4 text-center ${
        highlight ? "border border-success/40" : ""
      }`}
    >
      <p className="text-2xl font-bold text-accent-glow">{value}</p>
      <p className="text-xs text-gray-500 uppercase">{label}</p>
    </div>
  );
}
