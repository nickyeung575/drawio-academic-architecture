# Portable Architecture Specification

Use this JSON contract to describe synthetic or reusable architecture figures before drawing them. The validator checks structure and references; it does not generate draw.io XML.

## Example

```json
{
  "version": 1,
  "title": "Generic signal study",
  "subtitle": "Synthetic architecture example",
  "slug": "generic-signal-study",
  "layers": [
    {
      "label": "Analysis",
      "modules": [
        {
          "id": "signal-input",
          "label": "Signal input",
          "subtitle": "Generated samples",
          "motif": "waveform",
          "details": ["Collect samples"],
          "colorRole": "teal"
        },
        {
          "id": "compact-model",
          "label": "Compact model",
          "subtitle": "Feature encoder",
          "motif": "neural-network",
          "details": ["Encode features", "Score output"],
          "colorRole": "slate"
        }
      ]
    }
  ],
  "edges": [
    {
      "id": "input-to-model",
      "source": "signal-input",
      "target": "compact-model",
      "label": "sample stream",
      "role": "flow"
    }
  ]
}
```

## Field contract

| Field | Type | Requirement |
| --- | --- | --- |
| `version` | integer | Required; exactly `1`. |
| `title` | string | Required and non-empty. |
| `subtitle` | string | Optional canvas subtitle. |
| `slug` | string | Required export filename stem; match `^[a-z0-9]+(?:-[a-z0-9]+)*$`. |
| `layers` | array | Required with at least one layer and at least one module in total. |
| `layers[].label` | string | Optional display label for a grouped region. |
| `layers[].modules` | array | Modules assigned to that layer. |
| `modules[].id` | string | Required stable ID; match `^[a-z][a-z0-9-]*$` and be globally unique among module and edge IDs. |
| `modules[].label` | string | Required and non-empty. |
| `modules[].subtitle` | string | Required and non-empty. |
| `modules[].motif` | string | Required and non-empty; names an editable icon or micro-visual. |
| `modules[].details` | string array | Required; one to three non-empty mechanism lines. |
| `modules[].colorRole` | string | Required; one of `neutral`, `slate`, `teal`, `sage`, `clay`, `khaki`, or `plum`. |
| `edges` | array | Optional when the architecture has no connections; otherwise contains directed edges. |
| `edges[].id` | string | Required stable ID; same format and global uniqueness rule as module IDs. |
| `edges[].source` | string | Required; resolve to a module ID. |
| `edges[].target` | string | Required; resolve to a module ID. |
| `edges[].label` | string | Optional connector label. |
| `edges[].role` | string | Required; one of `flow`, `feedback`, `constraint`, or `reference`. |

## Validation

Run the validator with Node.js 22 or newer:

```powershell
node skill/drawio-academic-architecture/scripts/validate-spec.mjs path/to/spec.json
```

The CLI writes one compact JSON object. It exits `0` with `{"valid":true,"errors":[]}` or exits `1` with `valid: false` and every validation error. Invalid JSON is reported without reproducing the source text.

Programmatic callers may import `validateArchitectureSpec(spec)` or `loadAndValidateSpec(inputPath)`. The direct validator returns an error array. The loader returns `{ spec, errors }` and uses `spec: null` when parsing fails. Neither throws for schema or JSON parse failures.
