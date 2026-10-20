import { handleBioTranslate } from '../routes/translate_bio.js';

const testItems = [
  { id: 1, text: "All reagents and solvents were purchased from commercial sources and used without further purification." },
  { id: 2, text: "The enantiomeric excess of the product was determined to be 98% ee using high-performance liquid chromatography." },
  { id: 3, text: "The reaction mixture was warmed to room temperature and stirred for an additional 2 hours." },
  { id: 4, text: "Western blot analysis confirmed that GPX4 knockdown triggered iron-dependent lipid peroxidation and ferroptosis in vitro." }
];

console.log('=== 测试智能混合分流流水线 (无需 AI Key 测试平滑降级与免Key分流) ===');
console.time('HybridBatchTranslate');
handleBioTranslate({
  items: testItems,
  targetLang: 'zh-CN',
  enableHybrid: true
}).then(res => {
  console.timeEnd('HybridBatchTranslate');
  console.log('\n分流统计信息:', res.dispatchStats);
  console.log('\n最终合并翻译结果:');
  res.translations.forEach(t => console.log(`[ID ${t.id}] ${t.text}`));
}).catch(err => {
  console.error('测试失败:', err);
});
