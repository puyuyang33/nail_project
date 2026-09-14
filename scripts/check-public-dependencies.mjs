import { readFile } from "node:fs/promises";

const lock = JSON.parse(await readFile("package-lock.json", "utf8"));
const manifest = JSON.parse(await readFile("package.json", "utf8"));
const allowedResolvedHosts = new Set(["registry.npmjs.org"]);
const organizationToken = ["de", "ere"].join("");
const forbiddenNamePatterns = [
  new RegExp(organizationToken, "i"),
  new RegExp(`john[-_. ]?${organizationToken}`, "i"),
  /^@jd(?:[/-]|$)/i,
];
const problems = [];

const manifestDependencies = {
  ...manifest.dependencies,
  ...manifest.devDependencies,
  ...manifest.optionalDependencies,
  ...manifest.peerDependencies,
};

for (const name of Object.keys(manifestDependencies)) {
  if (forbiddenNamePatterns.some((pattern) => pattern.test(name))) {
    problems.push(`Forbidden dependency name in package.json: ${name}`);
  }
}

for (const [path, entry] of Object.entries(lock.packages ?? {})) {
  const name =
    entry.name ??
    path
      .replace(/^node_modules\//, "")
      .replace(/node_modules\//g, "");

  if (
    name &&
    forbiddenNamePatterns.some((pattern) => pattern.test(name))
  ) {
    problems.push(`Forbidden dependency name in package-lock.json: ${name}`);
  }

  if (entry.resolved) {
    let host;
    try {
      host = new URL(entry.resolved).hostname;
    } catch {
      problems.push(`Invalid resolved dependency URL: ${entry.resolved}`);
      continue;
    }
    if (!allowedResolvedHosts.has(host)) {
      problems.push(
        `Non-public dependency registry for ${name || path}: ${entry.resolved}`,
      );
    }
  }
}

if (problems.length) {
  console.error("Public dependency audit failed:\n");
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}

console.log(
  "Public dependency audit passed: all package names are portable and all resolved tarballs use registry.npmjs.org.",
);
