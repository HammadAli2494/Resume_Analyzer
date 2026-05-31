import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { createJob, deleteJob, fetchJobs } from "../api/client";

export default function RecruiterDashboard() {
  const [jobs, setJobs] = useState([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setJobs(await fetchJobs());
      setError("");
    } catch {
      setError("Could not load jobs. Run migrations and start Django.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    setCreating(true);
    try {
      await createJob(title.trim(), description.trim());
      setTitle("");
      setDescription("");
      await load();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to create job");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this job and all candidate screenings?")) return;
    await deleteJob(id);
    await load();
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-white">Recruiter Dashboard</h2>
        <p className="text-sm text-gray-500 mt-1">
          Create a job posting, upload many resumes, and rank candidates automatically.
        </p>
      </div>

      <form onSubmit={handleCreate} className="glass rounded-2xl p-6 space-y-4">
        <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
          New job posting
        </h3>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Job title (e.g. Data Scientist)"
          className="w-full rounded-xl bg-surface-900 border border-surface-600 px-4 py-3 text-white focus:ring-2 focus:ring-accent/50 outline-none"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={6}
          placeholder="Full job description with required skills…"
          className="w-full rounded-xl bg-surface-900 border border-surface-600 px-4 py-3 text-white focus:ring-2 focus:ring-accent/50 outline-none resize-y"
        />
        <button
          type="submit"
          disabled={creating}
          className="px-6 py-2.5 rounded-xl bg-accent text-white font-medium disabled:opacity-50"
        >
          {creating ? "Creating…" : "Create job"}
        </button>
      </form>

      {error && <p className="text-danger text-sm">{error}</p>}

      <div className="glass rounded-2xl overflow-hidden">
        <h3 className="px-6 py-4 text-sm font-medium text-gray-400 border-b border-surface-600">
          Your jobs
        </h3>
        {loading ? (
          <p className="p-6 text-gray-500">Loading…</p>
        ) : jobs.length === 0 ? (
          <p className="p-6 text-gray-500">No jobs yet. Create one above.</p>
        ) : (
          <ul className="divide-y divide-surface-600">
            {jobs.map((job) => (
              <li key={job.id} className="px-6 py-4 flex items-center justify-between gap-4">
                <div>
                  <Link
                    to={`/jobs/${job.id}`}
                    className="font-medium text-white hover:text-accent-glow"
                  >
                    {job.title}
                  </Link>
                  <p className="text-xs text-gray-500 mt-1">
                    {job.candidate_count} candidates screened
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Link
                    to={`/jobs/${job.id}`}
                    className="px-3 py-1.5 rounded-lg bg-surface-700 text-sm text-gray-200 hover:bg-surface-600"
                  >
                    Screen batch
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleDelete(job.id)}
                    className="px-3 py-1.5 rounded-lg text-sm text-danger hover:bg-danger/10"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
