import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { httpError } from "../utils/httpError.js";
import { publicUser } from "../utils/present.js";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function signToken(user) {
  return jwt.sign(
    { sub: String(user._id), email: user.email, role: user.role, ver: user.tokenVersion || 0 },
    env.jwtSecret,
    { expiresIn: "7d" }
  );
}

function clean(value, max) {
  return String(value ?? "").replace(/\0/g, "").trim().slice(0, max);
}

export async function register(req, res) {
  const name = clean(req.body.name, 80);
  const email = clean(req.body.email, 120).toLowerCase();
  const password = String(req.body.password ?? "");

  if (name.length < 2) throw httpError(400, "Name is required.");
  if (!EMAIL.test(email) || email.includes("$")) throw httpError(400, "A valid email is required.");
  if (password.length < 8) throw httpError(400, "Password must be at least 8 characters.");

  const existing = await User.findOne({ email });
  if (existing) throw httpError(409, "An account with this email already exists.");

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ name, email, passwordHash, role: "recruiter" });
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
}

export async function login(req, res) {
  const email = clean(req.body.email, 120).toLowerCase();
  const password = String(req.body.password ?? "");
  if (!email || !password) throw httpError(401, "Incorrect email or password.");

  const user = await User.findOne({ email }).select("+passwordHash");
  const matches = user ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!user || !matches) throw httpError(401, "Incorrect email or password.");

  res.json({ token: signToken(user), user: publicUser(user) });
}

export async function me(req, res) {
  const user = await User.findById(req.user.id);
  if (!user) throw httpError(401, "Authentication required.");
  res.json(publicUser(user));
}

export async function logout(req, res) {
  await User.updateOne({ _id: req.user.id }, { $inc: { tokenVersion: 1 } });
  res.json({ message: "Logged out." });
}
