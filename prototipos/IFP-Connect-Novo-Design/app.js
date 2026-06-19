
/* ====== EMBLEMA (logo OFICIAL do Instituto — leão coroado, via CSS mask p/ recolorir) ====== */
const LEAO = `<span class="brandmark"></span>`;

/* ====== ÍCONES ====== */
const IC={
 home:'<path d="M3 11l9-7 9 7M5 10v10h14V10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
 users:'<circle cx="9" cy="8" r="3.2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3.5 20c0-3.6 2.7-5.5 5.5-5.5s5.5 1.9 5.5 5.5M16 6.5a3 3 0 0 1 0 6M17 14.5c2.4.4 4 2.1 4 5.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
 crown:'<path d="M2 15 L4 5 L9 10 L12 2 L15 10 L20 5 L22 15 Z" fill="currentColor"/>',
 stethoscope:'<path d="M6 3v6a5 5 0 0 0 10 0V3" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="18" cy="16" r="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M11 14v2a5 5 0 0 0 5 5" fill="none" stroke="currentColor" stroke-width="2"/>',
 cap:'<path d="M2 8l10-5 10 5-10 5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M6 10v5c0 1.5 3 3 6 3s6-1.5 6-3v-5" fill="none" stroke="currentColor" stroke-width="2"/>',
 medal:'<circle cx="12" cy="14" r="6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 8 6 2h12l-2 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
 baby:'<circle cx="12" cy="9" r="6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9 9h.01M15 9h.01M9.5 12c1.5 1 3.5 1 5 0M4 22c0-3 3.5-5 8-5s8 2 8 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
 list:'<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
 cal:'<rect x="3" y="4" width="18" height="17" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 9h18M8 2v4M16 2v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
 flag:'<path d="M5 21V4M5 4h11l-2 4 2 4H5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
 grid:'<rect x="3" y="3" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" stroke-width="2"/><rect x="14" y="3" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="14" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" stroke-width="2"/><rect x="14" y="14" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" stroke-width="2"/>',
 chart:'<path d="M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
 report:'<rect x="5" y="3" width="14" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9 8h6M9 12h6M9 16h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
 cfg:'<circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
 heart:'<path d="M12 21s-7-4.6-9.5-9C1 9 2.5 5 6.5 5 9 5 12 8 12 8s3-3 5.5-3C21.5 5 23 9 21.5 12 19 16.4 12 21 12 21z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
 check:'<path d="M2 9l6 6L22 2" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
 logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
 right:'<path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>'
};
const icon=(n,s=20)=>`<svg viewBox="0 0 24 24" width="${s}" height="${s}">${IC[n]||''}</svg>`;

/* ====== DATASET ====== */
const DATA={
 unidades:{medico:{nome:'Centro Médico',cor:'#10C2BB'},capacitacao:{nome:'Capacitação',cor:'#FF772E'},esportivo:{nome:'Centro Esportivo',cor:'#9A3D0B'},recreativo:{nome:'Recreativo',cor:'#007571'}},
 familias:[
  {p:'IFP-2026-000412',nome:'Silva',titular:'Maria Silva',idade:34,status:'Ativa',membros:3,id:'silva'},
  {p:'IFP-2026-000388',nome:'Santos',titular:'Cleia Santos',idade:41,status:'Ativa',membros:4},
  {p:'IFP-2026-000401',nome:'Oliveira',titular:'Rosa Oliveira',idade:29,status:'Em triagem',membros:3},
  {p:'IFP-2026-000420',nome:'Costa',titular:'Paulo Costa',idade:37,status:'Ativa',membros:5},
  {p:'IFP-2026-000433',nome:'Pereira',titular:'Lúcia Pereira',idade:45,status:'Aguardando elegibilidade',membros:2},
 ],
 silva:{p:'IFP-2026-000412',titular:{nome:'Maria Silva',idade:34,ini:'MS'},membros:[
   {nome:'Maria Silva',idade:34,vinc:'Titular',ini:'MS'},
   {nome:'João Silva',idade:8,vinc:'Filho',ini:'JS',unidade:'medico',alertas:['Asma','Alergia a Dipirona'],id:'joao'},
   {nome:'Ana Silva',idade:5,vinc:'Filha',ini:'AS',unidade:'recreativo',id:'ana'},
 ],socio:{renda:'R$ 1.380 / mês',percapita:'R$ 460',moradia:'Alugada',beneficios:'Bolsa Família',vuln:'Insegurança alimentar'}},
 kpi:{maio:{fam:1248,vagas:84,conc:137,saude:78,dFam:'+9,2%',dVagas:'+3 p.p.',dConc:'+21',dSaude:'+2'},
      abril:{fam:1143,vagas:81,conc:116,saude:76,dFam:'+6,1%',dVagas:'+2 p.p.',dConc:'+14',dSaude:'+1'}},
 pulso:[
  {u:'medico',nome:'Centro Médico',vagas:'612/680',pct:90,fila:47,status:'SOB PRESSÃO',sc:'#B3261E',sb:'#FCEDEC'},
  {u:'capacitacao',nome:'Capacitação',vagas:'540/620',pct:87,fila:12,status:'SAUDÁVEL',sc:'#1a7a4a',sb:'rgba(26,122,74,.12)'},
  {u:'esportivo',nome:'Centro Esportivo',vagas:'498/640',pct:78,fila:5,status:'COM FOLGA',sc:'#1a7a4a',sb:'rgba(26,122,74,.12)'},
  {u:'recreativo',nome:'Recreativo',vagas:'456/568',pct:80,fila:9,status:'SAUDÁVEL',sc:'#1a7a4a',sb:'rgba(26,122,74,.12)'},
 ],
 chart:[760,815,870,910,905,980,1020,1060,1095,1150,1190,1248],
 saude:[['Cobertura vacinal das crianças',92],['Acompanhamento nutricional em dia',81],['Saúde bucal (avaliação anual)',67],['Encaminhamentos concluídos',74]],
 atividade:['Serviço Social concedeu 34 novas elegibilidades esta semana','Capacitação formou turma de Costura Industrial — 28 certificados','Mutirão Odontológico atendeu 96 famílias','17 novas famílias registradas na Ficha Cidadã hoje','Centro Esportivo abriu 40 vagas de futsal infantil'],
 triagem:[
  {fam:'Oliveira',p:'IFP-2026-000401',sol:'Centro Médico + Recreativo'},
  {fam:'Pereira',p:'IFP-2026-000433',sol:'Centro Médico'},
  {fam:'Mendes (nova)',p:'IFP-2026-000440',sol:'Capacitação'},
 ],
 ponte:[
  {de:'Dr. Marcos Lima · Médico',sobre:'João Silva — sugere avaliação social da família',q:'há 2 h'},
  {de:'Prof. Carla · Recreativo',sobre:'Ana Silva — encaminhar irmão p/ reforço',q:'ontem'},
 ],
 agendaMedico:[
  {h:'08:30',b:'Família Santos',prof:'Dr. Marcos Lima',sala:'2',st:'atendido'},
  {h:'09:15',b:'Família Costa',prof:'Dra. Helena Reis',sala:'1',st:'atendido'},
  {h:'15:30',b:'Família Pereira',prof:'Dr. Marcos Lima',sala:'2',st:'agendado'},
 ],
 profissionais:[{n:'Dr. Marcos Lima',e:'Clínico Geral',s:'2'},{n:'Dra. Helena Reis',e:'Pediatria',s:'1'}],
 turmas:[{n:'Informática Básica',a:18,d:'Seg/Qua 14h'},{n:'Costura Industrial',a:14,d:'Ter/Qui 09h'},{n:'Padaria Artesanal',a:12,d:'Sex 14h'}],
 notif:[
  {t:'Joana Martins aprovou elegibilidade de João Silva no Centro Médico',q:'há 5 min'},
  {t:'Nova ficha cadastrada: Família Mendes (IFP-2026-000440)',q:'há 1 h'},
  {t:'Dr. Marcos Lima abriu uma Ponte da Corte sobre João Silva',q:'há 2 h'},
 ],
};

/* ====== PERSONAS ====== */
const PERSONAS={
 erick:{nome:'Erick Ramos',cargo:'Presidência',ini:'ER',selo:'Visão Executiva',salao:'corte',cor:'#752C05',sub:'Corte · Presidência',home:'pres-painel'},
 joana:{nome:'Joana Martins',cargo:'Serviço Social',ini:'JM',selo:'Chave-Mestra',salao:'corte',cor:'#C9962F',sub:'Serviço Social · transversal',home:'social-familias'},
 raquel:{nome:'Raquel Souza',cargo:'Gestora · Centro Médico',ini:'RS',selo:'Unidade',salao:'medico',cor:'#10C2BB',sub:'Centro Médico · gestão',home:'medico-painel'},
 marcos:{nome:'Dr. Marcos Lima',cargo:'Médico',ini:'ML',selo:'Atendimento',salao:'medico',cor:'#10C2BB',sub:'',home:'atend-prancha'},
 sandra:{nome:'Sandra Silva',cargo:'Responsável',ini:'SS',selo:'Família',salao:'capacitacao',cor:'#FF772E',sub:'',home:'familia-inicio'},
 beatriz:{nome:'Dra. Beatriz Nunes',cargo:'Odontologia',ini:'BN',selo:'Atendimento',salao:'medico',cor:'#10C2BB',sub:'',home:'odonto-prancha'},
 claudia:{nome:'Enf. Cláudia Rocha',cargo:'Recepção · Enfermagem',ini:'CR',selo:'Acolhimento',salao:'medico',cor:'#10C2BB',sub:'',home:'recep-fila'},
 tania:{nome:'Tânia Moraes',cargo:'Gestora · Capacitação',ini:'TM',selo:'Unidade',salao:'capacitacao',cor:'#FF772E',sub:'Centro de Capacitação · gestão',home:'cap-painel'},
 rafael:{nome:'Prof. Rafael Dias',cargo:'Instrutor · Barbeiro',ini:'RD',selo:'Aula',salao:'capacitacao',cor:'#FF772E',sub:'',home:'cap-diario'},
};
const cor2={'#752C05':'#5a2204','#C9962F':'#a87a1f','#10C2BB':'#0E9A95','#FF772E':'#C24D0F','#9A3D0B':'#752C05','#007571':'#005C59'};

/* ====== ESTADO ====== */
const APP={persona:null,view:null,eleg:{joao:'EM ANÁLISE',ana:'APROVADO'},joaoAgendado:false,joaoAtendido:false,periodo:'maio'};

/* ====== RAILS por perfil ====== */
const RAILS={
 erick:[['pres-painel','Painel',IC.home],['pres-unidades','Unidades',IC.grid],['pres-impacto','Impacto',IC.chart],['pres-familias','Famílias',IC.users],['pres-relatorio','Relatórios',IC.report],['cfg','Config',IC.cfg]],
 joana:[['social-familias','Famílias',IC.users],['social-triagem','Triagem',IC.list,3],['social-eleg','Elegib.',IC.crown],['social-ponte','Ponte',IC.flag,2],['social-agenda','Agenda',IC.cal]],
 raquel:[['medico-painel','Painel',IC.home],['medico-fila','Fila',IC.list,5],['medico-agenda','Agenda',IC.cal],['medico-aprovados','Aprovados',IC.users],['medico-prof','Equipe',IC.stethoscope],['medico-indicadores','Indic.',IC.chart]],
 tania:[['cap-painel','Painel',IC.home],['cap-catalogo','Catálogo',IC.grid],['cap-turmas','Turmas',IC.list],['cap-matriculas','Matríc.',IC.users,3],['cap-sessoes','Modelos',IC.cal,2],['cap-certificados','Certif.',IC.medal],['cap-indicadores','Indic.',IC.chart]],
};

/* ====== HELPERS ====== */
const $=s=>document.querySelector(s);
function crest(ini,w=46,gold=true){return `<span class="crest" style="width:${w}px;height:${Math.round(w*1.16)}px"><span class="foto" style="font-size:${Math.round(w*0.32)}px">${ini}</span><svg class="moldura" viewBox="0 0 100 116" preserveAspectRatio="none" style="color:${gold?'var(--dourado)':'var(--unidade)'}"><path d="M50,4 C78,4 94,22 94,42 C94,74 74,96 50,112 C26,96 6,74 6,42 C6,22 22,4 50,4 Z" fill="none" stroke="currentColor" stroke-width="4"/></svg></span>`;}
function coroaSeal(status){const m={'APROVADO':['cs-aprovado','crown','Aprovado'],'EM ANÁLISE':['cs-analise','crown','Em análise'],'NÃO ELEGÍVEL':['cs-bloq','crown','Não elegível'],'BLOQUEADO':['cs-bloq','crown','Bloqueado']}[status]||['cs-analise','crown','—'];return `<span class="coroa-seal ${m[0]}"><svg viewBox="0 0 24 18">${IC.crown}</svg>${m[2]}</span>`;}
function jubaRing(pct,size=64,color='var(--unidade)'){const r=size/2-5,c=2*Math.PI*r,off=c*(1-pct/100);return `<span class="juba-ring" style="width:${size}px;height:${size}px"><svg width="${size}" height="${size}"><circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="var(--linha)" stroke-width="5"/><circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${off}"/></svg><span class="num">${pct}%</span></span>`;}
function spark(arr,color='var(--tinta)'){const w=120,h=30,mn=Math.min(...arr),mx=Math.max(...arr),pts=arr.map((v,i)=>`${(i/(arr.length-1))*w},${h-((v-mn)/(mx-mn||1))*(h-4)-2}`).join(' ');return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;}

/* ====== LOGIN ====== */
function montaLogin(){
 $('#leao-hero').innerHTML=LEAO; $('#wm').innerHTML=LEAO;
 const g=$('#persona-grid'); g.innerHTML='';
 Object.entries(PERSONAS).forEach(([id,p])=>{
   const el=document.createElement('button');
   el.className='persona';
   el.style.cssText=`--p-cor:${p.cor};--p-cor-esc:${cor2[p.cor]};--p-suave:${p.cor}22`;
   el.innerHTML=`${crest(p.ini,50,false)}<div><div class="pnome">${p.nome}</div><div class="pcargo">${p.cargo}</div></div><span class="pselo">${p.selo}</span>`;
   el.onmouseenter=()=>{$('#login-entrar').style.background=`radial-gradient(120% 90% at 50% 0%, ${p.cor}14, transparent 70%)`;};
   el.onmouseleave=()=>{$('#login-entrar').style.background='';};
   el.onclick=()=>entrarComo(id);
   g.appendChild(el);
 });
}

