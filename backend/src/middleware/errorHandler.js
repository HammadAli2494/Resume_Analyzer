export function notFound(_req, res) {
  res.status(404).json({ error: "Not found." });
}

export function errorHandler(err, _req, res, _next) {
  if (err.name === "CastError") {
    return res.status(400).json({ error: "Invalid id." });
  }
  if (err.code === 11000) {
    const fields = Object.keys(err.keyPattern || err.keyValue || {});
    if (fields.includes("email")) {
      return res.status(409).json({ error: "An account with this email already exists." });
    }
    return res.status(409).json({ error: "This file was already analyzed for this job version." });
  }
  const status = err.status || 500;
  if (status >= 500 && !err.expose) console.error(err);
  const message = status >= 500 && !err.expose ? "Something went wrong." : err.message;
  return res.status(status).json({ error: message || "Something went wrong." });
}
