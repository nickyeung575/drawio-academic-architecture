import assert from 'node:assert/strict';
import { execFile, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const scannerPath = path.resolve(
  'skill/drawio-academic-architecture/scripts/scan-public-tree.mjs',
);

async function loadScanner() {
  let scannerModule;

  try {
    scannerModule = await import(`${pathToFileURL(scannerPath)}?test=${Date.now()}`);
  } catch {
    // The assertion below gives the first TDD cycle a stable failure message.
  }

  assert.equal(
    typeof scannerModule?.scanPublicTree,
    'function',
    'scanner API must exist',
  );
  return scannerModule;
}

async function withTemporaryTree(run) {
  const root = await mkdtemp(path.join(tmpdir(), 'public-tree-test-'));
  try {
    return await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function writeTreeFile(root, relativePath, content) {
  const filePath = path.join(root, relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content);
}

async function withEnvironmentVariable(name, value, run) {
  const hadOriginal = Object.hasOwn(process.env, name);
  const original = process.env[name];
  try {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
    return await run();
  } finally {
    if (hadOriginal) {
      process.env[name] = original;
    } else {
      delete process.env[name];
    }
  }
}

function pngWithChunk(chunkType, payload = Buffer.from('synthetic')) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(payload.length);
  const checksum = Buffer.alloc(4);
  return Buffer.concat([
    signature,
    length,
    Buffer.from(chunkType, 'ascii'),
    payload,
    checksum,
  ]);
}

async function runGit(root, ...args) {
  return execFileAsync('git', args, { cwd: root });
}

async function runGitWithEnvironment(root, args, environment) {
  return execFileAsync('git', args, {
    cwd: root,
    env: { ...process.env, ...environment },
  });
}

test('returns no findings for a clean temporary tree', async () => {
  const { scanPublicTree } = await loadScanner();

  await withTemporaryTree(async (root) => {
    await writeFile(path.join(root, 'README.md'), '# Synthetic example\n');

    assert.deepEqual(await scanPublicTree(root), []);
  });
});

test('detects home paths and temporary attachment markers in working files', async () => {
  const { scanPublicTree } = await loadScanner();

  await withTemporaryTree(async (root) => {
    const privateLocations = [
      ['C:', 'Users', 'SyntheticOwner', 'draft.drawio'].join('\\'),
      `/${['Users', 'SyntheticOwner', 'draft.drawio'].join('/')}`,
      `/${['home', 'synthetic-owner', 'draft.drawio'].join('/')}`,
    ];
    const attachmentMarker = ['sandbox:', '/', 'mnt', '/', 'data', '/', 'upload.png'].join('');

    await writeTreeFile(root, 'notes/locations.txt', privateLocations.join('\n'));
    await writeTreeFile(root, 'notes/upload.txt', attachmentMarker);

    const findings = await scanPublicTree(root);
    assert.ok(findings.some(({ rule }) => rule === 'local-path'), 'local-path');
    assert.ok(
      findings.some(({ rule }) => rule === 'temporary-attachment'),
      'temporary-attachment',
    );
  });
});

test('detects a personal email address in a working file', async () => {
  const { scanPublicTree } = await loadScanner();

  await withTemporaryTree(async (root) => {
    const personalEmail = ['synthetic.owner', 'example.invalid'].join('@');
    await writeTreeFile(root, 'notes/contact.txt', personalEmail);

    const findings = await scanPublicTree(root);
    assert.ok(findings.some(({ rule }) => rule === 'personal-email'), 'personal-email');
  });
});

test('detects PUBLIC_SCAN_EXTRA_TERMS in working paths and contents', async () => {
  const { scanPublicTree } = await loadScanner();

  await withTemporaryTree(async (root) => {
    const extraTerm = ['Project', 'Orchid', 'Codename'].join('-');
    await writeTreeFile(root, `notes/${extraTerm}-brief.txt`, 'Generic text\n');
    await writeTreeFile(root, 'notes/content.txt', `Contains ${extraTerm}\n`);

    await withEnvironmentVariable('PUBLIC_SCAN_EXTRA_TERMS', extraTerm, async () => {
      const findings = await scanPublicTree(root);
      assert.equal(
        findings.filter(({ rule }) => rule === 'extra-term').length,
        2,
        'extra-term',
      );
    });
  });
});

test('fails closed when required extra terms are missing or empty', async () => {
  const { scanPublicTree } = await loadScanner();

  await withTemporaryTree(async (root) => {
    for (const value of [undefined, '  , \n ; ']) {
      await withEnvironmentVariable('PUBLIC_SCAN_EXTRA_TERMS', value, async () => {
        const findings = await scanPublicTree(root, { requireExtraTerms: true });
        assert.deepEqual(
          findings.map(({ rule }) => rule),
          ['extra-terms-required'],
          'extra-terms-required',
        );
      });
    }
  });
});

test('rejects compressed drawio files without inspectable mxGraphModel XML', async () => {
  const { scanPublicTree } = await loadScanner();

  await withTemporaryTree(async (root) => {
    const opaquePayload = ['opaque', '-', 'compressed', '-', 'payload'].join('');
    await writeTreeFile(
      root,
      'examples/diagram.drawio',
      `<mxfile><diagram>${opaquePayload}</diagram></mxfile>`,
    );

    const findings = await scanPublicTree(root);
    assert.ok(
      findings.some(({ rule }) => rule === 'drawio-compressed'),
      'drawio-compressed',
    );
  });
});

test('rejects PNG textual and EXIF metadata chunks', async () => {
  const { scanPublicTree } = await loadScanner();

  await withTemporaryTree(async (root) => {
    const prohibitedChunks = [
      ['tE', 'Xt'].join(''),
      ['zT', 'Xt'].join(''),
      ['iT', 'Xt'].join(''),
      ['eX', 'If'].join(''),
    ];
    for (const [index, chunk] of prohibitedChunks.entries()) {
      await writeTreeFile(root, `exports/preview-${index}.png`, pngWithChunk(chunk));
    }

    const findings = await scanPublicTree(root);
    assert.equal(
      findings.filter(({ rule }) => rule === 'png-text-metadata').length,
      prohibitedChunks.length,
      'png-text-metadata',
    );
  });
});

test('skips a linked-worktree .git pointer file', async () => {
  const { scanPublicTree } = await loadScanner();

  await withTemporaryTree(async (root) => {
    const extraTerm = ['Private', 'Workspace', 'Root'].join('-');
    await writeTreeFile(root, '.git', `gitdir: ../${extraTerm}/worktrees/example\n`);
    await writeTreeFile(root, 'README.md', 'Synthetic public tree\n');

    await withEnvironmentVariable('PUBLIC_SCAN_EXTRA_TERMS', extraTerm, async () => {
      assert.deepEqual(await scanPublicTree(root), []);
    });
  });
});

test('does not interpret opaque PNG payload bytes as searchable text', async () => {
  const { scanPublicTree } = await loadScanner();

  await withTemporaryTree(async (root) => {
    const extraTerm = ['Binary', 'Coincidence'].join('-');
    await writeTreeFile(root, 'exports/preview.png', pngWithChunk('IDAT', Buffer.from(extraTerm)));

    await withEnvironmentVariable('PUBLIC_SCAN_EXTRA_TERMS', extraTerm, async () => {
      const findings = await scanPublicTree(root);
      assert.equal(findings.some(({ rule }) => rule === 'extra-term'), false);
    });
  });
});

test('rejects SVG metadata and embedded raster data', async () => {
  const { scanPublicTree } = await loadScanner();

  await withTemporaryTree(async (root) => {
    const metadataElement = ['<meta', 'data>synthetic</meta', 'data>'].join('');
    const embeddedRaster = ['data:', 'image/', 'png;base64,', 'AAAA'].join('');
    await writeTreeFile(root, 'exports/metadata.svg', `<svg>${metadataElement}</svg>`);
    await writeTreeFile(
      root,
      'exports/embedded.svg',
      `<svg><image href="${embeddedRaster}" /></svg>`,
    );

    const findings = await scanPublicTree(root);
    assert.equal(
      findings.filter(({ rule }) => rule === 'svg-metadata').length,
      2,
      'svg-metadata',
    );
  });
});

test('rejects a prohibited source-artifact filename with clean content', async () => {
  const { scanPublicTree } = await loadScanner();

  await withTemporaryTree(async (root) => {
    const prohibitedFilename = ['screen', 'shot', '-source.png'].join('');
    await writeTreeFile(root, `exports/${prohibitedFilename}`, Buffer.alloc(0));

    const findings = await scanPublicTree(root);
    assert.ok(
      findings.some(({ rule }) => rule === 'prohibited-filename'),
      'prohibited-filename',
    );
  });
});

test('scans staged filenames and index blobs that differ from the working tree', async () => {
  const { scanPublicTree } = await loadScanner();

  await withTemporaryTree(async (root) => {
    await runGit(root, 'init', '--quiet');
    const stagedFilename = ['screen', 'shot', '-index.png'].join('');
    const stagedPath = `exports/${stagedFilename}`;
    await writeTreeFile(root, stagedPath, Buffer.alloc(0));
    await runGit(root, 'add', '--', stagedPath);
    await rename(path.join(root, stagedPath), path.join(root, 'exports/preview.png'));

    const extraTerm = ['Index', 'Only', 'Codename'].join('-');
    const contentPath = 'notes/staged.txt';
    await writeTreeFile(root, contentPath, `Contains ${extraTerm}\n`);
    await runGit(root, 'add', '--', contentPath);
    await writeTreeFile(root, contentPath, 'Generic replacement\n');

    await withEnvironmentVariable('PUBLIC_SCAN_EXTRA_TERMS', extraTerm, async () => {
      const findings = await scanPublicTree(root);
      const stagedFindings = findings.filter(({ source }) => source === 'staged-index');
      assert.ok(
        stagedFindings.some(({ rule }) => rule === 'prohibited-filename'),
        'staged prohibited-filename',
      );
      assert.ok(
        stagedFindings.some(({ rule }) => rule === 'extra-term'),
        'staged extra-term',
      );
    });
  });
});

test('scans every reachable commit tree, blob, commit identity, and annotated tag identity', async () => {
  const { scanPublicTree } = await loadScanner();

  await withTemporaryTree(async (root) => {
    await runGit(root, 'init', '--quiet');
    const prohibitedFilename = ['screen', 'shot', '-history.png'].join('');
    const prohibitedPath = `exports/${prohibitedFilename}`;
    const extraTerm = ['History', 'Only', 'Codename'].join('-');
    const historicalContentPath = 'notes/historical.txt';
    await writeTreeFile(root, prohibitedPath, Buffer.alloc(0));
    await writeTreeFile(root, historicalContentPath, `Contains ${extraTerm}\n`);
    await runGit(root, 'add', '--all');

    const privateCommitEmail = ['history.owner', 'example.invalid'].join('@');
    await runGitWithEnvironment(root, ['commit', '--quiet', '-m', 'historical fixture'], {
      GIT_AUTHOR_NAME: 'Synthetic History Author',
      GIT_AUTHOR_EMAIL: privateCommitEmail,
      GIT_COMMITTER_NAME: 'Synthetic History Committer',
      GIT_COMMITTER_EMAIL: privateCommitEmail,
    });

    await rename(path.join(root, prohibitedPath), path.join(root, 'exports/preview.png'));
    await rm(path.join(root, historicalContentPath));
    await runGit(root, 'add', '--all');
    const allowedNoreplyEmail = ['12345+synthetic', 'users.noreply.github.com'].join('@');
    await runGitWithEnvironment(root, ['commit', '--quiet', '-m', 'sanitize current tree'], {
      GIT_AUTHOR_NAME: 'Synthetic Public Author',
      GIT_AUTHOR_EMAIL: allowedNoreplyEmail,
      GIT_COMMITTER_NAME: 'Synthetic Public Committer',
      GIT_COMMITTER_EMAIL: allowedNoreplyEmail,
    });

    const privateTaggerEmail = ['release.owner', 'example.invalid'].join('@');
    await runGitWithEnvironment(root, ['tag', '-a', 'v0.0.0', '-m', 'synthetic tag'], {
      GIT_COMMITTER_NAME: 'Synthetic Release Tagger',
      GIT_COMMITTER_EMAIL: privateTaggerEmail,
    });

    await withEnvironmentVariable('PUBLIC_SCAN_EXTRA_TERMS', extraTerm, async () => {
      const findings = await scanPublicTree(root, { history: true });
      const historyFindings = findings.filter(({ source }) => source === 'git-history');
      assert.ok(
        historyFindings.some(({ rule }) => rule === 'prohibited-filename'),
        'historical prohibited-filename',
      );
      assert.ok(
        historyFindings.some(({ rule }) => rule === 'extra-term'),
        'historical extra-term',
      );

      const commitIdentities = findings.filter(
        ({ source, rule }) => source === 'commit-identity' && rule === 'personal-email',
      );
      assert.equal(commitIdentities.length, 2, 'commit author and committer identities');
      assert.ok(
        findings.some(
          ({ source, rule }) => source === 'tag-identity' && rule === 'personal-email',
        ),
        'annotated tagger identity',
      );
    });
  });
});

test('sanitizes findings without echoing matched path or content values', async () => {
  const { scanPublicTree } = await loadScanner();

  await withTemporaryTree(async (root) => {
    const extraTerm = ['Sanitize', 'Only', 'Codename'].join('-');
    const personalEmail = ['sanitized.owner', 'example.invalid'].join('@');
    await writeTreeFile(
      root,
      `notes/${extraTerm}-brief.txt`,
      `Contains ${extraTerm} and ${personalEmail}\n`,
    );

    await withEnvironmentVariable('PUBLIC_SCAN_EXTRA_TERMS', extraTerm, async () => {
      const findings = await scanPublicTree(root);
      const serialized = JSON.stringify(findings);
      assert.ok(findings.some(({ rule }) => rule === 'extra-term'));
      assert.ok(findings.some(({ rule }) => rule === 'personal-email'));
      assert.ok(!serialized.includes(extraTerm), 'must not echo extra term');
      assert.ok(!serialized.includes(personalEmail), 'must not echo personal email');
      for (const finding of findings) {
        assert.deepEqual(Object.keys(finding).sort(), ['object', 'rule', 'source']);
      }
    });
  });
});

test('CLI returns compact sanitized JSON with clean, finding, and fail-closed exits', async () => {
  await withTemporaryTree(async (root) => {
    await writeTreeFile(root, 'README.md', '# Synthetic example\n');
    const cleanEnvironment = { ...process.env };
    delete cleanEnvironment.PUBLIC_SCAN_EXTRA_TERMS;

    const clean = spawnSync(process.execPath, [scannerPath, '--root', root], {
      encoding: 'utf8',
      env: cleanEnvironment,
    });
    assert.equal(clean.status, 0, clean.stderr);
    assert.equal(clean.stderr, '');
    const cleanPayload = JSON.parse(clean.stdout);
    assert.deepEqual(cleanPayload, { valid: true, findings: [] });
    assert.equal(clean.stdout.trim(), JSON.stringify(cleanPayload), 'compact clean JSON');

    const extraTerm = ['Cli', 'Only', 'Codename'].join('-');
    await writeTreeFile(root, 'notes/private.txt', `Contains ${extraTerm}\n`);
    const failing = spawnSync(process.execPath, [scannerPath, '--root', root], {
      encoding: 'utf8',
      env: { ...cleanEnvironment, PUBLIC_SCAN_EXTRA_TERMS: extraTerm },
    });
    assert.equal(failing.status, 1, failing.stderr);
    assert.equal(failing.stderr, '');
    const failingPayload = JSON.parse(failing.stdout);
    assert.equal(failingPayload.valid, false);
    assert.ok(failingPayload.findings.some(({ rule }) => rule === 'extra-term'));
    assert.equal(failing.stdout.trim(), JSON.stringify(failingPayload), 'compact finding JSON');
    assert.ok(!`${failing.stdout}${failing.stderr}`.includes(extraTerm), 'sanitized CLI');

    await rm(path.join(root, 'notes'), { recursive: true, force: true });
    const required = spawnSync(
      process.execPath,
      [scannerPath, '--root', root, '--require-extra-terms'],
      { encoding: 'utf8', env: cleanEnvironment },
    );
    assert.equal(required.status, 1, required.stderr);
    assert.equal(required.stderr, '');
    const requiredPayload = JSON.parse(required.stdout);
    assert.ok(
      requiredPayload.findings.some(({ rule }) => rule === 'extra-terms-required'),
      'fail-closed required terms',
    );
    assert.equal(required.stdout.trim(), JSON.stringify(requiredPayload), 'compact required JSON');
  });
});
