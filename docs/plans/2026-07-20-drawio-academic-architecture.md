# Draw.io Academic Architecture Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build, test, install, and publicly publish a privacy-safe Codex Skill for restrained 3D academic architecture diagrams in draw.io.

**Architecture:** Keep the new Skill as a thin orchestration and design layer over the pinned external `drawio-scientific-illustrator` plugin. Store portable architecture briefs as JSON, validate them with deterministic Node.js scripts, create only synthetic public examples through the upstream live MCPs, and block publication with working-tree, export-metadata, and Git-history privacy scans.

**Tech Stack:** Codex Skills, Node.js 22+ ESM, Node test runner, Python Skill Creator utilities, draw.io Desktop, `drawio-live` MCP, `drawio-file-utils` MCP, PowerShell, Git, GitHub CLI.

---

## Execution context

After the bootstrap steps below, run every implementation command from the isolated worktree's repository root. At the start of each task or fresh shell, verify:

```powershell
$repoRoot = git rev-parse --show-toplevel
Set-Location $repoRoot
```

Recompute task-local variables in each fresh shell; do not assume PowerShell variables survive between commands.

Bootstrap exception: from the unpublished main checkout, derive the authenticated GitHub account ID and login through the connected GitHub account API, configure this repository's `user.name`, and set `user.email` to the account's generated `${id}+${login}@users.noreply.github.com` address. Inspect every existing commit identity. If any design/plan commit contains a personal address, rewrite the local root history with `git rebase --root --exec "git commit --amend --no-edit --reset-author"`, then verify every author and committer identity again. Add the ignored worktree directory and create the isolated worktree only after this bootstrap is clean. No GitHub CLI is required for these local bootstrap steps.

---

### Task 1: Record baseline agent behavior before the Skill exists

**Files:**
- Create: `tests/evals/cases.json`
- Create: `tests/evals/baseline-results.md`

**Step 1: Define three generic evaluation cases outside the repository**

Keep the raw prompts and assertion rubric only in the controller context until baseline responses are complete; do not create evaluation files yet. Cover:

1. Upgrade an existing `.drawio` copy with lower-saturation colors and three mechanism lines per module.
2. Turn a generic architecture brief into editable 3D modules with icons, then validate and export it.
3. Prepare a public example when the user also supplied a confidential reference.

Score only commitments observable in an execution plan: preserve the source, inspect stable IDs, avoid `drawio_live_clear` for revisions, choose restrained semantic colors, add internal details, select both upstream MCP layers, plan inspection of a 2000-pixel PNG, and exclude the confidential source from publication. Do not claim that a plan-only evaluation proved actual MCP or export behavior.

**Step 2: Run the cases without the new Skill**

Dispatch fresh subagents with no forked conversation, no repository path, and an explicit instruction not to inspect the filesystem. Give each subagent one raw case and ask for an execution plan only.

Expected: at least one case omits a project-specific behavior such as copy-first revision, restrained palette selection, internal module expansion, export inspection, or publication privacy gating.

**Step 3: Persist the cases and observed gaps after baseline responses finish**

Now write the sanitized prompts and plan-level rubric to `tests/evals/cases.json`. Write the case ID, relevant response excerpts, and unmet plan assertions to `tests/evals/baseline-results.md`. Do not include any private source, local absolute path, institution, or personal email.

**Step 4: Commit the RED baseline**

```powershell
git add -- tests/evals/cases.json tests/evals/baseline-results.md
git commit -m "test: record skill baseline behavior"
```

---

### Task 2: Scaffold the installable Skill

**Files:**
- Create: `skill/drawio-academic-architecture/SKILL.md`
- Create: `skill/drawio-academic-architecture/agents/openai.yaml`
- Create directories: `skill/drawio-academic-architecture/scripts`, `skill/drawio-academic-architecture/references`

**Step 1: Locate the Skill Creator scripts without a user-specific path**

