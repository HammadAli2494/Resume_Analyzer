import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { batchScreen, downloadJobCsv, fetchJob } from "../api/client";

export default function JobDetail() {
  const { jobId } = useParams();
  const [job, setJob] = useState(null);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [screening, setScreening] = useState(false);
  const [error, setError] = useState("");
  const [batchResult, setBatchResult] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      setJob(await fetchJob(jobId));
      setError("");
    } catch {
      setError("Job not found");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [jobId]);

  const handleFiles = (e) => {
    setFiles(Array.from(e.target.files || []));
  };

  const handleBatch = async () => {
    if (!files.length) {
      setError("Select one or more PDF/DOCX resumes.");
      return;
    }
    setScreening(true);
    setError("");
    setBatchResult(null);
    try {
      const data = await batchScreen(jobId, files);
      setBatchResult(data);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || "Batch screening failed");
    } finally {
      setScreening(false);
    }
  };

  if (loading) return <p className="text-gray-500">Loading job…</p>;
  if (!job) return <p className="text-danger">{error || "Not found"}</p>;

  const rankings = batchResult?.rankings?.length
    ? batchResult.rankings
    : job.rankings || [];

  return (
    <div className="space-y-8">
      <Link to="/dashboard" className="text-sm text-accent hover:underline">
        ← Back to dashboard
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">{job.title}</h2>
          <p className="text-sm text-gray-500 mt-2 whitespace-pre-wrap">{job.description}</p>
        </div>
        <button
          type="button"
          onClick={() => downloadJobCsv(jobId)}
          className="shrink-0 px-4 py-2 rounded-lg bg-surface-700 text-sm text-gray-200 hover:bg-surface-600"
        >
          Export CSV ↓
        </button>
      </div>

      <div className="glass rounded-2xl p-6 space-y-4">
        <h3 className="text-sm font-medium text-gray-400 uppercase">Batch upload</h3>
        <input
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          multiple
          onChange={handleFiles}
          className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-accent file:text-white"
        />
        {files.length > 0 && (
          <p className="text-sm text-gray-500">{files.length} file(s) selected</p>
        )}
        <button
          type="button"
          onClick={handleBatch}
          disabled={screening}
          className="px-6 py-2.5 rounded-xl bg-accent text-white font-medium disabled:opacity-50"
        >
          {screening ? "Screening…" : "Screen & rank all"}
        </button>
        {error && <p className="text-danger text-sm">{error}</p>}
        {batchResult && (
          <p className="text-success text-sm">
            Screened {batchResult.screened} — failed {batchResult.failed}
          </p>
        )}
      </div>

      <div className="glass rounded-2xl overflow-x-auto">
        <h3 className="px-6 py-4 text-sm font-medium text-gray-400 border-b border-surface-600">
          Candidate rankings (highest score first)
        </h3>
        {rankings.length === 0 ? (
          <p className="p-6 text-gray-500">No candidates screened yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-surface-600">
                <th className="px-6 py-3">#</th>
                <th className="px-6 py-3">Candidate</th>
                <th className="px-6 py-3">Score</th>
                <th className="px-6 py-3">Match</th>
                <th className="px-6 py-3">Keyword</th>
                <th className="px-6 py-3">Semantic</th>
                <th className="px-6 py-3">Missing skills</th>
              </tr>
            </thead>
            <tbody>
              {rankings.map((c, i) => (
                <tr key={c.id} className="border-b border-surface-600/50 hover:bg-surface-700/30">
                  <td className="px-6 py-3 text-gray-500">{i + 1}</td>
                  <td className="px-6 py-3 text-white font-medium">
                    {c.candidate_name || c.resume_filename}
                  </td>
                  <td className="px-6 py-3 text-accent-glow font-bold">{c.resume_score}</td>
                  <td className="px-6 py-3">{c.match_percentage}%</td>
                  <td className="px-6 py-3">{c.keyword_score}%</td>
                  <td className="px-6 py-3">{c.semantic_score}%</td>
                  <td className="px-6 py-3 text-gray-400 max-w-xs truncate">
                    {(c.missing_skills || []).slice(0, 4).join(", ") || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
