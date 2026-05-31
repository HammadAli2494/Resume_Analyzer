export default function ResumeUpload({ file, onFileChange, disabled }) {
  const handleChange = (e) => {
    const selected = e.target.files?.[0];
    if (selected) onFileChange(selected);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (disabled) return;
    const dropped = e.dataTransfer.files?.[0];
    const ok =
      dropped?.type === "application/pdf" ||
      dropped?.name?.toLowerCase().endsWith(".docx");
    if (ok) onFileChange(dropped);
  };

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      className={`glass rounded-2xl p-6 transition ${disabled ? "opacity-60 pointer-events-none" : "hover:border-accent/40"}`}
    >
      <label className="block cursor-pointer">
        <span className="text-sm font-medium text-gray-400 uppercase tracking-wider">
          Step 1 — Upload Resume (PDF or DOCX)
        </span>
        <div className="mt-4 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-surface-600 py-12 px-4 text-center">
          <svg className="h-12 w-12 text-accent/70 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="text-gray-200 font-medium">
            {file ? file.name : "Drag & drop or click to browse"}
          </p>
          <p className="text-sm text-gray-500 mt-1">PDF or DOCX, max 10 MB</p>
          <input
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={handleChange}
            disabled={disabled}
          />
        </div>
      </label>
    </div>
  );
}