```powershell
$codexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $HOME '.codex' }
$creator = Join-Path $codexHome 'skills/.system/skill-creator/scripts'
```

**Step 2: Run the required initializer**

```powershell
$codexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $HOME '.codex' }
$creator = Join-Path $codexHome 'skills/.system/skill-creator/scripts'
python (Join-Path $creator 'init_skill.py') drawio-academic-architecture `
  --path skill `
  --resources scripts,references `
  --interface 'display_name=Draw.io Academic Architecture' `
  --interface 'short_description=Build restrained 3D academic architecture figures' `
  --interface 'default_prompt=Use $drawio-academic-architecture to turn this architecture brief into an editable, restrained 3D draw.io figure.'
```

Expected: the named Skill directory and `agents/openai.yaml` are created.

**Step 3: Verify the scaffold only**

```powershell
Get-ChildItem -Recurse skill/drawio-academic-architecture
```

Expected: no example placeholder files and no README inside the Skill directory.

---

### Task 3: Build the architecture-spec validator with TDD

**Files:**
- Create: `tests/validate-spec.test.mjs`
- Create: `skill/drawio-academic-architecture/scripts/validate-spec.mjs`
- Create: `skill/drawio-academic-architecture/references/architecture-spec.md`

**Step 1: Write the first failing validator behavior**

Write one async test for a complete valid spec. Dynamically import the future module inside the test, catch module resolution, and assert `typeof module?.validateArchitectureSpec === 'function'` before calling it. Await the loader and expect an empty error list.

**Step 2: Run the first test and verify RED**

```powershell
node --test --test-name-pattern "accepts a complete" tests/validate-spec.test.mjs
```

Expected: assertion FAIL with `validator API must exist`, not an uncaught import error.

**Step 3: Implement only the first behavior and verify GREEN**

Create `validate-spec.mjs`, export `validateArchitectureSpec`, and return an empty list for the complete valid fixture.

```powershell
node --test --test-name-pattern "accepts a complete" tests/validate-spec.test.mjs
```

Expected: PASS.

**Step 4: Add validation behaviors one at a time**

For each row below: write one failing test, run only that test and observe the stated assertion, implement the minimal rule, then run the full validator test file and keep it green.

| Behavior | Expected RED evidence |
|---|---|
| Root must be an object with `version: 1` | error contains `version` |
| `title` is non-empty and `slug` is filename-safe | error contains `title` or `slug` |
| At least one layer and module exist | error contains `layer` or `module` |
| Stable module and edge IDs match `^[a-z][a-z0-9-]*$` and are unique | error contains `duplicate` or `stable id` |
| Module label, subtitle, motif, and one-to-three detail strings exist | error names the missing field or `at most 3` |
| Color role is one of `neutral`, `slate`, `teal`, `sage`, `clay`, `khaki`, `plum` | error contains `color role` |
| Edge source and target resolve to modules | error contains `unknown source` or `unknown target` |
| Edge role is one of `flow`, `feedback`, `constraint`, `reference` | error contains `edge role` |

**Step 5: Test and implement file loading**

Write failing tests using temporary valid JSON, invalid JSON, and valid JSON with schema errors. Assert `loadAndValidateSpec(inputPath)` returns parsed spec plus errors and reports parse failures without throwing raw JSON text. Run RED, then export and implement the minimal loader, then run GREEN.

**Step 6: Test and implement the CLI**

Spawn the script against valid and invalid temporary files. Assert exit `0` plus compact JSON with `valid: true`; assert exit `1` plus `valid: false` and every validation error. Run RED before adding the CLI entrypoint, then GREEN.

**Step 7: Document the JSON contract**

Write `architecture-spec.md` with one compact synthetic JSON example and a field table. Keep it under 150 lines.

**Step 8: Run the complete validator suite**

```powershell
node --test tests/validate-spec.test.mjs
```

Expected: all validator API, loader, rule, and CLI tests pass.

**Step 9: Commit**

```powershell
git add -- tests/validate-spec.test.mjs skill/drawio-academic-architecture/scripts/validate-spec.mjs skill/drawio-academic-architecture/references/architecture-spec.md
git commit -m "feat: validate portable architecture specs"
```

---

### Task 4: Build the publication privacy scanner with TDD

**Files:**
- Create: `tests/scan-public-tree.test.mjs`
- Create: `skill/drawio-academic-architecture/scripts/scan-public-tree.mjs`

**Step 1: Establish the scanner API with one RED-GREEN cycle**

Write one async test for a clean temporary tree. Use the assertion-based dynamic loader and require `scanPublicTree` to exist and return no findings. Run it and observe `scanner API must exist`. Implement only recursive clean-tree traversal with `.git`, `node_modules`, and `.tools` excluded; rerun and require PASS.

**Step 2: Add working-tree rules one at a time**

For every rule below, assemble prohibited values from string fragments, write one failing test, verify its specific rule name, implement the minimum detection, and rerun the full file:

- Windows/macOS/Linux home paths and temporary-attachment markers in path or content;
- personal email addresses while allowing `users.noreply.github.com` commit identities;
- `PUBLIC_SCAN_EXTRA_TERMS` in path or content;
- `--require-extra-terms` fails closed when `PUBLIC_SCAN_EXTRA_TERMS` is empty or missing, without printing the supplied terms;
- compressed `.drawio` missing `<mxGraphModel>`;
- PNG `tEXt`, `zTXt`, `iTXt`, or `eXIf` chunks;
- SVG `<metadata` or `data:image/`;
- prohibited filenames whose content is clean.

**Step 3: Add staged-index rules with RED-GREEN evidence**

Create a temporary Git repo where the staged path/content differs from the working tree. First assert the scanner misses neither staged filename nor index blob. Run RED. Implement `git diff --cached --name-only -z` plus `git show :<path>`, applying the same path/content rules. Run GREEN.

**Step 4: Add complete reachable-history rules with RED-GREEN evidence**

Create commits containing then renaming/deleting a prohibited path. Add tests for commit/tree paths, blob content, commit author/committer identity, and annotated-tag tagger identity. Run RED. Implement:

- `git rev-list --all` followed by `git ls-tree -r --full-tree <commit>` for every reachable commit, so every historical path is scanned;
- `git cat-file` for referenced blobs;
- `git log --all --format` for author/committer identities;
- `git for-each-ref refs/tags --format` plus tag-object inspection for tagger identities;
- allow only GitHub-generated `users.noreply.github.com` addresses in Git identity metadata.

Run GREEN and confirm deleted or renamed private paths remain blocked.

**Step 5: Test sanitised output and CLI behavior before implementation**

Write tests asserting findings contain only relative path/object label plus rule name and never echo the matched secret. Spawn the CLI against clean and failing temporary repos; assert exit `0`/`1`, compact JSON, and no matched value in stdout/stderr. Run RED, then add the CLI and sanitised serializer, then run GREEN.

**Step 6: Run the complete scanner suite**

```powershell
node --test tests/scan-public-tree.test.mjs
```

Expected: all working-tree, staged-index, full-history, identity, binary metadata, sanitized-output, and CLI tests pass.

**Step 7: Commit**

```powershell
git add -- tests/scan-public-tree.test.mjs skill/drawio-academic-architecture/scripts/scan-public-tree.mjs
git commit -m "feat: block private publication artifacts"
```

---

### Task 5: Add the restrained academic style reference

**Files:**
- Create: `skill/drawio-academic-architecture/references/style-system.md`

**Step 1: Write the reference**

Specify:

- near-white surfaces and deep neutral text;
- seven semantic accent families with muted fill, line, and icon colors;
- 3D cube construction, spacing, typography, borders, shadows, and corner rules;
- icon/micro-visual choices for data, model, safety, routing, fusion, evaluation, and action;
- maximum three internal mechanism lines per module;
- connector routing and label-background rules;
- a visual review checklist for clipping, overlap, contrast, topology, whitespace, and arrow direction.

Include a compact quick-reference table. Do not include private figures or project-specific labels.

**Step 2: Check length and prohibited content**

```powershell
(Get-Content skill/drawio-academic-architecture/references/style-system.md | Measure-Object -Line).Lines
node skill/drawio-academic-architecture/scripts/scan-public-tree.mjs --root .
```

Expected: fewer than 200 lines and zero findings.

**Step 3: Commit**

```powershell
git add -- skill/drawio-academic-architecture/references/style-system.md
git commit -m "docs: define restrained academic diagram style"
```

---

### Task 6: Write the minimal Skill from observed baseline gaps

**Files:**
- Modify: `skill/drawio-academic-architecture/SKILL.md`
- Modify: `skill/drawio-academic-architecture/agents/openai.yaml`

**Step 1: Write the Skill frontmatter**

Use only:

```yaml
---
name: drawio-academic-architecture
description: Use when creating, recreating, or revising editable scientific architecture diagrams in draw.io that need restrained academic styling, 3D modules, visual motifs, expanded internal mechanisms, or privacy-safe public examples.
---
```

**Step 2: Write the Skill body**

Keep the body under 500 words. Address only the verified baseline gaps and include:

- required upstream plugin/tool names and the pinned compatibility baseline;
- source inspection and semantic decomposition;
- copy-first revision and stable-ID inspection;
- explicit prohibition on `drawio_live_clear` for normal revisions;
- 3D module, icon, internal-detail, and restrained-palette workflow;
- use of `style-system.md` and `architecture-spec.md`;
- save, validate, export, and visual review gate;
- public-example privacy gate and scanner command;
- a quick-reference table and common mistakes.

**Step 3: Keep metadata within the supported schema**

Retain only the generated interface fields in `agents/openai.yaml`. Document the local `drawio-live` and `drawio-file-utils` requirements in `SKILL.md` and enforce them through the executable preflight; do not invent unsupported `transport` or `url` values for local MCPs.

**Step 4: Run official structure validation**

```powershell
$codexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $HOME '.codex' }
python (Join-Path $codexHome 'skills/.system/skill-creator/scripts/quick_validate.py') skill/drawio-academic-architecture
```

Expected: `Skill is valid!`

**Step 5: Re-run the evaluation cases with the Skill**

Copy only `skill/drawio-academic-architecture` to a clean temporary evaluation directory outside the repository. Dispatch fresh subagents with no forked conversation and the same raw prompts plus: `Use $drawio-academic-architecture at <temporary-skill-path>`. Instruct them to read only that Skill tree and the prompt, not the project repository or evaluation results.

Expected for every applicable plan-level assertion: the response selects the correct MCP layer, preserves originals, avoids clearing revisions, uses the restrained style system, expands modules, commits to validation/export inspection, and keeps private sources out of public fixtures. Actual MCP and export behavior remains covered by Task 9's isolated forward test.

Record only assertion outcomes in `tests/evals/skill-results.md`.

**Step 6: Commit**

```powershell
git add -- skill/drawio-academic-architecture tests/evals/skill-results.md
git commit -m "feat: add drawio academic architecture skill"
```

---

### Task 7: Add and test the upstream MCP preflight

**Files:**
- Create: `tests/fixtures/fake-mcp-server.mjs`
- Create: `tests/check-upstream.test.mjs`
- Create: `skill/drawio-academic-architecture/scripts/check-upstream.mjs`

**Step 1: Establish the preflight API with one RED-GREEN cycle**

Use an assertion-based dynamic loader and a tiny fixture MCP server that answers `initialize` and `tools/list`. The fixture plugin root contains `.codex-plugin/plugin.json` and `.mcp.json` with both stdio server declarations. Write only the happy-path test, observe `upstream preflight API must exist`, then export a minimal `checkUpstream` that parses both files, starts only the declared MCP processes, lists tools without invoking any tool, closes processes, and passes the happy path.

**Step 2: Add preflight behaviors one at a time**

For each behavior, write the failing test, observe its specific failure, implement the minimum change, and rerun the full file:

- report every missing required tool from both servers at once;
- require plugin version exactly `1.0.0` rather than only a lower bound;
- support `expectedRevision` plus `strictRevision`; when strict, walk upward from the canonical plugin root to locate the Git top level, then invoke Git with a command-local `-c safe.directory=<canonical-top-level>` and require the exact pinned commit. Fail if Git metadata is absent or mismatched, and never modify global Git configuration;
- prove tool discovery never calls `drawio_live_launch` or otherwise launches draw.io;
- sanitize child-process errors and always terminate both MCP processes.

**Step 3: Test and implement the CLI**

Spawn the future CLI with `--plugin-root`, `--expected-version`, `--expected-revision`, and `--strict-revision`. Assert compact JSON and exit `0`/`1`. Run RED before adding argument handling, then GREEN.

**Step 4: Verify with fixture and pinned local plugin**

```powershell
node --test tests/check-upstream.test.mjs
$pluginRoot = if ($env:DRAWIO_SCIENTIFIC_PLUGIN_ROOT) {
  $env:DRAWIO_SCIENTIFIC_PLUGIN_ROOT
} elseif (Test-Path ../drawio-scientific-illustrator) {
  (Resolve-Path ../drawio-scientific-illustrator/plugins/drawio-scientific-illustrator).Path
} else {
  throw 'Set DRAWIO_SCIENTIFIC_PLUGIN_ROOT to the pinned upstream plugin checkout.'
}
node skill/drawio-academic-architecture/scripts/check-upstream.mjs `
  --plugin-root $pluginRoot `
  --expected-version 1.0.0 `
  --expected-revision dd248168295bbcac34c9d74a8bd9efac3c2fbf99 `
  --strict-revision
