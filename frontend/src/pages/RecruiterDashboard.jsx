import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { archiveJob, createJob, deleteJob, errorMessage, fetchJobs } from "../api/client";
import JobForm from "../components/JobForm";
import { Presence } from "../components/Motion";

export default function RecruiterDashboard() {
  const [jobs, setJobs] = useState([]);
  const [archivedView, setArchivedView] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState("");

  const load = async (archived = archivedView) => {
    setLoading(true);
    try {
      setJobs(await fetchJobs(archived));
      setError("");
    } catch (err) {
      setError(errorMessage(err, "Could not load jobs."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(archivedView);
  }, [archivedView]);

  const handleCreate = async (payload) => {
    setCreating(true);
    try {
      await createJob(payload);
      toast.success("Job created");
      setShowForm(false);
      setArchivedView(false);
      await load(false);
    } catch (err) {
      toast.error(errorMessage(err, "Could not create the job."));
    } finally {
      setCreating(false);
    }
  };

  const handleArchive = async (job) => {
    const verb = job.archived ? "Restore" : "Archive";
    if (pendingId) return;
    if (!window.confirm(`${verb} “${job.title}”? Analyses stay attached to this job.`)) return;
    setPendingId(job.id);
    try {
      await archiveJob(job.id, !job.archived);
      toast.success(job.archived ? "Job restored" : "Job archived");
      await load();
    } catch (err) {
      toast.error(errorMessage(err, "Could not update the job."));
    } finally {
      setPendingId("");
    }
  };

  const handleDelete = async (job) => {
    if (pendingId) return;
    if (!window.confirm(`Delete “${job.title}” and its saved analyses? Extracted resume text for those analyses will be removed.`)) return;
    setPendingId(job.id);
    try {
      await deleteJob(job.id);
      toast.success("Job deleted");
      await load();
    } catch (err) {
      toast.error(errorMessage(err, "Could not delete the job."));
    } finally {
      setPendingId("");
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Jobs</h1>
          <p className="text-sm text-gray-400 mt-1">Create a job, then screen resumes against that job.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="px-3 py-2 rounded-lg bg-surface-700 text-sm" onClick={() => setArchivedView((value) => !value)}>
            {archivedView ? "Show active jobs" : "Show archived"}
          </button>
          {!archivedView && (
            <button type="button" className="px-3 py-2 rounded-lg bg-accent text-sm text-white" onClick={() => setShowForm((value) => !value)}>
              {showForm ? "Close form" : "New job"}
            </button>
          )}
        </div>
      </div>

      <Presence show={showForm && !archivedView}>
        <div className="glass rounded-2xl p-6">
          <h2 className="text-lg text-white mb-4">New job</h2>
          <JobForm submitLabel="Create job" busy={creating} onSubmit={handleCreate} />
        </div>
      </Presence>

      {error && (
        <div className="rounded-xl border border-danger/40 p-4 text-sm text-danger flex justify-between gap-3">
          <span>{error}</span>
          <button type="button" className="underline" onClick={() => load()}>Retry</button>
        </div>
      )}

      <section className="glass rounded-2xl overflow-hidden">
        <h2 className="px-6 py-4 text-sm text-gray-400 border-b border-surface-600">{archivedView ? "Archived jobs" : "Your jobs"}</h2>
        {loading ? (
          <p className="p-6 text-gray-400">Loading jobs…</p>
        ) : jobs.length === 0 ? (
          <p className="p-6 text-gray-400">{archivedView ? "No archived jobs." : "No jobs yet. Create one to start screening."}</p>
        ) : (
          <ul className="divide-y divide-surface-600">
            {jobs.map((job) => (
              <li key={job.id} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <Link to={`/jobs/${job.id}`} className="font-medium text-white hover:text-accent-glow">{job.title}</Link>
                  <p className="text-xs text-gray-500 mt-1">
                    {job.candidate_count} screened · version {job.version}
                    {job.education_requirements ? "" : " · education not specified"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link to={`/jobs/${job.id}`} className="px-3 py-1.5 rounded-lg bg-surface-700 text-sm">Open</Link>
                  <button type="button" className="px-3 py-1.5 rounded-lg bg-surface-700 text-sm disabled:opacity-50" disabled={pendingId === job.id} onClick={() => handleArchive(job)}>
                    {job.archived ? "Restore" : "Archive"}
                  </button>
                  <button type="button" className="px-3 py-1.5 rounded-lg text-sm text-danger disabled:opacity-50" disabled={pendingId === job.id} onClick={() => handleDelete(job)}>Delete</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
