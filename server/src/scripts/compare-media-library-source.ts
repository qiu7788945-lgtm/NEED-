import 'dotenv/config';
import { closeDbPool } from '../db/client.js';
import {
  readMediaLibraryMysqlCandidates,
  type MediaLibraryMysqlCandidate,
} from '../services/data-source/media-library-content-source.js';
import { listLocalImages, type LocalImageFile } from '../services/media/media.service.js';

type StableKey = string;

interface MatchedPair {
  stableKey: StableKey;
  local: LocalImageFile;
  mysql: MediaLibraryMysqlCandidate;
}

interface FieldMismatch {
  stableKey: StableKey;
  fileName: string;
  fieldName: string;
  jsonValue: unknown;
  mysqlValue: unknown;
  message: string;
}

function normalizeUrl(value: string | undefined) {
  const raw = value?.trim() ?? '';
  if (!raw) {
    return '';
  }

  try {
    const url = new URL(raw);
    return decodeURIComponent(`${url.pathname}${url.search}`.replace(/\?.*$/, ''));
  } catch {
    try {
      return decodeURIComponent(raw.replace(/\?.*$/, ''));
    } catch {
      return raw.replace(/\?.*$/, '');
    }
  }
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeStatus(value: unknown) {
  const text = normalizeText(value).toLowerCase();
  if (text === 'inactive') {
    return 'archived';
  }
  return text;
}

function fileNameFromPath(value: string | undefined) {
  const normalized = normalizeUrl(value);
  if (!normalized) {
    return '';
  }

  return normalized.split(/[\\/]/).filter(Boolean).pop() ?? '';
}

function localStableKeys(item: LocalImageFile): StableKey[] {
  return [
    normalizeUrl(item.url) ? `url:${normalizeUrl(item.url)}` : '',
    item.fileName ? `fileName:${item.fileName}` : '',
    item.fileName ? `fileNameSize:${item.fileName}#${item.size}` : '',
  ].filter(Boolean);
}

function mysqlStableKeys(item: MediaLibraryMysqlCandidate): StableKey[] {
  const pathFileName = fileNameFromPath(item.filePath);
  return [
    normalizeUrl(item.publicUrl) ? `url:${normalizeUrl(item.publicUrl)}` : '',
    normalizeUrl(item.url) ? `url:${normalizeUrl(item.url)}` : '',
    normalizeUrl(item.filePath) ? `filePath:${normalizeUrl(item.filePath)}` : '',
    item.fileName ? `fileName:${item.fileName}` : '',
    item.fileName ? `fileNameSize:${item.fileName}#${item.fileSize}` : '',
    pathFileName ? `fileName:${pathFileName}` : '',
    pathFileName ? `fileNameSize:${pathFileName}#${item.fileSize}` : '',
  ].filter(Boolean);
}

function buildMysqlLookup(candidates: MediaLibraryMysqlCandidate[]) {
  const lookup = new Map<StableKey, MediaLibraryMysqlCandidate>();

  for (const candidate of candidates) {
    for (const key of mysqlStableKeys(candidate)) {
      if (!lookup.has(key)) {
        lookup.set(key, candidate);
      }
    }
  }

  return lookup;
}

function findMysqlMatch(
  localItem: LocalImageFile,
  mysqlLookup: Map<StableKey, MediaLibraryMysqlCandidate>,
): { stableKey: StableKey; candidate: MediaLibraryMysqlCandidate } | null {
  for (const key of localStableKeys(localItem)) {
    const candidate = mysqlLookup.get(key);
    if (candidate) {
      return { stableKey: key, candidate };
    }
  }

  return null;
}

function addMismatch(
  mismatches: FieldMismatch[],
  input: {
    stableKey: StableKey;
    fileName: string;
    fieldName: string;
    jsonValue: unknown;
    mysqlValue: unknown;
  },
) {
  mismatches.push({
    ...input,
    message: `${input.fieldName} differs between listLocalImages() and MySQL media_files adapter output.`,
  });
}

function collectFieldMismatches(matches: MatchedPair[]) {
  const mismatches: FieldMismatch[] = [];

  for (const match of matches) {
    const checks = [
      {
        fieldName: 'displayName',
        jsonValue: normalizeText(match.local.displayName),
        mysqlValue: normalizeText(match.mysql.displayName || match.mysql.title),
      },
      {
        fieldName: 'originalName',
        jsonValue: normalizeText(match.local.originalName),
        mysqlValue: normalizeText(match.mysql.originalName),
      },
      {
        fieldName: 'fileSize',
        jsonValue: match.local.size,
        mysqlValue: match.mysql.fileSize,
      },
      {
        fieldName: 'mimeType',
        jsonValue: normalizeText(match.local.mimeType),
        mysqlValue: normalizeText(match.mysql.mimeType),
      },
      {
        fieldName: 'category',
        jsonValue: normalizeText(match.local.category),
        mysqlValue: normalizeText(match.mysql.category),
      },
      {
        fieldName: 'status',
        jsonValue: normalizeStatus(match.local.status),
        mysqlValue: normalizeStatus(match.mysql.status),
      },
    ];

    for (const check of checks) {
      if (check.jsonValue !== check.mysqlValue) {
        addMismatch(mismatches, {
          stableKey: match.stableKey,
          fileName: match.local.fileName,
          fieldName: check.fieldName,
          jsonValue: check.jsonValue,
          mysqlValue: check.mysqlValue,
        });
      }
    }
  }

  return mismatches;
}

function summarizeLocal(item: LocalImageFile) {
  return {
    fileName: item.fileName,
    url: item.url,
    originalName: item.originalName,
    displayName: item.displayName,
    fileSize: item.size,
    mimeType: item.mimeType,
    category: item.category,
    status: item.status,
  };
}

function summarizeMysql(item: MediaLibraryMysqlCandidate) {
  return {
    id: item.id,
    fileName: item.fileName,
    url: item.url,
    publicUrl: item.publicUrl,
    filePath: item.filePath,
    originalName: item.originalName,
    displayName: item.displayName,
    fileSize: item.fileSize,
    mimeType: item.mimeType,
    category: item.category,
    status: item.status,
    ownershipKind: item.ownershipKind,
    ownershipReason: item.ownershipReason,
  };
}

async function main() {
  const [localItems, mysqlResult] = await Promise.all([
    listLocalImages({ status: 'all' }),
    readMediaLibraryMysqlCandidates(),
  ]);
  const likelyMysql = mysqlResult.candidates.filter((item) => item.ownershipKind === 'likelyMediaLibrary');
  const sharedExcluded = mysqlResult.candidates.filter((item) => item.ownershipKind === 'sharedButReferenced');
  const unknownOwnership = mysqlResult.candidates.filter((item) => item.ownershipKind === 'unknown');
  const mysqlLookup = buildMysqlLookup(likelyMysql);
  const matchedMysqlIds = new Set<number>();
  const matched: MatchedPair[] = [];
  const missingInMysql: LocalImageFile[] = [];

  for (const localItem of localItems) {
    const match = findMysqlMatch(localItem, mysqlLookup);
    if (!match) {
      missingInMysql.push(localItem);
      continue;
    }

    matchedMysqlIds.add(match.candidate.id);
    matched.push({
      stableKey: match.stableKey,
      local: localItem,
      mysql: match.candidate,
    });
  }

  const missingInJson = likelyMysql.filter((item) => !matchedMysqlIds.has(item.id));
  const fieldMismatches = collectFieldMismatches(matched);
  const status = missingInMysql.length || missingInJson.length || fieldMismatches.length
    ? 'warning'
    : 'matched';

  console.log(JSON.stringify({
    generatedAt: new Date().toISOString(),
    status,
    mode: 'read-only-shadow-compare',
    note: '/api/media/list is not changed; this report compares current listLocalImages() output to a standalone MySQL media_files adapter.',
    counts: {
      jsonUploadsList: localItems.length,
      mysqlTotal: mysqlResult.counts.total,
      mysqlLikelyMediaLibrary: mysqlResult.counts.likelyMediaLibrary,
      mysqlSharedExcluded: mysqlResult.counts.sharedButReferenced,
      mysqlUnknownOwnership: mysqlResult.counts.unknown,
      matched: matched.length,
      missingInMysql: missingInMysql.length,
      missingInJson: missingInJson.length,
      fieldMismatches: fieldMismatches.length,
    },
    summary: {
      stableKeyPriority: ['url/publicUrl', 'filePath', 'fileName', 'fileName+fileSize'],
      sharedTablePolicy: 'sharedButReferenced and unknown rows are reported but not treated as official media-library list rows.',
      nextGate: 'Review this report before deciding whether 22-5C-3 can switch the admin list.',
    },
    matched: matched.slice(0, 100).map((match) => ({
      stableKey: match.stableKey,
      fileName: match.local.fileName,
      mysqlId: match.mysql.id,
    })),
    missingInMysql: missingInMysql.slice(0, 100).map(summarizeLocal),
    missingInJson: missingInJson.slice(0, 100).map(summarizeMysql),
    fieldMismatches: fieldMismatches.slice(0, 200),
    sharedExcluded: sharedExcluded.slice(0, 100).map(summarizeMysql),
    unknownOwnership: unknownOwnership.slice(0, 100).map(summarizeMysql),
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(JSON.stringify({
      generatedAt: new Date().toISOString(),
      status: 'failed',
      mode: 'read-only-shadow-compare',
      error: error instanceof Error ? error.message : String(error),
    }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDbPool();
  });
