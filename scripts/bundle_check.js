import fs from 'node:fs';
import path from 'node:path';

const LIMITS = {
  '.js': 300 * 1024,
  '.css': 100 * 1024
};

function checkDir(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      checkDir(fullPath);
    } else {
      const ext = path.extname(file);
      if (LIMITS[ext] && stat.size > LIMITS[ext]) {
        console.error(`ERROR: ${fullPath} exceeds limit (${stat.size} bytes > ${LIMITS[ext]} bytes)`);
        process.exit(1);
      }
    }
  }
}

console.log('Validating bundle sizes...');
checkDir('./src');
checkDir('./dist');
console.log('Bundle size verification: PASS OK');
