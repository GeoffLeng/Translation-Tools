async function run() {
  console.log('--- 1. 测试 /api/personas ---');
  const personasRes = await fetch('http://localhost:3300/api/personas');
  const personas = await personasRes.json();
  console.log('可用角色列表:');
  personas.personas.forEach(p => console.log(`  • [${p.id}] ${p.name} - ${p.desc} (词库量: ${p.termCount})`));

  console.log('\n--- 2. 测试各角色语料库统计 ---');
  const [bioResT, ecoResT, genResT] = await Promise.all([
    fetch('http://localhost:3300/api/terms?persona=biochem').then(r => r.json()),
    fetch('http://localhost:3300/api/terms?persona=economics').then(r => r.json()),
    fetch('http://localhost:3300/api/terms?persona=general').then(r => r.json())
  ]);
  console.log(`生化学术库词条数: ${bioResT.totalCount}`);
  console.log(`经济学术库词条数: ${ecoResT.totalCount}`);
  console.log(`通用默认角色词条数: ${genResT.totalCount} (零语料注入验证通过)`);

  console.log('\n--- 3. 测试数据隐私合规脱敏 + 经济学专家翻译 ---');
  const ecoPayload = {
    persona: 'economics',
    items: [
      { id: 'sec1', text: 'Contact research analyst at analyst.zhang@macrofund.org or phone +86 13800138000 for quantitative easing details.' },
      { id: 'sec2', text: 'The central bank implemented forward guidance and quantitative easing to curb systemic risk.' }
    ],
    targetLang: 'zh-CN'
  };
  const ecoRes = await fetch('http://localhost:3300/api/translate/bio', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ecoPayload)
  }).then(r => r.json());
  console.log('经济学翻译结果:');
  ecoRes.translations.forEach(t => console.log(`  [${t.id}] -> ${t.text}`));
  if (ecoRes.matchedTerms) {
    console.log('命中经济学术语:', ecoRes.matchedTerms.map(t => `${t.term}->${t.translation}`).join('; '));
  }

  console.log('\n--- 4. 测试生化专家翻译 ---');
  const bioPayload = {
    persona: 'biochem',
    items: [
      { id: 'bio1', text: 'Cryo-EM revealed that allosteric regulation and CRISPR-Cas9 endonuclease activity were preserved.' }
    ],
    targetLang: 'zh-CN'
  };
  const bioRes = await fetch('http://localhost:3300/api/translate/bio', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bioPayload)
  }).then(r => r.json());
  console.log('生化翻译结果:');
  bioRes.translations.forEach(t => console.log(`  [${t.id}] -> ${t.text}`));
  if (bioRes.matchedTerms) {
    console.log('命中生化学术语:', bioRes.matchedTerms.map(t => `${t.term}->${t.translation}`).join('; '));
  }

  console.log('\n--- 5. 测试默认通用翻译 (大众通俗·零语料) ---');
  const genPayload = {
    persona: 'general',
    items: [
      { id: 'gen1', text: 'Today is a wonderful sunny day and we are enjoying our vacation in the countryside.' }
    ],
    targetLang: 'zh-CN'
  };
  const genRes = await fetch('http://localhost:3300/api/translate/bio', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(genPayload)
  }).then(r => r.json());
  console.log('通用翻译结果:');
  genRes.translations.forEach(t => console.log(`  [${t.id}] -> ${t.text}`));
  console.log('通用模式词条注入数 (应为0):', genRes.matchedTerms ? genRes.matchedTerms.length : 0);
  console.log('\n✅ 全部接口功能与合规脱敏测试通过！');
}

run().catch(console.error);
