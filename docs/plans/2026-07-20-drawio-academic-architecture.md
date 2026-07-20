# Draw.io Academic Architecture Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build, test, install, and publicly publish a privacy-safe Codex Skill for restrained 3D academic architecture diagrams in draw.io.

**Architecture:** Keep the new Skill as a thin orchestration and design layer over the pinned external `drawio-scientific-illustrator` plugin. Store portable architecture briefs as JSON, validate them with deterministic Node.js scripts, create only synthetic public examples through the upstream live MCPs, and block publication with working-tree, export-metadata, and Git-history privacy scans.

**Tech Stack:** Codex Skills, Node.js 22+ ESM, Node test runner, Python Skill Creator utilities, draw.io Desktop, `drawio-live` MCP, `drawio-file-utils` MCP, PowerShell, Git, GitHub CLI.

---

### Task 1: Record baseline agent behavior before the Skill exists

**Files:**
- Create: `tests/evals/cases.json`
- Create: `tests/evals/baseline-results.md`

**Step 1: Define three generic evaluation cases**

Create `tests/evals/cases.json` with prompts covering:

1. Upgrade an existing `.drawio` copy with lower-saturation colors and three mechanism lines per module.
2. Turn a generic architecture brief into editable 3D modules with icons, then validate and export it.
3. Prepare a public example when the user also supplied a confidential reference.

Each case must assert these behaviors where applicable: preserve the source, inspect stable IDs, avoid `drawio_live_clear` for revisions, use restrained semantic colors, add internal details, use both upstream MCPs, visually inspect a 2000-pixel PNG, and exclude the confidential source from publication.

**Step 2: Run the cases without the new Skill**

Dispatch fresh subagents without mentioning or exposing the planned Skill. Give each subagent one raw case and ask for an execution plan only.

Expected: at least one case omits a project-specific behavior such as copy-first revision, restrained palette selection, internal module expansion, export inspection, or publication privacy gating.

**Step 3: Record observed gaps verbatim**

Write the case ID, relevant response excerpts, and unmet assertions to `tests/evals/baseline-results.md`. Do not include any private source, local absolute path, institution, or email.

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

**Step 1: Write failing validator tests**

Use `node:test` and import `validateArchitectureSpec`. Cover:

```js
test('accepts a complete architecture spec', () => {
  assert.deepEqual(validateArchitectureSpec(validSpec), []);
});

test('rejects duplicate module ids', () => {
  assert.match(validateArchitectureSpec(duplicateIds).join('\n'), /duplicate module id/i);
});

test('rejects an edge whose endpoint is missing', () => {
  assert.match(validateArchitectureSpec(brokenEdge).join('\n'), /unknown target/i);
});

test('rejects more than three module detail lines', () => {
  assert.match(validateArchitectureSpec(tooManyDetails).join('\n'), /at most 3/i);
});

test('rejects an unknown semantic color role', () => {
  assert.match(validateArchitectureSpec(badRole).join('\n'), /color role/i);
});
```

Approved roles: `neutral`, `slate`, `teal`, `sage`, `clay`, `khaki`, and `plum`.

**Step 2: Run tests and verify RED**

```powershell
node --test tests/validate-spec.test.mjs
```

Expected: FAIL because the validator module does not exist.

**Step 3: Implement the minimal validator**

Export `validateArchitectureSpec(spec)` and `loadAndValidateSpec(inputPath)`. Validate:

- object root and schema version `1`;
- non-empty `title` and safe filename `slug`;
- at least one layer and module;
- unique stable IDs matching `^[a-z][a-z0-9-]*$`;
- labels, subtitles, one-to-three detail strings, motif, and approved color role;
- edge IDs and valid source/target IDs;
- supported edge roles `flow`, `feedback`, `constraint`, and `reference`.

The CLI prints a compact JSON result. Exit `0` for valid input and `1` with all errors for invalid input.

**Step 4: Document the JSON contract**

Write `architecture-spec.md` with one compact synthetic JSON example and a field table. Keep it under 150 lines.

**Step 5: Run tests and verify GREEN**

```powershell
node --test tests/validate-spec.test.mjs
```

Expected: all validator tests pass.

**Step 6: Commit**

```powershell
git add -- tests/validate-spec.test.mjs skill/drawio-academic-architecture/scripts/validate-spec.mjs skill/drawio-academic-architecture/references/architecture-spec.md
git commit -m "feat: validate portable architecture specs"
```

---

### Task 4: Build the publication privacy scanner with TDD

