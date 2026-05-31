import { useState } from "react";
import { analyzeResume } from "../api/client";
import { useAuth } from "../context/AuthContext";
import ResumeUpload from "../components/ResumeUpload";
import JobDescriptionInput from "../components/JobDescriptionInput";
import MLModelBanner from "../components/MLModelBanner";
import ResultsDashboard from "../components/ResultsDashboard";

export default function QuickAnalyze() {
  const { isAuthenticated } = useAuth();
  const [resumeFile, setResumeFile] = useState(null);
  const [saveToHistory, setSaveToHistory] = useState(false);
  const [jobDescription, setJobDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const handleAnalyze = async () => {
    setError("");
    setResult(null);
    if (!resumeFile) {
      setError("Please upload a resume (PDF or DOCX).");
      return;
    }
    if (!jobDescription.trim()) {
      setError("Please paste a job description.");
      return;
    }

    setLoading(true);
    try {
      const data = await analyzeResume(resumeFile, jobDescription, {
        save: isAuthenticated && saveToHistory,
      });
      setResult(data);
    } catch (err) {
      const data = err.response?.data;
      setError(
        (typeof data === "object" && data?.error) ||
          err.message ||
          "Analysis failed. Is Django running on port 8000?"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <MLModelBanner />

      <p className="text-gray-400 text-sm leading-relaxed max-w-3xl">
        Supervised ML classifier predicts match probability; keyword & semantic scores
        support explainability.
      </p>

      <div className="grid lg:grid-cols-2 gap-6">
        <ResumeUpload file={resumeFile} onFileChange={setResumeFile} disabled={loading} />
        <JobDescriptionInput
          value={jobDescription}
          onChange={setJobDescription}
          disabled={loading}
        />
      </div>

      {isAuthenticated && (
        <label className="flex items-center gap-2 text-sm text-gray-400">
          <input
            type="checkbox"
            checked={saveToHistory}
            onChange={(e) => setSaveToHistory(e.target.checked)}
            className="rounded border-surface-600"
          />
          Save this analysis to my history
        </label>
      )}

      <div className="flex flex-col sm:flex-row items-center gap-4">
        <button
          type="button"
          onClick={handleAnalyze}
          disabled={loading}
          className="w-full sm:w-auto px-8 py-3 rounded-xl bg-accent hover:bg-accent-glow text-white font-semibold transition disabled:opacity-50"
        >
          {loading ? "Analyzing…" : "Analyze Match"}
        </button>
        {error && <p className="text-danger text-sm flex-1">{error}</p>}
      </div>

      {result && <ResultsDashboard data={result} />}
    </div>
  );
}
