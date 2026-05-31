import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchMlInfo } from "../api/client";

export default function MLModelBanner() {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    fetchMlInfo()
      .then(setInfo)
      .catch(() => setInfo({ ml_ready: false }));
  }, []);

  if (!info) return null;

  if (!info.ml_ready) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
        Model not loaded. From <code className="font-mono text-xs">backend/</code> run:{" "}
        <code className="font-mono text-xs bg-surface-900 px-1 rounded">python manage.py train_ml --real-only</code>
        {" · "}
        <Link to="/evaluation" className="text-accent hover:underline">
          Evaluation
        </Link>
      </div>
    );
  }

  const card = info.model_card || {};
  const m = card.test_metrics || {};

  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
      <span className="text-emerald-300 font-medium">Classifier ready</span>
      <span className="text-gray-400">F1 {m.f1 ?? "—"} · AUC {m.roc_auc ?? "—"}</span>
      <Link to="/evaluation" className="text-accent text-xs hover:underline">
        View metrics →
      </Link>
    </div>
  );
}
