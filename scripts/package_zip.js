import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const version = pkg.version || '1.0.1';

const releaseDir = path.join(rootDir, 'release');
if (!fs.existsSync(releaseDir)) {
  fs.mkdirSync(releaseDir, { recursive: true });
}

// 自动清理 release 目录下的所有旧版本 zip 安装包
const existingFiles = fs.readdirSync(releaseDir);
for (const file of existingFiles) {
  if (file.endsWith('.zip')) {
    const oldFilePath = path.join(releaseDir, file);
    fs.unlinkSync(oldFilePath);
    console.log(`🗑️ 已清理旧版本安装包: ${file}`);
  }
}

const distDir = path.join(rootDir, 'dist');
console.log('正在执行全量生产级编译构建 (npm run build)...');
execSync('npm run build', { cwd: rootDir, stdio: 'inherit' });

const zipPath = path.join(releaseDir, `translate-fy-v${version}.zip`);
console.log(`正在打包最新 Chrome 扩展至: ${zipPath}`);

try {
  // 使用 PowerShell 原生 Compress-Archive 打包 dist/*，无需引入外部臃肿依赖
  const psCommand = `powershell -NoProfile -Command "Compress-Archive -Path '${distDir}\\*' -DestinationPath '${zipPath}' -Force"`;
  execSync(psCommand, { stdio: 'inherit' });
  const stat = fs.statSync(zipPath);
  console.log(`✅ 打包成功！最新版本: v${version}，文件大小: ${(stat.size / 1024).toFixed(1)} KB`);
  console.log(`📦 产物路径: ${zipPath}`);
  console.log('💡 该 zip 包可直接分发给朋友解压安装，已内置轻量化透明通道 PNG 图标！');
} catch (e) {
  console.error('打包压缩失败:', e.message);
}
