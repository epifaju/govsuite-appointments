const net = require('net');
const dns = require('dns').promises;
const fs = require('fs');
const http = require('http');
const targets = [
  ['rec008-postgres', 5432, 'allowed'],
  ['rec008-mock', 8080, 'allowed'],
  ['rec008-ollama', 11434, 'allowed'],
  ['govsuite-postgres', 5432, 'forbidden'],
  ['govsuite-n8n', 5678, 'forbidden'],
  ['govsuite-mailpit', 8025, 'forbidden'],
  ['192.168.112.4', 5432, 'forbidden'],
  ['192.168.112.2', 5678, 'forbidden'],
  ['192.168.112.3', 8025, 'forbidden'],
  ['192.168.112.1', 5433, 'forbidden'],
  ['192.168.240.1', 5433, 'forbidden']
];
function probe(host, port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    let settled = false;
    const finish = (result) => { if (settled) return; settled = true; socket.destroy(); resolve(result); };
    const timer = setTimeout(() => finish('timeout'), 1500);
    socket.on('connect', () => { clearTimeout(timer); finish('open'); });
    socket.on('error', (error) => { clearTimeout(timer); finish(error.code || 'error'); });
  });
}
function get(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.setTimeout(3000, () => { req.destroy(); resolve({ status: 0, body: 'timeout' }); });
    req.on('error', (error) => resolve({ status: 0, body: error.code || 'error' }));
  });
}
(async () => {
  const route = fs.readFileSync('/proc/net/route', 'utf8').trim().split('\n').slice(1).map((line) => line.split('\t').slice(0, 3).join(' '));
  const results = [];
  for (const [host, port, expect] of targets) {
    let address = null;
    let dnsResult = 'ok';
    try { address = (await dns.lookup(host)).address; }
    catch (error) { dnsResult = error.code || 'dns-error'; }
    const tcp = dnsResult === 'ok' ? await probe(host, port) : 'not-probed';
    results.push({ host, port, expect, dns: dnsResult, tcp });
  }
  const tags = await get('http://rec008-ollama:11434/api/tags');
  let models = [];
  try { models = JSON.parse(tags.body).models.map((item) => item.name); } catch { models = [tags.body.slice(0, 120)]; }
  const meta = await get('http://rec008-mock:8080/_meta/calls');
  console.log(JSON.stringify({ route, results, tags: tags.status, models, meta }));
})();
