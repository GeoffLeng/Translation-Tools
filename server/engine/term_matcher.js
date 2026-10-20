// 高性能多学科专业术语多模式匹配引擎 (Multi-Persona Term Matcher)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 多学科词库分角色缓存
const personaTermsCache = {
  biochem: null,
  economics: null,
  general: {}
};

const personaKeysCache = {
  biochem: null,
  economics: null,
  general: []
};

/**
 * 根据指定角色加载并合并权威术语库与用户自定义词库
 * @param {'general' | 'biochem' | 'economics'} persona 学术角色类型
 */
export function loadAllTerms(persona = 'biochem') {
  // 默认大众翻译：无预设专业语料库，不加载特定词典
  if (persona === 'general') {
    return {};
  }

  if (personaTermsCache[persona]) {
    return personaTermsCache[persona];
  }

  const dataDir = path.join(__dirname, '..', 'data');
  const fileNameMap = {
    biochem: 'biochem_terms.json',
    economics: 'economics_terms.json'
  };

  const targetFile = path.join(dataDir, fileNameMap[persona] || 'biochem_terms.json');
  const userPath = path.join(dataDir, 'user_glossary.json');

  let domainTerms = {};
  let userTerms = {};

  try {
    if (fs.existsSync(targetFile)) {
      const content = fs.readFileSync(targetFile, 'utf-8');
      domainTerms = JSON.parse(content).terms || {};
    }
  } catch (e) {
    console.warn(`读取 ${fileNameMap[persona]} 异常:`, e.message);
  }

  try {
    if (fs.existsSync(userPath)) {
      const content = fs.readFileSync(userPath, 'utf-8');
      userTerms = JSON.parse(content).terms || {};
    }
  } catch (e) {
    console.warn('读取 user_glossary.json 异常:', e.message);
  }

  // 用户自定义词库覆盖通用词典
  const merged = { ...domainTerms, ...userTerms };
  personaTermsCache[persona] = merged;

  // 关键优化：按词长从长到短排序，确保长复合词优先命中
  personaKeysCache[persona] = Object.keys(merged).sort((a, b) => b.length - a.length);

  return merged;
}

/**
 * 扫描输入文本，提取对应学术角色的权威术语清单 (毫秒级极速多模式匹配)
 * @param {string} text 待翻译原英文或段落
 * @param {number} maxHits 最多返回的匹配项
 * @param {'general' | 'biochem' | 'economics'} persona 翻译角色
 * @returns {Array<{ term: string, translation: string, category: string, abbr: string, otherLangs: object }>} 命中的术语清单
 */
export function matchTerms(text, maxHits = 12, persona = 'biochem') {
  if (!text || typeof text !== 'string') return [];

  // 默认通用角色：零语料注入
  if (persona === 'general') return [];

  const termsMap = loadAllTerms(persona);
  const sortedKeys = personaKeysCache[persona];
  if (!sortedKeys || sortedKeys.length === 0) return [];

  const lowerText = text.toLowerCase();
  const matched = [];
  const matchedSet = new Set();

  for (const term of sortedKeys) {
    if (matched.length >= maxHits) break;

    // 快速子串判定
    if (lowerText.includes(term)) {
      // 单词边界严密校验，避免部分子单词误触
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const wordBoundaryRegex = new RegExp(`\\b${escaped}\\b`, 'i');
      if (wordBoundaryRegex.test(text)) {
        const val = termsMap[term];
        const zh = typeof val === 'object' ? (val.zh || val.translation) : val;
        const en = typeof val === 'object' ? (val.en || term) : term;
        const category = typeof val === 'object' ? (val.category || '') : '';
        const abbr = typeof val === 'object' ? (val.abbr || '') : '';
        const otherLangs = typeof val === 'object' ? (val.otherLangs || {}) : {};

        // 避免重复中文概念重复塞入
        if (!matchedSet.has(zh)) {
          matched.push({
            term: en,
            translation: zh,
            category,
            abbr,
            otherLangs
          });
          matchedSet.add(zh);
        }
      }
    }
  }

  return matched;
}

/**
 * 添加新的自定义词条并热保存
 */
export function addCustomTerm(englishTerm, chineseTranslation, category = '用户自定义/学术前沿') {
  if (!englishTerm || !chineseTranslation) return false;
  const userPath = path.join(__dirname, '..', 'data', 'user_glossary.json');

  let currentData = { description: '用户自定义科研术语', version: '2.0.0', terms: {} };
  try {
    if (fs.existsSync(userPath)) {
      currentData = JSON.parse(fs.readFileSync(userPath, 'utf-8'));
    }
  } catch (e) {}

  currentData.terms = currentData.terms || {};
  const normKey = englishTerm.toLowerCase().trim();
  currentData.terms[normKey] = {
    en: englishTerm.trim(),
    zh: chineseTranslation.trim(),
    category: category,
    abbr: '',
    otherLangs: {}
  };

  fs.writeFileSync(userPath, JSON.stringify(currentData, null, 2), 'utf-8');

  // 清空缓存以便下次重新热加载
  personaTermsCache.biochem = null;
  personaTermsCache.economics = null;
  loadAllTerms('biochem');
  loadAllTerms('economics');
  return true;
}
