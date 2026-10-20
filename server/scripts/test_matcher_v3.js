import { loadAllTerms, matchTerms } from '../engine/term_matcher.js';
import { buildBioSystemPrompt } from '../engine/prompt_builder.js';

console.time('LoadAllTerms');
const terms = loadAllTerms();
console.timeEnd('LoadAllTerms');
console.log(`已加载词条总数: ${Object.keys(terms).length}`);

// 构造一段典型的高难度博士生化文献段落 (涵盖有机催化、冷冻电镜、铁死亡、原位探针、学术拉丁语)
const samplePaperText = `
In this study, we investigated the enantiomeric excess of the chiral auxiliary using dynamic kinetic resolution.
Cryo-electron microscopy single-particle analysis revealed a novel allosteric binding pocket near the ATP synthase complex.
Furthermore, western blot analysis demonstrated that GPX4 depletion induced pronounced lipid peroxidation and triggered ferroptosis in vitro.
High-performance liquid chromatography tandem mass spectrometry (HPLC-MS/MS) was employed to quantify intracellular metabolites.
`;

console.time('MatchTerms');
const matched = matchTerms(samplePaperText, 15);
console.timeEnd('MatchTerms');

console.log('\n=== 命中的权威学术术语清单 ===');
console.log(JSON.stringify(matched, null, 2));

console.log('\n=== 编排生成的博士级学术评审 System Prompt 片段 ===');
const prompt = buildBioSystemPrompt(matched, 'zh-CN');
console.log(prompt);
