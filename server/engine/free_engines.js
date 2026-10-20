// 免 Key 免费翻译引擎服务 (Google GTX & 微软 Bing 自动熔断与降级体系)

let bingTokenCache = {
  ig: '',
  iid: '',
  key: '',
  token: '',
  expiresAt: 0
};

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
};

/**
 * 谷歌免费高速接口翻译 (Google GTX)
 */
export async function translateGoogle(text, targetLang = 'zh-CN') {
  if (!text || typeof text !== 'string') return '';
  const tl = targetLang === 'zh-CN' ? 'zh-CN' : targetLang;
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(url, { headers: BROWSER_HEADERS, signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`Google API 响应状态异常: ${res.status}`);
    const data = await res.json();
    if (data && Array.isArray(data[0])) {
      return data[0].map(item => (item && item[0] ? item[0] : '')).join('');
    }
    throw new Error('Google 未返回有效翻译结果');
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/**
 * 提取微软 Bing 防刷动态令牌
 */
async function getBingToken() {
  const now = Date.now();
  if (bingTokenCache.token && now < bingTokenCache.expiresAt) {
    return bingTokenCache;
  }

  const res = await fetch('https://www.bing.com/translator', { headers: BROWSER_HEADERS });
  if (!res.ok) throw new Error(`Bing 网站无法连接: ${res.status}`);
  const html = await res.text();

  const igMatch = html.match(/IG:"([A-F0-9]+)"/i);
  const iidMatch = html.match(/data-iid="([^"]+)"/i);
  const tokenMatch = html.match(/var\s+params_AbusePreventionHelper\s*=\s*\[([0-9]+),"([^"]+)"/);

  if (!tokenMatch) throw new Error('无法解析 Bing 动态鉴权令牌');

  bingTokenCache = {
    ig: igMatch ? igMatch[1] : '',
    iid: iidMatch ? iidMatch[1] : 'translator.5028',
    key: tokenMatch[1],
    token: tokenMatch[2],
    expiresAt: now + 15 * 60 * 1000 // 缓存 15 分钟
  };
  return bingTokenCache;
}

/**
 * 微软 Bing 翻译接口
 */
export async function translateBing(text, targetLang = 'zh-CN') {
  if (!text || typeof text !== 'string') return '';
  const langMap = { 'zh-CN': 'zh-Hans', 'en': 'en', 'ja': 'ja', 'ko': 'ko' };
  const to = langMap[targetLang] || targetLang;

  let tokenInfo = await getBingToken();

  const doRequest = async (info) => {
    const params = new URLSearchParams();
    params.append('fromLang', 'auto-detect');
    params.append('text', text);
    params.append('to', to);
    params.append('key', info.key);
    params.append('token', info.token);

    const url = `https://www.bing.com/ttranslatev3?isVertical=1&IG=${info.ig}&IID=${info.iid}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        ...BROWSER_HEADERS,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });
    if (!res.ok) throw new Error(`Bing 接口请求错误: ${res.status}`);
    return await res.json();
  };

  let data = await doRequest(tokenInfo);
  if (!data || !data[0] || !data[0].translations) {
    // 令牌失效主动刷新重试一次
    bingTokenCache.expiresAt = 0;
    tokenInfo = await getBingToken();
    data = await doRequest(tokenInfo);
  }

  if (data && data[0] && data[0].translations && data[0].translations[0]) {
    return data[0].translations[0].text;
  }
  throw new Error('Bing 未返回有效翻译结果');
}

/**
 * 免费双通道快速翻译 (优先 Google，失败自动降级到 Bing)
 */
export async function translateFreeFast(text, targetLang = 'zh-CN') {
  try {
    return await translateGoogle(text, targetLang);
  } catch (googleErr) {
    console.warn(`[FreeEngine] Google 翻译失败 (${googleErr.message})，平滑降级至 Bing 翻译...`);
    try {
      return await translateBing(text, targetLang);
    } catch (bingErr) {
      throw new Error(`Google 与 Bing 双通道均不可用: ${googleErr.message} / ${bingErr.message}`);
    }
  }
}
