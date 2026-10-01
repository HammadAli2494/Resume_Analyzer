import mongoose from "mongoose";
import { env } from "./env.js";
import { ensureScreeningIndex } from "../services/mongoSupport.js";

export async function connectDb() {
  mongoose.set("strictQuery", true);
  try {
    await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 4000 });
    console.log("MongoDB connected");
    try {
      await ensureScreeningIndex();
    } catch (error) {
      console.error(`Screening index was not created (${error.name || "error"}). Existing rows were not changed.`);
    }
  } catch (error) {
    console.error(`MongoDB unavailable (${error.name || "error"}). Check MONGODB_URI and that the database is running.`);
  }
}

export function dbReady() {
  return mongoose.connection.readyState === 1;
}
