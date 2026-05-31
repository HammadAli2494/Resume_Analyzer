const EXAMPLE_JD = `Looking for a Data Scientist with 3+ years experience.
Required: Python, SQL, Machine Learning, Pandas, scikit-learn.
Nice to have: TensorFlow, AWS, Docker, NLP, communication skills.`;

export default function JobDescriptionInput({ value, onChange, disabled }) {
  return (
    <div className={`glass rounded-2xl p-6 ${disabled ? "opacity-60" : ""}`}>
      <div className="flex items-center justify-between gap-2 mb-4">
        <span className="text-sm font-medium text-gray-400 uppercase tracking-wider">
          Step 2 — Job Description
        </span>
        <button
          type="button"
          onClick={() => onChange(EXAMPLE_JD)}
          disabled={disabled}
          className="text-xs text-accent hover:text-accent-glow disabled:opacity-50"
        >
          Load example
        </button>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={10}
        placeholder="Paste the job posting here — skills and requirements help the ATS-style matcher..."
        className="w-full rounded-xl bg-surface-900 border border-surface-600 px-4 py-3 text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-accent/50 resize-y font-sans text-sm leading-relaxed"
      />
    </div>
  );
}
