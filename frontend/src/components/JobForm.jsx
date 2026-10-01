import { useState } from "react";

const fieldClass = "w-full rounded-xl bg-surface-900 border border-surface-600 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-accent/50";

function splitSkills(value) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

export default function JobForm({ initial, submitLabel, busy, onSubmit }) {
  const [title, setTitle] = useState(initial?.title || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [skills, setSkills] = useState((initial?.required_skills || []).join(", "));
  const [experience, setExperience] = useState(initial?.experience_requirements || "");
  const [education, setEducation] = useState(initial?.education_requirements || "");
  const [error, setError] = useState("");

  const handleSubmit = (event) => {
    event.preventDefault();
    const requiredSkills = splitSkills(skills);
    if (title.trim().length < 2) return setError("Enter a job title.");
    if (description.trim().length < 20) return setError("Describe the job in at least a few sentences.");
    if (!requiredSkills.length) return setError("Add at least one required skill.");
    if (experience.trim().length < 2) return setError("Describe the experience requirement.");
    setError("");
    onSubmit({
      title: title.trim(),
      description: description.trim(),
      requiredSkills,
      experienceRequirements: experience.trim(),
      educationRequirements: education.trim(),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="block text-sm text-gray-300">
        Job title
        <input className={`${fieldClass} mt-1`} value={title} onChange={(event) => setTitle(event.target.value)} required />
      </label>
      <label className="block text-sm text-gray-300">
        Description
        <textarea className={`${fieldClass} mt-1 resize-y`} rows={5} value={description} onChange={(event) => setDescription(event.target.value)} required />
      </label>
      <label className="block text-sm text-gray-300">
        Required skills
        <input className={`${fieldClass} mt-1`} value={skills} onChange={(event) => setSkills(event.target.value)} placeholder="Python, SQL, AWS" required />
      </label>
      <label className="block text-sm text-gray-300">
        Experience requirement
        <input className={`${fieldClass} mt-1`} value={experience} onChange={(event) => setExperience(event.target.value)} placeholder="3 or more years in a similar role" required />
        <span className="mt-1 block text-xs text-gray-500">For reviewers only. This is not part of the match score.</span>
      </label>
      <label className="block text-sm text-gray-300">
        Education requirement <span className="text-gray-500">(optional)</span>
        <input className={`${fieldClass} mt-1`} value={education} onChange={(event) => setEducation(event.target.value)} placeholder="Leave blank if not specified" />
        <span className="mt-1 block text-xs text-gray-500">For reviewers only. Leave blank when it is not specified. This is not scored.</span>
      </label>
      {error && <p className="text-danger text-sm" role="alert">{error}</p>}
      <button type="submit" disabled={busy} className="px-5 py-2.5 rounded-xl bg-accent text-white font-medium disabled:opacity-50">
        {busy ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
