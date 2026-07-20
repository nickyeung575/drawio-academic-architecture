import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const EXCLUDED_DIRECTORIES = new Set(['.git', 'node_modules', '.tools']);
const HOME_PATH_PATTERNS = [
  /\b[a-z]:[\\/]+users[\\/]+[^\\/\s"'<>]+/i,
  /(?:^|[\s"'(=])\/(?:users|home)\/[^/\s"'<>]+/im,
];
const TEMPORARY_ATTACHMENT_PATTERNS = [
  /sandbox:\/mnt\/data(?:\/|\b)/i,
  /(?:^|[\s"'(=])\/(?:tmp|var\/tmp)\//im,
  /[\\/]appdata[\\/]local[\\/]temp[\\/]/i,
];
const EMAIL_PATTERN = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,63}/i;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const PROHIBITED_PNG_CHUNKS = new Set(['tEXt', 'zTXt', 'iTXt', 'eXIf']);
const OPAQUE_BINARY_EXTENSIONS = new Set([
  '.gif',
  '.jpeg',
  '.jpg',
  '.pdf',
  '.png',
  '.webp',
  '.zip',
]);
const PROHIBITED_FILENAME_PATTERN =
  /(?:^|[._ -])(?:screenshot|screen[-_ ]?capture|attachment|paper[-_ ]?figure|source[-_ ]?figure)(?:[._ -]|$)/i;
const GITHUB_NOREPLY_PATTERN = /^[^@\s]+@users\.noreply\.github\.com$/i;
const OBJECT_SENSITIVE_RULES = new Set([
  'local-path',
  'temporary-attachment',
  'personal-email',
  'extra-term',
  'prohibited-filename',
]);

function parseExtraTerms(value) {
  return (value ?? '')
    .split(/[\r\n,;]+/)
    .map((term) => term.trim())
    .filter(Boolean);
}

function hasProhibitedPngChunk(content) {
  if (
    content.length < PNG_SIGNATURE.length ||
    !content.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)
  ) {
    return false;
  }

  let offset = PNG_SIGNATURE.length;
  while (offset + 12 <= content.length) {
    const dataLength = content.readUInt32BE(offset);
    const end = offset + 12 + dataLength;
    if (end > content.length) {
      return false;
    }
    const chunkType = content.toString('ascii', offset + 4, offset + 8);
    if (PROHIBITED_PNG_CHUNKS.has(chunkType)) {
      return true;
    }
    offset = end;
  }

  return false;
}

function containsProhibitedEmail(values, allowGitHubNoreply) {
  const emailPattern = new RegExp(EMAIL_PATTERN.source, 'gi');
  return values.some((value) => {
    const addresses = value.match(emailPattern) ?? [];
    return addresses.some(
      (address) => !allowGitHubNoreply || !GITHUB_NOREPLY_PATTERN.test(address),
    );
  });
}

function isSearchableText(relativePath, content) {
  if (OPAQUE_BINARY_EXTENSIONS.has(path.posix.extname(relativePath.toLocaleLowerCase()))) {
    return false;
  }
  return !content.subarray(0, Math.min(content.length, 4096)).includes(0);
}

function matchingRules(
  relativePath,
  content,
  extraTerms,
  { allowGitHubNoreply = false } = {},
) {
  const contentText = content.toString('utf8');
  const values = [relativePath, ...(isSearchableText(relativePath, content) ? [contentText] : [])];
  const rules = [];

  if (values.some((value) => HOME_PATH_PATTERNS.some((pattern) => pattern.test(value)))) {
    rules.push('local-path');
  }
  if (
    values.some((value) =>
      TEMPORARY_ATTACHMENT_PATTERNS.some((pattern) => pattern.test(value)),
    )
  ) {
    rules.push('temporary-attachment');
  }
  if (containsProhibitedEmail(values, allowGitHubNoreply)) {
    rules.push('personal-email');
  }
  if (
    extraTerms.some((term) =>
      values.some((value) => value.toLocaleLowerCase().includes(term.toLocaleLowerCase())),
    )
  ) {
    rules.push('extra-term');
  }
  if (
    relativePath.toLocaleLowerCase().endsWith('.drawio') &&
    !/<mxGraphModel(?:\s|>)/i.test(contentText)
  ) {
    rules.push('drawio-compressed');
  }
  if (
    relativePath.toLocaleLowerCase().endsWith('.png') &&
    hasProhibitedPngChunk(content)
  ) {
    rules.push('png-text-metadata');
  }
  if (
    relativePath.toLocaleLowerCase().endsWith('.svg') &&
    (/<metadata\b/i.test(contentText) || /data:image\//i.test(contentText))
  ) {
    rules.push('svg-metadata');
  }
  if (PROHIBITED_FILENAME_PATTERN.test(path.posix.basename(relativePath))) {
    rules.push('prohibited-filename');
  }

  return rules;
}

async function walkTree(root, directory, findings, extraTerms) {
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    if (EXCLUDED_DIRECTORIES.has(entry.name)) {
      continue;
    }
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await walkTree(root, absolutePath, findings, extraTerms);
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }

    const relativePath = path.relative(root, absolutePath).split(path.sep).join('/');
    const content = await readFile(absolutePath);
    for (const rule of matchingRules(relativePath, content, extraTerms)) {
      findings.push({ source: 'working-tree', object: relativePath, rule });
    }
  }
}

async function runGit(root, args) {
  return execFileAsync('git', args, {
    cwd: root,
    encoding: 'buffer',
    maxBuffer: 64 * 1024 * 1024,
  });
}

async function isGitRepository(root) {
  try {
    const { stdout } = await runGit(root, ['rev-parse', '--is-inside-work-tree']);
    return stdout.toString('utf8').trim() === 'true';
  } catch {
    return false;
  }
}

function nullSeparatedValues(buffer) {
  return buffer
    .toString('utf8')
    .split('\0')
    .filter(Boolean);
}

async function scanStagedIndex(root, findings, extraTerms) {
  const { stdout } = await runGit(root, ['diff', '--cached', '--name-only', '-z']);

  for (const stagedPath of nullSeparatedValues(stdout)) {
    let content;
    try {
      ({ stdout: content } = await runGit(root, ['show', `:${stagedPath}`]));
    } catch {
      content = Buffer.alloc(0);
    }
    for (const rule of matchingRules(stagedPath, content, extraTerms)) {
      findings.push({ source: 'staged-index', object: stagedPath, rule });
    }
  }
}

function parseTreeRecord(record) {
  const tab = record.indexOf('\t');
  if (tab === -1) {
    return undefined;
  }
  const [mode, type, objectId] = record.slice(0, tab).split(' ');
  if (!mode || !type || !objectId) {
    return undefined;
  }
  return { mode, type, objectId, treePath: record.slice(tab + 1) };
}

async function scanReachableTrees(root, findings, extraTerms) {
  const { stdout: revisionOutput } = await runGit(root, ['rev-list', '--all']);
  const commits = revisionOutput.toString('ascii').split(/\r?\n/).filter(Boolean);
  const blobCache = new Map();

  for (const commit of commits) {
    const { stdout: treeOutput } = await runGit(root, [
      'ls-tree',
      '-r',
      '--full-tree',
      '-z',
      commit,
    ]);
    for (const rawRecord of nullSeparatedValues(treeOutput)) {
      const record = parseTreeRecord(rawRecord);
      if (!record) {
        continue;
      }

      let content = Buffer.alloc(0);
      if (record.type === 'blob') {
        if (!blobCache.has(record.objectId)) {
          const { stdout } = await runGit(root, ['cat-file', 'blob', record.objectId]);
          blobCache.set(record.objectId, stdout);
        }
        content = blobCache.get(record.objectId);
      }

      for (const rule of matchingRules(record.treePath, content, extraTerms)) {
        findings.push({
          source: 'git-history',
          object: `commit:${commit.slice(0, 12)}:${record.treePath}`,
          rule,
        });
      }
    }
  }
}

function addIdentityFindings(findings, source, object, identity, extraTerms) {
  for (const rule of matchingRules(object, Buffer.from(identity), extraTerms, {
    allowGitHubNoreply: true,
  })) {
    findings.push({ source, object, rule });
  }
}

async function scanCommitIdentities(root, findings, extraTerms) {
  const { stdout } = await runGit(root, [
    'log',
    '--all',
    '--format=%x1e%H%x1f%an%x1f%ae%x1f%cn%x1f%ce',
  ]);
  const records = stdout.toString('utf8').split('\x1e').filter((record) => record.trim());

  for (const rawRecord of records) {
    const [commit, authorName, authorEmail, committerName, committerEmail] = rawRecord
      .replace(/^\r?\n|\r?\n$/g, '')
      .split('\x1f');
    if (!commit) {
      continue;
    }
    const label = `commit:${commit.slice(0, 12)}`;
    addIdentityFindings(
      findings,
      'commit-identity',
      `${label}:author`,
      `${authorName}\n${authorEmail}`,
      extraTerms,
    );
    addIdentityFindings(
      findings,
      'commit-identity',
      `${label}:committer`,
      `${committerName}\n${committerEmail}`,
      extraTerms,
    );
  }
}

async function scanAnnotatedTagIdentities(root, findings, extraTerms) {
  const { stdout } = await runGit(root, [
    'for-each-ref',
    'refs/tags',
    '--format=%(refname)%00%(objecttype)%00%(objectname)',
  ]);
  const records = stdout.toString('utf8').split(/\r?\n/).filter(Boolean);

  for (const record of records) {
    const [refName, objectType, objectId] = record.split('\0');
    if (objectType !== 'tag' || !objectId) {
      continue;
    }
    const { stdout: tagObject } = await runGit(root, ['cat-file', 'tag', objectId]);
    const taggerLine = tagObject
      .toString('utf8')
      .split(/\r?\n/)
      .find((line) => line.startsWith('tagger '));
    const match = /^tagger (.*) <([^<>]+)> \d+ [+-]\d{4}$/.exec(taggerLine ?? '');
    if (!match) {
      continue;
    }
    const tagName = refName.replace(/^refs\/tags\//, '');
    addIdentityFindings(
      findings,
      'tag-identity',
      `tag:${tagName}:tagger`,
      `${match[1]}\n${match[2]}`,
      extraTerms,
    );
  }
}

async function scanHistory(root, findings, extraTerms) {
  await scanReachableTrees(root, findings, extraTerms);
  await scanCommitIdentities(root, findings, extraTerms);
  await scanAnnotatedTagIdentities(root, findings, extraTerms);
}

function sanitizeFindings(findings) {
  const sensitiveObjects = new Set(
    findings
      .filter(({ rule }) => OBJECT_SENSITIVE_RULES.has(rule))
      .map(({ source, object }) => `${source}\0${object}`),
  );

  return findings.map(({ source, object, rule }) => {
    const key = `${source}\0${object}`;
    if (!sensitiveObjects.has(key)) {
      return { source, object: object.replace(/[\u0000-\u001f\u007f]/g, '?'), rule };
    }
    const digest = createHash('sha256').update(key).digest('hex').slice(0, 12);
    return { source, object: `${source}:object:${digest}`, rule };
  });
}

export async function scanPublicTree(
  root,
  { history = false, requireExtraTerms = false } = {},
) {
  const absoluteRoot = path.resolve(root);
  const findings = [];
  const extraTerms = parseExtraTerms(process.env.PUBLIC_SCAN_EXTRA_TERMS);
  if (requireExtraTerms && extraTerms.length === 0) {
    return [
      {
        source: 'configuration',
        object: 'environment',
        rule: 'extra-terms-required',
      },
    ];
  }
  await walkTree(absoluteRoot, absoluteRoot, findings, extraTerms);
  if (await isGitRepository(absoluteRoot)) {
    await scanStagedIndex(absoluteRoot, findings, extraTerms);
    if (history) {
      await scanHistory(absoluteRoot, findings, extraTerms);
    }
  }
  return sanitizeFindings(findings);
}

function parseCliArguments(argv) {
  const options = { root: process.cwd(), history: false, requireExtraTerms: false };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--root' && argv[index + 1]) {
      options.root = argv[index + 1];
      index += 1;
    } else if (argument === '--history') {
      options.history = true;
    } else if (argument === '--require-extra-terms') {
      options.requireExtraTerms = true;
    } else {
      throw new Error('invalid scanner arguments');
    }
  }

  return options;
}

async function runCli() {
  let findings;
  try {
    const { root, history, requireExtraTerms } = parseCliArguments(process.argv.slice(2));
    findings = await scanPublicTree(root, { history, requireExtraTerms });
  } catch {
    findings = [{ source: 'scanner', object: 'scan', rule: 'scan-error' }];
  }

  const payload = { valid: findings.length === 0, findings };
  process.stdout.write(`${JSON.stringify(payload)}\n`);
  process.exitCode = payload.valid ? 0 : 1;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]).toLocaleLowerCase() ===
    fileURLToPath(import.meta.url).toLocaleLowerCase()
) {
  await runCli();
}
