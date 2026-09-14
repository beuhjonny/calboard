async function testProxyList() {
  const shortUrl = 'https://photos.app.goo.gl/rPu6ZCJtajQt4kYu6';
  
  // Follow redirect
  const expandedRes = await fetch(shortUrl, { redirect: 'follow' });
  const expandedUrl = expandedRes.url;
  console.log('Expanded URL:', expandedUrl);

  const candidates = [
    `https://api.allorigins.win/get?url=${encodeURIComponent(expandedUrl)}`,
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(shortUrl)}`,
    `https://corsproxy.io/?url=${encodeURIComponent(expandedUrl)}`,
    `https://cors-anywhere.herokuapp.com/${expandedUrl}`,
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(expandedUrl)}`,
  ];

  for (const c of candidates) {
    console.log('\nTesting candidate:', c.substring(0, 60));
    try {
      const res = await fetch(c, { signal: AbortSignal.timeout(5000) });
      console.log('Status:', res.status);
      if (res.ok) {
        const text = await res.text();
        console.log('Response length:', text.length);
        const matches = text.match(/https:\/\/lh[3-6]\.googleusercontent\.com\/(?:pw|lr|[a-zA-Z0-9\-_]+)\/[a-zA-Z0-9\-_]{40,}/g) || [];
        console.log('Photo matches:', matches.length);
      }
    } catch (e) {
      console.log('Error:', e.message);
    }
  }
}

testProxyList();
