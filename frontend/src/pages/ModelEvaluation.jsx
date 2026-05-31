import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { fetchMlCvReport, fetchMlMetrics } from "../api/client";

export default function ModelEvaluation() {
  const [data, setData] = useState(null);
  const [cv, setCv] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([fetchMlMetrics(), fetchMlCvReport().catch(() => null)])
      .then(([d, cvData]) => {
        setData(d);
        setCv(cvData);
      })
      .catch(() => setError("Train model first — see commands below."));
  }, []);

  const tm = data?.metrics?.test_metrics;
  const bl = data?.metrics?.baselines?.tfidf_cosine;
  const comparison = tm && bl ? [
    { name: "Classifier", f1: tm.f1, roc: tm.roc_auc },
    { name: "TF-IDF baseline", f1: bl.f1, roc: bl.roc_auc ?? bl.accuracy },
  ] : [];

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">ML Evaluation</h2>
          <p className="text-sm text-gray-500 mt-1">Real training metrics — for portfolio & reports</p>
        </div>
        <Link to="/labeling" className="text-sm text-accent hover:underline shrink-0">
          Add more labels →
        </Link>
      </div>

      {error && <p className="text-warning">{error}</p>}

      {tm && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {["accuracy", "precision", "recall", "f1", "roc_auc"].map((k) => (
            <div key={k} className="glass rounded-xl p-4 text-center">
              <p className="text-xl font-bold text-accent-glow">{tm[k]}</p>
              <p className="text-xs text-gray-500 uppercase">{k.replace("_", " ")}</p>
            </div>
          ))}
        </div>
      )}

      {cv?.metrics_mean && (
        <div className="glass rounded-2xl p-6">
          <h3 className="text-sm text-gray-400 mb-2">5-fold cross-validation</h3>
          <p className="text-white">
            F1 = <strong>{cv.metrics_mean.f1}</strong> (± {cv.metrics_std?.f1 ?? 0}) · ROC-AUC ={" "}
            <strong>{cv.metrics_mean.roc_auc}</strong>
          </p>
          <p className="text-xs text-gray-600 mt-1">n = {cv.dataset_size} verified pairs</p>
        </div>
      )}

      {comparison.length > 0 && (
        <div className="glass rounded-2xl p-6">
          <h3 className="text-sm text-gray-400 mb-4">Classifier vs baseline</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={comparison}>
              <XAxis dataKey="name" tick={{ fill: "#9ca3af", fontSize: 11 }} />
              <YAxis domain={[0, 1]} tick={{ fill: "#9ca3af" }} />
              <Tooltip contentStyle={{ background: "#1a2030", border: "1px solid #252d3d" }} />
              <Bar dataKey="f1" name="F1" fill="#3b9eff" />
              <Bar dataKey="roc" name="ROC-AUC" fill="#34d399" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="glass rounded-2xl p-6 text-sm text-gray-400 space-y-2">
        <p>Full write-up: <code className="text-accent">docs/ML_REPORT.md</code></p>
        <p>Next: add 50+ labels on <Link to="/labeling" className="text-accent">/labeling</Link>, retrain, refresh this page.</p>
      </div>
    </div>
  );
}
