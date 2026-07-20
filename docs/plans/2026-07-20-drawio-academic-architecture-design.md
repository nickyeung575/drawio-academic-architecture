# Draw.io Academic Architecture Skill Design

## Goal

Create a public, reusable Codex Skill for turning a reference image or architecture description into an editable academic diagram with restrained color, compact 3D modules, visual icons, readable internal details, and validated draw.io exports.

Publish the project as `nickyeung575/drawio-academic-architecture` and install the Skill locally under the user's Codex skills directory.

## Privacy boundary

The public repository must contain only newly created generic material.

- Do not copy or publish user-provided paper figures, screenshots, temporary attachments, or derived diagrams.
- Do not include paper-specific labels, topology, datasets, or research claims.
- Do not include absolute local paths, institution names, email addresses, or temporary-directory names.
- Generate examples from synthetic briefs written specifically for this repository.
- Run a repository privacy scan before every release.
- Treat the scanner as a publication safeguard, not a substitute for the host model/provider's data-handling policy. Do not use confidential source material when generating public examples.
- Scan the working tree, staged files, and every reachable Git blob before publishing so deleted private files cannot survive in history.
- Require public `.drawio` examples to use inspectable uncompressed XML. Reject embedded source payloads and textual metadata in PNG/SVG exports.

## Dependency boundary

Use `icebird1998/drawio-scientific-illustrator` v1.0.0 (`dd248168295bbcac34c9d74a8bd9efac3c2fbf99`) as an external MIT-licensed plugin dependency. Do not vendor or fork its MCP source in this repository.

The upstream plugin owns two MCP servers and its generic figure-recreation Skill:

- `drawio-live` controls the visible graph and incremental cell updates;
- `drawio-file-utils` validates saved diagrams and exports review files;
- `recreate-scientific-figure-in-drawio` provides the generic live-recreation workflow.

Before drawing, run `scripts/check-upstream.mjs` against the configured plugin path. Require MCP initialization and tool discovery to expose `drawio_live_status`, `drawio_live_inspect`, `drawio_live_update_cell`, `drawio_validate`, and `drawio_export`. If the check fails, direct the user to install and enable the pinned upstream release before continuing.

The new Skill owns the higher-level design method:

- restrained academic palette;
- semantic 3D module system;
- icon and micro-visual selection;
- module-detail expansion;
- copy-first, incremental editing rules;
- structural and visual validation;
- privacy-safe example generation.

Document the dependency and attribution in `NOTICE` and the repository README.

## Repository architecture

```text
drawio-academic-architecture/
├── README.md
├── LICENSE
├── NOTICE
├── package.json
├── .github/workflows/ci.yml
├── scripts/install.ps1
├── scripts/check-upstream.mjs
├── skill/
│   └── drawio-academic-architecture/
│       ├── SKILL.md
│       ├── agents/openai.yaml
│       ├── scripts/
│       │   ├── validate-spec.mjs
│       │   └── scan-public-tree.mjs
│       └── references/
│           ├── style-system.md
│           └── architecture-spec.md
├── examples/
│   ├── multimodal-ml-pipeline/
│   └── generic-safe-control-loop/
├── tests/
│   ├── fixtures/
│   ├── validate-spec.test.mjs
│   └── scan-public-tree.test.mjs
└── docs/plans/
```

Keep the installable Skill under `skill/drawio-academic-architecture/`; repository-facing material remains outside it so the installed Skill stays concise and its directory name matches its frontmatter name.

## Skill behavior

When asked to create or upgrade a scientific architecture diagram, the Skill must:

1. Inspect the reference or brief and extract semantic topology before decoration.
2. Choose a restrained semantic palette with near-white surfaces and low-saturation accents.
3. Represent each major module with an editable 3D container, a meaningful icon or micro-visual, and concise internal mechanism lines.
4. Preserve an existing source by creating a versioned copy before editing.
5. Inspect stable cell IDs and update the live graph incrementally; never clear and rebuild merely to revise content or style.
6. Keep connectors readable and route them around unrelated modules.
7. Save, structurally validate, export a 2000-pixel PNG and SVG, and inspect the PNG for clipping and overlap.
8. Return editable and review deliverables with validation results.

## Portable architecture specification

Use a small JSON specification for examples and reusable validation. It contains:

- canvas title and optional subtitle;
- layers or grouped regions;
- modules with stable IDs, labels, subtitles, detail lines, semantic color roles, and visual motifs;
- directed edges with labels and semantic roles;
- export filename stem.

`validate-spec.mjs` validates required fields, unique IDs, valid edge endpoints, bounded detail counts, and approved semantic color roles. It does not generate draw.io XML; visible drawing remains the responsibility of the pinned external live MCP contract.

## Synthetic examples

### Multimodal ML Pipeline

A fictional research workflow containing data ingestion, preprocessing, modality encoders, feature fusion, prediction, and evaluation. It demonstrates parallel branches and convergence without using any user research material.

### Generic Safe Control Loop

A textbook-style loop containing sensing, state estimation, nominal policy, safety guard, actuator command, and feedback. It demonstrates cross-layer feedback and safety semantics without reproducing a private figure.

Each example includes a JSON brief, editable `.drawio`, PNG preview, SVG export, and `review.json` record created specifically for the public repository. The review record captures structural validation counts and a named clipping/overlap/legibility checklist completed by the publishing agent.

## Error handling

- Fail early when the external draw.io MCP tools are unavailable and report the required dependency.
- Reject malformed specifications before opening draw.io.
- Refuse an incremental edit if the inspected graph is truncated or expected stable IDs are missing.
- Reject exports with validation errors or warnings.
- Block publication when the privacy scan finds local paths, private-source filenames, institutional identifiers, email addresses, disallowed research-specific terms, compressed or embedded draw.io payloads, PNG textual chunks, or SVG metadata/embedded raster data.
- Block publication if the same scan finds a prohibited value in any reachable Git blob.

## Testing

Follow RED-GREEN-REFACTOR for the Skill itself.

1. Run realistic prompts against an agent without the new Skill, including an environment where the upstream generic Skill is available, and record missed behaviors.
2. Write the minimal Skill that closes those observed gaps.
3. Re-run the same prompts with the Skill and require the response plan to select the two upstream MCPs, preserve source files, avoid canvas clearing for revisions, apply restrained styling, expand module internals, validate exports, and keep private input out of publication fixtures.
4. Unit-test the specification validator and privacy scanner with explicit passing and failing fixtures; require zero failed tests.
5. Run the official Skill validator from the local Skill Creator package with the generated Skill directory and require exit code zero.
6. Forward-test one synthetic example with an independent subagent and require a complete architecture spec, stable IDs, valid endpoints, three or fewer detail lines per module, and an explicit validation/export checklist.
7. Run the same checks in GitHub Actions and from a local `prepush` command. GitHub Actions must use a full-history checkout (`fetch-depth: 0`) before scanning reachable Git blobs.

## Publishing

- Use an independent public repository on the authenticated GitHub account.
- Commit only reviewed project files and synthetic outputs.
- Use the MIT license for original repository content.
- Include dependency attribution without implying affiliation with the upstream author.
- Install the exact validated `skill/drawio-academic-architecture/` tree as `$CODEX_HOME/skills/drawio-academic-architecture` after tests pass.
- Verify the public repository URL and default-branch contents after push.
