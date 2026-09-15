import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

if (process.platform !== 'win32') {
  const rootDir = process.cwd();

  // 1. Quick shell fallback for Linux/Unix
  try {
    execSync(
      'chmod -R +x node_modules/.bin apps/*/node_modules/.bin packages/*/node_modules/.bin 2>/dev/null || true',
      { stdio: 'ignore' }
    );
  } catch (e) {}

  // 2. Comprehensive JS traversal handling symlinks and real paths
  function fixBinaries(binDirPath) {
    if (!fs.existsSync(binDirPath)) return;
    try {
      const items = fs.readdirSync(binDirPath, { withFileTypes: true });
      for (const item of items) {
        const fullPath = path.join(binDirPath, item.name);
        if (item.isDirectory()) {
          fixBinaries(fullPath);
        } else {
          // Apply chmod to file / symlink
          try {
            fs.chmodSync(fullPath, 0o755);
          } catch (e) {}

          // Also resolve symlink target and apply chmod
          try {
            const realPath = fs.realpathSync(fullPath);
            if (realPath && realPath !== fullPath) {
              fs.chmodSync(realPath, 0o755);
            }
          } catch (e) {}
        }
      }
    } catch (err) {}
  }

  function scanNodeModules(dirPath) {
    if (!fs.existsSync(dirPath)) return;
    try {
      const items = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const item of items) {
        const fullPath = path.join(dirPath, item.name);
        if (item.isDirectory()) {
          if (item.name === '.bin' || item.name === 'bin') {
            fixBinaries(fullPath);
          } else {
            scanNodeModules(fullPath);
          }
        }
      }
    } catch (err) {}
  }

  const targetDirs = [
    path.join(rootDir, 'node_modules'),
    path.join(rootDir, 'apps/web/node_modules'),
    path.join(rootDir, 'apps/api/node_modules'),
    path.join(rootDir, 'packages/shared/node_modules'),
  ];

  for (const dir of targetDirs) {
    if (fs.existsSync(dir)) {
      scanNodeModules(dir);
    }
  }
}
