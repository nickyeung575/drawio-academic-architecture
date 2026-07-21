import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const validatorUrl = new URL(
  '../skill/drawio-academic-architecture/scripts/validate-spec.mjs',
  import.meta.url,
);

async function loadValidator() {
  try {
    return await import(validatorUrl);
  } catch (error) {
    if (error?.code === 'ERR_MODULE_NOT_FOUND') {
      return undefined;
    }
    throw error;
  }
}

const completeSpec = {
  version: 1,
  title: 'Synthetic sensing pipeline',
  subtitle: 'A portable example',
  slug: 'synthetic-sensing-pipeline',
  layers: [
    {
      label: 'Processing',
      modules: [
        {
          id: 'sensor-input',
          label: 'Sensor input',
          subtitle: 'Synthetic readings',
          motif: 'waveform',
          details: ['Collect samples'],
          colorRole: 'teal',
        },
        {
          id: 'feature-model',
          label: 'Feature model',
          subtitle: 'Compact encoder',
          motif: 'neural-network',
          details: ['Encode features', 'Score output'],
          colorRole: 'slate',
        },
      ],
    },
  ],
  edges: [
    {
      id: 'input-to-model',
      source: 'sensor-input',
      target: 'feature-model',
      label: 'sample stream',
      role: 'flow',
    },
  ],
};

function cloneCompleteSpec() {
  return structuredClone(completeSpec);
}

async function writeTemporarySpec(t, contents) {
  const directory = await mkdtemp(join(tmpdir(), 'architecture-spec-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const inputPath = join(directory, 'spec.json');
  await writeFile(inputPath, contents, 'utf8');
  return inputPath;
}

async function runValidatorCli(inputPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [fileURLToPath(validatorUrl), inputPath],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.once('error', reject);
    child.once('close', (code) => resolve({ code, stdout, stderr }));
  });
}

test('accepts a complete architecture spec', async () => {
  const module = await loadValidator();

  assert.equal(
    typeof module?.validateArchitectureSpec,
    'function',
    'validator API must exist',
  );
  assert.deepEqual(module.validateArchitectureSpec(completeSpec), []);
});

test('requires an object root with version 1', async () => {
  const { validateArchitectureSpec } = await loadValidator();

  assert.match(validateArchitectureSpec(null).join('\n'), /version/i);
  assert.match(
    validateArchitectureSpec({ ...completeSpec, version: 2 }).join('\n'),
    /version/i,
  );
});

test('requires a non-empty title and filename-safe slug', async () => {
  const { validateArchitectureSpec } = await loadValidator();

  assert.match(
    validateArchitectureSpec({ ...completeSpec, title: '   ' }).join('\n'),
    /title/i,
  );
  assert.match(
    validateArchitectureSpec({ ...completeSpec, slug: '../unsafe name' }).join(
      '\n',
    ),
    /slug/i,
  );
});

test('requires at least one layer and one module', async () => {
  const { validateArchitectureSpec } = await loadValidator();

  assert.match(
    validateArchitectureSpec({ ...completeSpec, layers: [] }).join('\n'),
    /layer/i,
  );
  assert.match(
    validateArchitectureSpec({
      ...completeSpec,
      layers: [{ label: 'Empty layer', modules: [] }],
    }).join('\n'),
    /module/i,
  );
});

test('requires arrays for module and edge collections', async () => {
  const { validateArchitectureSpec } = await loadValidator();
  const invalidModules = cloneCompleteSpec();
  invalidModules.layers[0].modules = {};

  assert.match(
    validateArchitectureSpec(invalidModules).join('\n'),
    /modules must be an array/i,
  );

  for (const invalidEdges of [{}, 'not-an-array', null]) {
    assert.match(
      validateArchitectureSpec({ ...completeSpec, edges: invalidEdges }).join('\n'),
      /edges must be an array/i,
    );
  }
});

test('requires unique stable module and edge IDs', async () => {
  const { validateArchitectureSpec } = await loadValidator();
  const invalidModuleId = cloneCompleteSpec();
  invalidModuleId.layers[0].modules[0].id = 'Invalid ID';
  const invalidEdgeId = cloneCompleteSpec();
  invalidEdgeId.edges[0].id = '1-invalid';
  const duplicateModuleId = cloneCompleteSpec();
  duplicateModuleId.layers[0].modules[1].id = 'sensor-input';
  const duplicateEdgeId = cloneCompleteSpec();
  duplicateEdgeId.edges.push({ ...duplicateEdgeId.edges[0] });

  assert.match(validateArchitectureSpec(invalidModuleId).join('\n'), /stable id/i);
  assert.match(validateArchitectureSpec(invalidEdgeId).join('\n'), /stable id/i);
  assert.match(
    validateArchitectureSpec(duplicateModuleId).join('\n'),
    /duplicate/i,
  );
  assert.match(
    validateArchitectureSpec(duplicateEdgeId).join('\n'),
    /duplicate/i,
  );
});

