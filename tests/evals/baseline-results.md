# Baseline Plan Evaluation

These results were collected from three fresh agents before the Skill existed. Each agent received one generic prompt, no repository context, and instructions not to inspect the filesystem. The evaluation measures plan commitments only; it does not claim actual MCP execution or export quality.

## copy-first-revision

Observed strengths:

- Preserved the original and proposed a versioned copy.
- Chose a muted semantic palette, editable native shapes, one-to-three mechanism lines, validation, and export inspection.

Unmet assertions:

- Did not name stable cell-ID inspection before mutation.
- Did not explicitly prohibit clearing the canvas during revision.
- Did not distinguish live-editing MCP tools from file validation/export MCP tools.
- Did not require inspection of a 2000-pixel PNG.

## brief-to-editable-figure

Observed strengths:

- Proposed restrained styling, editable components, meaningful icons, internal mechanisms, endpoint-oriented validation, and export QA.

Unmet assertions:

- Did not require stable module and edge IDs.
- Did not distinguish live-editing MCP tools from file validation/export MCP tools.
- Did not require inspection of a 2000-pixel PNG.

## confidential-reference-public-example

Observed strengths:

- Explicitly isolated the confidential reference, invented an independent synthetic scenario, checked hidden content and metadata, and kept the source editable.

Unmet assertions:

- Did not require scanning working-tree, staged-index, and complete Git history paths and identities.
- Did not distinguish live-editing MCP tools from file validation/export MCP tools.
- Did not require inspection of a 2000-pixel PNG.

## Skill target

The Skill should preserve the baseline strengths while making the missing operational commitments concise and repeatable.