**Files:**
- Create: `tests/scan-public-tree.test.mjs`
- Create: `skill/drawio-academic-architecture/scripts/scan-public-tree.mjs`

**Step 1: Write failing privacy tests**

Create temporary directories and Git repositories during tests. Assemble prohibited test values from string fragments so the repository itself contains no real-looking private path or email literal.

Cover:

- an ordinary clean text tree passes;
- a Windows home path assembled at runtime fails;
- an email assembled at runtime fails;
- an extra deny term supplied through `PUBLIC_SCAN_EXTRA_TERMS` fails;
- a compressed `.drawio` without `<mxGraphModel>` fails;
- a PNG containing `tEXt`, `zTXt`, `iTXt`, or `eXIf` chunks fails;
- an SVG containing `<metadata` or `data:image/` fails;
- a prohibited value committed and then deleted still fails with `--history`.

**Step 2: Run tests and verify RED**

```powershell
node --test tests/scan-public-tree.test.mjs
```

Expected: FAIL because the scanner module does not exist.

**Step 3: Implement the minimal scanner**

Export `scanPublicTree({ root, history, extraTerms })`. Requirements:

- skip `.git`, `node_modules`, and repo-local `.tools` in the working-tree traversal;
- inspect UTF-8 text for absolute home paths, temporary-attachment markers, institution-like configured terms, email addresses, and extra deny terms;
- require `.drawio` text to contain `<mxfile` and `<mxGraphModel`;
- parse PNG chunk types and reject textual or EXIF chunks;
- reject SVG metadata and embedded raster payloads;
- when `history=true`, enumerate reachable objects with `git rev-list --objects --all`, read blobs with `git cat-file`, and apply the same checks;
- print only relative paths and rule names, never the matched private value;
- exit nonzero on any finding.

**Step 4: Run tests and verify GREEN**

```powershell
node --test tests/scan-public-tree.test.mjs
```

Expected: all scanner tests pass.

**Step 5: Commit**

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

**Step 3: Add MCP dependency metadata**

Retain generated interface fields. Add two local MCP dependency entries for `drawio-live` and `drawio-file-utils`, without inventing a hosted URL or transport.

**Step 4: Run official structure validation**

```powershell
$codexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $HOME '.codex' }
python (Join-Path $codexHome 'skills/.system/skill-creator/scripts/quick_validate.py') skill/drawio-academic-architecture
```

Expected: `Skill is valid!`

**Step 5: Re-run the evaluation cases with the Skill**

Dispatch fresh subagents with the same raw prompts plus: `Use $drawio-academic-architecture at <repo>/skill/drawio-academic-architecture`.

Expected for every applicable assertion: the response selects the correct MCP layer, preserves originals, avoids clearing revisions, uses the restrained style system, expands modules, validates/exports, and keeps private sources out of public fixtures.

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
- Create: `scripts/check-upstream.mjs`

**Step 1: Write failing tests**

Use a tiny fixture MCP server that answers `initialize` and `tools/list`. Test that the preflight:

- succeeds when all required live and file tools are listed;
- reports all missing tools at once;
- rejects an upstream plugin version below `1.0.0`;
- never launches draw.io during tool discovery.

**Step 2: Run tests and verify RED**

```powershell
node --test tests/check-upstream.test.mjs
```

Expected: FAIL because `scripts/check-upstream.mjs` does not exist.

**Step 3: Implement the preflight**

Accept `--plugin-root` or `DRAWIO_SCIENTIFIC_PLUGIN_ROOT`. Read `.codex-plugin/plugin.json`, then spawn each declared stdio MCP server, initialize it, request `tools/list`, compare required tool names, close child processes, and emit compact JSON.

**Step 4: Verify with fixture and pinned local plugin**

```powershell
node --test tests/check-upstream.test.mjs
node scripts/check-upstream.mjs --plugin-root $env:DRAWIO_SCIENTIFIC_PLUGIN_ROOT
```

Expected: tests pass and the real plugin reports version `1.0.0` with every required tool.

**Step 5: Commit**

