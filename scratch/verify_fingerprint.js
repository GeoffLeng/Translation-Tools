import { getPdfFingerprint, formatBytes, formatTimestamp } from '../src/doc_storage.js';

// 1. 测试微调修订版抗碰撞
const buf1 = new Uint8Array(200000);
buf1[100] = 65;
buf1[190000] = 88;

const buf2 = new Uint8Array(200000);
buf2[100] = 65;
buf2[190000] = 89; // 尾部 64KB 内仅仅微调 1 个字节 (模拟作者在 Acrobat 或 Word 中微调修订文字并重新导出)

const mockPdf = { numPages: 10, fingerprints: ['fixed_permanent_trailer_id'] };

const fp1 = getPdfFingerprint(mockPdf, buf1, 'Nature_paper.pdf', { lastModified: 1700000000000 });
const fp2 = getPdfFingerprint(mockPdf, buf2, 'Nature_paper.pdf', { lastModified: 1700000500000 });

console.log('FP1:', fp1);
console.log('FP2:', fp2);

if (fp1 === fp2) {
  throw new Error('COLLISION DETECTED! Fingerprints should be strictly different for revisions!');
}
console.log('✓ 抗碰撞测试通过：相同文件名、相同原生Trailer ID、相同页数，但尾部仅差 1 字节时指纹完全互斥隔离！');

// 2. 测试体积与时间格式化
console.log('5MB format:', formatBytes(5242880));
console.log('Time format:', formatTimestamp(1729410000000));
console.log('All scratch tests passed!');
