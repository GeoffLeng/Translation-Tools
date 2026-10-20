import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 原始基础生化词典数据 (兼顾向后兼容)
const oldPath = path.join(__dirname, '../data/biochem_terms.json');
let oldTerms = {};
if (fs.existsSync(oldPath)) {
  try {
    oldTerms = JSON.parse(fs.readFileSync(oldPath, 'utf-8')).terms || {};
  } catch (e) {}
}

console.log(`现有旧词条总数: ${Object.keys(oldTerms).length}`);
