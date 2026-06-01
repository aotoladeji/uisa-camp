import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const releaseWebDir = path.join(root, 'release', 'web');

function parseArgs(argv) {
  const args = { website: false, dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const next = argv[i + 1];

    if (key === '--bucket' && next) {
      args.bucket = next;
      i += 1;
    } else if (key === '--region' && next) {
      args.region = next;
      i += 1;
    } else if (key === '--profile' && next) {
      args.profile = next;
      i += 1;
    } else if (key === '--website') {
      args.website = true;
    } else if (key === '--dry-run') {
      args.dryRun = true;
    }
  }
  return args;
}

function runAws(args, label) {
  console.log(label);
  const result = spawnSync('aws', args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    cwd: root,
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const bucket = args.bucket || process.env.S3_BUCKET;

  if (!bucket) {
    console.error('Missing bucket. Use --bucket <name> or set S3_BUCKET env var.');
    process.exit(1);
  }

  const shared = [];
  if (args.region) shared.push('--region', args.region);
  if (args.profile) shared.push('--profile', args.profile);
  if (args.dryRun) shared.push('--dryrun');

  const target = `s3://${bucket}`;

  runAws(
    [
      's3', 'sync', releaseWebDir, target,
      '--delete',
      '--exclude', '*.html',
      '--cache-control', 'public,max-age=31536000,immutable',
      ...shared,
    ],
    'Uploading versioned static assets...'
  );

  runAws(
    [
      's3', 'sync', releaseWebDir, target,
      '--exclude', '*',
      '--include', '*.html',
      '--cache-control', 'no-cache,no-store,must-revalidate',
      '--content-type', 'text/html; charset=utf-8',
      ...shared,
    ],
    'Uploading HTML entry files with no-cache headers...'
  );

  if (args.website) {
    runAws(
      [
        's3', 'website', target,
        '--index-document', 'index.html',
        '--error-document', 'index.html',
        ...shared,
      ],
      'Configuring S3 static website index/error documents...'
    );
  }

  console.log(`Deployment complete: ${target}`);
}

main();
