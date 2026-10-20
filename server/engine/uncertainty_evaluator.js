// 学术文本不确定度与分流决策评估引擎 (Uncertainty & Domain Router)

/**
 * 评估待翻译文本块的专业不确定性与分流策略
 * @param {string} text 待翻译原英文段落
 * @param {Array<{ term: string, translation: string, category: string }>} matchedTerms 本段命中的专业生化术语
 * @param {Map<string, string>} tokenMap 实体遮罩映射表 (CAS号、统计指标、限制酶等)
 * @returns {{ isUncertain: boolean, score: number, reasons: string[] }}
 */
export function evaluateChunkUncertainty(text, matchedTerms = [], tokenMap = new Map()) {
  const reasons = [];
  let score = 0;

  // 1. 命中生化前沿 3000+ 权威术语词库 (高危歧义专有名词)
  if (matchedTerms && matchedTerms.length > 0) {
    score += matchedTerms.length * 30;
    reasons.push(`命中 ${matchedTerms.length} 个生化前沿权威术语: [${matchedTerms.slice(0, 3).map(t => t.term).join(', ')}]`);
  }

  // 2. 包含需严密保护的生化实体与参数 (CAS号、酶切位点、微摩尔级统计参数)
  if (tokenMap && tokenMap.size > 0) {
    score += tokenMap.size * 25;
    reasons.push(`检测到 ${tokenMap.size} 个高精生化实体/参数 (CAS号、酶或指标)`);
  }

  // 3. 包含立体化学命名、构型前缀或反应机理符号
  const stereochemPattern = /\b([RSEDL]-(?:configured|isomer|enantiomer|stereocenter)|cis-|trans-|syn-|anti-|endo-|exo-|ee\b|de\b|kcat|Km\b)/i;
  if (stereochemPattern.test(text)) {
    score += 20;
    reasons.push('包含立体化学构型前缀或动力学特征常数');
  }

  // 4. 包含学术拉丁惯用语或特殊词源
  const latinPattern = /\b(in vitro|in vivo|in silico|ex vivo|de novo|ab initio|mutatis mutandis|sui generis)\b/i;
  if (latinPattern.test(text)) {
    score += 15;
    reasons.push('包含易误译的学术拉丁语规范表达');
  }

  // 决策判定：若综合不确定性分值 >= 20，则判定为“学术高危/不确定段落”，必须走大模型 API Key 精准翻译；
  // 否则属于平实实验描述、常规背景、器材来源等“确定性段落”，可安全由免费的 Google / Bing 高速代劳。
  const isUncertain = score >= 20;

  return {
    isUncertain,
    score,
    reasons
  };
}
