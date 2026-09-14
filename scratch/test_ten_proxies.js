async function testTenProxies() {
  const shortUrl = 'https://photos.app.goo.gl/rPu6ZCJtajQt4kYu6';
  
  // Follow redirect to get expanded URL
  const expandedRes = await fetch(shortUrl, { redirect: 'follow' });
  const expandedUrl = expandedRes.url;

  const testList = [
    { name: 'allorigins-raw', url: `https://api.allorigins.win/raw?url=${encodeURIComponent(expandedUrl)}` },
    { name: 'allorigins-get', url: `https://api.allorigins.win/get?url=${encodeURIComponent(expandedUrl)}` },
    { name: 'cors-proxy-sploitus', url: `https://cors.eu.org/${expandedUrl}` },
    { name: 'bypass-cors', url: `https://bypass-cors.fly.dev/${expandedUrl}` },
    { name: 'cors-anywhere-herokuapp', url: `https://cors-anywhere.herokuapp.com/${expandedUrl}` },
    { name: 'codetabs', url: `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(shortUrl)}` },
    { name: 'worker-proxy', url: `https://corsproxy.org/?${encodeURIComponent(expandedUrl)}` },
  ];

  for (const t of testList) {
    console.log(`\nTesting ${t.name}...`);
    try {
      const res = await fetch(t.url, { 
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        signal: AbortSignal.timeout(6000) 
      });
      console.log(`[${t.name}] Status: ${res.status}`);
      if (res.ok) {
        const text = await res.text();
        const matches = text.match(/https:\/\/lh[3-6]\.googleusercontent\.com\/(?:pw|lr|[a-zA-Z0-9\-_]+)\/[a-zA-Z0-9\-_]{40,}/g) || [];
        console.log(`[${t.name}] Success! Extracted ${matches.length} photos. Length: ${text.length}`);
      }
    } catch (e) {
      console.log(`[${t.name}] Failed: ${e.message}`);
    }
  }
}

testTenProxies();
