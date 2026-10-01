import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { errorMessage, fetchHistory, renameCandidate } from "../api/client";
import ResultsDashboard from "../components/ResultsDashboard";
import { Presence } from "../components/Motion";

function when(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
}

export default function History() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState(null);
  const [total, setTotal] = useState(0);
  const [renaming, setRenaming] = useState(false);

  const load = () => {
    setLoading(true);
    fetchHistory()
      .then((data) => {
        const results = Array.isArray(data) ? data : (data.results || []);
        setRows(results);
        setTotal(Array.isArray(data) ? results.length : (data.total || results.length));
        setError("");
      })
      .catch((err) => setError(errorMessage(err, "Could not load analysis history.")))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Analysis history</h1>
        <p className="text-sm text-gray-400 mt-1">Saved results keep the job version they were scored against.{total ? ` Showing ${rows.length} of ${total}.` : ""}</p>
      </div>
      {error && (
        <div className="rounded-xl border border-danger/40 p-4 text-sm text-danger flex justify-between gap-3">
          <span>{error}</span>
          <button type="button" className="underline" onClick={load}>Retry</button>
        </div>
      )}
      {loading ? (
        <p className="text-gray-400">Loading history…</p>
      ) : rows.length === 0 ? (
        <p className="text-gray-400">No analyses yet. Open a job and upload a resume.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.id} className="glass rounded-2xl p-4 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                <button
                  type="button"
                  className="text-left"
                  aria-expanded={openId === row.id}
                  onClick={() => setOpenId(openId === row.id ? null : row.id)}
                >
                  <span className="block text-white font-medium">{row.candidate_name || row.resume_filename}</span>
                  <span className="block text-sm text-gray-400">
                    {row.job_title || "Job"}
                    {row.job_version ? ` · version ${row.job_version}` : ""}
                    {" · "}{row.match_percentage}% job match · {when(row.created_at)}
                  </span>
                </button>
                {row.job_id && (
                  <Link to={`/jobs/${row.job_id}`} className="text-sm text-accent hover:underline shrink-0">Open job</Link>
                )}
              </div>
              <Presence show={openId === row.id}>
                <div className="pt-2">
                  <ResultsDashboard
                    data={row}
                    renaming={renaming}
                    onRename={row.job_id ? async (candidateName) => {
                      setRenaming(true);
                      try {
                        await renameCandidate(row.job_id, row.id, candidateName);
                        await load();
                      } catch (err) {
                        setError(errorMessage(err, "Could not save the candidate name."));
                      } finally {
                        setRenaming(false);
                      }
                    } : undefined}
                  />
                </div>
              </Presence>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
