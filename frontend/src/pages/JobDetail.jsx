import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { downloadJobCsv, errorMessage, fetchJob, renameCandidate, screenResume, updateJob } from "../api/client";
import JobForm from "../components/JobForm";
import { Presence } from "../components/Motion";
import ResultsDashboard from "../components/ResultsDashboard";

const MAX_FILES = 10;
const MAX_BYTES = 8 * 1024 * 1024;

export default function JobDetail() {
  const { jobId } = useParams();
  const [job, setJob] = useState(null);
  const [files, setFiles] = useState([]);
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [screening, setScreening] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState(null);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [renaming, setRenaming] = useState(false);
  const fileInput = useRef(null);

  const load = async (version, initial = false) => {
    if (initial) setLoading(true);
    try {
      const data = await fetchJob(jobId, version ? { version } : {});
      setJob(data);
      setSelectedVersion(data.selected_version);
      setError("");
    } catch (err) {
      if (initial) setJob(null);
      setError(errorMessage(err, "Job not found."));
    } finally {
      if (initial) setLoading(false);
    }
  };

  useEffect(() => {
    load(null, true);
  }, [jobId]);

  const chooseFiles = (list) => {
    const selected = Array.from(list || []);
    if (selected.length > MAX_FILES) {
      setError("Upload at most 10 resumes at once.");
      return;
    }
    const invalid = selected.find((file) => !/\.(pdf|docx)$/i.test(file.name) || file.size > MAX_BYTES || file.size === 0);
    if (invalid) {
      setError(invalid.size > MAX_BYTES
        ? "File is too large. Maximum size is 8 MB."
        : "Upload a non-empty PDF or DOCX.");
      return;
    }
    setError("");
    setFiles(selected);
    setQueue(selected.map((file) => ({ name: file.name, status: "ready", message: "" })));
  };

  const handleScreen = async () => {
    if (!files.length || screening) return;
    setScreening(true);
    setError("");
    let saved = 0;
    for (let index = 0; index < files.length; index += 1) {
      setQueue((current) => current.map((item, itemIndex) => (
        itemIndex === index ? { ...item, status: "analyzing", message: "" } : item
      )));
      try {
        const data = await screenResume(jobId, files[index], job.version);
        const row = data.rankings?.[0];
        const failure = data.errors?.[0];
        if (row) {
          saved += 1;
          setQueue((current) => current.map((item, itemIndex) => (
            itemIndex === index
              ? { ...item, status: row.duplicate ? "duplicate" : "saved", message: row.duplicate ? "Already analyzed for this job version." : "Analysis saved." }
              : item
          )));
        } else {
          setQueue((current) => current.map((item, itemIndex) => (
            itemIndex === index ? { ...item, status: "failed", message: failure?.error || "We could not read this file. Upload a text-based PDF or DOCX." } : item
          )));
        }
      } catch (err) {
        const message = errorMessage(err, "Analysis is temporarily unavailable. Please try again.");
        setQueue((current) => current.map((item, itemIndex) => (
          itemIndex === index ? { ...item, status: "failed", message } : item
        )));
        if (err.response?.status === 409) {
          setError(message);
          break;
        }
      }
    }
    if (saved) toast.success("Analysis saved");
    setScreening(false);
    setFiles([]);
    if (fileInput.current) fileInput.current.value = "";
    await load(job.version);
  };

  const handleUpdate = async (payload) => {
    setSaving(true);
    try {
      const updated = await updateJob(jobId, { ...payload, baseVersion: job.version });
      toast.success(updated.requirements_changed ? "Requirements saved as a new version" : "Job updated");
      setEditing(false);
      await load(updated.version);
    } catch (err) {
      toast.error(errorMessage(err, "Could not update the job."));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-gray-400">Loading job…</p>;
  if (!job) {
    return (
      <div className="space-y-3">
        <p className="text-danger">{error || "Job not found."}</p>
        <button type="button" className="text-sm underline" onClick={() => load(null, true)}>Retry</button>
      </div>
    );
  }

  const rankings = job.rankings || [];

  return (
    <div className="space-y-8">
      <Link to="/jobs" className="text-sm text-accent hover:underline">Back to jobs</Link>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">{job.title}</h1>
          <p className="text-sm text-gray-500 mt-1">Version {job.version}{job.archived ? " · archived" : ""}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="px-3 py-2 rounded-lg bg-surface-700 text-sm disabled:opacity-50" disabled={screening} onClick={() => setEditing((value) => !value)}>
            {editing ? "Close editor" : "Edit job"}
          </button>
          <button
            type="button"
            className="px-3 py-2 rounded-lg bg-surface-700 text-sm"
            onClick={() => downloadJobCsv(jobId, selectedVersion || job.version).catch((err) => toast.error(errorMessage(err, "Export failed.")))}
          >
            Export CSV
          </button>
        </div>
      </div>

      <Presence show={editing && !screening}>
        <div className="glass rounded-2xl p-6 space-y-3">
          <p className="text-sm text-gray-400">Saving creates a new version. Earlier analyses keep the requirements they were scored against.</p>
          <JobForm
            initial={job}
            submitLabel="Save job"
            busy={saving}
            onSubmit={handleUpdate}
          />
        </div>
      </Presence>

      <section className="glass rounded-2xl p-6 space-y-3 text-sm text-gray-300">
        <p className="whitespace-pre-wrap">{job.description}</p>
        <p><span className="text-gray-500">Required skills: </span>{(job.required_skills || []).join(", ")}</p>
        <p><span className="text-gray-500">Experience (not scored): </span>{job.experience_requirements}</p>
        <p><span className="text-gray-500">Education (not scored): </span>{job.education_status}</p>
      </section>

      <section className="glass rounded-2xl p-6 space-y-4">
        <h2 className="text-lg text-white">Upload resumes</h2>
        <p className="text-sm text-gray-400">PDF or DOCX, up to 10 files, 8 MB each. Each file is analyzed against version {job.version}.</p>
        {job.archived ? (
          <p className="text-sm text-warning">Restore this job before screening resumes.</p>
        ) : (
          <>
            <label className="block text-sm text-gray-300">
              Resume files
              <input
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                multiple
                ref={fileInput}
                className="mt-2 block w-full text-sm"
                disabled={screening}
                onChange={(event) => chooseFiles(event.target.files)}
              />
            </label>
            {queue.length > 0 && (
              <ul className="space-y-2" aria-live="polite">
                {queue.map((item, index) => (
                  <li key={`${item.name}-${index}`} className="flex flex-col sm:flex-row sm:justify-between gap-1 text-sm border border-surface-600 rounded-xl px-3 py-2">
                    <span className="text-white">{item.name}</span>
                    <span className={item.status === "failed" ? "text-danger" : "text-gray-400"}>
                      {item.status === "analyzing" ? "Analyzing…" : item.message || item.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {error && <p className="text-danger text-sm" role="alert">{error}</p>}
            <button
              type="button"
              disabled={screening || !files.length}
              onClick={handleScreen}
              className="px-5 py-2.5 rounded-xl bg-accent text-white font-medium disabled:opacity-50"
            >
              {screening ? "Analyzing…" : "Analyze resumes"}
            </button>
          </>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <h2 className="text-lg text-white">Ranked comparison</h2>
          {(job.versions || []).length > 1 && (
            <label className="text-sm text-gray-300">
              Results version
              <select
                className="mt-1 block rounded-lg bg-surface-900 border border-surface-600 px-3 py-2 text-white"
                value={selectedVersion || job.version}
                onChange={(event) => load(Number(event.target.value))}
              >
                {job.versions.map((version) => (
                  <option key={version} value={version}>
                    {version === job.version ? `Version ${version} (current)` : `Version ${version}`}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        {job.requirements_notice && <p className="text-sm text-warning" role="status">{job.requirements_notice}</p>}
        {job.historical_notice && <p className="text-sm text-gray-300" role="status">{job.historical_notice}</p>}
        {rankings.length === 0 ? (
          <p className="text-gray-400 text-sm">
            {selectedVersion && selectedVersion !== job.version
              ? "No resumes were analyzed for this version."
              : "No analyses for this version yet."}
          </p>
        ) : (
          <ol className="space-y-3">
            {rankings.map((row, index) => (
              <li key={row.id} className="glass rounded-2xl p-4">
                <button
                  type="button"
                  className="w-full text-left flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  aria-expanded={openId === row.id}
                  onClick={() => setOpenId(openId === row.id ? null : row.id)}
                >
                  <span className="text-white font-medium">{index + 1}. {row.candidate_name || row.resume_filename}</span>
                  <span className="text-accent-glow">{row.match_percentage}% job match · version {row.job_version}</span>
                </button>
                <Presence show={openId === row.id}>
                  <div className="pt-4">
                    <ResultsDashboard
                      data={row}
                      renaming={renaming}
                      onRename={async (candidateName) => {
                        setRenaming(true);
                        try {
                          await renameCandidate(jobId, row.id, candidateName);
                          toast.success("Candidate name saved");
                          await load(selectedVersion || job.version);
                        } catch (err) {
                          toast.error(errorMessage(err, "Could not save the candidate name."));
                        } finally {
                          setRenaming(false);
                        }
                      }}
                    />
                  </div>
                </Presence>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
