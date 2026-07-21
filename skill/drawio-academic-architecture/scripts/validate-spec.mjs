import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const STABLE_ID_PATTERN = /^[a-z][a-z0-9-]*$/;
const COLOR_ROLES = new Set([
  'neutral',
  'slate',
  'teal',
  'sage',
  'clay',
  'khaki',
  'plum',
]);
const EDGE_ROLES = new Set(['flow', 'feedback', 'constraint', 'reference']);

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

export function validateArchitectureSpec(spec) {
  if (spec === null || typeof spec !== 'object' || Array.isArray(spec)) {
    return ['root must be an object with version 1'];
  }

  const errors = [];
  if (spec.version !== 1) {
    errors.push('version must be 1');
  }
  if (typeof spec.title !== 'string' || spec.title.trim() === '') {
    errors.push('title must be a non-empty string');
  }
  if (
    typeof spec.slug !== 'string' ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(spec.slug)
  ) {
    errors.push('slug must be a filename-safe lowercase slug');
  }
  if (!Array.isArray(spec.layers) || spec.layers.length === 0) {
    errors.push('at least one layer is required');
  } else {
    for (const [layerIndex, layer] of spec.layers.entries()) {
      if (!Array.isArray(layer?.modules)) {
        errors.push(`layer ${layerIndex} modules must be an array`);
      }
    }
    const moduleCount = spec.layers.reduce(
      (count, layer) =>
        count + (Array.isArray(layer?.modules) ? layer.modules.length : 0),
      0,
    );
    if (moduleCount === 0) {
      errors.push('at least one module is required');
    }
  }

  const modules = Array.isArray(spec.layers)
    ? spec.layers.flatMap((layer) =>
        Array.isArray(layer?.modules) ? layer.modules : [],
      )
    : [];
  if (!Array.isArray(spec.edges)) {
    errors.push('edges must be an array');
  }
  const edges = Array.isArray(spec.edges) ? spec.edges : [];
  const seenIds = new Set();

  for (const [index, item] of [...modules, ...edges].entries()) {
    if (!STABLE_ID_PATTERN.test(item?.id)) {
      errors.push(`item ${index} id must be a stable id`);
      continue;
    }
    if (seenIds.has(item.id)) {
      errors.push(`item ${index} has a duplicate stable id`);
    }
    seenIds.add(item.id);
  }

  for (const [moduleIndex, module] of modules.entries()) {
    for (const field of ['label', 'subtitle', 'motif']) {
      if (!isNonEmptyString(module?.[field])) {
        errors.push(`module ${moduleIndex} ${field} must be a non-empty string`);
      }
    }

    if (!Array.isArray(module?.details) || module.details.length === 0) {
      errors.push(`module ${moduleIndex} details must contain at least 1 string`);
    } else {
      if (module.details.length > 3) {
        errors.push(`module ${moduleIndex} details may contain at most 3 strings`);
      }
      for (const detail of module.details) {
        if (!isNonEmptyString(detail)) {
          errors.push(`module ${moduleIndex} detail must be a non-empty string`);
        }
      }
    }

    if (!COLOR_ROLES.has(module?.colorRole)) {
      errors.push(`module ${moduleIndex} color role is not approved`);
    }
  }

  const moduleIds = new Set(modules.map((module) => module?.id));
  for (const [edgeIndex, edge] of edges.entries()) {
    if (!moduleIds.has(edge?.source)) {
      errors.push(`edge ${edgeIndex} has an unknown source`);
    }
    if (!moduleIds.has(edge?.target)) {
      errors.push(`edge ${edgeIndex} has an unknown target`);
    }
    if (!EDGE_ROLES.has(edge?.role)) {
      errors.push(`edge ${edgeIndex} edge role is not approved`);
    }
  }

  return errors;
}

export async function loadAndValidateSpec(inputPath) {
  const source = await readFile(inputPath, 'utf8');
  let spec;
  try {
    spec = JSON.parse(source);
  } catch {
    return { spec: null, errors: ['input is not valid JSON'] };
  }
  return { spec, errors: validateArchitectureSpec(spec) };
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  const { errors } = await loadAndValidateSpec(process.argv[2]);
  const output = { valid: errors.length === 0, errors };
  process.stdout.write(`${JSON.stringify(output)}\n`);
  process.exitCode = output.valid ? 0 : 1;
}