test('requires module text, motif, and one to three detail strings', async () => {
  const { validateArchitectureSpec } = await loadValidator();

  for (const field of ['label', 'subtitle', 'motif']) {
    const missingField = cloneCompleteSpec();
    delete missingField.layers[0].modules[0][field];
    assert.match(
      validateArchitectureSpec(missingField).join('\n'),
      new RegExp(field, 'i'),
    );
  }

  const noDetails = cloneCompleteSpec();
  noDetails.layers[0].modules[0].details = [];
  assert.match(validateArchitectureSpec(noDetails).join('\n'), /detail/i);

  const tooManyDetails = cloneCompleteSpec();
  tooManyDetails.layers[0].modules[0].details = ['One', 'Two', 'Three', 'Four'];
  assert.match(
    validateArchitectureSpec(tooManyDetails).join('\n'),
    /at most 3/i,
  );

  const blankDetail = cloneCompleteSpec();
  blankDetail.layers[0].modules[0].details = ['   '];
  assert.match(validateArchitectureSpec(blankDetail).join('\n'), /detail/i);
});

test('requires an approved module color role', async () => {
  const { validateArchitectureSpec } = await loadValidator();
  const invalidColor = cloneCompleteSpec();
  invalidColor.layers[0].modules[0].colorRole = 'electric-blue';

  assert.match(validateArchitectureSpec(invalidColor).join('\n'), /color role/i);
});

test('requires edge endpoints to resolve to modules', async () => {
  const { validateArchitectureSpec } = await loadValidator();
  const unknownSource = cloneCompleteSpec();
  unknownSource.edges[0].source = 'missing-source';
  const unknownTarget = cloneCompleteSpec();
  unknownTarget.edges[0].target = 'missing-target';

  assert.match(validateArchitectureSpec(unknownSource).join('\n'), /unknown source/i);
  assert.match(validateArchitectureSpec(unknownTarget).join('\n'), /unknown target/i);
});

test('requires an approved edge role', async () => {
  const { validateArchitectureSpec } = await loadValidator();
  const invalidRole = cloneCompleteSpec();
  invalidRole.edges[0].role = 'teleport';

  assert.match(validateArchitectureSpec(invalidRole).join('\n'), /edge role/i);
});

test('loads a valid JSON architecture spec', async (t) => {
  const module = await loadValidator();
  const inputPath = await writeTemporarySpec(t, JSON.stringify(completeSpec));

  assert.equal(
    typeof module?.loadAndValidateSpec,
    'function',
    'loader API must exist',
  );
  assert.deepEqual(await module.loadAndValidateSpec(inputPath), {
    spec: completeSpec,
    errors: [],
  });
});

test('reports invalid JSON without echoing raw input', async (t) => {
  const { loadAndValidateSpec } = await loadValidator();
  const privateSentinel = 'do-not-echo-this-source';
  const inputPath = await writeTemporarySpec(
    t,
    `{"private-note":"${privateSentinel}",`,
  );

  const result = await loadAndValidateSpec(inputPath);

  assert.equal(result.spec, null);
  assert.match(result.errors.join('\n'), /json/i);
  assert.doesNotMatch(result.errors.join('\n'), new RegExp(privateSentinel));
});

test('returns parsed JSON with schema validation errors', async (t) => {
  const { loadAndValidateSpec } = await loadValidator();
  const invalidSpec = { ...completeSpec, version: 2 };
  const inputPath = await writeTemporarySpec(t, JSON.stringify(invalidSpec));

  const result = await loadAndValidateSpec(inputPath);

  assert.deepEqual(result.spec, invalidSpec);
  assert.match(result.errors.join('\n'), /version/i);
});

test('CLI reports compact JSON and validation exit status', async (t) => {
  const { validateArchitectureSpec } = await loadValidator();
  const validPath = await writeTemporarySpec(t, JSON.stringify(completeSpec));
  const invalidSpec = { ...completeSpec, version: 2, slug: '../unsafe' };
  const invalidPath = await writeTemporarySpec(t, JSON.stringify(invalidSpec));

  const validRun = await runValidatorCli(validPath);
  assert.equal(validRun.code, 0);
  assert.equal(validRun.stderr, '');
  assert.equal(validRun.stdout.trim(), '{"valid":true,"errors":[]}');

  const invalidRun = await runValidatorCli(invalidPath);
  const expectedErrors = validateArchitectureSpec(invalidSpec);
  assert.equal(invalidRun.code, 1);
  assert.equal(invalidRun.stderr, '');
  assert.equal(
    invalidRun.stdout.trim(),
    JSON.stringify({ valid: false, errors: expectedErrors }),
  );
});
