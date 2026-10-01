export function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };
}

export function jobSnapshot(job) {
  return {
    version: job.version || 1,
    title: job.title,
    description: job.description,
    requiredSkills: job.requiredSkills || [],
    experienceRequirements: job.experienceRequirements || "",
    educationRequirements: job.educationRequirements || "",
  };
}

export function presentJob(job, candidateCount = 0) {
  return {
    id: job._id,
    title: job.title,
    description: job.description,
    required_skills: job.requiredSkills || [],
    experience_requirements: job.experienceRequirements || "",
    education_requirements: job.educationRequirements || "",
    education_status: job.educationRequirements ? job.educationRequirements : "Not specified",
    version: job.version || 1,
    archived: Boolean(job.archived),
    candidate_count: candidateCount,
    created_at: job.createdAt,
    updated_at: job.updatedAt,
  };
}

export function presentRanking(analysis) {
  const resume = analysis.resumeId?.originalName ? analysis.resumeId : null;
  const result = analysis.result || {};
  const snapshot = analysis.jobSnapshot || {};
  const liveJob = analysis.jobId?.title ? analysis.jobId : null;
  return {
    id: analysis._id,
    candidate_name: analysis.candidateName || "",
    resume_filename: resume?.originalName || result.resume_filename || "",
    match_percentage: analysis.matchScore,
    resume_score: analysis.resumeScore,
    keyword_score: analysis.keywordScore,
    wording_overlap: analysis.wordingOverlap ?? result.wording_overlap ?? null,
    semantic_score: null,
    skill_coverage: analysis.skillCoverage,
    skills_specified: result.skills_specified !== false && analysis.skillCoverage != null,
    model_signal: analysis.modelSignal ?? result.model_signal ?? null,
    model_lean: result.model_lean || null,
    model_note: result.model_note || "",
    explanation: analysis.explanation || result.explanation || "",
    matched_skills: analysis.matchedSkills || [],
    missing_skills: analysis.missingSkills || [],
    top_matching_terms: result.top_matching_terms || [],
    top_missing_terms: result.top_missing_terms || [],
    recommendations: analysis.recommendations || [],
    skill_evidence: result.skill_evidence || [],
    name_source: analysis.nameSource || result.candidate_name_source || "filename",
    score_disclaimer: result.score_disclaimer || "This screening aid supports human review and does not reject candidates.",
    created_at: analysis.createdAt,
    duplicate: Boolean(result.duplicate),
    job_id: analysis.jobId?._id || analysis.jobId || null,
    job_title: snapshot.title || liveJob?.title || "",
    job_version: snapshot.version || null,
    experience_requirements: snapshot.experienceRequirements || "",
    education_requirements: snapshot.educationRequirements || "",
    education_status: snapshot.educationRequirements ? snapshot.educationRequirements : "Not specified",
  };
}

const FORMULA_PREFIX = /^[\t\r\n\u0000-\u001F]|^\s*[=+\-@]/;

export function csvEscape(value) {
  let text = String(value ?? "").replace(/\0/g, "");
  if (FORMULA_PREFIX.test(text)) text = `'${text}`;
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}
