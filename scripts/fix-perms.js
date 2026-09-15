import fs from 'node:fs';
import path from 'node:path';

if (process.platform !== 'win32') {
  const rootDir = process.cwd();

  function fixBinaries(binDirPath) {
    if (!fs.existsSync(binDirPath)) return;
    try {
      const items = fs.readdirSync(binDirPath, { withFileTypes: true });
      for (const item of items) {
        const fullPath = path.join(binDirPath, item.name);
        if (item.isDirectory()) {
          fixBinaries(fullPath);
        } else if (item.isFile()) {
          try {
            fs.chmodSync(fullPath, 0o755);
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
    path.join(rootDir, 'packages/shared/node_modules')
  ];

  for (const dir of targetDirs) {
    if (fs.existsSync(dir)) {
      scanNodeModules(dir);
    }
  }
}
