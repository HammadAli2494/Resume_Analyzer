import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import ScoreRing from "./ScoreRing";

function SkillBadge({ name, variant = "matched" }) {
  const styles = {
    matched: "bg-success/15 text-success border-success/30",
    missing: "bg-danger/15 text-danger border-danger/30",
    extra: "bg-accent/15 text-accent-glow border-accent/30",
    detected: "bg-surface-600/50 text-gray-200 border-surface-600",
    term: "bg-surface-700/80 text-gray-300 border-surface-600 font-mono text-xs",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm border ${styles[variant]}`}>
      {variant === "matched" && "✔ "}
      {variant === "missing" && "✗ "}
      {name}
    </span>
  );
}

export default function ResultsDashboard({ data }) {
  const chartData = [
    ...(data.ml_available
      ? [{ name: "ML match prob.", value: data.ml_match_probability, fill: "#22d3ee" }]
      : []),
    { name: "Keyword (TF-IDF)", value: data.keyword_score ?? data.match_percentage, fill: "#3b9eff" },
    { name: "Semantic", value: data.semantic_score ?? 0, fill: "#34d399" },
    { name: "Skill coverage", value: data.skill_coverage, fill: "#fbbf24" },
    { name: "Overall score", value: data.resume_score, fill: "#a78bfa" },
  ];

  const scoreColor =
    data.match_percentage >= 80
      ? "#34d399"
      : data.match_percentage >= 60
        ? "#fbbf24"
        : "#f87171";

  return (
    <section className="space-y-6">
      <h2 className="text-xl font-semibold text-white flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
        Analysis results
      </h2>

      <div className="flex flex-wrap gap-2 text-xs">
        {data.ml_available && (
          <span className="px-2 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
            ML: {data.ml_prediction} · {data.ml_confidence}% confidence · v{data.ml_model_version}
          </span>
        )}
        {data.semantic_method && (
          <span className="text-gray-500 font-mono">{data.semantic_method}</span>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="glass rounded-2xl p-6 flex flex-col items-center">
          <div className="relative">
            <ScoreRing
              value={data.ml_match_probability ?? data.match_percentage}
              label={data.ml_available ? "ML match %" : "Overall match"}
              color={scoreColor}
            />
          </div>
          <p className="mt-4 text-center text-sm text-gray-400">
            {data.ml_available
              ? "Trained classifier probability (primary score)"
              : "Train ML model for supervised match probability"}
          </p>
        </div>

        <div className="glass rounded-2xl p-6 lg:col-span-2">
          <h3 className="text-sm font-medium text-gray-400 mb-4">Score breakdown</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20 }}>
              <XAxis type="number" domain={[0, 100]} tick={{ fill: "#9ca3af", fontSize: 12 }} />
              <YAxis type="category" dataKey="name" width={120} tick={{ fill: "#e5e7eb", fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: "#1a2030", border: "1px solid #252d3d", borderRadius: "8px" }}
                formatter={(v) => [`${v}%`, "Score"]}
              />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={24}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-center text-2xl font-bold text-white mt-2">
            Resume score: <span className="text-accent-glow">{data.resume_score}</span>/100
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="glass rounded-2xl p-6">
          <h3 className="text-sm font-medium text-success mb-3">Top matching terms</h3>
          <div className="flex flex-wrap gap-2">
            {(data.top_matching_terms || []).map((t) => (
              <SkillBadge key={t} name={t} variant="term" />
            ))}
            {!data.top_matching_terms?.length && (
              <p className="text-gray-500 text-sm">No overlap terms found.</p>
            )}
          </div>
        </div>
        <div className="glass rounded-2xl p-6">
          <h3 className="text-sm font-medium text-danger mb-3">Top missing terms (from JD)</h3>
          <div className="flex flex-wrap gap-2">
            {(data.top_missing_terms || []).map((t) => (
              <SkillBadge key={t} name={t} variant="term" />
            ))}
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="glass rounded-2xl p-6">
          <h3 className="text-sm font-medium text-success mb-3">Matched skills</h3>
          <div className="flex flex-wrap gap-2">
            {data.matched_skills?.length ? (
              data.matched_skills.map((s) => <SkillBadge key={s} name={s} variant="matched" />)
            ) : (
              <p className="text-gray-500 text-sm">None detected.</p>
            )}
          </div>
        </div>
        <div className="glass rounded-2xl p-6">
          <h3 className="text-sm font-medium text-danger mb-3">Missing skills</h3>
          <div className="flex flex-wrap gap-2">
            {data.missing_skills?.length ? (
              data.missing_skills.map((s) => <SkillBadge key={s} name={s} variant="missing" />)
            ) : (
              <p className="text-gray-500 text-sm">Full skill coverage.</p>
            )}
          </div>
        </div>
      </div>

      {data.entities && (
        <div className="glass rounded-2xl p-6 grid sm:grid-cols-2 gap-4 text-sm">
          {data.entities.organizations?.length > 0 && (
            <div>
              <span className="text-gray-500">Organizations: </span>
              {data.entities.organizations.join(", ")}
            </div>
          )}
          {data.entities.job_titles?.length > 0 && (
            <div>
              <span className="text-gray-500">Titles detected: </span>
              {data.entities.job_titles.join(", ")}
            </div>
          )}
        </div>
      )}

      <div className="glass rounded-2xl p-6">
        <h3 className="text-sm font-medium text-gray-400 mb-3">All skills on resume</h3>
        <div className="flex flex-wrap gap-2">
          {data.detected_skills?.map((s) => (
            <SkillBadge key={s} name={s} variant="detected" />
          ))}
        </div>
      </div>

      <div className="glass rounded-2xl p-6 border-accent/20">
        <h3 className="text-sm font-medium text-accent-glow mb-3">
          {data.llm_available ? "AI coach feedback (LLM)" : "Coaching tips"}
        </h3>
        <ul className="space-y-2">
          {(data.llm_feedback?.length ? data.llm_feedback : data.suggestions)?.map((tip, i) => (
            <li key={i} className="flex gap-2 text-sm text-gray-300">
              <span className="text-accent shrink-0">→</span>
              {tip}
            </li>
          ))}
        </ul>
        {data.resume_improvements?.length > 0 && (
          <>
            <h3 className="text-sm font-medium text-white mt-4 mb-2">Suggested rewrites</h3>
            <ul className="space-y-2">
              {data.resume_improvements.map((tip, i) => (
                <li key={i} className="text-sm text-gray-400 pl-4 border-l-2 border-accent/30">
                  {tip}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      {data.saved && (
        <p className="text-success text-sm">Saved to your screening history.</p>
      )}
    </section>
  );
}
