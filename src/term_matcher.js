// 纯前端与浏览器扩展内置权威术语匹配引擎 (Client-side In-Extension Term Matcher)
import biochemJson from './data/biochem_terms.json';
import economicsJson from './data/economics_terms.json';

const personaTermsCache = {
  biochem: biochemJson.terms || {},
  economics: economicsJson.terms || {},
  general: {}
};

// 预热按词长由长到短排序，优先贪婪命中多词复合专有名词
const personaKeysCache = {
  biochem: Object.keys(personaTermsCache.biochem).sort((a, b) => b.length - a.length),
  economics: Object.keys(personaTermsCache.economics).sort((a, b) => b.length - a.length),
  general: []
};

/**
 * 扫描输入文本，提取对应学术角色的权威术语清单
 * @param {string} text 待翻译文本
 * @param {number} maxHits 最多返回匹配项数
 * @param {'general' | 'biochem' | 'economics'} persona 翻译角色
 * @returns {Array<{ term: string, translation: string, category: string, abbr: string }>} 命中清单
 */
export function matchTerms(text, maxHits = 15, persona = 'biochem') {
  if (!text || typeof text !== 'string') return [];
  if (persona === 'general') return [];

  const termsMap = personaTermsCache[persona];
  const sortedKeys = personaKeysCache[persona];
  if (!termsMap || !sortedKeys || sortedKeys.length === 0) return [];

  const lowerText = text.toLowerCase();
  const matched = [];
  const matchedSet = new Set();

  for (const term of sortedKeys) {
    if (matched.length >= maxHits) break;

    // 快速子串探测
    if (lowerText.includes(term)) {
      // 严密单词边界检测，避免子串误触
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const wordBoundaryRegex = new RegExp(`\\b${escaped}\\b`, 'i');
      if (wordBoundaryRegex.test(text)) {
        const val = termsMap[term];
        const zh = typeof val === 'object' ? (val.zh || val.translation) : val;
        const en = typeof val === 'object' ? (val.en || term) : term;
        const category = typeof val === 'object' ? (val.category || '') : '';
        const abbr = typeof val === 'object' ? (val.abbr || '') : '';

        if (zh && !matchedSet.has(zh)) {
          matched.push({
            term: en,
            translation: zh,
            category,
            abbr
          });
          matchedSet.add(zh);
        }
      }
    }
  }

  return matched;
}

export function getTermsCount() {
  return {
    biochem: personaKeysCache.biochem.length,
    economics: personaKeysCache.economics.length
  };
}
