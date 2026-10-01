# Machine learning

The scoring service loads one saved classifier when it starts. It does not train during a request or during startup.

## What a result measures

The job match score is a weighted blend for the selected job:

- 50% required-skill coverage, when the job lists required skills, otherwise this part is left out and the remaining weights are rescaled
- 30% keyword overlap: word and bigram TF-IDF cosine between that resume and that job description
- 20% classifier signal, only when the saved model loads

If required skills are missing, the blend is 70% keyword overlap and 30% classifier signal. If the classifier is not loaded, its weight is dropped and the score uses keyword overlap and required skills only.

Character n-gram overlap is reported separately as wording overlap. It is lexical pattern overlap. It is not semantic similarity, and this product does not compute sentence embeddings. The feature slot named `semantic_cosine` is kept so the saved model’s feature order stays stable. It is 0 unless `sentence-transformers` is installed, and it is not shown as a semantic score.

Experience and education are stored for reviewers. They are not scored. A blank education requirement is shown as “Not specified.”

The classifier signal is the model’s positive-class score times 100. It is not a calibrated probability of being hired, and it is not shown as confidence.

Matched and missing required skills are disjoint. A required skill is matched only when the shared matcher finds it outside a negated span. A cue such as “no experience with” covers the rest of that sentence, including a comma-separated list, until a contrast word such as “but” or “later.” A positive mention in another sentence still counts. This is a cue list, not full sentence understanding.

## Runtime model

`training/predict.py` loads `ml-service/models/match_pipeline.joblib` once.

The artifact used for live scoring is version `20260930_115657`:

- model type: logistic regression (`StandardScaler` + `LogisticRegression`)
- scikit-learn `1.9.1`
- skill features: `canonical_v1` from `training/skill_match.py`
- 10 features, in this order: `tfidf_cosine`, `char_cosine`, `semantic_cosine`, `skill_recall`, `skill_precision`, `skill_jaccard`, `skill_count_resume`, `skill_count_jd`, `resume_length_norm`, `jd_length_norm`

The loader refuses the file when the scikit-learn version, feature names, or feature count do not match. It does not guess a different feature layout. An older random-forest file is kept at `ml-service/models/archive/match_pipeline_20260927_155802.joblib` and is not loaded.

When the classifier is refused or missing, resume screening still runs with keyword overlap and required-skill coverage. Health checks call that state `keyword_only`, which is degraded, not fully ready.

## Training file and evaluation

`python training/train.py --project-csv` reads `data/processed/resume_job_pairs.csv` (`resume_text`, `job_text`, `label`). The flag name `--real-only` still selects that file. Loading a CSV does not make the labels real hiring decisions.

This run used 800 rows, 16 unique job descriptions, and 800 unique resumes. Splits are `GroupShuffleSplit` on normalized job-description text. Train, validation, and test shared 0 job descriptions and 0 resumes. Pairwise TF-IDF is fit inside each pair after the split, and the scaler inside logistic regression is fit on the training rows only.

Reported holdout metrics for version `20260930_115657` are accuracy, precision, recall, F1, and ROC-AUC of 1.0 on 187 test rows. A rule that averages TF-IDF cosine and skill recall also scored 1.0 on that same holdout. The labels in this file are separable from those overlap features. That is not evidence of hiring accuracy.

Grouped cross-validation in `models/cv_report.json` is a separate logistic-regression check with `GroupKFold` on job descriptions. It is not the saved model’s holdout score, and it is not an independent hiring evaluation. Real-world accuracy is unverified. There is no separate labeled hiring dataset in this repository.

## Commands

From `ml-service`, with its virtualenv active:

```powershell
.\venv\Scripts\python.exe training\train.py --project-csv
.\venv\Scripts\python.exe training\cross_validate.py
```

Training writes a candidate file, smoke-checks it, copies the previous `match_pipeline.joblib` into `models/archive` if that archive file is not already there, and only then replaces the live artifact and the metric files.

Skill names for the explanation shown to recruiters come from `training/skill_match.py`. The same module builds the skill ratios used by a model trained with `skill_matcher` `canonical_v1`. An artifact without that field would still use the older word-boundary list so its feature meaning would not change silently. spaCy is optional and is not required to score a resume.