/* ====== ENTRAR / SHELL ====== */
function entrarComo(id){
 const p=PERSONAS[id]; APP.persona=id;
 document.documentElement.dataset.salao=p.salao;
 // animação de lacre
 const seal=document.createElement('div'); seal.className='sealing';
 seal.innerHTML=`<div class="ring" style="position:relative;color:${p.cor}"><div style="position:absolute;inset:30px;color:${p.cor}"><span class="leao" style="display:block;width:100%;height:100%">${LEAO}</span></div><svg class="ring" viewBox="0 0 150 150" style="position:absolute;inset:0"><circle class="bar" cx="75" cy="75" r="70" fill="none" stroke="${p.cor}" stroke-width="5"/></svg></div>`;
 document.body.appendChild(seal);
 setTimeout(()=>{seal.remove(); abrirApp(id);}, document.documentElement.dataset.motion==='off'?0:1450);
}
function abrirApp(id){
 const p=PERSONAS[id];
 $('#login').style.display='none';
 $('#app').classList.remove('on'); $('#tablet-wrap').classList.remove('on'); $('#phone-wrap').classList.remove('on');
 if(id==='marcos'||id==='beatriz'||id==='claudia'||id==='rafael'){ APP.prontAba=null; APP.soap=0; $('#tablet-wrap').classList.add('on'); go(p.home); return; }
 if(id==='sandra'){ $('#phone-wrap').classList.add('on'); go(p.home); return; }
 // shell desktop
 $('#app').classList.add('on');
 $('#tb-leao').innerHTML=LEAO;
 $('#tb-sub').textContent=p.sub;
 $('#tb-user-ini').textContent=p.ini; $('#tb-user-nome').textContent=p.nome; $('#tb-user-cargo').textContent=p.cargo;
 // salão switch só p/ quem é transversal (Joana) — mostra a tese cor=navegação
 const ss=$('#salao-switch');
 if(id==='joana'){ss.classList.remove('hidden');ss.innerHTML=['corte','medico','capacitacao','esportivo','recreativo'].map(s=>`<button class="${s==='corte'?'on':''}" onclick="trocaSalao('${s}',this)">${s==='corte'?'Corte':DATA.unidades[s]?.nome.replace('Centro ','')||s}</button>`).join('');}
 else ss.classList.add('hidden');
 montaRail(id); go(p.home);
}
function trocaSalao(s,btn){document.documentElement.dataset.salao=s;document.querySelectorAll('#salao-switch button').forEach(b=>b.classList.remove('on'));btn.classList.add('on');}
function montaRail(id){
 const r=$('#rail'); r.innerHTML='';
 (RAILS[id]||[]).forEach(([view,label,ic,badge])=>{
   const b=document.createElement('button'); b.className='rail-item'; b.dataset.view=view;
   b.innerHTML=`${badge?`<span class="rbadge">${badge}</span>`:''}<svg viewBox="0 0 24 24" width="21" height="21">${ic}</svg><span>${label}</span>`;
   b.onclick=()=>go(view); r.appendChild(b);
 });
}
function go(view){
 APP.view=view;
 document.querySelectorAll('.rail-item').forEach(b=>b.classList.toggle('on',b.dataset.view===view));
 const fn=VIEWS[view]; const html=fn?fn():`<div class="card">Tela <b>${view}</b> — em construção no protótipo.</div>`;
 if(APP.persona==='marcos'||APP.persona==='beatriz'||APP.persona==='claudia'||APP.persona==='rafael'){$('#tablet').innerHTML=html; if(VIEWS['_after_'+view])VIEWS['_after_'+view](); return;}
 if(APP.persona==='sandra'){$('#phone').innerHTML=html; return;}
 $('#content').innerHTML=html;
 $('#bcrumb').innerHTML=crumbFor(view);
 if(VIEWS['_after_'+view])VIEWS['_after_'+view]();
 window.scrollTo(0,0);
}
function crumbFor(v){const map={'pres-painel':'Presidência · <b>Sala de Comando</b>','pres-unidades':'Presidência · <b>As 4 Unidades</b>','pres-impacto':'Presidência · <b>Impacto</b>','pres-familias':'Presidência · <b>Famílias (agregado)</b>','pres-relatorio':'Presidência · <b>Relatórios</b>','social-familias':'Serviço Social · <b>Ficha Cidadã</b>','social-ficha':'Serviço Social · Famílias · <b>Família Silva</b>','social-triagem':'Serviço Social · <b>Fila de Triagem</b>','social-eleg':'Serviço Social · <b>Elegibilidades</b>','social-ponte':'Serviço Social · <b>Ponte da Corte</b>','social-agenda':'Serviço Social · <b>Agenda Geral</b>','medico-painel':'Centro Médico · <b>Painel da Unidade</b>','medico-fila':'Centro Médico · <b>Fila de Espera</b>','medico-agenda':'Centro Médico · <b>Agenda do dia</b>','medico-aprovados':'Centro Médico · <b>Beneficiários Aprovados</b>','medico-prof':'Centro Médico · <b>Equipe</b>','medico-indicadores':'Centro Médico · <b>Indicadores</b>','cap-painel':'Centro de Capacitação · <b>Painel</b>','cap-catalogo':'Centro de Capacitação · <b>Catálogo</b>','cap-curso':'Capacitação · Catálogo · <b>Curso</b>','cap-turma':'Capacitação · <b>Turma</b>','cap-turmas':'Capacitação · <b>Turmas</b>','cap-matriculas':'Capacitação · <b>Matrículas</b>','cap-sessoes':'Capacitação · <b>Sessões Práticas · Banco de Modelos</b>','cap-certificados':'Capacitação · <b>Certificados</b>','cap-indicadores':'Capacitação · <b>Indicadores</b>'};return map[v]||'';}

/* ============================================================
   VIEWS
   ============================================================ */
const VIEWS={};

