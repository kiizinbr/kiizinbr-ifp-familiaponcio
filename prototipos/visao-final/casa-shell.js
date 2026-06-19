/* ============================================================
   IFP Connect · casa-shell.js — monta o "esqueleto" de cada tela do Atlas.
   Contrato (atributos no <body>):
     data-tipo   = "interno" (padrão) | "publico" | "mobile"
     data-modulo = presidencia|medico|capacitacao|educacional|esportivo|social|admin   (rail interno)
     data-tela   = id do item de rail ativo
     data-user   = "Erick Ramos"   data-cargo="Presidência"   data-ini="ER"
   E o <html data-salao="corte|medico|capacitacao|esportivo|recreativo|social"> define a COR.
   A tela escreve só o miolo:
     interno -> <main class="conteudo">…</main>
     publico -> <main class="site-main">…</main>
     mobile  -> <div class="phone-screen">…</div>
   Helpers globais p/ as telas: crest(), jubaRing(), coroaSeal(), icon(), LEAO.
   ============================================================ */
(function(){
const IC={
 home:'M3 12l9-9 9 9M5 10v10h14V10',
 grid:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
 cal:'M3 4h18v18H3zM3 9h18M8 2v4M16 2v4',
 users:'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M23 21v-2a4 4 0 0 0-3-3.87',
 user:'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
 file:'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M9 13h6M9 17h5',
 chart:'M3 3v18h18M19 9l-5 5-3-3-4 4',
 heart:'M12 21s-7-4.5-9.5-9C1 9 2.5 5 6 5c2 0 3.2 1.2 4 2.4C10.8 6.2 12 5 14 5c3.5 0 5 4 3.5 7C19 16.5 12 21 12 21z',
 list:'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
 award:'M12 15a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM8.2 13.3L7 22l5-3 5 3-1.2-8.7',
 book:'M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z',
 settings:'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.81 1.17V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4',
 shield:'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
 baby:'M9 12h.01M15 12h.01M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5M12 2a5 5 0 0 0-5 5v1a5 5 0 0 0 10 0V7a5 5 0 0 0-5-5z',
 activity:'M22 12h-4l-3 9L9 3l-3 9H2',
 bridge:'M2 18V9a10 10 0 0 1 20 0v9M2 14h20M8 14v4M16 14v4M12 14v4',
 calendar:'M3 4h18v18H3zM3 9h18M8 2v4M16 2v4',
 clipboard:'M9 2h6a1 1 0 0 1 1 1v2H8V3a1 1 0 0 1 1-1zM8 5H6a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2',
 stethoscope:'M6 3v6a6 6 0 0 0 12 0V3M18 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6M9 3H5M15 3h4',
 crown:'M3 7l4 4 5-6 5 6 4-4v10H3z',
};
function icon(n,s){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:'+(s||21)+'px;height:'+(s||21)+'px"><path d="'+(IC[n]||IC.grid)+'"/></svg>';}
window.icon=icon; window.IC=IC;
window.LEAO='<span class="brandmark"></span>';

window.crest=function(ini,w,gold){w=w||40;var h=Math.round(w*1.16);var col=gold===false?'var(--unidade)':'var(--dourado)';
 return '<span class="crest" style="width:'+w+'px;height:'+h+'px"><span class="foto" style="font-size:'+(w*.32)+'px">'+ini+'</span>'+
 '<svg class="moldura" viewBox="0 0 100 116" preserveAspectRatio="none" style="color:'+col+'"><path d="M50,4 C78,4 94,22 94,42 C94,74 74,96 50,112 C26,96 6,74 6,42 C6,22 22,4 50,4 Z" fill="none" stroke="currentColor" stroke-width="4"/></svg></span>';};
window.jubaRing=function(pct,size,color){size=size||64;color=color||'var(--unidade)';var r=size/2-5;var c=2*Math.PI*r;var off=c*(1-pct/100);
 return '<span class="juba-ring" style="width:'+size+'px;height:'+size+'px"><svg width="'+size+'" height="'+size+'"><circle cx="'+size/2+'" cy="'+size/2+'" r="'+r+'" fill="none" stroke="var(--linha)" stroke-width="5"/><circle cx="'+size/2+'" cy="'+size/2+'" r="'+r+'" fill="none" stroke="'+color+'" stroke-width="5" stroke-linecap="round" stroke-dasharray="'+c.toFixed(1)+'" stroke-dashoffset="'+off.toFixed(1)+'"/></svg><span class="num" style="font-size:'+(size*.2)+'px">'+pct+'%</span></span>';};
window.coroaSeal=function(status){var map={'APROVADO':'cs-aprovado','EM ANÁLISE':'cs-analise','ANÁLISE':'cs-analise','NÃO ELEGÍVEL':'cs-bloq','BLOQUEADO':'cs-bloq'};var cls=map[(status||'').toUpperCase()]||'cs-analise';
 return '<span class="coroa-seal '+cls+'"><svg viewBox="0 0 24 18" fill="currentColor"><path d="M3 5l4 4 5-6 5 6 4-4v10H3z"/></svg>'+status+'</span>';};

/* navegação do rail por módulo: [telaId, rótulo, ícone] */
var NAV={
 presidencia:[['painel','Painel','home'],['unidades','Unidades','grid'],['impacto','Impacto','chart'],['familias','Famílias','users'],['relatorios','Relatórios','file'],['config','Config','settings']],
 medico:[['agenda','Agenda','cal'],['fila','Fila','list'],['prontuarios','Prontuários','clipboard'],['beneficiarios','Beneficiários','users'],['indicadores','Indicadores','chart'],['equipe','Equipe','stethoscope']],
 capacitacao:[['painel','Painel','home'],['turmas','Turmas','users'],['cursos','Cursos','book'],['certificados','Certificados','award'],['sessoes','Sessões','activity'],['indicadores','Indicadores','chart']],
 educacional:[['painel','Painel','home'],['turmas','Turmas','baby'],['comunicados','Comunicados','bell'],['criancas','Crianças','user'],['indicadores','Indicadores','chart']],
 esportivo:[['painel','Painel','home'],['turmas','Turmas','users'],['frequencia','Frequência','clipboard'],['indicadores','Indicadores','chart']],
 social:[['inicio','Início','home'],['fichas','Fichas','file'],['triagem','Triagem','list'],['elegibilidade','Elegib.','shield'],['ponte','Ponte','bridge'],['agenda','Agenda','cal']],
 admin:[['usuarios','Usuários','users'],['unidades','Unidades','grid'],['auditoria','Auditoria','shield'],['config','Config','settings']],
};
var SUB={corte:'Corte · Presidência',medico:'Centro Médico',capacitacao:'Centro de Capacitação',esportivo:'Centro Esportivo',recreativo:'Centro Recreativo',social:'Serviço Social'};
var SALOES=[['corte','Corte'],['medico','Médico'],['capacitacao','Capac.'],['esportivo','Esport.'],['recreativo','Recre.'],['social','Social']];

function defsOgival(){var s=document.createElementNS('http://www.w3.org/2000/svg','svg');s.setAttribute('width','0');s.setAttribute('height','0');s.style.position='absolute';
 s.innerHTML='<defs><clipPath id="ogival" clipPathUnits="objectBoundingBox"><path d="M0.5,0.04 C0.80,0.04 0.94,0.18 0.94,0.40 C0.94,0.70 0.74,0.92 0.5,1 C0.26,0.92 0.06,0.70 0.06,0.40 C0.06,0.18 0.20,0.04 0.5,0.04 Z"/></clipPath></defs>';
 document.body.appendChild(s);}

function trocarSalao(s){document.documentElement.dataset.salao=s;var sub=document.getElementById('tb-sub');if(sub&&SUB[s])sub.textContent=SUB[s];
 document.querySelectorAll('#salao-switch button').forEach(function(b){b.classList.toggle('on',b.dataset.s===s);});}
window.trocarSalao=trocarSalao;

function montaInterno(b){
 var modulo=b.dataset.modulo||'presidencia';var telaAtiva=b.dataset.tela||'';
 var user=b.dataset.user||'Erick Ramos';var cargo=b.dataset.cargo||'Presidência';var ini=b.dataset.ini||'ER';
 var main=document.querySelector('main.conteudo');
 var app=document.createElement('div');app.className='app';
 var topbar='<header class="topbar"><div class="tb-marca"><span class="medalhao"><span class="leao">'+LEAO+'</span></span>'+
   '<div class="tb-nome"><div class="b">IFP Connect</div><div class="s" id="tb-sub">'+(SUB[document.documentElement.dataset.salao]||'')+'</div></div></div>'+
   '<div class="tb-busca">'+icon('grid',15).replace(IC.grid,'M11 11m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0M21 21l-4-4')+'<input placeholder="Buscar família, protocolo, beneficiário…"></div>'+
   '<div class="tb-right"><div class="salao-switch" id="salao-switch">'+SALOES.map(function(x){return '<button data-s="'+x[0]+'" class="'+(x[0]===document.documentElement.dataset.salao?'on':'')+'" onclick="trocarSalao(\''+x[0]+'\')">'+x[1]+'</button>';}).join('')+'</div>'+
   '<div class="sino"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" stroke-linecap="round" stroke-linejoin="round"/></svg><span class="badge">3</span></div>'+
   '<div class="tb-user">'+crest(ini,34)+'<div><div class="un">'+user+'</div><div class="uc">'+cargo+'</div></div></div></div></header>';
 var items=(NAV[modulo]||NAV.presidencia).map(function(it){return '<button class="rail-item '+(it[0]===telaAtiva?'on':'')+'">'+icon(it[2],21)+'<span>'+it[1]+'</span></button>';}).join('');
 var rail='<nav class="rail" id="rail">'+items+'</nav>';
 app.innerHTML=topbar+rail;
 b.insertBefore(app,main);app.appendChild(main);
}
function montaPublico(b){
 var header='<header class="site-header"><span class="medalhao"><span class="leao">'+LEAO+'</span></span><span class="site-nome">Instituto Família Poncio</span>'+
  '<nav class="site-nav"><a href="publico-landing.html">Início</a><a href="publico-unidades.html">Unidades</a><a href="publico-como-ser-atendido.html">Como funciona</a><a href="publico-doe.html">Doe</a><a href="publico-voluntario.html">Voluntário</a>'+
  '<a class="btn btn-primary" href="auth-login.html" style="padding:8px 16px">Acessar sistema</a></nav></header>';
 var footer='<footer class="site-footer"><span class="leao">'+LEAO+'</span><div>Instituto Família Poncio · Acolhimento integral à família</div><div style="opacity:.7;margin-top:6px">© 2026 · Grupo Pôncio</div></footer>';
 b.insertAdjacentHTML('afterbegin',header);
 var main=document.querySelector('main.site-main');if(main)main.insertAdjacentHTML('afterend',footer);
}
function montaMobile(b){
 var user=b.dataset.user||'Sandra';var sub=b.dataset.cargo||'Mãe da Ana';var tela=b.dataset.tela||'diario';
 var screen=document.querySelector('.phone-screen');
 var wrap=document.createElement('div');wrap.className='phone-wrap';
 var phone=document.createElement('div');phone.className='phone';
 var top='<div class="phone-top"><span class="medalhao"><span class="leao">'+LEAO+'</span></span><div><div class="pt-nome">'+user+'</div><div class="pt-sub">'+sub+'</div></div></div>';
 var navs=[['diario','Diário','book'],['comunicados','Avisos','bell'],['crianca','Criança','user']];
 var nav='<div class="phone-nav">'+navs.map(function(n){return '<button class="'+(n[0]===tela?'on':'')+'">'+icon(n[2],22)+'<span>'+n[1]+'</span></button>';}).join('')+'</div>';
 phone.innerHTML=top;phone.appendChild(screen);phone.insertAdjacentHTML('beforeend',nav);
 wrap.appendChild(phone);b.appendChild(wrap);
}

document.addEventListener('DOMContentLoaded',function(){
 var b=document.body;defsOgival();
 var wm=document.createElement('span');wm.className='watermark leao';wm.innerHTML=LEAO;b.appendChild(wm);
 var tipo=b.dataset.tipo||'interno';
 if(tipo==='publico')montaPublico(b);
 else if(tipo==='mobile')montaMobile(b);
 else if(tipo==='limpo'){/* sem shell: a tela monta o proprio layout centralizado */}
 else montaInterno(b);
});
})();