```powershell
git add -- tests/check-upstream.test.mjs tests/fixtures/fake-mcp-server.mjs scripts/check-upstream.mjs
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

Run `scripts/check-upstream.mjs` and require success before launching draw.io.

**Step 2: Draw the multimodal example live**

Use the spec, `drawio_live_launch`, stable IDs, individual or paced operations, restrained colors, editable 3D modules, and one motif plus one-to-three detail lines per module. Save only after the visible graph is complete.

**Step 3: Validate and export the multimodal example**

Require zero validation errors and warnings. Export PNG at width 2000 with `embed=false`; export SVG without embedded raster or draw.io source metadata.

**Step 4: Inspect and record the multimodal review**

Open the PNG with visual inspection. Write `review.json` containing counts and booleans for `noClipping`, `noOverlap`, `labelsReadable`, `arrowDirectionsCorrect`, `restrainedPalette`, and `sourceSynthetic`.

**Step 5: Repeat Steps 2–4 for the safe-control-loop example**

Use a separate visible draw.io document and output directory.

**Step 6: Scan the exports**

```powershell
node skill/drawio-academic-architecture/scripts/scan-public-tree.mjs --root . --history
```

Expected: zero findings. If PNG/SVG metadata is rejected, re-export with embedding disabled; never weaken the scanner for convenience.

**Step 7: Commit**

```powershell
git add -- examples
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

Use `actions/checkout@v4` with `fetch-depth: 0`, `actions/setup-node@v4` with Node 22, then run `npm test` and `npm run scan:history`.

**Step 5: Add a safe PowerShell installer**

Resolve `$CODEX_HOME` or `$HOME/.codex`, copy only `skill/drawio-academic-architecture` into the same named destination, refuse to overwrite a non-matching existing directory unless `-Force` is supplied, and print the restart requirement. Do not install the upstream plugin automatically.

**Step 6: Run all checks**

```powershell
npm test
npm run scan:history
python (Join-Path $creator 'quick_validate.py') skill/drawio-academic-architecture
```

Expected: all tests pass, zero privacy findings, and `Skill is valid!`.

**Step 7: Commit**

```powershell
git add -- README.md LICENSE NOTICE .gitignore package.json .github scripts/install.ps1
git commit -m "chore: package skill for public release"
```

---

### Task 11: Install and verify the personal Skill

**Files:**
- Install: `$CODEX_HOME/skills/drawio-academic-architecture/**`

**Step 1: Run the installer**

```powershell
powershell -ExecutionPolicy Bypass -File scripts/install.ps1
```

Expected: the named destination is created without copying repository-only files.

**Step 2: Compare source and installed trees**

Compute SHA-256 for every file relative to each tree and require identical path/hash sets.

**Step 3: Validate the installed copy**

```powershell
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

Because package managers may be unavailable, query the official `cli/cli` GitHub release API, download the Windows amd64 ZIP plus checksums, verify SHA-256, and extract it under ignored `.tools/gh`. Do not download from third-party mirrors.

**Step 2: Verify CLI and authentication**

```powershell
& .tools/gh/gh.exe --version
& .tools/gh/gh.exe auth status
```

If unauthenticated, run `gh auth login --web --hostname github.com --git-protocol https` and allow the user to complete the official device/browser authorization.

**Step 3: Run the final publication gate**

```powershell
npm test
npm run scan:history
git status --short --branch
git log --oneline --decorate -10
```

Expected: tests pass, zero findings, and only intended clean history is present.

**Step 4: Create and push the new public repository**

```powershell
& .tools/gh/gh.exe repo create nickyeung575/drawio-academic-architecture `
  --public `
  --description 'Codex Skill for restrained, editable 3D academic architecture diagrams in draw.io' `
  --source . `
  --remote origin `
  --push
```

For this new-repository bootstrap, push the reviewed `main` history directly; do not create an empty pull request against a nonexistent base.

**Step 5: Verify through GitHub independently**

Use the connected GitHub app to retrieve repository metadata and fetch `README.md`, `skill/drawio-academic-architecture/SKILL.md`, and both example specs from the default branch.

Expected: repository is public, default branch is `main`, files match the local committed versions, and no private source artifacts appear.

**Step 6: Tag the initial milestone**

```powershell
git tag -a v0.1.0 -m "Initial public skill release"
git push origin v0.1.0
```

---

### Task 13: Final verification and handoff

**Files:**
- Verify all committed files and public URLs.

**Step 1: Run fresh local verification**

```powershell
npm test
npm run scan:history
python (Join-Path $creator 'quick_validate.py') skill/drawio-academic-architecture
git status --short --branch
```

Expected: zero failures, zero privacy findings, valid Skill, clean worktree.

**Step 2: Inspect both final PNG previews**

Require legible labels, no clipping or unintended overlap, correct arrow directions, subdued color, and clearly synthetic content.

**Step 3: Return the deliverables**

Provide clickable local paths for the repository, installed Skill, both example previews, and the public GitHub URL. Report test counts, privacy-scan result, commit/tag, and the restart/new-task requirement.