/* ---------- PRESIDÊNCIA ---------- */
VIEWS['pres-painel']=()=>{
 const k=DATA.kpi[APP.periodo];
 const atend=1180+(APP.joaoAtendido?1:0);
 const kpiCard=(label,val,delta,tend,extra='')=>`<div class="card kpi"><div class="k-top"><span class="k-label">${label}</span><span class="k-tend">${tend}</span></div><div class="k-val">${val}</div><div class="k-delta k-up">${delta} vs período anterior</div>${extra}</div>`;
 return `
 <div class="page-h"><div><h2>Sala de Comando</h2><div class="desc">Visão executiva agregada das 4 unidades · ${APP.periodo==='maio'?'Maio':'Abril'} 2026 · exercício 2026</div></div>
   <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
     <div class="periodo"><button onclick="setPeriodo('abril')">‹</button><span class="pl">${APP.periodo==='maio'?'Maio 2026':'Abril 2026'}</span><button onclick="setPeriodo('maio')">›</button></div>
     <button class="btn btn-gold" onclick="gerarRelatorio()"><svg viewBox="0 0 24 18" width="15">${IC.crown}</svg> Gerar Relatório da Corte</button>
   </div></div>
 <div class="card" style="margin-bottom:16px;display:flex;align-items:center;gap:26px;background:linear-gradient(120deg,#fff,var(--papel))">
   ${jubaRing(k.vagas,92,'var(--dourado)')}
   <div style="flex:1"><div style="font-size:21px;color:var(--tinta);font-weight:500;letter-spacing:.01em">A Corte acolheu <b style="font-weight:700">${k.fam.toLocaleString('pt-BR')} famílias</b> este mês.</div><div class="desc">${k.vagas}% das vagas das 4 unidades preenchidas · ${atend.toLocaleString('pt-BR')} atendimentos no mês</div></div>
 </div>
 <div class="grid g4" style="margin-bottom:16px">
   ${kpiCard('Famílias atendidas',k.fam.toLocaleString('pt-BR'),k.dFam,'Em alta',`<div style="margin-top:10px">${spark(DATA.chart)}</div>`)}
   ${kpiCard('Vagas preenchidas',k.vagas+'%',k.dVagas,'Em alta')}
   ${kpiCard('Conclusões & certificados',k.conc,k.dConc,'Em alta')}
   ${kpiCard('Saúde populacional',k.saude+'/100',k.dSaude,'Estável')}
 </div>
 <div class="grid g-60-40" style="margin-bottom:16px">
   <div class="card"><div class="sec-tit">${icon('grid',16)} Pulso das unidades</div><div class="grid g2">
     ${DATA.pulso.map(u=>`<div class="card pulso" style="--u:${DATA.unidades[u.u].cor};box-shadow:none;cursor:pointer" onclick="go('pres-unidades')">${jubaRing(u.pct,54,DATA.unidades[u.u].cor)}<div class="pinfo"><div class="pn">${u.nome}</div><div class="pm">${u.vagas} vagas · fila ${u.fila}</div><span class="pstatus" style="background:${u.sb};color:${u.sc}">${u.status}</span></div></div>`).join('')}
   </div></div>
   <div class="card"><div class="sec-tit">${icon('chart',16)} Impacto · famílias / mês</div><div id="impacto-chart"></div><div class="desc" style="margin-top:8px">Jun/2025 → Mai/2026 · marcos: Mutirão de Inverno, 2ª turma de Capacitação</div></div>
 </div>
 <div class="grid g-50" style="margin-bottom:16px">
   <div class="card"><div class="sec-tit">${icon('heart',16)} Mapa de saúde populacional <span class="pill pill-neu" title="agregado anônimo">🔒 anônimo</span></div>
     ${DATA.saude.map(([l,v])=>`<div style="margin:11px 0"><div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:5px"><span>${l}</span><b style="color:var(--tinta)">${v}%</b></div><div style="height:9px;background:var(--papel);border-radius:999px;overflow:hidden"><div style="height:100%;width:${v}%;background:linear-gradient(90deg,var(--tinta),#a8521f);border-radius:999px"></div></div></div>`).join('')}
     <div class="desc" style="margin-top:10px">A Presidência vê apenas dados agregados e anonimizados — informação clínica individual fica restrita ao Serviço Social e ao profissional.</div></div>
   <div class="card"><div class="sec-tit">${icon('list',16)} Atividade recente da Corte</div><ul class="tl">${DATA.atividade.map(a=>`<li><div class="tx">${a}</div></li>`).join('')}</ul></div>
 </div>
 <div class="constel">
   ${Object.entries(DATA.unidades).map(([id,u])=>`<div class="cu" style="--unidade:${u.cor}">${crest('🦁',46,false).replace('🦁',`<span style="font-size:18px">♛</span>`)}<small>${u.nome}</small></div>`).join('')}
   <div class="manifesto">"Uma família, quatro caminhos, uma só Corte."<br><b style="color:var(--tinta)">${k.fam.toLocaleString('pt-BR')} famílias acolhidas em ${APP.periodo==='maio'?'maio':'abril'}.</b></div>
 </div>`;
};
VIEWS['_after_pres-painel']=()=>{const c=$('#impacto-chart'); if(c)c.innerHTML=areaChart(DATA.chart);};
function setPeriodo(p){APP.periodo=p;go('pres-painel');}
function areaChart(arr){const w=460,h=190,mn=Math.min(...arr)*0.92,mx=Math.max(...arr),X=i=>20+(i/(arr.length-1))*(w-30),Y=v=>h-22-((v-mn)/(mx-mn))*(h-44);const line=arr.map((v,i)=>`${X(i)},${Y(v)}`).join(' ');const area=`20,${h-22} ${line} ${X(arr.length-1)},${h-22}`;return `<svg class="chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><defs><linearGradient id="ga" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#752C05" stop-opacity=".22"/><stop offset="1" stop-color="#752C05" stop-opacity="0"/></linearGradient></defs><polygon points="${area}" fill="url(#ga)"/><polyline points="${line}" fill="none" stroke="var(--tinta)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>${arr.map((v,i)=>`<circle cx="${X(i)}" cy="${Y(v)}" r="2.5" fill="var(--tinta)"/>`).join('')}</svg>`;}

VIEWS['pres-unidades']=()=>`<div class="page-h"><div><h2>As 4 Unidades</h2><div class="desc">Constelação da Corte · visão agregada (sem dado individual)</div></div></div>
 <div class="grid g2">${DATA.pulso.map(u=>`<div class="card" style="--unidade:${DATA.unidades[u.u].cor};border-top:5px solid ${DATA.unidades[u.u].cor}"><div style="display:flex;align-items:center;gap:18px">${jubaRing(u.pct,76,DATA.unidades[u.u].cor)}<div style="flex:1"><div class="pn" style="font-size:16px">${u.nome}</div><div class="pm">${u.vagas} vagas preenchidas</div><div class="pm">Fila de espera: ${u.fila} famílias</div><span class="pstatus" style="background:${u.sb};color:${u.sc};margin-top:8px">${u.status}</span></div></div></div>`).join('')}</div>`;
VIEWS['pres-impacto']=()=>`<div class="page-h"><div><h2>Impacto · Indicadores</h2><div class="desc">Tendência de 12 meses</div></div></div><div class="card"><div class="sec-tit">${icon('chart',16)} Famílias acolhidas / mês</div><div id="imp2"></div></div>`;
VIEWS['_after_pres-impacto']=()=>{$('#imp2').innerHTML=areaChart(DATA.chart);};
VIEWS['pres-familias']=()=>tabelaFamilias(true);
VIEWS['pres-relatorio']=()=>{gerarRelatorio();return `<div class="card">Use o botão <b>Gerar Relatório da Corte</b> para selar o relatório do período.</div>`;};

/* ---------- SERVIÇO SOCIAL ---------- */
function tabelaFamilias(agregado){
 return `<div class="page-h"><div><h2>${agregado?'Famílias (agregado)':'Ficha Cidadã'}</h2><div class="desc">${agregado?'Visão de contagem — a Presidência não acessa o indivíduo':'Registro único por família · clique para abrir'}</div></div>
   ${agregado?'':'<button class="btn btn-primary" onclick="novaFamilia()">+ Nova família</button>'}</div>
 <div class="card" style="padding:6px"><table class="tb"><thead><tr><th>Protocolo</th><th>Família</th><th>Titular</th><th>Membros</th><th>Status</th>${agregado?'':'<th></th>'}</tr></thead><tbody>
 ${DATA.familias.map(f=>`<tr ${f.id&&!agregado?`style="cursor:pointer" onclick="go('social-ficha')"`:''}><td><b style="color:var(--tinta)">${f.p}</b></td><td>Família ${f.nome}</td><td>${agregado?'—':f.titular+', '+f.idade}</td><td>${f.membros}</td><td><span class="pill ${f.status==='Ativa'?'pill-ok':f.status==='Em triagem'?'pill-wait':'pill-info'}">${f.status}</span></td>${agregado?'':`<td>${f.id?icon('right',16):''}</td>`}</tr>`).join('')}
 </tbody></table></div>`;
}
VIEWS['social-familias']=()=>tabelaFamilias(false);
VIEWS['social-ficha']=()=>{
 const s=DATA.silva;
 return `<div class="page-h"><div style="display:flex;align-items:center;gap:18px">${crest(s.titular.ini,64)}<div><h2>Família ${'Silva'}</h2><div class="desc">${s.p} · titular ${s.titular.nome}, ${s.titular.idade} anos · núcleo de tudo</div></div></div>
   <button class="btn btn-primary" onclick="go('social-eleg')"><svg viewBox="0 0 24 18" width="15">${IC.crown}</svg> Gerir elegibilidade</button></div>
 <div class="grid g-60-40">
   <div class="card"><div class="sec-tit">${icon('users',16)} Composição familiar</div>
     ${s.membros.map(m=>`<div class="membro">${crest(m.ini,46)}<div style="flex:1"><div class="mn">${m.nome} <span style="font-weight:400;color:#9a8f84;font-size:12px">· ${m.idade} anos · ${m.vinc}</span></div><div style="display:flex;gap:7px;margin-top:6px;flex-wrap:wrap">${m.unidade?coroaSeal(m.id==='joao'?APP.eleg.joao:APP.eleg.ana)+`<span class="chip" style="font-size:11px">${DATA.unidades[m.unidade].nome}</span>`:''}${(m.alertas||[]).map(a=>`<span class="chip ${a.includes('Alergia')?'alergia':'cronico'}">${a}</span>`).join('')}</div></div></div>`).join('')}
   </div>
   <div class="card"><div class="sec-tit">${icon('list',16)} Dados socioeconômicos</div>
     ${Object.entries({'Renda familiar':s.socio.renda,'Renda per capita':s.socio.percapita,'Moradia':s.socio.moradia,'Benefícios':s.socio.beneficios,'Vulnerabilidade':s.socio.vuln}).map(([k,v])=>`<div style="display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--linha);font-size:13px"><span style="color:#9a8f84">${k}</span><b style="color:var(--tinta);text-align:right">${v}</b></div>`).join('')}
     <div style="margin-top:14px;padding:11px;background:var(--ambar-bg);border-radius:11px;color:var(--ambar);font-size:12.5px;display:flex;gap:8px"><svg viewBox="0 0 24 24" width="16">${IC.flag}</svg> 1 sinalização da Ponte da Corte sobre esta família</div>
   </div>
 </div>`;
};
VIEWS['social-eleg']=()=>{
 const linha=(m,id,uni)=>`<div class="card" style="display:flex;align-items:center;gap:16px;margin-bottom:12px">${crest(m.ini,50)}<div style="flex:1"><div class="mn" style="font-weight:600;color:var(--tinta)">${m.nome} <span style="font-weight:400;color:#9a8f84;font-size:12px">· ${DATA.unidades[uni].nome}</span></div><div style="margin-top:7px">${coroaSeal(APP.eleg[id])}</div></div>
   ${APP.eleg[id]==='APROVADO'?`<button class="btn btn-ghost btn-sm" onclick="setEleg('${id}','EM ANÁLISE')">Revogar</button>`:`<button class="btn btn-gold btn-sm" onclick="setEleg('${id}','APROVADO')"><svg viewBox="0 0 24 18" width="14">${IC.crown}</svg> Conceder elegibilidade</button>`}</div>`;
 return `<div class="page-h"><div><h2>Elegibilidades · Família Silva</h2><div class="desc">A chave-mestra que abre a porta de cada unidade. Conceder acende a coroa — e a unidade passa a ver o beneficiário.</div></div></div>
   ${linha(DATA.silva.membros[1],'joao','medico')}
   ${linha(DATA.silva.membros[2],'ana','recreativo')}
   <div class="card" style="background:var(--unidade-suave);border:0;font-size:13px;color:var(--unidade-escuro);display:flex;gap:10px;align-items:center"><svg viewBox="0 0 24 24" width="18" style="flex:0 0 auto">${IC.flag}</svg> Ao conceder, o dado atravessa a casa: aparece no painel da Raquel, na prancha do Dr. Marcos, no celular da Sandra e no agregado do Erick — sem e-mail, sem planilha.</div>`;
};
function setEleg(id,status){APP.eleg[id]=status;go('social-eleg');if(status==='APROVADO')toast(`Elegibilidade concedida: ${id==='joao'?'João':'Ana'} Silva · ${id==='joao'?'Centro Médico':'Recreativo'}. A unidade já vê o beneficiário.`);}
VIEWS['social-triagem']=()=>`<div class="page-h"><div><h2>Fila de Triagem</h2><div class="desc">Famílias aguardando avaliação do Serviço Social</div></div></div>
 <div class="card" style="padding:6px"><table class="tb"><thead><tr><th>Família</th><th>Protocolo</th><th>Unidades solicitadas</th><th></th></tr></thead><tbody>
 ${DATA.triagem.map(t=>`<tr><td><b style="color:var(--tinta)">Família ${t.fam}</b></td><td>${t.p}</td><td>${t.sol}</td><td><button class="btn btn-primary btn-sm" onclick="toast('Triagem iniciada para ${t.fam}.')">Iniciar triagem</button></td></tr>`).join('')}
 </tbody></table></div>`;
VIEWS['social-ponte']=()=>`<div class="page-h"><div><h2>Ponte da Corte</h2><div class="desc">Sinalizações enviadas pelos profissionais ao Serviço Social — o ciclo de cuidado integral</div></div></div>
 ${DATA.ponte.map(p=>`<div class="card" style="display:flex;gap:14px;align-items:flex-start;margin-bottom:12px"><div style="color:var(--ambar)"><svg viewBox="0 0 24 24" width="22">${IC.flag}</svg></div><div style="flex:1"><div style="font-weight:600;color:var(--tinta);font-size:14px">${p.sobre}</div><div class="desc">De: ${p.de} · ${p.q}</div></div><button class="btn btn-ghost btn-sm" onclick="toast('Sinalização atendida.')">Atender</button></div>`).join('')}`;
VIEWS['social-agenda']=()=>`<div class="page-h"><div><h2>Agenda Geral</h2><div class="desc">Visão transversal das 4 unidades</div></div></div><div class="card">Agenda consolidada (demo) — selecione uma unidade no seletor de salão acima para recolorir a visão.</div>`;

/* ---------- GESTORA (Raquel · Médico) ---------- */
VIEWS['medico-painel']=()=>{
 const ag=agendaAtual();
 return `<div class="page-h"><div><h2>Painel da Unidade</h2><div class="desc">Centro Médico · gestão da operação · Raquel Souza</div></div></div>
 <div class="grid g4" style="margin-bottom:16px">
   ${[['Na fila agora',7],['Agendados hoje',ag.length],['Aguardando triagem',3],['Aprovados ativos',aprovadosLista().length]].map(([l,v])=>`<div class="card kpi"><span class="k-label">${l}</span><div class="k-val" style="margin-top:6px">${v}</div></div>`).join('')}
 </div>
 <div class="grid g-60-40">
   <div class="card"><div class="sec-tit">${icon('cal',16)} Agenda de hoje</div>${tabelaAgenda(ag)}</div>
   <div class="card"><div class="sec-tit">${icon('users',16)} Beneficiários aprovados</div>${aprovadosLista().map(b=>`<div class="membro">${crest(b.ini,42)}<div style="flex:1"><div class="mn">${b.nome}</div><div class="mv">${b.det}</div></div>${coroaSeal('APROVADO')}</div>`).join('')||'<div class="desc">Nenhum aprovado ainda — aguardando o Serviço Social.</div>'}</div>
 </div>`;
};
function aprovadosLista(){const arr=[];if(APP.eleg.joao==='APROVADO')arr.push({nome:'João Silva',det:'8 anos · Família Silva · novo',ini:'JS'});arr.push({nome:'Família Santos · 1 membro',det:'aprovado',ini:'CS'},{nome:'Família Costa · 2 membros',det:'aprovado',ini:'PC'});return arr;}
function agendaAtual(){const base=[...DATA.agendaMedico];if(APP.joaoAgendado)base.push({h:'14:00',b:'João Silva (8)',prof:'Dr. Marcos Lima',sala:'2',st:APP.joaoAtendido?'atendido':'agendado'});return base.sort((a,b)=>a.h.localeCompare(b.h));}
function tabelaAgenda(ag){return `<table class="tb"><thead><tr><th>Hora</th><th>Beneficiário</th><th>Profissional</th><th>Sala</th><th>Status</th></tr></thead><tbody>${ag.map(a=>`<tr><td><b>${a.h}</b></td><td>${a.b}</td><td>${a.prof}</td><td>${a.sala}</td><td><span class="pill ${a.st==='atendido'?'pill-ok':'pill-wait'}">${a.st}</span></td></tr>`).join('')}</tbody></table>`;}
VIEWS['medico-fila']=()=>`<div class="page-h"><div><h2>Fila de Espera</h2><div class="desc">Tempo real · Centro Médico</div></div></div>
 <div class="grid g4">${[['Chegou',3,'pill-info'],['Triagem',2,'pill-wait'],['Aguardando',4,'pill-neu'],['Em atendimento',3,'pill-ok']].map(([l,n,c])=>`<div class="card" style="text-align:center"><div class="k-val" style="color:var(--unidade)">${n}</div><span class="pill ${c}" style="margin-top:8px">${l}</span></div>`).join('')}</div>`;
VIEWS['medico-agenda']=()=>{
 return `<div class="page-h"><div><h2>Agenda do dia</h2><div class="desc">Centro Médico · ${agendaAtual().length} agendamentos</div></div>
   ${APP.joaoAgendado?'':`<button class="btn btn-primary" onclick="agendarJoao()">+ Agendar João Silva · 14h</button>`}</div>
   ${APP.eleg.joao==='APROVADO'&&!APP.joaoAgendado?`<div class="card" style="background:var(--unidade-suave);border:0;margin-bottom:14px;font-size:13px;color:var(--unidade-escuro)">✦ João Silva foi aprovado pelo Serviço Social e já pode ser agendado nesta unidade.</div>`:''}
   <div class="card">${tabelaAgenda(agendaAtual())}</div>`;
};
function agendarJoao(){APP.joaoAgendado=true;go('medico-agenda');toast('João Silva agendado para hoje 14h com Dr. Marcos (sala 2). Já aparece na prancha do médico e no app da mãe.');}
VIEWS['medico-aprovados']=()=>`<div class="page-h"><div><h2>Beneficiários Aprovados</h2><div class="desc">Liberados pelo Serviço Social para o Centro Médico</div></div></div>
 ${aprovadosLista().map(b=>`<div class="card" style="display:flex;align-items:center;gap:16px;margin-bottom:10px">${crest(b.ini,48)}<div style="flex:1"><div class="mn" style="font-weight:600;color:var(--tinta)">${b.nome}</div><div class="mv">${b.det}</div></div>${coroaSeal('APROVADO')}${b.nome.includes('João')?`<button class="btn btn-primary btn-sm" onclick="${APP.joaoAgendado?'jaAgendado()':'agendarJoao()'}">Agendar</button>`:''}</div>`).join('')}`;
function jaAgendado(){toast('João já está agendado para hoje 14h.');}
VIEWS['medico-prof']=()=>`<div class="page-h"><div><h2>Equipe</h2><div class="desc">Profissionais do Centro Médico</div></div></div>
 <div class="grid g3">${DATA.profissionais.map(p=>`<div class="card" style="text-align:center">${crest(p.n.split(' ').slice(-1)[0][0]+(p.n.split(' ')[1]?.[0]||''),52)}<div class="mn" style="margin-top:10px">${p.n}</div><div class="mv">${p.e} · Sala ${p.s}</div></div>`).join('')}</div>`;

/* ---------- DR. MARCOS (tablet) ---------- */
VIEWS['atend-prancha']=()=>{
 const ag=agendaAtual();
 return `<div style="padding:18px 22px;background:linear-gradient(120deg,var(--unidade),var(--unidade-escuro));color:#fff;display:flex;align-items:center;gap:14px">
   <span class="medalhao" style="width:40px;height:40px"><span class="leao" style="width:28px;height:28px">${LEAO}</span></span>
   <div style="flex:1"><div style="font-weight:600;letter-spacing:.12em;text-transform:uppercase;font-size:14px">Prancha de Atendimento</div><div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;opacity:.85">Dr. Marcos Lima · Centro Médico</div></div>
   <button class="btn btn-ghost btn-sm" onclick="trocarPerfil()" style="color:#fff;border-color:rgba(255,255,255,.4);background:rgba(255,255,255,.12)">↩ Trocar perfil</button></div>
 <div style="padding:22px">
   <div class="sec-tit">${icon('cal',16)} Minha agenda de hoje</div>
   ${ag.map(a=>`<div class="card" style="display:flex;align-items:center;gap:14px;margin-bottom:10px;${a.b.includes('João')?'border:2px solid var(--unidade)':''}">${crest(a.b.includes('João')?'JS':a.b[8]||'F',46)}<div style="flex:1"><div class="mn" style="font-weight:600;color:var(--tinta)">${a.h} · ${a.b}</div><div class="mv">${a.prof} · Sala ${a.sala}</div></div>${a.st==='atendido'?'<span class="pill pill-ok">atendido</span>':a.b.includes('João')?`<button class="btn btn-primary btn-sm" onclick="go('atend-prontuario')">Iniciar atendimento</button>`:`<span class="pill pill-wait">${a.st}</span>`}</div>`).join('')}
   ${APP.joaoAgendado?'':`<div class="card" style="background:var(--papel);text-align:center;color:#9a8f84;font-size:13px">João Silva ainda não está na agenda — a gestora Raquel precisa agendá-lo. (Troque para a Raquel e agende.)</div>`}
 </div>`;
};
VIEWS['atend-prontuario']=()=>{
 return `<div style="padding:18px 22px;background:linear-gradient(120deg,var(--unidade),var(--unidade-escuro));color:#fff;display:flex;align-items:center;gap:14px">
   <button class="btn btn-ghost btn-sm" onclick="go('atend-prancha')" style="color:#fff;border-color:rgba(255,255,255,.4);background:rgba(255,255,255,.12)">‹ Agenda</button>
   <div style="flex:1"><div style="font-weight:600;letter-spacing:.1em;text-transform:uppercase;font-size:14px">Prontuário · João Silva</div></div>
   <span style="font-size:12px;opacity:.9">14:00 · Sala 2</span></div>
 <div style="padding:22px">
   <div class="card" style="display:grid;grid-template-columns:auto 1fr;gap:18px;background:var(--papel)">
     ${crest('JS',86)}
     <div><div style="font-size:19px;color:var(--tinta);font-weight:600">João Pereira da Silva</div><div class="desc">8 anos · 26 kg · Família Silva · ${coroaSeal('APROVADO')}</div>
       <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><span class="chip alergia"><svg viewBox="0 0 24 24" width="14"><path d="M12 3 1 21h22L12 3zM12 9v5M12 17.5v.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> Alergia: Dipirona</span><span class="chip cronico">Asma</span><span class="chip">💊 Bombinha 2x/dia</span></div>
       <div style="margin-top:12px;padding:9px 12px;border-radius:11px;background:var(--ambar-bg);color:var(--ambar);font-size:12.5px;display:flex;gap:8px"><svg viewBox="0 0 24 24" width="16">${IC.flag}</svg> Contexto social (Ficha Cidadã): insegurança alimentar · família em 3 frentes</div>
     </div>
   </div>
   <div class="card" style="margin-top:16px"><div class="sec-tit">Evolução do atendimento</div>
     <textarea style="width:100%;font-family:inherit;font-size:14px;border:1px solid var(--linha);border-radius:12px;padding:12px;background:var(--papel);min-height:90px" placeholder="Registre a evolução…">Tosse seca há 3 dias, piora à noite. Ausculta com sibilos leves. Mantida bombinha; orientada hidratação.</textarea>
     <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap">
       <button class="btn btn-ghost" onclick="toast('Receita gerada (sem Dipirona — alergia bloqueada) e enviada ao app da Sandra.')">Prescrever</button>
       <button class="btn btn-ghost" onclick="abrirPonte()"><svg viewBox="0 0 24 24" width="14">${IC.flag}</svg> Ponte da Corte</button>
       <button class="btn btn-primary" style="margin-left:auto" onclick="atenderJoao()"><svg viewBox="0 0 24 18" width="15">${IC.check}</svg> Finalizar atendimento</button>
     </div>
   </div>
 </div>`;
};
function atenderJoao(){APP.joaoAtendido=true;APP.joaoAgendado=true;toast('Atendimento finalizado. SOAP/CID gerados; KPI da Presidência atualizado; agenda da Sandra marcada como atendido.');go('atend-prancha');}
function abrirPonte(){openModal(`<div style="padding:24px"><div class="sec-tit"><svg viewBox="0 0 24 24" width="18" style="color:var(--ambar)">${IC.flag}</svg> Ponte da Corte → Serviço Social</div><p style="font-size:13px;color:var(--corpo)">Sinalize algo percebido no atendimento. Fecha o ciclo de cuidado.</p><textarea style="width:100%;border:1px solid var(--linha);border-radius:12px;padding:12px;font-family:inherit;min-height:70px;background:var(--papel)">João chega com frequência sem ter se alimentado — sugiro avaliação social.</textarea><div style="display:flex;gap:10px;margin-top:14px"><button class="btn btn-ghost" onclick="closeModal()" style="flex:1">Cancelar</button><button class="btn btn-primary" style="flex:1" onclick="closeModal();toast('Sinalização enviada ao Serviço Social.')">Enviar à Corte</button></div></div>`);}

/* ---------- SANDRA (phone PWA) ---------- */
VIEWS['familia-inicio']=()=>phoneShell('inicio',`
 <div class="card" style="margin-bottom:12px"><div class="sec-tit">Hoje</div>
   ${APP.joaoAtendido?`<div class="membro"><div style="color:#10C2BB">${crest('JS',40)}</div><div style="flex:1"><div class="mn">João · Consulta</div><div class="mv">Centro Médico · 14h</div></div><span class="pill pill-ok">atendido</span></div>`:`<div class="membro"><div>${crest('JS',40)}</div><div style="flex:1"><div class="mn">João · Consulta</div><div class="mv">Centro Médico · 14h</div></div><span class="pill pill-wait">${APP.joaoAgendado?'hoje':'a confirmar'}</span></div>`}
 </div>
 <div class="card"><div class="sec-tit">Meus filhos</div>
   <div class="membro">${crest('JS',40)}<div style="flex:1"><div class="mn">João, 8</div><div class="mv">Centro Médico</div></div></div>
   <div class="membro">${crest('AS',40)}<div style="flex:1"><div class="mn">Ana, 5</div><div class="mv">Recreativo</div></div></div>
 </div>`);
VIEWS['familia-agenda']=()=>phoneShell('agenda',`<div class="card"><div class="sec-tit">Agenda dos filhos</div>
   ${[['João','Centro Médico','#10C2BB','Consulta clínico',APP.joaoAtendido?'Hoje 14h · atendido':(APP.joaoAgendado?'Hoje 14h':'A confirmar')],['Ana','Recreativo','#007571','Oficina de pintura','Amanhã 10h'],['Ana','Recreativo','#007571','Recreação','Sex 9h']].map(([f,u,c,e,w])=>`<div class="membro"><div style="width:6px;height:40px;background:${c};border-radius:4px"></div><div style="flex:1"><div class="mn">${e}</div><div class="mv">${f} · ${u}</div></div><div class="mv" style="text-align:right">${w}</div></div>`).join('')}
 </div>`);
VIEWS['familia-certificados']=()=>phoneShell('cert',`<div class="card" style="text-align:center;padding:24px">${crest('AS',60)}<div style="margin-top:14px"><svg viewBox="0 0 24 18" width="28" style="color:var(--dourado)">${IC.crown}</svg></div><div class="mn" style="margin-top:8px">Participação · Oficina Recreativa</div><div class="mv">Ana Silva · Abril/2026</div><button class="btn btn-primary btn-sm" style="margin-top:14px" onclick="toast('Certificado baixado (PDF).')">Baixar certificado</button></div>`);
function phoneShell(tab,body){
 const tabs=[['inicio','Início',IC.home,'familia-inicio'],['agenda','Agenda',IC.cal,'familia-agenda'],['cert','Certif.',IC.medal,'familia-certificados']];
 return `<div class="notch"></div>
   <div class="phone-head"><div style="display:flex;align-items:center;gap:10px"><span class="medalhao" style="width:34px;height:34px;color:#fff;box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.5);background:rgba(255,255,255,.12)"><span style="width:24px;height:24px;display:block;color:#fff">${LEAO}</span></span><div><div style="font-weight:600;letter-spacing:.06em;font-size:13px">Olá, Sandra 👋</div><div style="font-size:10px;opacity:.85;letter-spacing:.1em;text-transform:uppercase">Família Silva</div></div></div></div>
   <div class="phone-body">${body}</div>
   <div class="phone-tabs">${tabs.map(([id,l,ic,view])=>`<button class="${id===tab?'on':''}" onclick="go('${view}')"><svg viewBox="0 0 24 24" width="20">${ic}</svg>${l}</button>`).join('')}</div>`;
}

/* ====== AÇÕES GLOBAIS ====== */
function trocarPerfil(){closeUserMenu();$('#app').classList.remove('on');$('#tablet-wrap').classList.remove('on');$('#phone-wrap').classList.remove('on');$('#login').style.display='grid';APP.persona=null;document.documentElement.dataset.salao='corte';}
function toggleUserMenu(e){e.stopPropagation();const m=$('#usermenu');if(!m.classList.contains('hidden')){closeUserMenu();return;}m.innerHTML=`<div style="padding:10px 12px;border-bottom:1px solid var(--linha);font-size:12px;color:#9a8f84">${PERSONAS[APP.persona].nome}</div><button onclick="trocarPerfil()">${icon('logout',18)} Trocar de perfil</button>`;m.classList.remove('hidden');}
function closeUserMenu(){$('#usermenu').classList.add('hidden');}
document.addEventListener('click',()=>closeUserMenu());
function buscaFamilia(){if(APP.persona==='joana'||APP.persona==='erick'){go(APP.persona==='joana'?'social-ficha':'pres-familias');toast('Resultado: Família Silva (IFP-2026-000412)');}}
function abrirSino(){openModal(`<div style="padding:22px"><div class="sec-tit">${icon('list',16)} Notificações</div>${DATA.notif.map(n=>`<div style="padding:11px 0;border-bottom:1px solid var(--linha)"><div style="font-size:13px;color:var(--corpo)">${n.t}</div><div class="mv">${n.q}</div></div>`).join('')}<button class="btn btn-ghost" style="width:100%;margin-top:14px" onclick="closeModal()">Fechar</button></div>`);}
function novaFamilia(){openModal(`<div style="padding:24px"><div class="sec-tit">${icon('users',16)} Nova Família · Ficha Cidadã</div><p style="font-size:13px;color:#9a8f84">Fluxo de cadastro (demo): titular → composição → socioeconômico → revisão.</p><input style="width:100%;border:1px solid var(--linha);border-radius:12px;padding:12px;font-family:inherit;background:var(--papel);margin-bottom:10px" placeholder="Nome do responsável"><input style="width:100%;border:1px solid var(--linha);border-radius:12px;padding:12px;font-family:inherit;background:var(--papel)" placeholder="CPF"><div style="display:flex;gap:10px;margin-top:16px"><button class="btn btn-ghost" style="flex:1" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" style="flex:1" onclick="closeModal();toast('Família cadastrada — protocolo IFP-2026-000441 gerado.')">Criar ficha</button></div></div>`);}
function gerarRelatorio(){const k=DATA.kpi[APP.periodo];openModal(`<div class="relatorio"><div class="selo">${LEAO}</div><h3>Relatório da Corte</h3><div style="letter-spacing:.16em;text-transform:uppercase;font-size:12px;color:var(--dourado);font-weight:600;margin-bottom:16px">Selado · ${APP.periodo==='maio'?'Maio':'Abril'} 2026</div><p style="color:var(--corpo);font-size:14px;line-height:1.6;max-width:340px;margin:0 auto 20px">${k.fam.toLocaleString('pt-BR')} famílias acolhidas · ${k.vagas}% das vagas preenchidas · ${k.conc} conclusões. Impacto agregado e anonimizado das 4 unidades.</p><div style="display:flex;gap:10px;justify-content:center"><button class="btn btn-ghost" onclick="closeModal()">Fechar</button><button class="btn btn-gold" onclick="toast('Relatório exportado (PDF).')">Baixar PDF</button></div></div>`);}
function openModal(html){$('#modal').innerHTML=html;$('#overlay').classList.add('on');}
function closeModal(){$('#overlay').classList.remove('on');}
$('#overlay').addEventListener('click',e=>{if(e.target.id==='overlay')closeModal();});
let toastT;function toast(msg){$('#toast-msg').textContent=msg;$('#toast').classList.add('show');clearTimeout(toastT);toastT=setTimeout(()=>$('#toast').classList.remove('show'),4200);}

/* ============================================================
   MÓDULO CENTRO MÉDICO (expansão) — prontuário c/ abas, odontograma,
   recepção/triagem (Enf. Cláudia), odonto (Dra. Beatriz), indicadores
   ============================================================ */
document.head.insertAdjacentHTML('beforeend',`<style>
.stepper{display:flex;gap:4px;justify-content:space-between}
.step{flex:1;background:transparent;border:0;cursor:pointer;font-family:inherit;display:flex;flex-direction:column;align-items:center;gap:6px;padding:0}
.step .dot{width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;border:2px solid #d8cfc6;color:#b3a89d;background:#fff;transition:all .25s}
.step .nome{font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#b3a89d}
.step[data-state=done] .dot{background:var(--unidade);border-color:var(--unidade);color:#fff}
.step[data-state=done] .nome{color:var(--corpo)}
.step[data-state=current] .dot{border-color:var(--unidade);color:var(--unidade);box-shadow:0 0 0 4px var(--unidade-suave)}
.step[data-state=current] .nome{color:var(--tinta)}
.card-foco{background:#fff;border:1px solid var(--linha);border-radius:16px;overflow:hidden}
.card-foco .topo-ogival{height:6px;background:var(--unidade)}
.passo{padding:16px}
.toggle-chip{font-family:inherit;cursor:pointer;border:1px solid var(--linha);background:#fff;color:var(--corpo);border-radius:10px;padding:9px 12px;font-size:12.5px;text-align:left;display:flex;align-items:center;justify-content:space-between;gap:8px;transition:all .2s}
.toggle-chip[aria-pressed=true]{border-color:var(--unidade);background:var(--unidade-suave);color:var(--unidade-escuro);font-weight:600}
.vital{background:var(--papel);border:1px solid var(--linha);border-radius:12px;padding:10px 12px}
.lista-med{display:flex;flex-direction:column;gap:8px;margin-top:6px}
.med-item{display:flex;align-items:center;justify-content:space-between;background:var(--papel);border:1px solid var(--linha);border-radius:10px;padding:9px 12px;font-size:13px;gap:10px}
.med-item button{border:0;background:transparent;color:var(--erro);cursor:pointer;font-size:16px;line-height:1}
.add-row{display:flex;gap:8px;margin-top:10px}
.add-row select{flex:1;font-family:inherit;font-size:13px;border:1px solid var(--linha);border-radius:10px;padding:10px;background:#fff;color:var(--corpo)}
.btn-mini{font-family:inherit;cursor:pointer;background:var(--tinta);color:#fff;border:0;border-radius:10px;padding:0 16px;font-weight:600;font-size:12px;letter-spacing:.05em;text-transform:uppercase}
.acoes{display:flex;gap:12px}.acoes .btn{flex:1}
.rodape{display:flex;gap:12px;flex-wrap:wrap;background:var(--papel);padding:14px;border-radius:14px}
.btn-ponte{flex:1;min-width:200px;font-family:inherit;cursor:pointer;background:#fff;border:1.5px dashed var(--ambar);color:var(--ambar);border-radius:12px;padding:12px;font-weight:600;font-size:12px;letter-spacing:.05em;text-transform:uppercase;display:inline-flex;align-items:center;justify-content:center;gap:8px}
.btn-pausar{font-family:inherit;cursor:pointer;background:transparent;border:1px solid var(--linha);color:var(--corpo);border-radius:12px;padding:12px 18px;font-weight:600;font-size:12px;text-transform:uppercase}
.btn-voz{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--unidade);color:var(--unidade-escuro);background:var(--unidade-suave);padding:7px 13px;border-radius:999px;font-family:inherit;font-weight:600;font-size:11px;letter-spacing:.06em;text-transform:uppercase;cursor:pointer}
.atalhos{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.atalho{font-family:inherit;cursor:pointer;background:#fff;border:1px solid var(--linha);color:var(--tinta);border-radius:999px;padding:7px 13px;font-size:12.5px;font-weight:500;transition:all .2s}
.atalho:hover{background:var(--unidade);color:#fff;border-color:var(--unidade)}
.atalhos-lbl{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--corpo);opacity:.7;margin-top:14px;font-weight:600}
.abas{display:flex;gap:4px;background:#fff;border:1px solid var(--linha);border-radius:14px;padding:5px;margin:14px 0;overflow:auto}
.abas button{flex:1;border:0;background:transparent;cursor:pointer;font-family:inherit;font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--corpo);padding:10px 8px;border-radius:10px;white-space:nowrap}
.abas button.on{background:var(--unidade);color:#fff}
.passaporte{position:sticky;top:0;z-index:6;background:var(--papel);border:1px solid var(--linha);border-radius:16px;padding:14px 16px}
.filaboard{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
@media(max-width:760px){.filaboard{grid-template-columns:1fr 1fr}}
.fila-col{background:var(--papel);border:1px solid var(--linha);border-radius:14px;padding:10px;min-height:130px}
.fila-col h4{margin:0 0 10px;font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--tinta);display:flex;justify-content:space-between;align-items:center}
.fila-col h4 b{background:var(--unidade);color:#fff;border-radius:999px;padding:1px 8px;font-size:10px}
.fila-card{background:#fff;border:1px solid var(--linha);border-radius:11px;padding:9px 11px;margin-bottom:8px;font-size:12.5px;border-left:3px solid var(--unidade)}
.fila-card.click{cursor:pointer}.fila-card.click:hover{box-shadow:var(--shadow-sm)}
.fila-card .t{font-weight:600;color:var(--tinta)}.fila-card .w{font-size:10px;color:#9a8f84}
.odontograma{background:#fff;border:1px solid var(--linha);border-radius:16px;padding:16px}
.arcada{display:flex;justify-content:center;gap:2px;overflow-x:auto;padding:8px 0}
.dente{cursor:pointer;flex:0 0 auto}.dente .tf:hover{opacity:.7}.dente .num{font-size:9px;fill:#9a8f84;font-weight:600}
.legenda{display:flex;gap:10px;flex-wrap:wrap;margin:6px 0}
.leg{display:inline-flex;align-items:center;gap:6px;font-size:11px;color:var(--corpo)}
.leg i{width:13px;height:13px;border-radius:3px;display:inline-block;border:1px solid #7a5a3a}
.prio{display:inline-flex;align-items:center;gap:8px;padding:8px 14px;border-radius:12px;font-weight:600;font-size:12px}
.flash{animation:flashk .45s 4}@keyframes flashk{50%{background:var(--erro);color:#fff;transform:scale(1.05)}}
</style>`);

const MED={
 vitais:{temp:'37,8°C',fc:'96 bpm',sat:'97%',peso:'26 kg',alt:'1,28 m',pa:'95/60'},
 triagemPor:'Enf. Cláudia · 14:10',
 prioridade:{cor:'#C24D0F',bg:'#FBEEE3',label:'Amarelo · precisa de atenção hoje'},
 motivo:'Tosse seca há 3 dias, com piora à noite · encaminhado pela recepção às 14:05.',
 linhaVida:[
  {d:'14:00 hoje',cor:'#10C2BB',t:'Consulta clínica (em andamento)',prof:'Dr. Marcos Lima'},
  {d:'12/03',cor:'#10C2BB',t:'Consulta clínica — tosse · retorno em 30 dias',prof:'Dr. Marcos Lima'},
  {d:'02/02',cor:'#9A3D0B',t:'Mutirão odontológico — restauração no dente 16',prof:'Dra. Beatriz Nunes'},
  {d:'15/01',cor:'#007571',t:'Avaliação nutricional — encaminhamento',prof:'Nutri. Paula'},
 ],
 cid:[['J45','Asma'],['J06.9','Infecção respiratória aguda'],['J20','Bronquite aguda']],
 formulario:[
  {n:'Salbutamol spray — 2 jatos 6/6h · 5 dias',disp:'disponível'},
  {n:'Prednisolona 3mg/ml — 1x/dia · 5 dias',disp:'sob encomenda'},
  {n:'Soro fisiológico nasal — livre demanda',disp:'disponível'},
  {n:'Amoxicilina 250mg/5ml — 8/8h · 7 dias',disp:'disponível'},
  {n:'Dipirona — BLOQUEADO (alergia)',bloq:true},
 ],
 agendaOdonto:[{h:'10:00',b:'Pedro Oliveira (6a)',sala:'3',st:'atendido',ini:'PO'},{h:'14:40',b:'Lara Costa (4a)',sala:'3',st:'agendado',ini:'LC'}],
};
APP.joaoAgendado=true;
APP.odonto={'36':{O:'carie'},'16':{O:'restaurado'},'85':{ALL:'selante'},'75':{ALL:'extrair'}};
APP.odontoFluor=false;
APP.filaBoard={
 chegou:[{n:'João Silva',w:'chegou 14:05',joao:true},{n:'Família Mendes',w:'8 min'}],
 triagem:[{n:'Pedro Alves',w:'em triagem'}],
 aguardando:[{n:'Lúcia Pereira',w:'12 min'},{n:'Carla Dias',w:'5 min'}],
 atend:[{n:'Família Costa · sala 1',w:'Dra. Helena'}],
};

const TOP=[18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28];
const BOT=[48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38];
function faceFill(s){return {higido:'#ffffff',carie:'#E08A3C',restaurado:'#10C2BB',selante:'#CDEFEC',extrair:'#ffffff',ausente:'#f0ebe4'}[s]||'#ffffff';}
function faceState(t,f){const o=APP.odonto[t];if(!o)return 'higido';if(o.ALL)return o.ALL;return o[f]||'higido';}
function denteSVG(t){
 const whole=(APP.odonto[t]||{}).ALL;
 const fc=f=>faceFill(faceState(t,f));
 const poly=(f,pts)=>`<polygon class="tf" data-tooth="${t}" data-face="${f}" points="${pts}" fill="${fc(f)}" stroke="#7a5a3a" stroke-width="1"/>`;
 const faces=poly('V','3,3 41,3 30,15 14,15')+poly('L','3,41 41,41 30,29 14,29')+poly('M','3,3 14,15 14,29 3,41')+poly('D','41,3 30,15 30,29 41,41')+`<rect class="tf" data-tooth="${t}" data-face="O" x="14" y="15" width="16" height="14" fill="${fc('O')}" stroke="#7a5a3a" stroke-width="1"/>`;
 let ov='';
 if(whole==='extrair')ov=`<rect x="3" y="3" width="38" height="38" fill="none" stroke="#B3261E" stroke-width="2" stroke-dasharray="4 3"/><path d="M7 7 L37 37 M37 7 L7 37" stroke="#B3261E" stroke-width="2"/>`;
 if(whole==='ausente')ov=`<path d="M7 7 L37 37 M37 7 L7 37" stroke="#9a8f84" stroke-width="2.5"/>`;
 return `<svg class="dente" width="42" height="52" viewBox="0 0 44 52" style="overflow:visible">${faces}${ov}<text class="num" x="22" y="50" text-anchor="middle">${t}</text></svg>`;
}
function legenda(){const it=[['Hígido','#ffffff',''],['Cárie / a tratar','#E08A3C',''],['Restauração','#10C2BB',''],['Selante','#CDEFEC',''],['Extração indicada','#ffffff','dash'],['Ausente','#f0ebe4','']];return `<div class="legenda">${it.map(([l,c,d])=>`<span class="leg"><i style="background:${c};${d?'border:1px dashed #B3261E':''}"></i>${l}</span>`).join('')}</div>`;}
function odontograma(){
 return `<div class="odontograma">
   <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><div class="sec-tit" style="margin:0">Odontograma · João Silva</div><span class="pill pill-info">8 anos · dentição mista</span></div>
   ${legenda()}
   <div class="arcada" onclick="odontoClick(event)">${TOP.map(denteSVG).join('')}</div>
   <div style="height:1px;background:var(--linha);margin:6px 0"></div>
   <div class="arcada" onclick="odontoClick(event)">${BOT.map(denteSVG).join('')}</div>
   <div class="desc" style="margin-top:8px">Toque numa face do dente para registrar o achado · dentes 55–85 = decíduos (de leite).</div>
 </div>`;
}
function odontoClick(e){const p=e.target.closest('.tf');if(!p)return;openOdontoPopover(p.dataset.tooth,p.dataset.face);}
function openOdontoPopover(t,f){
 const est=[['higido','Hígido'],['carie','Cárie / a tratar'],['restaurado','Restauração'],['selante','Selante']];
 const wh=[['extrair','Extração indicada'],['ausente','Ausente']];
 openModal(`<div style="padding:22px"><div class="sec-tit">Dente ${t} · face ${f}</div>
   <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px">${est.map(([s,l])=>`<button class="atalho" onclick="setFace('${t}','${f}','${s}')">${l}</button>`).join('')}</div>
   <div class="sec-tit">Dente inteiro</div>
   <div style="display:flex;flex-wrap:wrap;gap:8px">${wh.map(([s,l])=>`<button class="atalho" onclick="setWhole('${t}','${s}')">${l}</button>`).join('')}</div></div>`);
}
function setFace(t,f,s){APP.odonto[t]=APP.odonto[t]||{};delete APP.odonto[t].ALL;if(s==='higido')delete APP.odonto[t][f];else APP.odonto[t][f]=s;closeModal();go('atend-prontuario');toast('Dente '+t+' · '+f+' → '+s);}
function setWhole(t,s){APP.odonto[t]={ALL:s};closeModal();go('atend-prontuario');toast('Dente '+t+' → '+s);}
function planoLista(){const it=[];Object.entries(APP.odonto).forEach(([t,o])=>{if(o.ALL==='extrair')it.push({txt:'Dente '+t+' · Extração',done:false});else if(o.ALL==='selante')it.push({txt:'Dente '+t+' · Selante preventivo',done:true});else Object.entries(o).forEach(([f,s])=>{if(f==='ALL')return;if(s==='carie')it.push({txt:'Dente '+t+' '+f+' · Restauração',done:false});if(s==='restaurado')it.push({txt:'Dente '+t+' '+f+' · Restauração',done:true});});});if(APP.odontoFluor)it.push({txt:'Aplicação de flúor',done:true});return it;}
function abaPlano(){const it=planoLista();const done=it.filter(i=>i.done).length;const pct=it.length?Math.round(done/it.length*100):0;
 return `<div class="card"><div style="display:flex;align-items:center;gap:18px;margin-bottom:14px">${jubaRing(pct,72)}<div><div class="sec-tit" style="margin:0">Saúde bucal em dia</div><div class="desc">${done} de ${it.length} procedimentos concluídos · tudo gratuito</div></div><button class="btn btn-ghost btn-sm" style="margin-left:auto" onclick="${APP.odontoFluor?'':'aplicarFluor()'}">${APP.odontoFluor?'Flúor aplicado ✓':'Aplicar flúor'}</button></div>
   <div class="lista-med">${it.map(i=>`<div class="med-item"><span>${i.txt}</span><span class="pill ${i.done?'pill-ok':'pill-wait'}">${i.done?'realizado':'planejado'}</span></div>`).join('')||'<div class="desc">Sem procedimentos.</div>'}</div>
   <div class="desc" style="margin-top:12px">Materiais: resina <b>disponível</b> · flúor <b>disponível</b> (almoxarifado social) · sem custo.</div></div>`;
}
function aplicarFluor(){APP.odontoFluor=true;go('atend-prontuario');toast('Flúor aplicado · entra no plano.');}

function isOdonto(){return APP.persona==='beatriz';}
function passaporte(){
 return `<div class="passaporte" style="display:grid;grid-template-columns:auto 1fr;gap:16px;align-items:center">${crest('JS',64)}
   <div><div style="font-size:18px;color:var(--tinta);font-weight:600">João Pereira da Silva</div>
   <div class="desc">8 anos · 26 kg · 1,28 m · Família Silva · ${coroaSeal('APROVADO')}</div>
   <div class="chips" style="margin-top:8px"><span class="chip alergia" id="chip-alergia">⚠ Alergia: Dipirona</span><span class="chip cronico">Asma</span><span class="chip med">💊 Bombinha 2x/dia</span><span class="chip neutro">Pediátrico · dose p/ 26 kg</span></div>
   <div class="social" style="margin-top:10px"><svg viewBox="0 0 24 24" width="16">${IC.flag}</svg> <span>Contexto social: insegurança alimentar · 3 frentes <b style="cursor:pointer;color:var(--ambar)" onclick="verCorte()">· Ver na Corte</b></span></div></div></div>`;
}
function verCorte(){openModal(`<div style="padding:22px"><div class="sec-tit">Contexto social · Ficha Cidadã</div><p class="desc">Dado do Serviço Social (Joana Martins) — visível ao profissional para o cuidado integral.</p>${Object.entries({'Renda familiar':'R$ 1.380/mês','Per capita':'R$ 460','Moradia':'Alugada','Benefícios':'Bolsa Família','Vulnerabilidade':'Insegurança alimentar'}).map(([k,v])=>`<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--linha);font-size:13px"><span style="color:#9a8f84">${k}</span><b style="color:var(--tinta)">${v}</b></div>`).join('')}<button class="btn btn-ghost" style="width:100%;margin-top:14px" onclick="closeModal()">Fechar</button></div>`);}
function abaResumo(){
 return `<div class="card" style="margin-bottom:14px"><div class="sec-tit">Motivo da vinda hoje</div><div style="font-size:14px">${MED.motivo}</div></div>
 <div class="card" style="margin-bottom:14px"><div class="sec-tit">Pré-consulta da enfermagem <span class="pill pill-neu">${MED.triagemPor}</span></div>
   <div class="grid g4">${[['Temperatura',MED.vitais.temp],['FC',MED.vitais.fc],['SatO₂',MED.vitais.sat],['Peso',MED.vitais.peso]].map(([k,v])=>`<div class="vital"><div style="font-size:20px;color:var(--tinta);font-weight:600">${v}</div><div style="font-size:10px;letter-spacing:.08em;text-transform:uppercase;opacity:.7">${k}</div></div>`).join('')}</div>
   <div style="margin-top:10px"><span class="prio" style="background:${MED.prioridade.bg};color:${MED.prioridade.cor}">● ${MED.prioridade.label}</span></div></div>
 <div class="grid g-50">
   <div class="card"><div class="sec-tit">Linha da vida</div><ul class="tl">${MED.linhaVida.map(e=>`<li style="border-left-color:${e.cor}"><div class="tx"><b style="color:var(--tinta)">${e.d}</b> · ${e.t}</div><div class="wn">${e.prof}</div></li>`).join('')}</ul></div>
   <div class="card"><div class="sec-tit">Alertas ativos</div><div style="padding:11px;border-radius:11px;background:var(--erro-bg);color:var(--erro);font-size:13px;margin-bottom:10px;font-weight:600">⚠ NÃO prescrever Dipirona (alergia)</div><div style="padding:11px;border-radius:11px;background:var(--ambar-bg);color:var(--ambar);font-size:13px">Asma — observar padrão respiratório</div></div></div>`;
}
function abaEvolucao(){
 const steps=[['S','Subjetivo'],['O','Objetivo'],['A','Avaliação'],['P','Plano']];
 return `<div class="stepper" style="margin:0 0 14px">${steps.map(([k,l],i)=>`<button class="step" data-state="${i<APP.soap?'done':i===APP.soap?'current':'todo'}" onclick="setSoap(${i})"><span class="dot">${i<APP.soap?'✓':k}</span><span class="nome">${l}</span></button>`).join('')}</div>
 <div class="card-foco"><div class="topo-ogival"></div>${soapCard(APP.soap)}</div>
 <div class="acoes" style="margin-top:14px"><button class="btn btn-ghost" onclick="setSoap(${Math.max(0,APP.soap-1)})" ${APP.soap===0?'disabled':''}>‹ Voltar</button><button class="btn btn-primary" onclick="setSoap(${Math.min(3,APP.soap+1)})">${APP.soap===3?'Concluir':'Próximo ›'}</button></div>`;
}
function setSoap(i){APP.soap=i;APP.consultaProg=Math.round((i+1)/4*100);go('atend-prontuario');}
function soapCard(i){
 if(i===0)return `<div class="passo"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><span class="sec-tit" style="margin:0">Subjetivo · queixa</span><button class="btn-voz" onclick="ditar()">🎤 Ditar voz</button></div><textarea id="soap-s" rows="3" style="width:100%;font-family:inherit;font-size:14px;border:1px solid var(--linha);border-radius:12px;padding:12px;background:var(--papel)">Tosse seca há 3 dias, com piora à noite. </textarea><div class="atalhos">${['Tosse','Febre','Falta de ar','Dor de garganta','Chiado no peito'].map(a=>`<button class="atalho" onclick="addQ('${a}')">${a}</button>`).join('')}</div></div>`;
 if(i===1)return `<div class="passo"><span class="sec-tit">Objetivo · exame físico</span><div class="grid g2" style="margin-top:8px">${['Ausculta pulmonar','Orofaringe','Otoscopia','Hidratação'].map(s=>`<button class="toggle-chip" aria-pressed="false" onclick="this.setAttribute('aria-pressed',this.getAttribute('aria-pressed')!=='true');var sp=this.querySelector('span');sp.textContent=sp.textContent==='normal'?'alterado':'normal'">${s} <span>normal</span></button>`).join('')}</div><div class="atalhos-lbl">Sinais vitais (da enfermagem · não redigita)</div><div class="grid g3" style="margin-top:8px">${[['Tª',MED.vitais.temp],['SatO₂',MED.vitais.sat],['FC',MED.vitais.fc]].map(([k,v])=>`<div class="vital"><div style="font-size:18px;color:var(--tinta);font-weight:600">${v}</div><div style="font-size:10px;text-transform:uppercase;opacity:.7">${k}</div></div>`).join('')}</div></div>`;
 if(i===2)return `<div class="passo"><span class="sec-tit">Avaliação · hipótese (CID-10)</span><input id="cid-in" placeholder="Digite: asma, tosse…" oninput="filtraCid(this.value)" style="width:100%;margin-top:8px;font-family:inherit;font-size:14px;border:1px solid var(--linha);border-radius:12px;padding:12px;background:var(--papel)"><div id="cid-res" class="atalhos">${MED.cid.map(c=>`<button class="atalho" onclick="pickCid('${c[0]}','${c[1]}')">${c[0]} · ${c[1]}</button>`).join('')}</div><div id="cid-pick" style="margin-top:10px">${APP.cidPick?cidChip():''}</div></div>`;
 return `<div class="passo"><span class="sec-tit">Plano · conduta</span><div class="grid g2" style="margin-top:8px"><button class="toggle-chip" aria-pressed="true">Atestado <span>2 dias</span></button><button class="toggle-chip" aria-pressed="true">Retorno <span>30 dias</span></button></div><div class="desc" style="margin-top:10px">Prescrição e exames nas abas próprias. Ao <b>finalizar</b>, o SOAP, o CID-10 e a assinatura são montados nos bastidores; a alta em linguagem simples vai pro app da Sandra.</div></div>`;
}
function ditar(){var t=document.getElementById('soap-s');if(t)t.value+=' Refere leve melhora com a bombinha.';toast('Trecho transcrito por voz.');}
function addQ(q){var t=document.getElementById('soap-s');if(t)t.value=(t.value.trim()+' '+q+'. ');}
function filtraCid(v){var r=document.getElementById('cid-res');var f=MED.cid.filter(c=>c[1].toLowerCase().includes(v.toLowerCase())||c[0].toLowerCase().includes(v.toLowerCase()));r.innerHTML=f.map(c=>`<button class="atalho" onclick="pickCid('${c[0]}','${c[1]}')">${c[0]} · ${c[1]}</button>`).join('');}
function pickCid(code,desc){APP.cidPick={code,desc};document.getElementById('cid-pick').innerHTML=cidChip();toast('CID '+code+' fixado (oculto do paciente).');}
function cidChip(){return `<span class="chip cronico">🔒 ${APP.cidPick.code} · ${APP.cidPick.desc} · oculto do paciente</span>`;}
function abaPrescricao(){
 APP.presc=APP.presc||['Salbutamol spray — 2 jatos 6/6h · 5 dias'];
 return `<div class="card"><div class="sec-tit">Prescrição · formulário do Instituto</div>
   <div class="lista-med">${APP.presc.map((m,i)=>`<div class="med-item"><span>${m}</span><button onclick="removePresc(${i})" aria-label="remover">×</button></div>`).join('')||'<div class="desc">Nada prescrito.</div>'}</div>
   <div class="add-row"><select id="presc-sel">${MED.formulario.map((f,i)=>`<option value="${i}">${f.n}${f.disp?' · '+f.disp:''}</option>`).join('')}</select><button class="btn-mini" onclick="addPresc()">Adicionar</button></div>
   <div class="desc" style="margin-top:8px"><b>disponível</b> = retira na hora · <b>sob encomenda</b> = 2 dias · farmácia social, sem custo.</div>
   <div class="grid g2" style="margin-top:12px"><button class="toggle-chip" aria-pressed="true">Atestado <span>2 dias</span></button><button class="toggle-chip" aria-pressed="true">Retorno <span>30 dias</span></button></div></div>`;
}
function addPresc(){var i=+document.getElementById('presc-sel').value;var f=MED.formulario[i];if(f.bloq){toast('⚠ Bloqueado: João é alérgico a Dipirona.');flashAlergia();return;}APP.presc.push(f.n);go('atend-prontuario');toast('Adicionado à prescrição.');}
function removePresc(i){APP.presc.splice(i,1);go('atend-prontuario');}
function flashAlergia(){var c=document.getElementById('chip-alergia');if(c){c.classList.remove('flash');void c.offsetWidth;c.classList.add('flash');}}
function abaExames(){return `<div class="card"><div class="sec-tit">Exames</div>
   <div class="atalhos" style="margin-bottom:12px">${['Hemograma','Raio-X tórax','Glicemia','Urina'].map(e=>`<button class="atalho" onclick="toast('${e} adicionado ao pedido.')">+ ${e}</button>`).join('')}</div>
   <div class="sec-tit">Resultados anteriores</div>
   <div class="lista-med"><div class="med-item"><span>Raio-X tórax · 02/02 · sem alterações</span><button class="btn btn-ghost btn-sm" onclick="toast('Laudo aberto (demo).')">Ver laudo</button></div><div class="med-item"><span>Hemograma · 15/01 · normal</span><button class="btn btn-ghost btn-sm" onclick="toast('Laudo aberto (demo).')">Ver laudo</button></div></div>
   <div style="margin-top:12px;padding:11px;border-radius:11px;background:var(--ambar-bg);color:var(--ambar);font-size:13px">Família sem transporte para exame externo? <b style="cursor:pointer" onclick="abrirPonte()">Acionar Serviço Social →</b></div></div>`;}
function abaHistorico(){return `<div class="card"><div class="sec-tit">Histórico de atendimentos · linha da vida</div>
   <div class="atalhos" style="margin-bottom:12px"><button class="atalho">Todas</button><button class="atalho">Clínico</button><button class="atalho">Odonto</button><button class="atalho">Nutrição</button></div>
   <ul class="tl">${MED.linhaVida.map(e=>`<li style="border-left-color:${e.cor}"><div class="tx"><b style="color:var(--tinta)">${e.d}</b> · ${e.t} <button class="btn btn-ghost btn-sm" style="margin-left:8px;padding:3px 9px" onclick="toast('Atendimento de ${e.d} aberto em leitura.')">abrir</button></div><div class="wn">${e.prof}</div></li>`).join('')}</ul>
   <div style="margin-top:10px;padding:11px;border-radius:11px;background:var(--unidade-suave);color:var(--unidade-escuro);font-size:13px;display:flex;justify-content:space-between;align-items:center;gap:10px"><span>Continuidade: retorno pedido em 12/03 → cumprido hoje · peso 24→26 kg.</span><button class="btn btn-ghost btn-sm" onclick="toast('Comparativo: peso +2 kg; sibilos leves estáveis.')">Comparar com hoje</button></div></div>`;}
function renderAba(id){
 if(id==='resumo')return abaResumo();
 if(id==='odontograma')return odontograma();
 if(id==='plano')return abaPlano();
 if(id==='evolucao')return abaEvolucao();
 if(id==='prescricao')return abaPrescricao();
 if(id==='exames')return abaExames();
 if(id==='historico')return abaHistorico();
 return '';
}
function rodapeAcao(){return `<div class="rodape" style="margin-top:16px;border:1px solid var(--linha)"><button class="btn-ponte" onclick="abrirPonte()"><svg viewBox="0 0 24 24" width="17">${IC.flag}</svg> Ponte da Corte → Serviço Social</button><button class="btn-pausar" onclick="toast('Atendimento pausado.')">Pausar</button><button class="btn btn-primary" onclick="finalizarAtend()"><svg viewBox="0 0 24 18" width="15">${IC.check}</svg> Finalizar (selar)</button></div>`;}
function renderProntuario(){
 if(!APP.prontAba)APP.prontAba=isOdonto()?'odontograma':'resumo';
 const abas=isOdonto()?[['resumo','Resumo'],['odontograma','Odontograma'],['plano','Plano'],['historico','Histórico']]:[['resumo','Resumo'],['evolucao','Evolução'],['prescricao','Prescrição'],['exames','Exames'],['historico','Histórico']];
 const prof=isOdonto()?'Dra. Beatriz Nunes':'Dr. Marcos Lima',sala=isOdonto()?'3':'2',back=isOdonto()?'odonto-prancha':'atend-prancha';
 return `<div style="padding:16px 20px;background:linear-gradient(120deg,var(--unidade),var(--unidade-escuro));color:#fff;display:flex;align-items:center;gap:14px">
   <button class="btn btn-ghost btn-sm" onclick="go('${back}')" style="color:#fff;border-color:rgba(255,255,255,.4);background:rgba(255,255,255,.12)">‹ Agenda</button>
   <div style="flex:1"><div style="font-weight:600;letter-spacing:.1em;text-transform:uppercase;font-size:14px">Prontuário · João Silva</div><div style="font-size:11px;opacity:.85">${prof} · Sala ${sala}</div></div>
   <span style="font-size:12px;opacity:.95">Progresso ${APP.consultaProg||10}%</span></div>
 <div style="padding:18px 20px">${passaporte()}<div class="abas">${abas.map(([id,l])=>`<button class="${APP.prontAba===id?'on':''}" onclick="setAba('${id}')">${l}</button>`).join('')}</div><div>${renderAba(APP.prontAba)}</div>${rodapeAcao()}</div>`;
}
function setAba(id){APP.prontAba=id;go('atend-prontuario');}
function finalizarAtend(){if(isOdonto()){APP.joaoAtendido=true;toast('Atendimento odonto selado — alta simples ("1 restauração · retorno em 30 dias") enviada ao app da Sandra.');go('odonto-prancha');return;}atenderJoao();}
VIEWS['atend-prontuario']=renderProntuario;

VIEWS['odonto-prancha']=()=>`<div style="padding:18px 22px;background:linear-gradient(120deg,var(--unidade),var(--unidade-escuro));color:#fff;display:flex;align-items:center;gap:14px"><span class="medalhao" style="width:40px;height:40px"><span class="leao" style="width:28px;height:28px">${LEAO}</span></span><div style="flex:1"><div style="font-weight:600;letter-spacing:.12em;text-transform:uppercase;font-size:14px">Agenda Odontológica</div><div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;opacity:.85">Dra. Beatriz Nunes · Sala 3</div></div><button class="btn btn-ghost btn-sm" onclick="trocarPerfil()" style="color:#fff;border-color:rgba(255,255,255,.4);background:rgba(255,255,255,.12)">↩ Trocar perfil</button></div>
 <div style="padding:22px">${MED.agendaOdonto.map(a=>`<div class="card" style="display:flex;align-items:center;gap:14px;margin-bottom:10px">${crest(a.ini,46)}<div style="flex:1"><div class="mn" style="font-weight:600;color:var(--tinta)">${a.h} · ${a.b}</div><div class="mv">Sala ${a.sala} · odontologia</div></div>${a.st==='atendido'?'<span class="pill pill-ok">atendido</span>':`<span class="pill pill-wait">${a.st}</span>`}</div>`).join('')}
   <div class="card" style="display:flex;align-items:center;gap:14px;border:2px solid var(--unidade)">${crest('JS',46)}<div style="flex:1"><div class="mn" style="font-weight:600;color:var(--tinta)">14:00 · João Silva (8 anos)</div><div class="mv">Encaminhado · dentição mista · ${APP.joaoAtendido?'atendido':'aguardando'}</div></div><button class="btn btn-primary btn-sm" onclick="APP.prontAba='odontograma';go('atend-prontuario')">Abrir odontograma</button></div></div>`;

function filaCol(k){return APP.filaBoard[k].map(p=>`<div class="fila-card ${p.joao?'click':''}" ${p.joao?'onclick="irTriagem()"':''}><div class="t">${p.n}</div><div class="w">${p.w}</div></div>`).join('');}
function irTriagem(){go('recep-triagem');}
VIEWS['recep-fila']=()=>`<div style="padding:18px 22px;background:linear-gradient(120deg,var(--unidade),var(--unidade-escuro));color:#fff;display:flex;align-items:center;gap:14px"><span class="medalhao" style="width:40px;height:40px"><span class="leao" style="width:28px;height:28px">${LEAO}</span></span><div style="flex:1"><div style="font-weight:600;letter-spacing:.12em;text-transform:uppercase;font-size:14px">Recepção · Fila em tempo real</div><div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;opacity:.85">Enf. Cláudia Rocha · acolhimento</div></div><button class="btn btn-ghost btn-sm" onclick="trocarPerfil()" style="color:#fff;border-color:rgba(255,255,255,.4);background:rgba(255,255,255,.12)">↩ Trocar perfil</button></div>
 <div style="padding:22px"><div class="filaboard">
   <div class="fila-col"><h4>Chegou <b>${APP.filaBoard.chegou.length}</b></h4>${filaCol('chegou')}</div>
   <div class="fila-col"><h4>Triagem <b>${APP.filaBoard.triagem.length}</b></h4>${filaCol('triagem')}</div>
   <div class="fila-col"><h4>Aguardando <b>${APP.filaBoard.aguardando.length}</b></h4>${filaCol('aguardando')}</div>
   <div class="fila-col"><h4>Em atendimento <b>${APP.filaBoard.atend.length}</b></h4>${filaCol('atend')}</div></div>
   <div class="desc" style="margin-top:12px">Toque no card do <b>João Silva</b> (Chegou) para fazer a triagem · maior espera 22 min · sincronizado com o painel da Raquel.</div></div>`;
VIEWS['recep-triagem']=()=>`<div style="padding:18px 22px;background:linear-gradient(120deg,var(--unidade),var(--unidade-escuro));color:#fff;display:flex;align-items:center;gap:14px"><button class="btn btn-ghost btn-sm" onclick="go('recep-fila')" style="color:#fff;border-color:rgba(255,255,255,.4);background:rgba(255,255,255,.12)">‹ Fila</button><div style="flex:1"><div style="font-weight:600;letter-spacing:.1em;text-transform:uppercase;font-size:14px">Triagem de Enfermagem</div><div style="font-size:11px;opacity:.85">Enf. Cláudia Rocha</div></div></div>
 <div style="padding:22px"><div class="card" style="display:flex;gap:16px;align-items:center;margin-bottom:14px">${crest('JS',56)}<div style="flex:1"><div style="font-size:17px;color:var(--tinta);font-weight:600">João Silva · 8 anos</div><div class="desc">Família Silva · ${coroaSeal('APROVADO')} · encaminhar p/ Dr. Marcos (Sala 2)</div></div></div>
   <div class="card" style="margin-bottom:14px"><div class="sec-tit">Motivo da vinda</div><textarea rows="2" style="width:100%;font-family:inherit;font-size:14px;border:1px solid var(--linha);border-radius:12px;padding:12px;background:var(--papel)">Tosse seca há 3 dias, piora à noite.</textarea></div>
   <div class="card" style="margin-bottom:14px"><div class="sec-tit">Sinais vitais</div><div class="grid g3">${[['Temperatura','37,8°C'],['FC','96 bpm'],['SatO₂','97%'],['Peso','26 kg'],['Altura','1,28 m'],['PA','95/60']].map(([k,v])=>`<div class="vital"><div style="font-size:18px;color:var(--tinta);font-weight:600">${v}</div><div style="font-size:10px;text-transform:uppercase;opacity:.7">${k}</div></div>`).join('')}</div></div>
   <div class="card"><div class="sec-tit">Classificação de prioridade (acolhimento)</div><div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:6px">${[['#1a7a4a','Verde · pode aguardar'],['#C24D0F','Amarelo · atenção hoje'],['#B3261E','Vermelho · agora']].map(([c,l])=>`<button class="toggle-chip" style="border-color:${c};color:${c}" onclick="document.querySelectorAll('.prio-b').forEach(x=>x.style.background='');this.style.background='${c}22'">${l}</button>`).join('').replace(/toggle-chip/g,'toggle-chip prio-b')}</div></div>
   <div class="acoes" style="margin-top:16px"><button class="btn btn-ghost" onclick="go('recep-fila')">‹ Voltar</button><button class="btn btn-primary" onclick="salvarTriagem()">Salvar e encaminhar ao Dr. Marcos</button></div></div>`;
function salvarTriagem(){toast('Triagem salva · sinais vitais enviados ao prontuário do Dr. Marcos (aparecem no Resumo, com seu selo). João encaminhado à Sala 2.');go('recep-fila');}

VIEWS['medico-indicadores']=()=>`<div class="page-h"><div><h2>Indicadores da Unidade</h2><div class="desc">Saúde populacional da comunidade atendida · Centro Médico</div></div></div>
 <div class="grid g4" style="margin-bottom:16px">${[['Atendimentos/mês','1.180'],['No-show','8%'],['Mutirão odonto','96 fam.'],['Cadeiras odonto','3']].map(([l,v])=>`<div class="card kpi"><span class="k-label">${l}</span><div class="k-val" style="margin-top:6px">${v}</div></div>`).join('')}</div>
 <div class="grid g-50"><div class="card"><div class="sec-tit">Saúde da comunidade</div>${DATA.saude.map(([l,v])=>`<div style="margin:11px 0"><div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:5px"><span>${l}</span><b style="color:var(--tinta)">${v}%</b></div><div style="height:9px;background:var(--papel);border-radius:999px;overflow:hidden"><div style="height:100%;width:${v}%;background:var(--unidade);border-radius:999px"></div></div></div>`).join('')}</div>
   <div class="card"><div class="sec-tit">Busca ativa de faltosos</div><div class="lista-med">${['Família Pereira · retorno cardio vencido','Família Oliveira · vacina pendente','João Silva · retorno asma'].map(f=>`<div class="med-item"><span>${f}</span><button class="btn btn-ghost btn-sm" onclick="toast('Reconvocação enviada por WhatsApp.')">Reconvocar</button></div>`).join('')}</div></div></div>`;

/* ============================================================
   MÓDULO CENTRO DE CAPACITAÇÃO (laranja) — catálogo, turmas, trilha,
   matrículas, BANCO DE MODELOS, chamada (Rafael tablet), certificados, indicadores
   ============================================================ */
const CAP={
 kpi:{cursos:12,turmas:18,alunos:540,vagas:620,ocup:87,cert:137,evasao:6,freq:84,fila:12,destino:64},
 cursos:[
  {n:'Corte e Costura',mod:'PRÁTICO',ch:'80h',turmas:2,ocup:90,modelos:false},
  {n:'Informática Básica',mod:'TEÓRICO',ch:'60h',turmas:1,ocup:80,modelos:false},
  {n:'Padaria & Confeitaria',mod:'PRÁTICO',ch:'100h',turmas:1,ocup:85,modelos:false},
  {n:'Barbeiro',mod:'PRÁTICO',ch:'120h',turmas:1,ocup:71,modelos:true},
  {n:'Cabeleireira',mod:'PRÁTICO',ch:'120h',turmas:1,ocup:82,modelos:true},
  {n:'Manicure & Design de Unhas',mod:'PRÁTICO',ch:'60h',turmas:1,ocup:79,modelos:true},
  {n:'Massagem / Massoterapia',mod:'PRÁTICO',ch:'90h',turmas:1,ocup:74,modelos:true},
  {n:'Maquiagem',mod:'PRÁTICO',ch:'40h',turmas:1,ocup:70,modelos:true},
  {n:'Design Gráfico',mod:'TEÓRICO',ch:'80h',turmas:1,ocup:66,modelos:false},
 ],
 turmas:[
  {cod:'CC-2026-1',curso:'Corte e Costura',dias:'Ter/Qui',hora:'09h–11h',sala:'Ateliê 2',inst:'Profa. Marlene Dias',vagas:18,total:20,freq:88,evasao:5,saude:'SAUDÁVEL',trilha:58},
  {cod:'INF-2026-1',curso:'Informática Básica',dias:'Seg/Qua',hora:'14h',sala:'Lab Informática',inst:'Prof. Edson Prado',vagas:16,total:20,freq:90,evasao:4,saude:'SAUDÁVEL',trilha:40},
  {cod:'BB-2026-1',curso:'Barbeiro',dias:'Seg/Qua/Sex',hora:'18h',sala:'Salão-Escola',inst:'Prof. Rafael Dias',vagas:14,total:16,freq:71,evasao:19,saude:'ATENÇÃO',trilha:45},
  {cod:'CB-2026-1',curso:'Cabeleireira',dias:'Ter/Qui',hora:'14h',sala:'Salão-Escola',inst:'Profa. Sônia Camargo',vagas:15,total:16,freq:82,evasao:9,saude:'SAUDÁVEL',trilha:35},
  {cod:'MN-2026-1',curso:'Manicure & Design',dias:'Qua',hora:'15h',sala:'Salão-Escola',inst:'Profa. Sônia Camargo',vagas:13,total:16,freq:79,evasao:12,saude:'ATENÇÃO',trilha:30},
 ],
 alunosBB:[
  {nome:'Marcos Pereira',ini:'MP',fam:'Pereira',freq:84},
  {nome:'Diego Costa',ini:'DC',fam:'Costa',freq:52,risco:true},
  {nome:'Tiago Alves',ini:'TA',fam:'Alves',freq:90},
  {nome:'Bruno Mendes',ini:'BM',fam:'Mendes',freq:61,risco:true},
  {nome:'Wesley Lima',ini:'WL',fam:'Lima',freq:77},
  {nome:'Igor Santos',ini:'IS',fam:'Santos',freq:88},
 ],
 trilhaBarbeiro:[['Higiene & paramentação','8h','done'],['Máquinas e pentes','12h','done'],['Cortes masculinos','40h','current'],['Barba & navalha','24h','todo'],['Acabamento','20h','todo'],['Projeto final','16h','todo']],
 fila:[{fam:'Oliveira',p:'IFP-2026-000401',curso:'Informática Básica',desde:'há 6 dias'},{fam:'Pereira',p:'IFP-2026-000433',curso:'Corte e Costura',desde:'há 4 dias'},{fam:'Mendes',p:'IFP-2026-000440',curso:'Barbeiro',desde:'há 2 dias'}],
 matriculas:[{p:'IFP-2026-000412',aprendiz:'Maria Silva',curso:'Corte e Costura',vaga:'CC-2026-1',status:'CONFIRMADA'},{p:'IFP-2026-000440',aprendiz:'Família Mendes · membro',curso:'Barbeiro',vaga:'BB-2026-1',status:'AGUARDANDO'},{p:'IFP-2026-000401',aprendiz:'membro Oliveira',curso:'Informática',vaga:'lista de espera',status:'ESPERA'}],
 servicos:['Corte masculino','Barba','Corte feminino','Escova','Manicure','Massagem relaxante','Maquiagem social'],
};
APP.modelos=[
 {id:'m1',nome:'Antônio Ferreira',ini:'AF',idade:58,bairro:'Vila Nova',prefs:['Corte masculino','Barba'],termo:true,status:'ATIVO',sessoes:3},
 {id:'m2',nome:'Dona Cleusa Martins',ini:'CM',idade:64,bairro:'Centro',prefs:['Corte feminino','Escova'],termo:true,status:'ATIVO',sessoes:5},
 {id:'m3',nome:'Pedro Henrique',ini:'PH',idade:23,bairro:'Vila Nova',prefs:['Corte masculino'],termo:false,status:'PENDENTE TERMO',sessoes:0},
 {id:'m4',nome:'Rita Souza',ini:'RS',idade:39,bairro:'Jardim',prefs:['Manicure','Maquiagem social'],termo:true,status:'ATIVO',sessoes:2},
 {id:'m5',nome:'Sebastião Lopes',ini:'SL',idade:71,bairro:'Centro',prefs:['Massagem relaxante'],termo:true,status:'ATIVO',sessoes:1},
];
APP.sessoes=[
 {id:'s1',hora:'18:30',curso:'Barbeiro',turma:'BB-2026-1',servico:'Corte masculino',aluno:{nome:'Marcos Pereira',ini:'MP'},modelo:'m1',status:'CONFIRMADA'},
 {id:'s2',hora:'19:10',curso:'Barbeiro',turma:'BB-2026-1',servico:'Barba',aluno:{nome:'Diego Costa',ini:'DC'},modelo:null,status:'BUSCANDO MODELO'},
 {id:'s3',hora:'18:30',curso:'Cabeleireira',turma:'CB-2026-1',servico:'Corte feminino',aluno:{nome:'Joana Alves',ini:'JA'},modelo:'m2',status:'A CONFIRMAR'},
 {id:'s4',hora:'15:00',curso:'Manicure & Design',turma:'MN-2026-1',servico:'Manicure',aluno:{nome:'Bruna Lima',ini:'BL'},modelo:'m4',status:'CONFIRMADA'},
];
APP.capChamada={};
function saudeCor(s){return {'SAUDÁVEL':['#1a7a4a','rgba(26,122,74,.12)'],'ATENÇÃO':['#C24D0F','#FCE9DD'],'RISCO':['#B3261E','#FCEDEC']}[s]||['#9a8f84','#f0ebe4'];}
function sessStatusCor(s){return {'CONFIRMADA':['#1a7a4a','rgba(26,122,74,.12)'],'A CONFIRMAR':['#C24D0F','#FCE9DD'],'BUSCANDO MODELO':['#FF772E','#FCE9DD'],'CONCLUÍDA':['#9a6b14','rgba(201,150,47,.2)'],'FALTOU MODELO':['#B3261E','#FCEDEC']}[s]||['#9a8f84','#f0ebe4'];}
function modeloById(id){return APP.modelos.find(m=>m.id===id);}
function abrirTurma(cod){CAP.turmaAtual=cod;APP.turmaAba='alunos';go('cap-turma');}
function abrirCurso(n){CAP.cursoAtual=n;APP.cursoAba='trilha';go('cap-curso');}

VIEWS['cap-painel']=()=>{
 const k=CAP.kpi, ord={'RISCO':0,'ATENÇÃO':1,'SAUDÁVEL':2};
 return `<div class="page-h"><div><h2>Centro de Capacitação</h2><div class="desc">Ano letivo 2026 · turmas ativas e saúde das turmas num olhar</div></div><button class="btn btn-gold" onclick="toast('Abrir nova turma (wizard) — demo.')">+ Abrir nova turma</button></div>
 <div class="card" style="margin-bottom:16px;display:flex;align-items:center;gap:26px;background:linear-gradient(120deg,#fff,var(--papel))">${jubaRing(k.ocup,92,'var(--dourado)')}<div style="flex:1"><div style="font-size:21px;color:var(--tinta);font-weight:500">O Centro abriu <b style="font-weight:700">540 vagas gratuitas</b> em 12 cursos este semestre.</div><div class="desc">fila de interesse: ${k.fila} famílias · evasão média ${k.evasao}% · frequência média ${k.freq}%</div></div></div>
 <div class="grid g4" style="margin-bottom:16px">${[['Cursos ativos',k.cursos],['Turmas em andamento',k.turmas],['Alunos matriculados',k.alunos],['Certificados no semestre',k.cert]].map(([l,v])=>`<div class="card kpi"><span class="k-label">${l}</span><div class="k-val" style="margin-top:6px">${v}</div></div>`).join('')}</div>
 <div class="grid g-60-40" style="margin-bottom:16px">
   <div class="card"><div class="sec-tit">${icon('grid',16)} Saúde das turmas</div><div class="grid g2">${[...CAP.turmas].sort((a,b)=>ord[a.saude]-ord[b.saude]).map(t=>{const[c,bg]=saudeCor(t.saude);return `<div class="card pulso" style="--u:var(--unidade);box-shadow:none;cursor:pointer" onclick="abrirTurma('${t.cod}')">${jubaRing(t.freq,54)}<div class="pinfo"><div class="pn">${t.curso}</div><div class="pm">${t.cod} · ${t.vagas}/${t.total} vagas · evasão ${t.evasao}%</div><span class="pstatus" style="background:${bg};color:${c}">${t.saude}</span></div></div>`;}).join('')}</div></div>
   <div class="card"><div class="sec-tit">${icon('chart',16)} Trilha do ano letivo</div>${[['Matrículas',540],['Em curso',488],['Conclusão & certificado',137]].map((s,i)=>`<div style="display:flex;align-items:center;gap:12px;padding:13px 0;border-bottom:1px solid var(--linha)"><span style="width:30px;height:30px;border-radius:50%;background:var(--unidade);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:600">${i+1}</span><div style="flex:1"><b style="color:var(--tinta)">${s[0]}</b></div><b style="color:var(--tinta);font-size:18px">${s[1]}</b></div>`).join('')}</div>
 </div>
 <div class="grid g-50"><div class="card"><div class="sec-tit">${icon('users',16)} Fila de interesse</div>${CAP.fila.map(f=>`<div class="med-item"><span><b style="color:var(--tinta)">Família ${f.fam}</b> · ${f.curso} · ${f.desde}</span><button class="btn btn-ghost btn-sm" onclick="go('cap-matriculas')">Alocar</button></div>`).join('')}</div>
   <div class="card"><div class="sec-tit">${icon('list',16)} Atividade recente</div><ul class="tl">${['Turma de Costura Industrial formou 28 alunas','Prof. Rafael confirmou 6 sessões práticas de barbeiro','3 novas famílias na fila de interesse'].map(a=>`<li><div class="tx">${a}</div></li>`).join('')}</ul></div></div>`;
};
VIEWS['cap-catalogo']=()=>`<div class="page-h"><div><h2>Catálogo de Cursos</h2><div class="desc">Cursos profissionalizantes gratuitos · 2026</div></div></div>
 <div class="atalhos" style="margin-bottom:14px"><button class="atalho">Todos</button><button class="atalho">Práticos</button><button class="atalho">Teóricos</button><button class="atalho">Com modelos</button></div>
 <div class="grid g3">${CAP.cursos.map(c=>`<div class="card" style="border-left:4px solid var(--unidade);cursor:pointer" onclick="abrirCurso('${c.n}')"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px"><div class="titulo" style="font-size:13px;line-height:1.3">${c.n}</div>${jubaRing(c.ocup,46)}</div><div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap"><span class="pill ${c.mod==='PRÁTICO'?'pill-info':'pill-neu'}">${c.mod}</span><span class="pill pill-neu">${c.ch}</span>${c.modelos?'<span class="pill" style="background:#FCE9DD;color:#C24D0F">🪑 modelos</span>':''}</div><div class="desc" style="margin-top:8px">${c.turmas} turma(s) · ${c.ocup}% ocupação</div></div>`).join('')}</div>`;
VIEWS['cap-curso']=()=>{
 APP.cursoAba=APP.cursoAba||'trilha'; const nome=CAP.cursoAtual||'Barbeiro';
 const abas=[['geral','Visão Geral'],['trilha','Ementa & Trilha'],['turmas','Turmas']];
 return `<div class="page-h"><div><h2>${nome}</h2><div class="desc">Curso gratuito · materiais fornecidos pelo Instituto</div></div><button class="btn btn-gold" onclick="toast('Abrir turma deste curso — demo.')">+ Abrir turma</button></div>
   <div class="abas">${abas.map(([id,l])=>`<button class="${APP.cursoAba===id?'on':''}" onclick="APP.cursoAba='${id}';go('cap-curso')">${l}</button>`).join('')}</div><div>${cursoAbaConteudo(APP.cursoAba,nome)}</div>`;
};
function cursoAbaConteudo(aba,nome){
 if(aba==='trilha')return trilhaVisual();
 if(aba==='turmas')return `<div class="card" style="padding:6px"><table class="tb"><thead><tr><th>Turma</th><th>Dias</th><th>Sala</th><th>Instrutor</th><th>Vagas</th><th></th></tr></thead><tbody>${CAP.turmas.filter(t=>nome.toLowerCase().includes(t.curso.toLowerCase().split(' ')[0])).map(t=>`<tr><td><b>${t.cod}</b></td><td>${t.dias} ${t.hora}</td><td>${t.sala}</td><td>${t.inst}</td><td>${t.vagas}/${t.total}</td><td><button class="btn btn-ghost btn-sm" onclick="abrirTurma('${t.cod}')">Abrir</button></td></tr>`).join('')||'<tr><td colspan=6 class="desc">Sem turmas para este filtro.</td></tr>'}</tbody></table></div>`;
 return `<div class="card"><div class="sec-tit">Sobre o curso</div><p style="font-size:14px;line-height:1.6">Curso profissionalizante gratuito, aberto a qualquer membro de família ativa (Ficha Cidadã). Materiais fornecidos pelo Instituto. Ao concluir com frequência mínima, o aluno recebe certificado com QR e entra no Banco de Talentos para encaminhamento ao mercado.</p></div>`;
}
function trilhaVisual(){
 const m=CAP.trilhaBarbeiro;
 return `<div class="card"><div class="sec-tit">Trilha do curso · estilo metrô</div><div style="display:flex;align-items:flex-start;overflow-x:auto;padding:14px 4px">${m.map((mod,i)=>{const st=mod[2],cor=st==='todo'?'#d8cfc6':'var(--unidade)';return `<div style="display:flex;align-items:center">${i>0?`<div style="height:3px;width:34px;background:${m[i-1][2]!=='todo'?'var(--unidade)':'#d8cfc6'};margin-top:15px"></div>`:''}<div style="display:flex;flex-direction:column;align-items:center;width:118px;flex:0 0 auto"><div style="width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:12px;border:2px solid ${cor};background:${st==='done'?'var(--unidade)':'#fff'};color:${st==='done'?'#fff':st==='current'?'var(--unidade)':'#b3a89d'};${st==='current'?'box-shadow:0 0 0 4px var(--unidade-suave)':''}">${st==='done'?'✓':i+1}</div><div style="font-size:9.5px;text-align:center;margin-top:8px;color:${st==='todo'?'#b3a89d':'var(--tinta)'};font-weight:600;text-transform:uppercase;letter-spacing:.03em;line-height:1.2">${mod[0]}</div><div style="font-size:10px;color:#9a8f84">${mod[1]}</div></div></div>`;}).join('')}</div><div class="desc" style="margin-top:6px">Módulo atual: <b style="color:var(--tinta)">Cortes masculinos</b> · demanda <b>4 sessões com modelo</b> (Banco de Modelos).</div></div>`;
}
VIEWS['cap-turmas']=()=>`<div class="page-h"><div><h2>Turmas</h2><div class="desc">Todas as turmas ativas · 2026</div></div><button class="btn btn-gold" onclick="toast('Abrir nova turma — demo.')">+ Abrir nova turma</button></div>
 <div class="card" style="padding:6px"><table class="tb"><thead><tr><th>Turma</th><th>Curso</th><th>Horário</th><th>Instrutor</th><th>Vagas</th><th>Saúde</th><th></th></tr></thead><tbody>${CAP.turmas.map(t=>{const[c,bg]=saudeCor(t.saude);return `<tr><td><b>${t.cod}</b></td><td>${t.curso}</td><td>${t.dias} ${t.hora}</td><td>${t.inst}</td><td>${t.vagas}/${t.total}</td><td><span class="pill" style="background:${bg};color:${c}">${t.saude}</span></td><td><button class="btn btn-ghost btn-sm" onclick="abrirTurma('${t.cod}')">Abrir</button></td></tr>`;}).join('')}</tbody></table></div>`;
VIEWS['cap-turma']=()=>{
 APP.turmaAba=APP.turmaAba||'alunos';
 const t=CAP.turmas.find(x=>x.cod===CAP.turmaAtual)||CAP.turmas[2];
 const[c,bg]=saudeCor(t.saude); const abas=[['alunos','Alunos'],['freq','Frequência'],['risco','Evasão & Risco']];
 return `<div class="page-h"><div><h2>${t.cod} · ${t.curso}</h2><div class="desc">${t.dias} ${t.hora} · ${t.sala} · ${t.inst}</div></div></div>
   <div class="card" style="display:flex;align-items:center;gap:18px;margin-bottom:14px">${jubaRing(Math.round(t.vagas/t.total*100),72)}<div style="flex:1"><div class="pn" style="font-size:15px;color:var(--tinta);font-weight:600">${t.vagas}/${t.total} vagas · frequência ${t.freq}% · evasão ${t.evasao}%</div><span class="pill" style="background:${bg};color:${c};display:inline-block;margin-top:8px">${t.saude}</span></div><button class="btn btn-ghost btn-sm" onclick="toast('Abre o diário/chamada (perfil do instrutor Rafael).')">Diário / Chamada</button></div>
   <div class="abas">${abas.map(([id,l])=>`<button class="${APP.turmaAba===id?'on':''}" onclick="APP.turmaAba='${id}';go('cap-turma')">${l}</button>`).join('')}</div><div>${turmaAbaConteudo(APP.turmaAba)}</div>`;
};
function turmaAbaConteudo(aba){
 const al=CAP.alunosBB;
 if(aba==='alunos')return `<div class="card">${al.map(a=>`<div class="membro">${crest(a.ini,42)}<div style="flex:1"><div class="mn">${a.nome}</div><div class="mv">Família ${a.fam} · frequência ${a.freq}%</div></div>${a.risco?'<span class="pill" style="background:#FCEDEC;color:#B3261E">risco</span>':jubaRing(a.freq,40)}</div>`).join('')}</div>`;
 if(aba==='freq')return heatmapFreq(al);
 return `<div class="card"><div class="sec-tit">Alunos em risco de evasão</div>${al.filter(a=>a.risco).map(a=>`<div class="card" style="display:flex;align-items:center;gap:14px;margin-bottom:10px;border-left:4px solid var(--erro)">${crest(a.ini,46)}<div style="flex:1"><div class="mn" style="font-weight:600;color:var(--tinta)">${a.nome}</div><div class="mv">Família ${a.fam} · frequência <b style="color:var(--erro)">${a.freq}%</b> · 3 faltas seguidas</div></div><button class="btn btn-primary btn-sm" onclick="ponteEvasao('${a.nome}','${a.fam}')">Abrir Ponte da Corte</button></div>`).join('')}<div class="desc">A Ponte da Corte devolve o caso ao Serviço Social — evasão costuma ter raiz social (transporte, trabalho, cuidado dos filhos).</div></div>`;
}
function heatmapFreq(al){
 const aulas=8;
 return `<div class="card"><div class="sec-tit">Mapa de presença · últimas ${aulas} aulas</div><div style="overflow-x:auto"><table class="tb" style="font-size:11px"><thead><tr><th>Aluno</th>${Array.from({length:aulas},(_,i)=>`<th>${i+1}</th>`).join('')}<th>%</th></tr></thead><tbody>${al.map(a=>{const cells=Array.from({length:aulas},(_,i)=>{const pres=((a.freq+i*9)%100)>40;return `<td style="text-align:center"><span style="display:inline-block;width:15px;height:15px;border-radius:4px;background:${pres?'var(--unidade)':'#FCEDEC'}"></span></td>`;}).join('');return `<tr><td>${a.nome}</td>${cells}<td><b style="color:${a.risco?'var(--erro)':'var(--tinta)'}">${a.freq}%</b></td></tr>`;}).join('')}</tbody></table></div><div class="desc" style="margin-top:8px"><span style="display:inline-block;width:11px;height:11px;border-radius:3px;background:var(--unidade);vertical-align:middle"></span> presente &nbsp; <span style="display:inline-block;width:11px;height:11px;border-radius:3px;background:#FCEDEC;vertical-align:middle"></span> falta</div></div>`;
}
function ponteEvasao(nome,fam){DATA.ponte.unshift({de:'Tânia Moraes · Capacitação',sobre:nome+' — frequência baixa em Barbeiro, avaliar contexto da Família '+fam,q:'agora'});toast('Sinalização enviada ao Serviço Social — risco de evasão de '+nome+'. (Aparece para a Joana.)');}
VIEWS['cap-matriculas']=()=>`<div class="page-h"><div><h2>Matrículas</h2><div class="desc">Ligadas à Ficha Cidadã · sem redigitação</div></div><button class="btn btn-primary" onclick="toast('Nova matrícula (wizard de 4 passos) — demo.')">+ Nova matrícula</button></div>
 <div class="card" style="padding:6px"><table class="tb"><thead><tr><th>Protocolo</th><th>Aprendiz</th><th>Curso</th><th>Vaga</th><th>Status</th><th></th></tr></thead><tbody>${CAP.matriculas.map(m=>{const st={'CONFIRMADA':['#1a7a4a','rgba(26,122,74,.12)'],'AGUARDANDO':['#C24D0F','#FCE9DD'],'ESPERA':['#9a8f84','#f0ebe4']}[m.status];return `<tr><td><b style="color:var(--tinta)">${m.p}</b></td><td>${m.aprendiz}</td><td>${m.curso}</td><td>${m.vaga}</td><td><span class="pill" style="background:${st[1]};color:${st[0]}">${m.status}</span></td><td>${m.status==='AGUARDANDO'?`<button class="btn btn-primary btn-sm" onclick="toast('Matrícula confirmada · WhatsApp enviado à família.')">Confirmar</button>`:''}</td></tr>`;}).join('')}</tbody></table></div>`;
VIEWS['cap-certificados']=()=>`<div class="page-h"><div><h2>Certificados</h2><div class="desc">Com QR de verificação · identidade do Instituto</div></div><button class="btn btn-gold" onclick="previewCert()">Pré-visualizar certificado</button></div>
 <div class="card" style="margin-bottom:14px;background:var(--unidade-suave);border:0;color:var(--unidade-escuro)"><b>137 certificados emitidos neste semestre.</b> Destaque: Turma de Costura Industrial — 28 alunas formadas.</div>
 <div class="card" style="padding:6px"><table class="tb"><thead><tr><th>Turma</th><th>Concluintes</th><th>Carga</th><th></th></tr></thead><tbody>${[['Costura Industrial — 2025/2','28','80h'],['Informática Básica — 2025/2','22','60h'],['Padaria — 2025/2','14','100h']].map(r=>`<tr><td><b>${r[0]}</b></td><td>${r[1]}</td><td>${r[2]}</td><td><button class="btn btn-ghost btn-sm" onclick="toast('Lote emitido — certificados no PWA das famílias.')">Emitir lote</button></td></tr>`).join('')}</tbody></table></div>`;
function previewCert(){openModal(`<div class="relatorio"><div class="selo">${LEAO}</div><h3>Certificado</h3><div style="letter-spacing:.14em;text-transform:uppercase;font-size:12px;color:var(--dourado);font-weight:600;margin-bottom:16px">Centro de Capacitação · IFP</div><p style="color:var(--corpo);font-size:14px;line-height:1.6;max-width:360px;margin:0 auto 18px">Certificamos que <b>Maria Silva</b> concluiu o curso de <b>Corte e Costura</b> (80h) no Instituto Família Pôncio.</p><div style="display:flex;gap:12px;justify-content:center;align-items:center"><div style="width:60px;height:60px;background:#fff;border:1px solid var(--linha);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:9px;color:#9a8f84">QR</div><button class="btn btn-ghost" onclick="closeModal()">Fechar</button></div></div>`);}
VIEWS['cap-indicadores']=()=>{const k=CAP.kpi;return `<div class="page-h"><div><h2>Indicadores & Impacto</h2><div class="desc">Centro de Capacitação · semestre 1/2026</div></div></div>
 <div class="grid g4" style="margin-bottom:16px">${[['Ocupação',k.ocup+'%'],['Frequência média',k.freq+'%'],['Evasão',k.evasao+'%'],['Taxa de destino',k.destino+'%']].map(([l,v])=>`<div class="card kpi"><span class="k-label">${l}</span><div class="k-val" style="margin-top:6px">${v}</div></div>`).join('')}</div>
 <div class="grid g-50"><div class="card"><div class="sec-tit">Funil capacitar → empregar</div>${[['Matrículas',540,100],['Concluintes/mês',38,42],['Certificados',31,32],['Banco de Talentos',24,25]].map(([l,v,w])=>`<div style="margin:11px 0"><div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:5px"><span>${l}</span><b style="color:var(--tinta)">${v}</b></div><div style="height:11px;background:var(--papel);border-radius:999px;overflow:hidden"><div style="height:100%;width:${w}%;background:var(--unidade);border-radius:999px"></div></div></div>`).join('')}</div>
   <div class="card"><div class="sec-tit">Ocupação por curso</div>${[['Corte e Costura',90],['Padaria',85],['Cabeleireira',82],['Informática',80],['Manicure',79],['Barbeiro',71]].map(([l,v])=>`<div style="margin:9px 0"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px"><span>${l}</span><b style="color:var(--tinta)">${v}%</b></div><div style="height:9px;background:var(--papel);border-radius:999px;overflow:hidden"><div style="height:100%;width:${v}%;background:var(--unidade);border-radius:999px"></div></div></div>`).join('')}</div></div>`;};

/* ---- BANCO DE MODELOS (cap-sessoes) ---- */
VIEWS['cap-sessoes']=()=>{
 APP.sessAba=APP.sessAba||'agenda';
 const abas=[['agenda','Agenda'],['banco','Banco de Modelos'],['termos','Termos']];
 const acaoTopo=APP.sessAba==='banco'?`<button class="btn btn-gold" onclick="cadastrarVoluntario()">+ Cadastrar voluntário</button>`:APP.sessAba==='agenda'?`<button class="btn btn-gold" onclick="toast('Agendar sessão prática — demo.')">+ Agendar sessão</button>`:'';
 return `<div class="page-h"><div><h2>Sessões Práticas</h2><div class="desc">O Banco de Modelos do Centro · a comunidade ganha cuidado gratuito, o aluno ganha prática real</div></div>${acaoTopo}</div>
   <div class="abas">${abas.map(([id,l])=>`<button class="${APP.sessAba===id?'on':''}" onclick="APP.sessAba='${id}';go('cap-sessoes')">${l}</button>`).join('')}</div><div>${sessAbaConteudo(APP.sessAba)}</div>`;
};
function sessAbaConteudo(aba){ if(aba==='banco')return bancoModelos(); if(aba==='termos')return termosModelos(); return agendaSessoes(); }
function agendaSessoes(){
 const conf=APP.sessoes.filter(s=>s.status==='CONFIRMADA').length, busc=APP.sessoes.filter(s=>s.status==='BUSCANDO MODELO').length;
 return `<div class="grid g4" style="margin-bottom:14px">${[['Sessões hoje',APP.sessoes.length],['Confirmadas',conf],['Buscando modelo',busc],['Concluídas no mês',38]].map(([l,v])=>`<div class="card kpi"><span class="k-label">${l}</span><div class="k-val" style="margin-top:6px">${v}</div></div>`).join('')}</div>
 ${APP.sessoes.map(s=>{const[c,bg]=sessStatusCor(s.status);const m=modeloById(s.modelo);return `<div class="card" style="display:flex;align-items:center;gap:14px;margin-bottom:10px;flex-wrap:wrap">
   <div style="min-width:160px"><div class="mn" style="font-weight:600;color:var(--tinta)">${s.hora} · ${s.servico}</div><div class="mv">${s.turma} · ${s.curso}</div></div>
   <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:280px">${crest(s.aluno.ini,38)}<div><div class="mv" style="font-size:9px;text-transform:uppercase;letter-spacing:.06em;opacity:.7">Aprendiz</div><div style="font-weight:600;color:var(--tinta);font-size:13px">${s.aluno.nome}</div></div><span style="color:#c9bfb4;font-size:18px">↔</span>${m?`${crest(m.ini,38)}<div><div class="mv" style="font-size:9px;text-transform:uppercase;letter-spacing:.06em;opacity:.7">Modelo voluntário</div><div style="font-weight:600;color:var(--tinta);font-size:13px">${m.nome}</div></div>`:`<button class="atalho" style="border-style:dashed;border-color:var(--unidade);color:var(--unidade-escuro)" onclick="matchModal('${s.id}')">+ Casar modelo</button>`}</div>
   <div style="text-align:right"><span class="pill" style="background:${bg};color:${c}">${s.status}</span><div style="margin-top:8px">${s.status==='A CONFIRMAR'?`<button class="btn btn-primary btn-sm" onclick="confirmarSessao('${s.id}')">Confirmar WhatsApp</button>`:s.status==='CONFIRMADA'?`<button class="btn btn-ghost btn-sm" onclick="toast('Baixa registrada — sessão concluída.')">Dar baixa</button>`:''}</div></div></div>`;}).join('')}`;
}
function matchModal(sid){
 const s=APP.sessoes.find(x=>x.id===sid);
 const key=s.servico.toLowerCase().split(' ')[0];
 const compat=APP.modelos.map(m=>{const pref=m.prefs.some(p=>p.toLowerCase().includes(key)||key.includes(p.toLowerCase().split(' ')[0]));const match=(pref?60:15)+(m.termo?30:0)+10;return {m,match,razao:`prefere ${m.prefs[0]} · ${m.termo?'termo OK':'⚠ termo pendente'} · ${m.bairro}`};}).sort((a,b)=>b.match-a.match);
 openModal(`<div class="card-foco" style="border:0;max-width:520px"><div class="topo-ogival"></div><div style="padding:20px"><div class="sec-tit">Casar modelo · ${s.servico} · ${s.aluno.nome}</div><p class="desc" style="margin-top:-4px">Match transparente: preferência + termo + disponibilidade. Sem caixa-preta.</p>
   ${compat.map(x=>`<div class="card" style="display:flex;align-items:center;gap:12px;margin-bottom:10px;box-shadow:none">${crest(x.m.ini,42)}<div style="flex:1"><div style="font-weight:600;color:var(--tinta)">${x.m.nome} <span class="pill" style="${x.m.termo?'background:rgba(26,122,74,.12);color:#1a7a4a':'background:#FCE9DD;color:#C24D0F'}">${x.m.termo?'✓ termo':'⚠ termo'}</span></div><div class="mv">${x.m.idade} anos · ${x.razao}</div></div><div style="text-align:right"><span class="pill pill-info">${x.match}% match</span><div style="margin-top:6px"><button class="btn btn-primary btn-sm" onclick="escolherModelo('${s.id}','${x.m.id}')">Escolher</button></div></div></div>`).join('')}
   <button class="btn btn-ghost" style="width:100%;margin-top:4px" onclick="closeModal()">Fechar</button></div></div>`);
}
function escolherModelo(sid,mid){const s=APP.sessoes.find(x=>x.id===sid);s.modelo=mid;s.status='A CONFIRMAR';closeModal();go('cap-sessoes');toast(modeloById(mid).nome+' casado com a sessão de '+s.aluno.nome+'. Falta confirmar presença.');}
function confirmarSessao(sid){const s=APP.sessoes.find(x=>x.id===sid);s.status='CONFIRMADA';go('cap-sessoes');toast('Confirmação enviada a '+modeloById(s.modelo).nome+' por WhatsApp — sessão hoje '+s.hora+'.');}
function bancoModelos(){
 return `<div class="atalhos" style="margin-bottom:12px"><button class="atalho">Todos</button><button class="atalho">Ativos</button><button class="atalho">Pendente termo</button></div>
 <div class="grid g3">${APP.modelos.map(m=>{const st={'ATIVO':['#1a7a4a','rgba(26,122,74,.12)'],'PENDENTE TERMO':['#C24D0F','#FCE9DD'],'INATIVO':['#9a8f84','#f0ebe4']}[m.status];return `<div class="card"><div style="display:flex;align-items:center;gap:12px">${crest(m.ini,46)}<div style="flex:1"><div class="mn" style="font-weight:600;color:var(--tinta)">${m.nome}</div><div class="mv">${m.idade} anos · ${m.bairro}</div></div></div>
   <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">${m.prefs.map(p=>`<span class="chip" style="font-size:11px">${p}</span>`).join('')}</div>
   <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px"><span class="pill" style="background:${st[1]};color:${st[0]}">${m.status}</span><span class="mv">💛 ${m.sessoes} sessões</span></div></div>`;}).join('')}</div>`;
}
function cadastrarVoluntario(){openModal(`<div style="padding:24px"><div class="sec-tit">+ Cadastrar voluntário</div><p class="desc">A comunidade retribuindo — o voluntário NÃO precisa ser da Ficha Cidadã.</p><input placeholder="Nome" style="width:100%;border:1px solid var(--linha);border-radius:12px;padding:11px;font-family:inherit;background:var(--papel);margin-bottom:10px"><input placeholder="Bairro · WhatsApp" style="width:100%;border:1px solid var(--linha);border-radius:12px;padding:11px;font-family:inherit;background:var(--papel)"><div class="atalhos-lbl">Serviços que topa receber</div><div class="atalhos">${CAP.servicos.map(s=>`<button class="atalho" onclick="this.classList.toggle('on');var on=this.classList.contains('on');this.style.background=on?'var(--unidade)':'';this.style.color=on?'#fff':''">${s}</button>`).join('')}</div><label style="display:flex;gap:8px;align-items:center;margin-top:14px;font-size:13px;cursor:pointer"><input type="checkbox" checked> Aceito ser fotografado durante a prática (Termo de Uso de Imagem)</label><div style="display:flex;gap:10px;margin-top:16px"><button class="btn btn-ghost" style="flex:1" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" style="flex:1" onclick="closeModal();toast('Voluntário cadastrado — obrigado por doar seu tempo. 💛')">Cadastrar</button></div></div>`);}
function termosModelos(){
 return `<div class="card">${APP.modelos.map(m=>`<div class="med-item"><span><b style="color:var(--tinta)">${m.nome}</b> · ${m.termo?'✓ termo assinado':'⚠ termo pendente'}</span>${m.termo?'<span class="pill pill-ok">OK</span>':`<button class="btn btn-primary btn-sm" onclick="coletarTermo('${m.id}')">Coletar termo</button>`}</div>`).join('')}</div>`;
}
function coletarTermo(mid){const m=modeloById(mid);openModal(`<div class="relatorio"><div class="selo">${LEAO}</div><h3>Termo de Uso de Imagem</h3><p style="color:var(--corpo);font-size:13px;line-height:1.6;max-width:390px;margin:0 auto 18px">Eu, <b>${m.nome}</b>, autorizo o uso das imagens captadas durante as sessões práticas gratuitas do Centro de Capacitação do Instituto Família Pôncio, para fins educativos e institucionais, <b>sem qualquer finalidade comercial</b> — podendo revogar quando quiser.</p><div style="display:flex;gap:10px;justify-content:center"><button class="btn btn-ghost" onclick="closeModal()">Cancelar</button><button class="btn btn-gold" onclick="assinarTermo('${mid}')">Assinar no tablet</button></div></div>`);}
function assinarTermo(mid){const m=modeloById(mid);m.termo=true;m.status='ATIVO';closeModal();go('cap-sessoes');toast('Termo coletado e arquivado · '+m.nome+'.');}

/* ---- INSTRUTOR RAFAEL (tablet) ---- */
VIEWS['cap-diario']=()=>`<div style="padding:18px 22px;background:linear-gradient(120deg,var(--unidade),var(--unidade-escuro));color:#fff;display:flex;align-items:center;gap:14px"><span class="medalhao" style="width:40px;height:40px"><span class="leao" style="width:28px;height:28px">${LEAO}</span></span><div style="flex:1"><div style="font-weight:600;letter-spacing:.12em;text-transform:uppercase;font-size:14px">Diário de Classe · BB-2026-1</div><div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;opacity:.85">Prof. Rafael Dias · Barbeiro</div></div><button class="btn btn-ghost btn-sm" onclick="trocarPerfil()" style="color:#fff;border-color:rgba(255,255,255,.4);background:rgba(255,255,255,.12)">↩ Trocar perfil</button></div>
 <div style="padding:22px"><div class="card" style="display:flex;align-items:center;gap:18px;margin-bottom:14px;background:var(--unidade-suave);border:0">${jubaRing(71,64)}<div style="flex:1"><div style="font-weight:600;color:var(--tinta)">Frequência da turma: 71% · evasão 19%</div><div class="desc">Módulo atual: Cortes masculinos · hoje tem sessão prática com modelos</div></div></div>
   <button class="btn btn-primary" style="width:100%;padding:16px" onclick="APP.capChamada={};go('cap-chamada')">Fazer chamada de hoje</button>
   <div style="margin-top:14px"><div class="sec-tit">Aulas recentes</div><div class="lista-med">${['Hoje · Cortes masculinos (prática com modelos)','Sex · Cortes masculinos','Qua · Máquinas e pentes'].map(a=>`<div class="med-item"><span>${a}</span><span class="mv">${a.startsWith('Hoje')?'em aberto':'registrada'}</span></div>`).join('')}</div></div>
   <button class="btn btn-ghost" style="width:100%;margin-top:14px" onclick="go('cap-sessao-instrutor')">🪑 Sessão prática de hoje (modelos)</button></div>`;
VIEWS['cap-chamada']=()=>{
 const al=CAP.alunosBB, pres=al.filter(a=>APP.capChamada[a.nome]==='P').length;
 return `<div style="padding:18px 22px;background:linear-gradient(120deg,var(--unidade),var(--unidade-escuro));color:#fff;display:flex;align-items:center;gap:14px"><button class="btn btn-ghost btn-sm" onclick="go('cap-diario')" style="color:#fff;border-color:rgba(255,255,255,.4);background:rgba(255,255,255,.12)">‹ Diário</button><div style="flex:1"><div style="font-weight:600;letter-spacing:.1em;text-transform:uppercase;font-size:14px">Chamada · BB-2026-1</div><div style="font-size:11px;opacity:.85">Toque no aluno para marcar presença</div></div><span style="font-size:13px;font-weight:600">${pres}/${al.length} presentes</span></div>
 <div style="padding:22px"><div style="display:flex;justify-content:flex-end;margin-bottom:12px"><button class="btn btn-ghost btn-sm" onclick="toast('Crachá-QR lido · presença marcada.')">Ler crachá-QR</button></div>
 <div class="grid g3">${al.map(a=>{const p=APP.capChamada[a.nome];return `<div class="card" style="display:flex;align-items:center;gap:12px;cursor:pointer;border-left:4px solid ${p==='P'?'#1a7a4a':p==='F'?'var(--erro)':'var(--linha)'}" onclick="marcarPresenca('${a.nome}')">${crest(a.ini,42)}<div style="flex:1"><div class="mn">${a.nome}</div><div class="mv">freq ${a.freq}%</div></div><span class="pill" style="${p==='P'?'background:rgba(26,122,74,.12);color:#1a7a4a':p==='F'?'background:#FCEDEC;color:#B3261E':'background:#f0ebe4;color:#9a8f84'}">${p==='P'?'presente':p==='F'?'falta':'—'}</span></div>`;}).join('')}</div>
 <button class="btn btn-primary" style="width:100%;margin-top:16px;padding:14px" onclick="encerrarChamada()">Encerrar chamada</button></div>`;
};
function marcarPresenca(nome){APP.capChamada[nome]=APP.capChamada[nome]==='P'?'F':'P';go('cap-chamada');}
function encerrarChamada(){toast('Chamada encerrada · frequência atualizada (sobe ao painel da Tânia).');go('cap-diario');}
VIEWS['cap-sessao-instrutor']=()=>`<div style="padding:18px 22px;background:linear-gradient(120deg,var(--unidade),var(--unidade-escuro));color:#fff;display:flex;align-items:center;gap:14px"><button class="btn btn-ghost btn-sm" onclick="go('cap-diario')" style="color:#fff;border-color:rgba(255,255,255,.4);background:rgba(255,255,255,.12)">‹ Diário</button><div style="flex:1"><div style="font-weight:600;letter-spacing:.1em;text-transform:uppercase;font-size:14px">Sessão Prática · Modelos</div><div style="font-size:11px;opacity:.85">Barbeiro · hoje 18h · Salão-Escola</div></div></div>
 <div style="padding:22px">${APP.sessoes.filter(s=>s.turma==='BB-2026-1').map(s=>{const m=modeloById(s.modelo);return `<div class="card" style="margin-bottom:12px"><div style="display:flex;align-items:center;gap:14px"><div style="flex:1;display:flex;align-items:center;gap:10px">${crest(s.aluno.ini,46)}<span style="color:#c9bfb4;font-size:18px">↔</span>${m?crest(m.ini,46):'<span class="atalho" style="border-style:dashed">sem modelo</span>'}</div><div style="text-align:right"><div style="font-weight:600;color:var(--tinta)">${s.servico}</div><div class="mv">${s.hora} · ${m?m.nome:'buscando modelo'}</div></div></div>
   ${m?`<div class="acoes" style="margin-top:12px"><button class="btn btn-ghost" onclick="toast('${m.nome} chegou · presença confirmada.')">Modelo chegou</button><button class="btn btn-primary" onclick="baixaSessao('${s.id}')">Dar baixa (concluir)</button></div>`:'<div class="desc" style="margin-top:10px">Sem modelo casado — a gestora resolve no Banco de Modelos.</div>'}</div>`;}).join('')}</div>`;
function baixaSessao(sid){const s=APP.sessoes.find(x=>x.id===sid);s.status='CONCLUÍDA';const m=modeloById(s.modelo);if(m)m.sessoes++;toast('Sessão concluída · '+s.aluno.nome+' praticou '+s.servico+' com '+(m?m.nome:'modelo')+'. +1h prática na trilha.');go('cap-sessao-instrutor');}

/* init */
montaLogin();
