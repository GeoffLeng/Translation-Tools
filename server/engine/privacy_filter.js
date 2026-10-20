// 隐私与敏感信息安全合规过滤引擎 (Privacy & Data Sanitization Engine)

/**
 * 隐私脱敏审计规则库
 */
const PRIVACY_RULES = [
  // 1. API Key / 凭据泄漏防护 (如 sk-..., AIzaSy..., ghp_...)
  {
    type: 'API_KEY',
    regex: /\b(?:sk-[a-zA-Z0-9_-]{20,}|AIzaSy[a-zA-Z0-9_-]{33}|ghp_[a-zA-Z0-9]{36})\b/g,
    mask: '[SECURITY_CREDENTIAL_REDACTED]'
  },
  // 2. 电子邮箱地址脱敏 (保护作者/患者未公开私人邮箱)
  {
    type: 'EMAIL',
    regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    mask: '[EMAIL_REDACTED]'
  },
  // 3. 手机与电话号码脱敏 (中国大陆11位手机号及国际E.164标准手机)
  {
    type: 'PHONE',
    regex: /(?:\+?86[- ]?)?1[3-9]\d{9}\b/g,
    mask: '[PHONE_REDACTED]'
  },
  // 4. 身份证号脱敏 (18位大陆居民身份证，含校验码X)
  {
    type: 'ID_CARD',
    regex: /\b\d{6}(?:18|19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx]\b/g,
    mask: '[ID_CARD_REDACTED]'
  },
  // 5. 内网私有 IP 地址脱敏 (保护科研内网网络拓扑)
  {
    type: 'PRIVATE_IP',
    regex: /\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})\b/g,
    mask: '[PRIVATE_IP_REDACTED]'
  }
];

/**
 * 检查文本中是否包含敏感隐私信息，并输出安全审计报告
 * @param {string} text 待检测原文本
 * @returns {{ isSafe: boolean, violations: Array<{ type: string, count: number }> }}
 */
export function auditTextSafety(text) {
  if (!text || typeof text !== 'string') return { isSafe: true, violations: [] };

  const violations = [];
  for (const rule of PRIVACY_RULES) {
    const matches = text.match(rule.regex);
    if (matches && matches.length > 0) {
      violations.push({
        type: rule.type,
        count: matches.length
      });
    }
  }

  return {
    isSafe: violations.length === 0,
    violations
  };
}

/**
 * 上传前硬脱敏过滤处理 (用占位符安全屏蔽隐私，保障云端大模型与免费通道零隐私泄露)
 * @param {string} text 待上传原文本
 * @returns {{ sanitizedText: string, redactionMap: Map<string, string>, hasRedaction: boolean }}
 */
export function sanitizeTextForUpload(text) {
  if (!text || typeof text !== 'string') {
    return { sanitizedText: text, redactionMap: new Map(), hasRedaction: false };
  }

  let sanitizedText = text;
  const redactionMap = new Map();
  let redactionCounter = 0;

  for (const rule of PRIVACY_RULES) {
    sanitizedText = sanitizedText.replace(rule.regex, (matchedStr) => {
      const placeholder = `__SAFE_PII_${rule.type}_${redactionCounter++}__`;
      redactionMap.set(placeholder, matchedStr);
      return placeholder;
    });
  }

  return {
    sanitizedText,
    redactionMap,
    hasRedaction: redactionMap.size > 0
  };
}

/**
 * 翻译完成后恢复脱敏数据
 * @param {string} translatedText 翻译后的文本
 * @param {Map<string, string>} redactionMap 脱敏映射表
 * @returns {string} 还原后的译文
 */
export function restoreSanitizedData(translatedText, redactionMap) {
  if (!translatedText || !redactionMap || redactionMap.size === 0) return translatedText;

  let restored = translatedText;
  for (const [placeholder, original] of redactionMap.entries()) {
    restored = restored.replaceAll(placeholder, original);
  }
  return restored;
}
