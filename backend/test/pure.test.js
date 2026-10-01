import assert from "node:assert/strict";
import test from "node:test";
import { productionProblems } from "../src/config/env.js";
import { csvEscape } from "../src/utils/present.js";

test("csv fields neutralize formula prefixes and leading controls", () => {
  assert.equal(csvEscape("=1+1"), "'=1+1");
  assert.equal(csvEscape("+1"), "'+1");
  assert.equal(csvEscape("-1"), "'-1");
  assert.equal(csvEscape("@SUM(A1)"), "'@SUM(A1)");
  assert.equal(csvEscape("\t=1+1"), "'\t=1+1");
  assert.equal(csvEscape("  =1+1"), "'  =1+1");
  assert.equal(csvEscape("Ada Lovelace"), "Ada Lovelace");
  assert.equal(csvEscape('say "hello"'), '"say ""hello"""');
});

test("production configuration rejects missing values without echoing them", () => {
  const problems = productionProblems({
    NODE_ENV: "production",
    MONGODB_URI: "",
    JWT_SECRET: "short",
    ML_SERVICE_URL: "",
    CLIENT_URL: "*",
    ML_INTERNAL_TOKEN: "",
  });
  assert.deepEqual(problems, ["MONGODB_URI", "JWT_SECRET", "ML_SERVICE_URL", "CLIENT_URL", "ML_INTERNAL_TOKEN"]);
  assert.equal(productionProblems({ NODE_ENV: "development" }).length, 0);
});
