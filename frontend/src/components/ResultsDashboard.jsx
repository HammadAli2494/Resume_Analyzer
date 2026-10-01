import { useEffect, useState } from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import ScoreRing from "./ScoreRing";

function Badge({ children, tone }) {
  const tones = {
    match: "bg-success/15 text-success border-success/30",
    miss: "bg-danger/15 text-danger border-danger/30",
    term: "bg-surface-700 text-gray-200 border-surface-600",
  };
  return <span className={`inline-flex px-3 py-1 rounded-full text-sm border ${tones[tone]}`}>{children}</span>;
}

function percent(value) {
  return value == null || Number.isNaN(Number(value)) ? null : Math.round(Number(value) * 10) / 10;
}

export default function ResultsDashboard({ data, onRename, renaming = false }) {
  const [name, setName] = useState(data.candidate_name || "");
  useEffect(() => {
    setName(data.candidate_name || "");
  }, [data.id, data.candidate_name]);
  const match = percent(data.match_percentage) ?? 0;
  const keyword = percent(data.keyword_score);
  const wording = percent(data.wording_overlap);
  const skills = data.skills_specified === false || data.skill_coverage == null ? null : percent(data.skill_coverage);
  const signal = percent(data.model_signal);
  const chartData = [
    { name: "Job match", value: match, fill: "#3b9eff" },
    ...(keyword == null ? [] : [{ name: "Keyword overlap", value: keyword, fill: "#5eb8ff" }]),
    ...(wording == null ? [] : [{ name: "Wording overlap", value: wording, fill: "#94a3b8" }]),
    ...(skills == null ? [] : [{ name: "Skill coverage", value: skills, fill: "#34d399" }]),
    ...(signal == null ? [] : [{ name: "Classifier signal", value: signal, fill: "#fbbf24" }]),
  ];

  return (
    <section className="space-y-6" aria-label="Analysis result">
      <div>
        <h3 className="text-lg font-semibold text-white">{data.candidate_name || data.resume_filename || "Resume"}</h3>
        <p className="text-xs text-gray-500 mt-1">
          {data.name_source === "recruiter"
            ? "Candidate name entered by you."
            : "This name comes from the file name, not from the resume text."}
        </p>
        {data.job_version ? <p className="text-xs text-gray-500 mt-1">Scored against job version {data.job_version}.</p> : null}
        <p className="text-sm text-gray-400 mt-2">{data.explanation}</p>
      </div>
      {onRename && (
        <form
          className="flex flex-col sm:flex-row gap-2 sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            onRename(name);
          }}
        >
          <label className="block text-sm text-gray-300 flex-1">
            Candidate name
            <input
              className="mt-1 w-full rounded-xl bg-surface-900 border border-surface-600 px-3 py-2 text-white"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <button type="submit" disabled={renaming || name.trim().length < 2} className="px-4 py-2 rounded-xl bg-surface-700 text-sm disabled:opacity-50">
            {renaming ? "Saving…" : "Save name"}
          </button>
        </form>
      )}

      <div className="grid lg:grid-cols-[180px_1fr] gap-6 items-center">
        <ScoreRing value={match} label="Job match" />
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 16, right: 12 }}>
              <XAxis type="number" domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 12 }} />
              <YAxis type="category" dataKey="name" width={120} tick={{ fill: "#e5e7eb", fontSize: 12 }} />
              <Tooltip formatter={(value) => [`${value}%`, ""]} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                {chartData.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <dl className="grid sm:grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-surface-900/60 p-3">
          <dt className="text-gray-500">Keyword overlap</dt>
          <dd className="text-white mt-1">{keyword == null ? "Not available" : `${keyword}%`}</dd>
        </div>
        <div className="rounded-xl bg-surface-900/60 p-3">
          <dt className="text-gray-500">Wording overlap</dt>
          <dd className="text-white mt-1">{wording == null ? "Not available" : `${wording}% of shared character patterns`}</dd>
        </div>
        <div className="rounded-xl bg-surface-900/60 p-3">
          <dt className="text-gray-500">Required skill coverage</dt>
          <dd className="text-white mt-1">{skills == null ? "Not specified" : `${skills}%`}</dd>
        </div>
        <div className="rounded-xl bg-surface-900/60 p-3">
          <dt className="text-gray-500">Classifier signal</dt>
          <dd className="text-white mt-1">{signal == null ? "Not used" : `${signal} — uncalibrated`}</dd>
        </div>
      </dl>

      {data.model_lean && <p className="text-sm text-gray-300">{data.model_lean}</p>}
      {data.model_note && <p className="text-sm text-gray-500">{data.model_note}</p>}

      <div className="space-y-3">
        <h4 className="text-sm text-gray-400">Matching skills</h4>
        <div className="flex flex-wrap gap-2">
          {(data.matched_skills || []).length
            ? data.matched_skills.map((skill) => <Badge key={skill} tone="match">{skill}</Badge>)
            : <span className="text-sm text-gray-500">None found in the resume text.</span>}
        {(data.skill_evidence || []).map((item) => (
          <p key={`${item.label}-${item.evidence}`} className="text-xs text-gray-500">
            {item.label}: “{item.evidence}”
          </p>
        ))}
        </div>
        <h4 className="text-sm text-gray-400">Missing required skills</h4>
        <div className="flex flex-wrap gap-2">
          {(data.missing_skills || []).length
            ? data.missing_skills.map((skill) => <Badge key={skill} tone="miss">{skill}</Badge>)
            : <span className="text-sm text-gray-500">No listed skill was missing from the resume text.</span>}
        </div>
        <h4 className="text-sm text-gray-400">Shared terms</h4>
        <div className="flex flex-wrap gap-2">
          {(data.top_matching_terms || []).map((term) => <Badge key={`m-${term}`} tone="term">{term}</Badge>)}
        </div>
        <h4 className="text-sm text-gray-400">Job terms not found in the resume</h4>
        <div className="flex flex-wrap gap-2">
          {(data.top_missing_terms || []).map((term) => <Badge key={`x-${term}`} tone="term">{term}</Badge>)}
        </div>
      </div>

      {data.experience_requirements && (
        <p className="text-sm text-gray-300">Experience requirement, for reviewers only and not scored: {data.experience_requirements}</p>
      )}
      <p className="text-sm text-gray-300">Education, for reviewers only and not scored: {data.education_status || "Not specified"}</p>
      <ul className="list-disc pl-5 text-sm text-gray-300 space-y-1">
        {(data.recommendations || []).map((note) => <li key={note}>{note}</li>)}
      </ul>
      <p className="text-xs text-gray-500">{data.score_disclaimer}</p>
      {data.duplicate && <p className="text-sm text-gray-400">This file was already analyzed for this job version.</p>}
    </section>
  );
}