```

Expected: tests pass and the real plugin reports exact version/revision with every required tool, including on a checkout that Git would otherwise classify as dubious ownership. The preflight must use only its command-local `safe.directory` override.

**Step 5: Commit**

```powershell
git add -- tests/check-upstream.test.mjs tests/fixtures/fake-mcp-server.mjs skill/drawio-academic-architecture/scripts/check-upstream.mjs
git commit -m "feat: verify upstream drawio tools"
```

---

### Task 8: Create two synthetic example specifications

**Files:**
- Create: `examples/multimodal-ml-pipeline/spec.json`
- Create: `examples/generic-safe-control-loop/spec.json`

**Step 1: Write the multimodal pipeline brief**

Use only fictional modules: Data Sources, Signal Cleaning, Image Encoder, Sequence Encoder, Feature Fusion, Prediction Head, and Evaluation. Use parallel encoder branches and one convergence edge.

**Step 2: Write the safe-control-loop brief**

Use only textbook modules: Sensors, State Estimator, Nominal Policy, Safety Guard, Actuator Command, and Feedback Monitor. Use a single feedback edge.

**Step 3: Validate both specs**

```powershell
node skill/drawio-academic-architecture/scripts/validate-spec.mjs examples/multimodal-ml-pipeline/spec.json
node skill/drawio-academic-architecture/scripts/validate-spec.mjs examples/generic-safe-control-loop/spec.json
```

Expected: both print `valid: true` and exit zero.

**Step 4: Run the publication scanner**

```powershell
node skill/drawio-academic-architecture/scripts/scan-public-tree.mjs --root . --history
```

Expected: zero findings.

**Step 5: Commit**

```powershell
git add -- examples/*/spec.json
git commit -m "docs: add synthetic architecture briefs"
```

---

### Task 9: Draw, validate, and review both synthetic examples

**Files:**
- Create: `examples/multimodal-ml-pipeline/example.drawio`
- Create: `examples/multimodal-ml-pipeline/preview.png`
- Create: `examples/multimodal-ml-pipeline/example.svg`
- Create: `examples/multimodal-ml-pipeline/review.json`
- Create: `examples/generic-safe-control-loop/example.drawio`
- Create: `examples/generic-safe-control-loop/preview.png`
- Create: `examples/generic-safe-control-loop/example.svg`
- Create: `examples/generic-safe-control-loop/review.json`

**Step 1: Preflight the upstream tools**

Resolve `$pluginRoot` with the same explicit environment-or-plugin-package sibling logic from Task 7. Run the installed Skill preflight with the exact expected version, pinned revision, and `--strict-revision`; require success before launching draw.io.

**Step 2: Draw the multimodal example live**

Use the spec, `drawio_live_launch`, stable IDs, individual or paced operations, restrained colors, editable 3D modules, and one motif plus one-to-three detail lines per module. Save only after the visible graph is complete.

**Step 3: Validate and export the multimodal example**

Require zero validation errors and warnings. Export PNG at width 2000 with `embed=false`; export SVG without embedded raster or draw.io source metadata.

**Step 4: Inspect and record the multimodal review**

Open the PNG with visual inspection. Write `review.json` containing counts and booleans for `noClipping`, `noOverlap`, `labelsReadable`, `arrowDirectionsCorrect`, `restrainedPalette`, and `sourceSynthetic`.

**Step 5: Repeat Steps 2–4 for the safe-control-loop example**

Use a separate visible draw.io document and output directory.

**Step 6: Forward-test one actual synthetic drawing**

Dispatch a fresh subagent with the installed-by-path Skill and only the generic safe-control-loop spec. Ask it to create a versioned throwaway `.drawio` plus PNG/SVG in an isolated temporary directory through the upstream live MCPs. Require stable IDs, valid endpoints, no source clearing during revision, zero validation errors/warnings, no clipping/overlap, and a clean privacy scan. Remove only the verified temporary output after recording assertion results in `tests/evals/forward-test-results.md`.

**Step 7: Scan the exports**

```powershell
node skill/drawio-academic-architecture/scripts/scan-public-tree.mjs --root . --history
```

Expected: zero findings. If PNG/SVG metadata is rejected, re-export with embedding disabled; never weaken the scanner for convenience.

**Step 8: Commit**

```powershell
git add -- examples tests/evals/forward-test-results.md
git commit -m "feat: add synthetic drawio examples"
```

---

### Task 10: Add repository packaging, CI, and installation

**Files:**
- Create: `README.md`
- Create: `LICENSE`
- Create: `NOTICE`
- Create: `.gitignore`
- Create: `package.json`
- Create: `.github/workflows/ci.yml`
- Create: `tests/install-script.test.mjs`
- Create: `scripts/install.ps1`

**Step 1: Write a bilingual repository README**

Include purpose, two synthetic previews, feature list, upstream prerequisite, pinned compatibility version, installation, example prompts, privacy boundary, validation commands, attribution, and license. Do not claim ownership of the upstream MCP.

**Step 2: Add license and attribution**

Use MIT for original repository content. In `NOTICE`, name the upstream project, author, URL, v1.0.0 commit, and MIT license; state that upstream source is not bundled.

**Step 3: Add package scripts**

Define:

```json
{
  "scripts": {
    "test": "node --test tests/*.test.mjs",
    "scan": "node skill/drawio-academic-architecture/scripts/scan-public-tree.mjs --root .",
    "scan:history": "node skill/drawio-academic-architecture/scripts/scan-public-tree.mjs --root . --history",
    "prepush": "npm test && npm run scan:history"
  }
}
```

**Step 4: Add full-history GitHub Actions CI**

Use `runs-on: windows-latest`, `actions/checkout@v4` with `fetch-depth: 0`, and `actions/setup-node@v4` with Node 22. Run command steps with `shell: pwsh`, then run `npm test` and `npm run scan:history`. CI exercises the portable built-in rules; the local publication gate separately requires the non-committed private denylist.

**Step 5: Write failing installer tests**

Start with an assertion-based existence guard and one test that copies only the named Skill tree into temporary source/destination roots. Observe `installer must exist`, implement only that behavior, and make it green. Then add each remaining behavior one at a time—refuse a non-matching existing destination without `-Force`, replace it with `-Force`, and produce identical relative SHA-256 path/hash sets—observing a behavior-specific RED before the minimum implementation and a full-file GREEN after each change.

Run:

```powershell
node --test tests/install-script.test.mjs
```

Expected for the first cycle: FAIL with `installer must exist`; later cycles fail only on the newly introduced behavior.

**Step 6: Add the minimal safe PowerShell installer**

Resolve `$CODEX_HOME` or `$HOME/.codex`, copy only `skill/drawio-academic-architecture` into the same named destination, refuse to overwrite a non-matching existing directory unless `-Force` is supplied, and print the restart requirement. Do not install the upstream plugin automatically.

**Step 7: Run all checks**

```powershell
$codexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $HOME '.codex' }
$creator = Join-Path $codexHome 'skills/.system/skill-creator/scripts'
npm test
npm run scan:history
python (Join-Path $creator 'quick_validate.py') skill/drawio-academic-architecture
```

Expected: all tests pass, zero privacy findings, and `Skill is valid!`.

**Step 8: Commit**

```powershell
git add -- README.md LICENSE NOTICE .gitignore package.json .github tests/install-script.test.mjs scripts/install.ps1
git commit -m "chore: package skill for public release"
```

---

### Task 11: Install and verify the personal Skill

**Files:**
- Install: `$CODEX_HOME/skills/drawio-academic-architecture/**`

**Step 1: Run the installer**

```powershell
$codexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $HOME '.codex' }
$creator = Join-Path $codexHome 'skills/.system/skill-creator/scripts'
powershell -ExecutionPolicy Bypass -File scripts/install.ps1
```

Expected: the named destination is created without copying repository-only files.

**Step 2: Compare source and installed trees**

Compute SHA-256 for every file relative to each tree and require identical path/hash sets.

**Step 3: Validate the installed copy**

```powershell
$codexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $HOME '.codex' }
$creator = Join-Path $codexHome 'skills/.system/skill-creator/scripts'
python (Join-Path $creator 'quick_validate.py') (Join-Path $codexHome 'skills/drawio-academic-architecture')
```

Expected: `Skill is valid!`.

**Step 4: State the activation boundary**

The current task cannot reload newly installed Skill metadata. Record that a Codex restart/new task is required for implicit discovery; explicit path-based forward tests remain valid in the current task.

---

### Task 12: Create and publish the public GitHub repository

**Files:**
- Local-only ignored tool: `.tools/gh/**`

**Step 1: Obtain GitHub CLI from the official release**

First require `git check-ignore .tools/probe` to succeed; add and commit `.tools/` to `.gitignore` before any download if needed. Because package managers may be unavailable, query the official `cli/cli` GitHub release API, download the Windows amd64 ZIP plus checksums, verify SHA-256, and extract it under ignored `.tools/gh`. Do not download from third-party mirrors. Locate exactly one `gh.exe` recursively after extraction instead of assuming the ZIP's internal directory layout.

**Step 2: Verify CLI and authentication**

```powershell
$ghCandidates = @(Get-ChildItem -Recurse -File .tools/gh -Filter gh.exe)
if ($ghCandidates.Count -ne 1) { throw "Expected one gh.exe, found $($ghCandidates.Count)" }
$gh = $ghCandidates[0].FullName
& $gh --version
& $gh auth status
```

If unauthenticated, resolve the executable again in the same command block before login:

```powershell
$ghCandidates = @(Get-ChildItem -Recurse -File .tools/gh -Filter gh.exe)
if ($ghCandidates.Count -ne 1) { throw "Expected one gh.exe, found $($ghCandidates.Count)" }
$gh = $ghCandidates[0].FullName
& $gh auth login --web --hostname github.com --git-protocol https
```

Allow the user to complete the official device/browser authorization.

**Step 3: Check remote and repository-name state**

Recompute `$gh` from the single extracted candidate. For this first-publication path, require that no `origin` remote exists. Run `& $gh repo view nickyeung575/drawio-academic-architecture`; expected is a not-found result. If either `origin` or the repository already exists, stop and inspect the state instead of overwriting, reusing `--remote origin`, or silently selecting another name.

**Step 4: Run the final publication gate**

```powershell
npm test
if ([string]::IsNullOrWhiteSpace($env:PUBLIC_SCAN_EXTRA_TERMS)) { throw 'Set the local-only confidential denylist in the controller environment.' }
node skill/drawio-academic-architecture/scripts/scan-public-tree.mjs --root . --history --require-extra-terms
git status --short --branch
git log --oneline --decorate -10
```

Expected: tests pass, the non-empty local-only denylist is accepted without being printed, zero findings remain, and only intended clean history is present. Do not save the denylist in shell history, logs, repository files, or CI configuration; populate it through the controller process environment.

**Step 5: Create and push the new public repository**

```powershell
$ghCandidates = @(Get-ChildItem -Recurse -File .tools/gh -Filter gh.exe)
if ($ghCandidates.Count -ne 1) { throw "Expected one gh.exe, found $($ghCandidates.Count)" }
$gh = $ghCandidates[0].FullName
& $gh repo create nickyeung575/drawio-academic-architecture `
  --public `
  --description 'Codex Skill for restrained, editable 3D academic architecture diagrams in draw.io' `
  --source . `
  --remote origin `
  --push
```

For this new-repository bootstrap, push the reviewed `main` history directly; do not create an empty pull request against a nonexistent base.

**Step 6: Verify through GitHub independently**

Use the connected GitHub app to retrieve repository metadata and fetch `README.md`, `skill/drawio-academic-architecture/SKILL.md`, and both example specs from the default branch.

Expected: repository is public, default branch is `main`, files match the local committed versions, and no private source artifacts appear.

**Step 7: Tag the initial milestone**

```powershell
git tag -a v0.1.0 -m "Initial public skill release"
if ([string]::IsNullOrWhiteSpace($env:PUBLIC_SCAN_EXTRA_TERMS)) { throw 'Set the local-only confidential denylist in the controller environment.' }
node skill/drawio-academic-architecture/scripts/scan-public-tree.mjs --root . --history --require-extra-terms
git push origin v0.1.0
```

Expected: the post-tag scan verifies tagger identity and all reachable content before the tag leaves the machine. If it fails, do not push the tag.

---

### Task 13: Final verification and handoff

**Files:**
- Verify all committed files and public URLs.

**Step 1: Run fresh local verification**

```powershell
$codexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $HOME '.codex' }
$creator = Join-Path $codexHome 'skills/.system/skill-creator/scripts'
npm test
if ([string]::IsNullOrWhiteSpace($env:PUBLIC_SCAN_EXTRA_TERMS)) { throw 'Set the local-only confidential denylist in the controller environment.' }
node skill/drawio-academic-architecture/scripts/scan-public-tree.mjs --root . --history --require-extra-terms
python (Join-Path $creator 'quick_validate.py') skill/drawio-academic-architecture
git status --short --branch
```

Expected: zero failures, zero privacy findings, valid Skill, clean worktree.

**Step 2: Inspect both final PNG previews**

Require legible labels, no clipping or unintended overlap, correct arrow directions, subdued color, and clearly synthetic content.

**Step 3: Return the deliverables**

Provide clickable local paths for the repository, installed Skill, both example previews, and the public GitHub URL. Report test counts, privacy-scan result, commit/tag, and the restart/new-task requirement.
