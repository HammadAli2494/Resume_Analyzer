import mongoose from "mongoose";

export function requireObjectId(param = "id") {
  return (req, res, next) => {
    if (!mongoose.isValidObjectId(req.params[param])) {
      return res.status(400).json({ error: "Invalid id." });
    }
    return next();
  };
}
