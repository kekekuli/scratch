import fs from 'fs';
const inputPath = '.raw';
const outputPath = 'kaggleURL.js';

const lines = fs.readFileSync(inputPath, 'utf-8')
  .split('\n')
  .map(line => line.trim())
  .filter(line => line.length > 0);

const jsArray = `export default [\n${lines.map(url => `  "${url}"`).join(',\n')}\n];\n`;

fs.writeFileSync(outputPath, jsArray, 'utf-8');