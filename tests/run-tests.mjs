import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const manifest = JSON.parse(
  readFileSync(new URL("validation-manifest.json", import.meta.url), "utf8"),
);
function execute(args) {
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, FORCE_COLOR: "0" },
  });
  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
  return result.stdout;
}
const legacyFiles = readdirSync(resolve(root, "tests"))
  .filter((name) => name.endsWith(".test.mjs"))
  .map((name) => `tests/${name}`)
  .sort();
const expectedLegacyFiles = manifest.legacy.map((entry) => entry.suite).sort();
if (JSON.stringify(legacyFiles) !== JSON.stringify(expectedLegacyFiles))
  throw new Error(
    "Catalog every retained Node suite in validation-manifest.json",
  );
const tap = execute([
  "--experimental-strip-types",
  "--test",
  "--test-reporter=tap",
  ...legacyFiles,
]);
const legacyCases = [...tap.matchAll(/^ok \d+ - (.+)$/gm)].map((match) =>
  match[1].trim(),
);
const expectedLegacyCases = manifest.legacy
  .flatMap((entry) => entry.caseNames)
  .sort();
if (
  JSON.stringify([...legacyCases].sort()) !==
  JSON.stringify(expectedLegacyCases)
)
  throw new Error("Legacy catalog must match executed individual cases");
execute(["node_modules/vitest/vitest.mjs", "run"]);
const result = JSON.parse(
  readFileSync(resolve(root, "tests/.results/vitest.json"), "utf8"),
);
if (
  !result.success ||
  result.numFailedTests ||
  result.numPendingTests ||
  result.numTodoTests
)
  throw new Error("All validation cases must execute and pass");
const sources = Object.fromEntries(
  Object.entries(manifest.owners).map(([source, owner]) => [
    source,
    {
      ...owner,
      actualCaseCount: 0,
      unitCases: 0,
      integrationCases: 0,
      suites: [],
    },
  ]),
);
let actualVitestCount = 0;
for (const suite of result.testResults) {
  const suiteFile = relative(root, suite.name).replaceAll("\\", "/");
  for (const test of suite.assertionResults) {
    const title = test.ancestorTitles.find((value) =>
      /^src\/.* \| (unit|integration)$/.test(value),
    );
    if (!title)
      throw new Error(`Missing source/type classification: ${test.fullName}`);
    const [source, type] = title.split(" | ");
    if (!sources[source])
      throw new Error(`Uncataloged validation owner: ${source}`);
    const owner = sources[source];
    let entry = owner.suites.find(
      (item) => item.suite === suiteFile && item.type === type,
    );
    if (!entry) {
      entry = { suite: suiteFile, type, actualCaseCount: 0, cases: [] };
      owner.suites.push(entry);
    }
    entry.cases.push({ name: test.title, status: test.status });
    entry.actualCaseCount++;
    owner.actualCaseCount++;
    owner[`${type}Cases`]++;
    actualVitestCount++;
  }
}
if (actualVitestCount !== result.numTotalTests)
  throw new Error("Runner case totals do not match report");
for (const legacy of manifest.legacy.filter((item) => item.source)) {
  const owner = sources[legacy.source];
  owner.suites.push({
    suite: legacy.suite,
    type: legacy.type,
    actualCaseCount: legacy.caseNames.length,
    cases: legacy.caseNames.map((name) => ({ name, status: "passed" })),
  });
  owner.actualCaseCount += legacy.caseNames.length;
  owner[`${legacy.type}Cases`] += legacy.caseNames.length;
}
for (const [source, owner] of Object.entries(sources)) {
  if (owner.actualCaseCount < manifest.minimumCasesPerSource)
    throw new Error(`${source}: only ${owner.actualCaseCount} cases`);
  owner.suites.sort(
    (a, b) => a.suite.localeCompare(b.suite) || a.type.localeCompare(b.type),
  );
}
function walk(path) {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? walk(resolve(path, entry.name))
      : [relative(root, resolve(path, entry.name)).replaceAll("\\", "/")],
  );
}
for (const path of walk(resolve(root, "src")))
  if (!(path in sources) && !(path in manifest.excluded))
    throw new Error(`Uninventoried source file: ${path}`);
const inventory = {
  schemaVersion: 1,
  command: "npm test",
  minimumCasesPerSource: manifest.minimumCasesPerSource,
  countsAreExecutedIndividualCases: true,
  coveragePercentagesMeasured: false,
  totals: {
    validationOwners: Object.keys(sources).length,
    vitestCases: actualVitestCount,
    nodeCases: legacyCases.length,
    validationCases: Object.values(sources).reduce(
      (sum, owner) => sum + owner.actualCaseCount,
      0,
    ),
    retainedNonValidationCases: manifest.legacy
      .filter((entry) => !entry.source)
      .flatMap((entry) => entry.caseNames).length,
    executedCases: actualVitestCount + legacyCases.length,
    failed: 0,
    skipped: 0,
  },
  sources,
  retainedNonValidationSuites: manifest.legacy
    .filter((entry) => !entry.source)
    .map((entry) => ({ ...entry, actualCaseCount: entry.caseNames.length })),
  excluded: manifest.excluded,
};
// These are reproducible generated reports, not manually maintained assertions.
mkdirSync(resolve(root, "tests/.results"), { recursive: true });
writeFileSync(
  resolve(root, "tests/validation-inventory.json"),
  JSON.stringify(inventory, null, 2) + "\n",
);
const table = [
  `${inventory.totals.validationOwners} validation owners; ${inventory.totals.vitestCases} Vitest cases + ${inventory.totals.nodeCases} retained Node cases = ${inventory.totals.executedCases} executed, all passed. ${inventory.totals.validationCases} validation cases and ${inventory.totals.retainedNonValidationCases} retained visual/render cases. No skipped cases.`,
  "",
  "| Source | Unit | Integration | Total | Suite(s) |",
  "| --- | ---: | ---: | ---: | --- |",
  ...Object.entries(sources).map(
    ([source, owner]) =>
      `| ${source} | ${owner.unitCases} | ${owner.integrationCases} | ${owner.actualCaseCount} | ${owner.suites.map((item) => item.suite).join(", ")} |`,
  ),
].join("\n");
const docPath = resolve(root, "TESTING.md");
const doc = readFileSync(docPath, "utf8");
if (
  !doc.includes("<!-- inventory:start -->") ||
  !doc.includes("<!-- inventory:end -->")
)
  throw new Error("TESTING.md requires inventory markers");
writeFileSync(
  docPath,
  doc.replace(
    /<!-- inventory:start -->[\s\S]*?<!-- inventory:end -->/,
    `<!-- inventory:start -->\n${table}\n<!-- inventory:end -->`,
  ),
);
console.log(
  `Inventory verified: ${inventory.totals.executedCases} passed cases, ${inventory.totals.validationOwners} owners, minimum ${manifest.minimumCasesPerSource} each.`,
);
