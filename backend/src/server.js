import mongoose from "mongoose";
import { app } from "./app.js";
import { connectDb } from "./config/db.js";
import { assertEnv, env } from "./config/env.js";

assertEnv();
await connectDb();

const server = app.listen(env.port);
server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${env.port} is already in use. Set PORT to a free port or stop the other program. This process was not killed.`);
  } else {
    console.error(`API failed to start (${error.name || "error"}).`);
  }
  process.exit(1);
});
server.on("listening", () => {
  console.log(`API listening on http://localhost:${env.port}`);
});

function shutdown(signal) {
  console.log(`API shutting down (${signal}).`);
  server.close(() => {
    mongoose.disconnect().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(0), 8000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
