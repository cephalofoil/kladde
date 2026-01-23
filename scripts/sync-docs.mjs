import { execSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const repoUrl = "https://github.com/cephalofoil/kladde.git";
const branch = "master";
const docsPath = "docs";
const cacheDir = path.join(process.cwd(), ".docs-cache");
const contentDir = path.join(process.cwd(), "content");

const run = (command) =>
  execSync(command, {
    stdio: "inherit",
  });

const runQuiet = (command) =>
  execSync(command, {
    stdio: "pipe",
  })
    .toString()
    .trim();

const ensureCache = () => {
  if (!existsSync(cacheDir)) {
    run(
      `git clone --depth=1 --filter=blob:none --sparse --branch ${branch} ${repoUrl} "${cacheDir}"`
    );
  }

  run(`git -C "${cacheDir}" sparse-checkout set ${docsPath}`);
  run(`git -C "${cacheDir}" fetch origin ${branch} --depth=1`);
};

const docsChanged = () => {
  if (!existsSync(contentDir)) {
    return true;
  }

  if (readdirSync(contentDir).length === 0) {
    return true;
  }

  try {
    runQuiet(
      `git -C "${cacheDir}" diff --quiet HEAD origin/${branch} -- ${docsPath}`
    );
    return false;
  } catch (error) {
    return true;
  }
};

const syncDocs = async () => {
  ensureCache();

  if (!docsChanged()) {
    console.log("Docs already up to date.");
    return;
  }

  run(`git -C "${cacheDir}" checkout ${branch}`);
  run(`git -C "${cacheDir}" pull --ff-only origin ${branch}`);

  await rm(contentDir, { recursive: true, force: true });
  await mkdir(contentDir, { recursive: true });

  const docsSource = path.join(cacheDir, docsPath);
  if (!existsSync(docsSource)) {
    await writeFile(
      path.join(contentDir, "index.mdx"),
      "# Documentation\n\nThe source repository does not contain a docs/ folder yet."
    );
    console.log("Docs folder missing. Created placeholder content/.");
    return;
  }

  await cp(docsSource, contentDir, { recursive: true });

  console.log("Docs synced to content/.");
};

syncDocs().catch((error) => {
  console.error("Docs sync failed:", error);
  process.exitCode = 1;
});
