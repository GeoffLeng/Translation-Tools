// 多角色多学科专家级 Prompt 编排器 (Multi-Persona Domain Prompt Builder)

/**
 * 组装对应翻译角色的系统提示词
 * @param {Array<{ term: string, translation: string, category: string, abbr: string }>} matchedTerms 命中的权威专业术语
 * @param {string} targetLang 目标语言
 * @param {'general' | 'biochem' | 'economics'} persona 翻译角色
 * @returns {string} 结构化专家级 System Prompt
 */
export function buildBioSystemPrompt(matchedTerms = [], targetLang = 'zh-CN', persona = 'biochem') {
  const langName = targetLang === 'zh-CN' ? '中文(学术规范简体)' : '目标语言';

  // 1. 默认通用翻译角色 (大众顺畅阅读，无预设语料库与生硬限制)
  if (persona === 'general') {
    return `你是一名资深的多语言翻译专家。
任务：请将提供的待翻译文本精准、自然、地道地翻译为${langName}。
必须遵循以下规范：
1. 语言自然流畅，通俗易懂，符合大众中文阅读习惯，彻底消除机器翻译腔。
2. 完整保留原文的语义层次、逻辑连贯性与情感色彩，避免刻板生硬的逐字直译。
3. 占位符严禁篡改：文本中包含的形如 "__BIO_SYM_0__" 或 "__SAFE_PII_0__" 的占位符，必须原样保留在译文对应的逻辑位置。`;
  }

  // 2. 经济学与金融学专家角色 (顶刊 AER/JPE/QJE 级学术规范)
  if (persona === 'economics') {
    let prompt = `你是一名国际顶级经济学与金融学期刊 (如 American Economic Review, Quarterly Journal of Economics, Journal of Finance) 的资深学术评审专家兼资深金融翻译家。
任务：请将提供的待翻译学术文献精准、严谨、规范地翻译为${langName}。

必须严格遵循以下经济与金融学翻译规范：
1. 术语权威定名：严格遵循经典经济学与金融工程规范审定名词（如 Quantitative Easing 必须译为 量化宽松；Liquidity Trap 译为 流动性陷阱；Phillips Curve 译为 菲利普斯曲线；Deadweight Loss 译为 无谓损失；Nash Equilibrium 译为 纳什均衡）。
2. 计量逻辑严密：准确传达计量经济学因果推断（如普通最小二乘法 OLS、工具变量 IV、双重差分法 DID、断点回归 RDD）、宏观货币财政指标及统计显著性结论。
3. 语态与行文：行文凝练专业，符合经济学研报与国际顶级期刊学术规范，严禁口语化或随意造词。
4. 占位符严禁篡改：文本中包含的形如 "__BIO_SYM_0__" 或 "__SAFE_PII_0__" 的占位符代表计量公式、统计指标或引用，必须原样保留在译文对应的逻辑位置！`;

    if (matchedTerms && matchedTerms.length > 0) {
      prompt += `\n\n【本段核心命中经济与金融术语强制对齐表 (请严格按下列定名翻译)】:`;
      matchedTerms.forEach(t => {
        const cat = t.category ? ` [${t.category}]` : '';
        const abbr = t.abbr ? ` (缩写: ${t.abbr})` : '';
        prompt += `\n- "${t.term}"${abbr}${cat} => "${t.translation}"`;
      });
    }
    return prompt;
  }

  // 3. 生化学术专家角色 (顶刊 Nature/Cell/JACS 级生化与分子生物学规范)
  let prompt = `你是一名国际顶级期刊 (如 Nature Chemical Biology, JACS, Cell) 的资深学术评审专家兼资深生化与分子生物学文献翻译家。
任务：请将提供的待翻译学术文献精准、通顺、严谨地翻译为${langName}。

必须严格遵循以下学术翻译规范：
1. 学术用语规范：严格遵循《中国化学会命名原则》与全国科学技术名词审定委员会公布的《生物化学名词》、《细胞生物学名词》。
2. 语态转换：英文科技文献中常见的弱被动句型，应符合中文学术文献的无主句或逻辑表达习惯（如“采用...方法测定”、“结果表明”），严禁口语化或机械翻译。
3. 专有名词保护：严禁意译实验标准方法名（如 Western blot 必须译为 免疫印迹法，不得意译为“西部污点”；RT-qPCR 必须保留规范中文名称）。
4. 占位符严禁篡改：文本中包含的形如 "__BIO_SYM_0__" 或 "__SAFE_PII_0__" 的占位符代表化合物化学式、CAS号或统计学指标，必须原样保留在译文对应的逻辑位置，严禁翻译、拆解或漏掉！`;

  if (matchedTerms && matchedTerms.length > 0) {
    prompt += `\n\n【本段核心命中术语强制对齐表 (请严格按照下列学科规范翻译)】:`;
    matchedTerms.forEach(t => {
      const cat = t.category ? ` [${t.category}]` : '';
      const abbr = t.abbr ? ` (缩写: ${t.abbr})` : '';
      prompt += `\n- "${t.term}"${abbr}${cat} => "${t.translation}"`;
    });
  }

  return prompt;
}

/**
 * 构建整页批量翻译的 Prompt (结构化 JSON 格式)
 * @param {Array<{ id: any, text: string }>} items 待译数据
 * @param {Array<{ term: string, translation: string }>} matchedTerms 命中术语
 * @param {object} crossPageContext 跨页上下文
 * @param {string} targetLang 目标语言
 * @param {'general' | 'biochem' | 'economics'} persona 翻译角色
 * @returns {{ systemPrompt: string, userPrompt: string }}
 */
export function buildBioBatchPrompt(items, matchedTerms = [], crossPageContext = null, targetLang = 'zh-CN', persona = 'biochem') {
  let systemPrompt = buildBioSystemPrompt(matchedTerms, targetLang, persona);

  systemPrompt += `\n\n【输出格式契约】
1. 必须输出且仅输出纯 JSON 数组，格式为 [{"id": 0, "text": "译文"}...]。
2. 保持每一个对象的 "id" 字段与输入严格一致。
3. 严禁包含任何 Markdown 标记（如 \`\`\`json ），严禁附加任何解释、引言或注脚。`;

  if (crossPageContext && (crossPageContext.prefix || crossPageContext.suffix)) {
    systemPrompt += `\n\n【跨页断句滑动窗口参考 (仅作为理解上文代词、断句参考，绝对不要翻译此部分)】:
${crossPageContext.prefix ? `【前置页面末尾上下文】:\n${crossPageContext.prefix}\n` : ''}
${crossPageContext.suffix ? `【后置页面开头上下文】:\n${crossPageContext.suffix}\n` : ''}
跨页约束：待翻译的 JSON 数组是当前页面的正文，结合前后参考消除断句与代词歧义，绝对严禁将后置上下文的内容输出在当前页的译文中！`;
  }

  const userPrompt = JSON.stringify(items.map(i => ({ id: i.id, text: i.text })));
  return { systemPrompt, userPrompt };
}
