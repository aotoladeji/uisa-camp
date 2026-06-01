import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { execSync } from 'node:child_process';

const root = process.cwd();
const clientBuildDir = path.join(root, 'client', 'build');
const releaseDir = path.join(root, 'release');
const webDir = path.join(releaseDir, 'web');

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function readGitCommit() {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

async function main() {
  if (!(await exists(clientBuildDir))) {
    throw new Error('client/build not found. Run "npm run build --prefix client" first.');
  }

  await fs.rm(webDir, { recursive: true, force: true });
  await fs.mkdir(webDir, { recursive: true });
  await fs.cp(clientBuildDir, webDir, { recursive: true });

  // SPA fallback for S3 website hosting; set Error document to index.html in S3 settings.
  await fs.copyFile(path.join(webDir, 'index.html'), path.join(webDir, '404.html'));

  const manifest = {
    app: 'uisa-camp-client',
    builtAt: new Date().toISOString(),
    gitCommit: readGitCommit(),
    sourceDir: 'client/build',
    releaseDir: 'release/web'
  };

  await fs.writeFile(
    path.join(releaseDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n',
    'utf8'
  );

  console.log('Release package ready at release/web');
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
