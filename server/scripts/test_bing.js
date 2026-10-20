async function testBingWithHeaders() {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
  };
  const res = await fetch('https://www.bing.com/translator', { headers });
  const html = await res.text();
  const igMatch = html.match(/IG:"([A-F0-9]+)"/i);
  const iidMatch = html.match(/data-iid="([^"]+)"/i);
  const tokenMatch = html.match(/var\s+params_AbusePreventionHelper\s*=\s*\[([0-9]+),"([^"]+)"/);
  if (!tokenMatch) throw new Error('Token match fail');
  const params = new URLSearchParams();
  params.append('fromLang', 'auto-detect');
  params.append('text', 'All reagents were purchased from commercial suppliers.');
  params.append('to', 'zh-Hans');
  params.append('key', tokenMatch[1]);
  params.append('token', tokenMatch[2]);
  const url = `https://www.bing.com/ttranslatev3?isVertical=1&IG=${igMatch ? igMatch[1] : ''}&IID=${iidMatch ? iidMatch[1] : 'translator.5028'}`;
  const r = await fetch(url, {
    method: 'POST',
    body: params.toString(),
    headers: {
      ...headers,
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  });
  const data = await r.json();
  if (data && data[0] && data[0].translations) {
    console.log('Bing success:', data[0].translations[0].text);
  } else {
    console.log('Bing response:', data);
  }
}
testBingWithHeaders().catch(e=>console.log('Bing err:', e.message));
