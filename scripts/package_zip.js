import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const releaseDir = path.join(rootDir, 'release');
if (!fs.existsSync(releaseDir)) {
  fs.mkdirSync(releaseDir, { recursive: true });
}

const distDir = path.join(rootDir, 'dist');
if (!fs.existsSync(distDir)) {
  console.log('未找到 dist 目录，正在执行 npm run build...');
  execSync('npm run build', { cwd: rootDir, stdio: 'inherit' });
}

const zipPath = path.join(releaseDir, 'lite-translate-v1.0.0.zip');
console.log(`正在打包 Chrome 扩展至: ${zipPath}`);

try {
  // 使用 PowerShell 原生 Compress-Archive 打包 dist/*，无需引入外部臃肿依赖
  const psCommand = `powershell -NoProfile -Command "Compress-Archive -Path '${distDir}\\*' -DestinationPath '${zipPath}' -Force"`;
  execSync(psCommand, { stdio: 'inherit' });
  const stat = fs.statSync(zipPath);
  console.log(`✅ 打包成功！文件大小: ${(stat.size / 1024).toFixed(1)} KB`);
  console.log(`📦 产物路径: ${zipPath}`);
  console.log('💡 该 zip 包可直接分发给朋友解压安装，或在配置好 PNG 图标后直接上传至 Chrome 网上应用店！');
} catch (e) {
  console.error('打包压缩失败:', e.message);
}
