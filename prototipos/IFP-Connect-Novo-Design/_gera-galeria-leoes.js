// Lê o output do workflow e gera uma galeria HTML com os 6 leões em vários tamanhos.
const fs = require('fs');
const SRC = process.argv[2];
const OUT = process.argv[3];
const data = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const leoes = data.result.leoes;

const cores = [
  { nome: 'Marrom (tinta)', hex: '#752C05', bg: '#FAF7F2' },
  { nome: 'Teal (Médico)', hex: '#10C2BB', bg: '#E6FAF8' },
  { nome: 'Laranja (Capac.)', hex: '#FF772E', bg: '#FCE9DD' },
];

function card(l, i) {
  const ang = (l.angulo || '').slice(0, 90);
  return `
  <div class="card">
    <div class="num">LEÃO ${i + 1}</div>
    <div class="ang">${ang}</div>
    <div class="sizes">
      <div class="cell"><div class="ico" style="width:140px;height:140px;color:#752C05">${l.svg}</div><span>140px</span></div>
      <div class="cell"><div class="ico" style="width:40px;height:40px;color:#752C05">${l.svg}</div><span>40px (header)</span></div>
      <div class="cell"><div class="ico" style="width:24px;height:24px;color:#752C05">${l.svg}</div><span>24px (favicon)</span></div>
    </div>
    <div class="temas">
      ${cores.map(c => `<div class="tema" style="background:${c.bg}"><div class="ico" style="width:64px;height:64px;color:${c.hex}">${l.svg}</div></div>`).join('')}
    </div>
    <div class="por">${(l.conceito || '').slice(0, 240)}</div>
  </div>`;
}

const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Leões IFP — galeria</title>
<style>
  body{margin:0;background:#FAF7F2;font-family:'Jost',system-ui,Segoe UI,sans-serif;color:#4A4A49;padding:30px}
  h1{color:#752C05;text-transform:uppercase;letter-spacing:.12em;font-size:18px;text-align:center}
  .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:22px;max-width:1180px;margin:24px auto}
  .card{background:#fff;border:1px solid rgba(117,44,5,.1);border-radius:18px;padding:18px;box-shadow:0 10px 30px -18px rgba(117,44,5,.4)}
  .num{font-weight:700;color:#752C05;letter-spacing:.1em;font-size:13px}
  .ang{font-size:11px;color:#9a8f84;margin:4px 0 14px;min-height:30px}
  .sizes{display:flex;align-items:flex-end;gap:16px;padding:14px;background:#FAF7F2;border-radius:12px;justify-content:center}
  .cell{display:flex;flex-direction:column;align-items:center;gap:6px}
  .cell span{font-size:9px;color:#9a8f84;letter-spacing:.06em}
  .ico svg{width:100%;height:100%;display:block}
  .temas{display:flex;gap:8px;margin-top:12px}
  .tema{flex:1;border-radius:10px;display:flex;align-items:center;justify-content:center;padding:10px}
  .por{font-size:11px;line-height:1.45;color:#6b6259;margin-top:12px}
</style></head><body>
<h1>🦁 6 Leões — escolha do emblema IFP Connect</h1>
<div class="grid">${leoes.map(card).join('')}</div>
</body></html>`;

fs.writeFileSync(OUT, html, 'utf8');
console.log('Galeria gerada com ' + leoes.length + ' leões em ' + OUT);
