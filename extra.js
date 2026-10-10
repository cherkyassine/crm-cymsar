/* Modules complémentaires du CRM CYMSAR : trésorerie, chantier, rapport, ventes avancées, compta avancée, contrôles. */
"use strict";
/* ---------- TVA déductible du budget et marge hors taxes ----------
   Les montants du budget sont des montants TTC pour les postes soumis à TVA. Pour chaque catégorie :
   TVA déductible estimée = TVA réelle des factures déjà reçues + (reste à engager × taux / (100 + taux)). */
const R2=n=>Math.round((+n||0)*100)/100;
const TVA_DEFAUT={'Acquisition terrain & société':0,'Prix non déclaré (hors acte)':0,'Permis & taxes':0,'Architecte, BET & contrôle':20,'Terrassement':20,'Gros œuvre':0,'Second œuvre':20,'Finitions':20,'Raccordements (eau/élec./assain.)':20,'Équipements de chantier':20,'Assurances, titres & réception':0,'Divers':0,'Frais bancaires':0};
const tvaRate=b=>(b.tva!==undefined&&b.tva!==null&&b.tva!=='')?+b.tva:(TVA_DEFAUT[b.categorie]!==undefined?TVA_DEFAUT[b.categorie]:0);
function budgetFiscal(){
  const k=calc(),C=S.compta,r=(+C.tvaVente||20)/100,reelle={};
  S.invoices.forEach(i=>{reelle[i.categorie]=(reelle[i.categorie]||0)+(+i.tva||0)});
  const cats=S.budget.map(b=>b.categorie);Object.keys(k.eng).forEach(c=>{if(!cats.includes(c))cats.push(c)});
  const lignes=cats.map(c=>{
    const b=S.budget.find(x=>x.categorie===c)||{categorie:c,estime:0},taux=tvaRate(b),eng=k.eng[c]||0;
    const reste=Math.max(0,(+b.estime||0)-eng),deja=reelle[c]||0,futur=reste*taux/(100+taux);
    return {categorie:c,taux,deja:R2(deja),futur:R2(futur),tva:R2(deja+futur)};
  });
  const tvaDed=R2(sum(lignes,l=>l.tva)),coutsHT=R2(k.budTot-tvaDed);
  const caHT=C.venteTTC?k.ca/(1+r):k.ca,tvaCol=C.venteTTC?k.ca-caHT:k.ca*r;
  const noir=sum(S.budget.filter(b=>b.categorie.startsWith('Prix non déclaré')),b=>b.estime);
  return {lignes,tvaDed,coutsHT,caHT:R2(caHT),tvaCol:R2(tvaCol),tvaNette:R2(tvaCol-tvaDed),margeHT:R2(caHT-coutsHT),margeHT2:R2(caHT-coutsHT+noir),noir,venteTTC:!!C.venteTTC,taux:C.tvaVente};
}

/* CSV pour Excel français : séparateur « ; », nombres avec virgule décimale, UTF-8 avec BOM */
function csvCell(v){
  let s;
  if(v==null)s='';
  else if(typeof v==='number')s=(Number.isInteger(v)?String(v):String(Math.round(v*100)/100)).replace('.',',');
  else{s=String(v);if(/^-?\d+\.\d+$/.test(s))s=s.replace('.',',')}
  return '"'+s.replace(/"/g,'""')+'"';
}

function FURL(p,img){
  if(window.WEB){const id=(S.drive&&S.drive[p])||(window.SCID&&SCID[p])||'';return id?(img?'https://drive.google.com/thumbnail?id='+id+'&sz=w400':'https://drive.google.com/file/d/'+id+'/view'):'#'}
  return '../'+encodeURI(p);
}
window.EXTRA_PAGES=[
  {at:3,page:['tre','Trésorerie prévue','tre']},
  {at:4,page:['chan','Chantier','chan']},
  {at:11,page:['rap','Rapport mensuel','rap']}
];
window.EXTRA_ICONS={
  tre:'<svg viewBox="0 0 24 24"><path d="M3 17l5-5 4 4 8-9"/><path d="M15 7h5v5"/></svg>',
  chan:'<svg viewBox="0 0 24 24"><path d="M2 20h20M5 20V9l7-5 7 5v11M9 20v-6h6v6"/></svg>',
  rap:'<svg viewBox="0 0 24 24"><path d="M6 2h9l5 5v15H6z"/><path d="M9 18v-4M12 18v-7M15 18v-5"/></svg>'
};
window.EXTRA_VIEWS={tre:vTre,chan:vChan,rap:vRap};

const dAdd=(d,n)=>{const t=new Date(d+'T00:00:00Z');t.setUTCDate(t.getUTCDate()+n);return t.toISOString().slice(0,10)};
const dMax=(a,b)=>a>b?a:b;
const dDiff=(a,b)=>Math.round((new Date(a+'T00:00:00Z')-new Date(b+'T00:00:00Z'))/864e5);
const ym=d=>d.slice(0,7);
function addMonths(k,n){const [y,m]=k.split('-').map(Number);const t=new Date(y,m-1+n,1);return t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')}
function tile(l,v,s,c=''){return `<div class="card kpi"><div class="l">${l}</div><div class="v" style="${c}">${v}</div><div class="s">${s||''}</div></div>`}
function printDoc(title,body){
  const w=window.open('','_blank');if(!w){alert('Autorisez les fenêtres pop-up pour imprimer.');return}
  w.document.write(`<!doctype html><meta charset="utf-8"><title>${esc(title)}</title><style>body{font:14px/1.5 Georgia,serif;max-width:780px;margin:30px auto;padding:0 20px;color:#111}h1{font-size:22px;text-align:center;margin:26px 0 4px}h2{font-size:15px;margin:20px 0 6px}.hd{border-bottom:2px solid #13283b;padding-bottom:8px;margin-bottom:10px}.hd b{font-size:18px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #999;padding:5px 8px;text-align:left}.r{text-align:right}.sig{display:flex;justify-content:space-between;margin-top:50px}.sig div{width:45%;border-top:1px solid #333;padding-top:6px;text-align:center}small{color:#555}@media print{button{display:none}}</style><button onclick="print()" style="float:right;padding:8px 14px">Imprimer / PDF</button>${body}`);
  w.document.close();
}
const hdr=()=>{const s=S.societe;return `<div class="hd"><b>${esc(s.nom)}</b><br>${esc(s.forme)} · ICE ${esc(s.ice)}<br>${esc(s.adresse)} · Tél. ${esc(s.tel)}</div>`};
function enLettres(n){
  n=Math.round(n*100)/100;const e=Math.floor(n),c=Math.round((n-e)*100);
  const u=['zéro','un','deux','trois','quatre','cinq','six','sept','huit','neuf','dix','onze','douze','treize','quatorze','quinze','seize','dix-sept','dix-huit','dix-neuf'];
  const d=['','','vingt','trente','quarante','cinquante','soixante','soixante','quatre-vingt','quatre-vingt'];
  const b100=x=>{if(x<20)return u[x];const t=Math.floor(x/10),r=x%10;
    if(t===7||t===9)return d[t]+(t===7&&r===1?' et ':'-')+u[10+r];
    if(t===8)return r===0?'quatre-vingts':'quatre-vingt-'+u[r];
    return d[t]+(r===1?' et un':r?'-'+u[r]:'')};
  const b1000=x=>{const h=Math.floor(x/100),r=x%100;let s='';if(h>0)s=(h===1?'cent':u[h]+' cent')+(r===0&&h>1?'s':'');if(r>0)s+=(s?' ':'')+b100(r);return s};
  const big=x=>{if(x===0)return 'zéro';let s='';const m=Math.floor(x/1e6),k=Math.floor((x%1e6)/1e3),r=x%1e3;
    if(m)s+=b1000(m)+(m>1?' millions ':' million ');
    if(k)s+=(k===1?'mille':b1000(k).replace(/(quatre-vingt)s$/,'$1').replace(/cents$/,'cent')+' mille')+' ';
    if(r)s+=b1000(r);return s.trim()};
  return big(e)+' dirhams'+(c?' et '+big(c)+' centimes':'');
}

/* ================= CONTRÔLES ================= */
function checks(){
  const out=[],add=(lvl,msg,link)=>out.push({lvl,msg,link});
  const seen={};
  S.invoices.forEach(i=>{
    const k=i.fournisseur+'|'+String(i.numero||'').trim().toLowerCase();
    if(i.numero){if(seen[k])add('bad',`Doublon possible : ${i.id} et ${seen[k]} (même fournisseur, même n° « ${i.numero} »).`,'inv');else seen[k]=i.id}
    if(Math.abs(i.ht+i.tva-i.ttc)>0.02)add('bad',`${i.id} : HT + TVA (${m2(i.ht+i.tva)}) ≠ TTC (${m2(i.ttc)}).`,'inv');
    if(i.paye>i.ttc+0.01)add('bad',`${i.id} : payé (${m2(i.paye)}) supérieur au TTC (${m2(i.ttc)}).`,'inv');
    if(i.paye>0&&!i.datePaiement)add('warn',`${i.id} : payée sans date de paiement.`,'inv');
    if(!i.fichier)add('warn',`${i.id} : aucun fichier de facture rattaché.`,'inv');
    const age=dDiff(today(),i.date);
    if(i.ttc-i.paye>0.005&&age>30)add('warn',`${i.id} (${cn(i.fournisseur)}) impayée depuis ${age} jours : ${m2(i.ttc-i.paye)} MAD.`,'inv');
    if(i.refBanque&&i.mode!=='Caisse'&&!S.bank.find(b=>String(b.n)===String(i.refBanque)))add('warn',`${FA(i.id)} : ligne bancaire n°${i.refBanque} introuvable.`,'bank');
  });
  S.bank.forEach(b=>{
    if(b.debit>0&&(b.factures||[]).length){
      const inv=b.factures.map(id=>S.invoices.find(i=>i.id===id)),miss=b.factures.filter((id,k)=>!inv[k]);
      if(miss.length)add('warn',`Ligne bancaire ${b.n} : facture(s) inconnue(s) ${miss.join(', ')}.`,'bank');
      else{const t=sum(inv,i=>i.paye);if(Math.abs(t-b.debit)>0.02)add('bad',`Ligne bancaire ${b.n} : débit ${m2(b.debit)} ≠ factures liées ${m2(t)}.`,'bank')}
    }
  });
  let run=0;for(const b of S.bank){run+=b.credit-b.debit;if(b.solde&&Math.abs(run-b.solde)>0.02){add('bad',`Relevé : le solde de la ligne ${b.n} (${m2(b.solde)}) ne correspond pas au cumul (${m2(run)}).`,'bank');break}}
  const k=calc();S.budget.forEach(b=>{if(b.estime>0&&k.eng[b.categorie]>b.estime*1.005)add('warn',`Budget « ${b.categorie} » dépassé : ${m0(k.eng[b.categorie])} engagés pour ${m0(b.estime)}.`,'bud')});
  S.tasks.filter(t=>t.statut!=='Fait'&&t.echeance&&t.echeance<today()).forEach(t=>add('warn',`Tâche en retard : ${t.titre}`,'task'));
  S.lots.forEach(l=>(l.echeances||[]).filter(e=>!e.recu&&e.date<today()).forEach(e=>add('warn',`Échéance acheteur en retard : ${l.nom}, ${fd(e.date)}, ${m2(e.montant)} MAD.`,'sal')));
  const t=tresoData();if(t.firstNeg)add('bad',`Trésorerie prévue négative dès ${mlabel(t.firstNeg)}.`,'tre');
  return out;
}
function controlsBox(){
  const c=checks();
  if(!c.length)return '<div class="banner" style="background:var(--ok-soft);color:var(--ok)">✓ Contrôles automatiques : aucune anomalie détectée.</div>';
  const bad=c.filter(x=>x.lvl==='bad').length;
  return `<div class="card" style="margin-bottom:14px"><h3>Contrôles automatiques · ${bad?`<span style="color:var(--bad)">${bad} erreur(s)</span> · `:''}${c.length-bad} avertissement(s)</h3>${c.slice(0,8).map(x=>`<div class="small" style="padding:3px 0"><span class="chip ${x.lvl==='bad'?'bad':'warn'}">${x.lvl==='bad'?'Erreur':'À voir'}</span> <a href="#${x.link}" style="color:inherit">${esc(x.msg)}</a></div>`).join('')}${c.length>8?`<div class="small mute" style="margin-top:6px">… et ${c.length-8} autre(s).</div>`:''}</div>`;
}

/* ================= TRÉSORERIE PRÉVUE ================= */
function tresoEvents(){
  const ev=[],t0=today();
  S.invoices.forEach(i=>{const r=i.ttc-i.paye;if(r>0.005)ev.push({d:dMax(dAdd(i.date,30),t0),l:`Facture ${FA(i.id)} · ${cn(i.fournisseur)}`,m:-r,src:'facture'})});
  S.contrats.forEach(c=>c.situations.forEach(s=>{if(!s.paye){const net=sitTTC(c,s)-sitRet(c,s);ev.push({d:dMax(dAdd(s.date,30),t0),l:`Situation ${cn(c.entreprise)} · ${s.libelle||''}`,m:-net,src:'contrat'})}}));
  S.lots.forEach(l=>(l.echeances||[]).filter(e=>!e.recu).forEach(e=>ev.push({d:e.date<t0?t0:e.date,l:`Acheteur · ${l.nom} · ${e.libelle||''}`,m:+e.montant,src:'vente'})));
  S.previsions.filter(p=>p.statut!=='Réalisé').forEach(p=>ev.push({d:p.date<t0?t0:p.date,l:p.libelle,m:p.sens==='entree'?+p.montant:-p.montant,src:'manuel',id:p.id}));
  return ev.sort((a,b)=>a.d<b.d?-1:1);
}
function tresoData(){
  const k=calc(),ev=tresoEvents(),m0k=ym(today()),months=[];
  for(let i=0;i<12;i++)months.push(addMonths(m0k,i));
  let bal=k.tre;const rows=months.map(m=>{const e=ev.filter(x=>ym(x.d)===m);const inn=sum(e.filter(x=>x.m>0),x=>x.m),out=-sum(e.filter(x=>x.m<0),x=>x.m);bal+=inn-out;return {m,inn,out,bal}});
  const later=ev.filter(x=>ym(x.d)>months[11]);
  const first=rows.find(r=>r.bal<0);
  return {rows,ev,start:k.tre,firstNeg:first?first.m:null,later,end:rows[rows.length-1].bal};
}
function vTre(){
  const T=tresoData();
  const W=620,H=230,pl=52,pb=28,pt=10,n=T.rows.length,bw=(W-pl)/n;
  const mx=Math.max(1,...T.rows.map(r=>Math.max(r.inn,r.out,Math.abs(r.bal)))),mn=Math.min(0,...T.rows.map(r=>r.bal));
  const y=v=>pt+(H-pb-pt)*(1-(v-mn)/(mx-mn));
  const bars=T.rows.map((r,i)=>{const x=pl+i*bw;return `<rect x="${x+bw*.12}" y="${y(r.inn)}" width="${bw*.34}" height="${Math.max(0,y(0)-y(r.inn))}" fill="var(--ok)" opacity=".8"/><rect x="${x+bw*.5}" y="${y(r.out)}" width="${bw*.34}" height="${Math.max(0,y(0)-y(r.out))}" fill="var(--bad)" opacity=".85"/><text x="${x+bw/2}" y="${H-10}" text-anchor="middle">${mlabel(r.m)}</text>`}).join('');
  const line=T.rows.map((r,i)=>`${i?'L':'M'}${pl+i*bw+bw/2},${y(r.bal)}`).join('');
  const grid=[mn,0,mx].map(v=>`<line x1="${pl}" x2="${W}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${pl-6}" y="${y(v)+4}" text-anchor="end">${m0(v/1000)}k</text>`).join('');
  let run=T.start;
  return `<div class="top"><div><h1>Trésorerie prévue</h1><p class="sub">Projection sur 12 mois : factures à payer (à 30 jours), situations d’entreprises, échéances acheteurs et prévisions manuelles.</p></div><div class="row"><button class="btn pri" onclick="newPrev()">+ Prévision</button></div></div>
  <div class="grid kpis">${tile('Trésorerie actuelle',MAD(T.start))}${tile('Solde dans 12 mois',MAD(T.end),'',T.end<0?'color:var(--bad)':'color:var(--ok)')}${tile('Premier mois négatif',T.firstNeg?mlabel(T.firstNeg):'Aucun',T.firstNeg?'Prévoir un apport ou un financement':'',T.firstNeg?'color:var(--bad)':'color:var(--ok)')}${tile('Besoin de financement max',MAD(Math.max(0,-Math.min(0,...T.rows.map(r=>r.bal)))))}</div>
  <div class="card"><h3>Solde prévisionnel fin de mois</h3><svg viewBox="0 0 ${W} ${H}" width="100%">${grid}${bars}<path d="${line}" fill="none" stroke="var(--acc)" stroke-width="2.5"/>${T.rows.map((r,i)=>`<circle cx="${pl+i*bw+bw/2}" cy="${y(r.bal)}" r="3.5" fill="${r.bal<0?'var(--bad)':'var(--acc)'}"><title>${m2(r.bal)}</title></circle>`).join('')}</svg>
  <div class="small mute">Barres vertes : entrées prévues · rouges : sorties prévues · courbe : solde.</div></div>
  <h3 class="mute" style="margin:18px 0 8px">Détail mensuel</h3>
  <div class="tw"><table><thead><tr><th>Mois</th><th class="num">Entrées</th><th class="num">Sorties</th><th class="num">Solde fin de mois</th></tr></thead><tbody>${T.rows.map(r=>`<tr><td>${mlabel(r.m)}</td><td class="num">${m2(r.inn)}</td><td class="num">${m2(r.out)}</td><td class="num" style="color:${r.bal<0?'var(--bad)':'inherit'}"><b>${m2(r.bal)}</b></td></tr>`).join('')}</tbody></table></div>
  <h3 class="mute" style="margin:18px 0 8px">Mouvements prévus (${T.ev.length})</h3>
  <div class="tw"><table><thead><tr><th>Date</th><th>Libellé</th><th>Source</th><th class="num">Montant</th><th class="num">Solde cumulé</th></tr></thead><tbody>${T.ev.map(e=>{run+=e.m;return `<tr ${e.id?`class="click" onclick="editPrev('${e.id}')"`:''}><td>${fd(e.d)}</td><td>${esc(e.l)}</td><td><span class="chip gray">${e.src}</span></td><td class="num" style="color:${e.m<0?'var(--bad)':'var(--ok)'}">${m2(e.m)}</td><td class="num">${m2(run)}</td></tr>`}).join('')||'<tr><td colspan="5" class="empty">Aucun mouvement prévu.</td></tr>'}</tbody></table></div>`;
}
const PREVF=()=>[{k:'date',l:'Date',t:'date',req:1},{k:'libelle',l:'Libellé',t:'text',req:1,full:1},{k:'montant',l:'Montant (MAD)',t:'number'},{k:'sens',l:'Sens',t:'select',o:[['sortie','Sortie (dépense)'],['entree','Entrée (recette)']]},{k:'statut',l:'Statut',t:'select',o:['Prévu','Réalisé']}];
function newPrev(){openForm({title:'Nouvelle prévision',fields:PREVF(),data:{date:today(),sens:'sortie',statut:'Prévu'},onSave:o=>S.previsions.push({id:uid('p'),...o})})}
function editPrev(id){const p=S.previsions.find(x=>x.id===id);openForm({title:'Prévision',fields:PREVF(),data:p,onSave:o=>Object.assign(p,o),onDelete:()=>{S.previsions=S.previsions.filter(x=>x!==p)}})}

/* ================= CHANTIER ================= */
const sitTTC=(c,s)=>s.ht*(1+c.tva/100);
const sitRet=(c,s)=>sitTTC(c,s)*c.retenue/100;
function vChan(){
  const t=UI.chanTab||'contrats';
  const tabs=`<div class="tabs">${[['contrats','Entreprises & situations'],['avanc','Avancement'],['journal','Journal de chantier']].map(([k,l])=>`<button class="${t===k?'on':''}" onclick="UI.chanTab='${k}';render()">${l}</button>`).join('')}</div>`;
  const btn={contrats:'<button class="btn pri" onclick="newContrat()">+ Contrat</button>',avanc:'<button class="btn pri" onclick="newPhase()">+ Phase</button>',journal:'<button class="btn pri" onclick="newJournal()">+ Entrée</button>'}[t];
  return `<div class="top"><div><h1>Chantier</h1><p class="sub">Entreprises, situations de travaux, retenues de garantie, avancement et journal.</p></div><div class="row">${btn}</div></div>${tabs}${t==='contrats'?chanContrats():t==='avanc'?chanAvanc():chanJournal()}`;
}
function chanContrats(){
  if(!S.contrats.length)return '<div class="card empty">Aucun contrat d’entreprise. Ajoutez vos marchés (gros œuvre, plomberie, électricité…) pour suivre situations et retenues.</div>';
  const rows=S.contrats.map(c=>{const ttc=c.ht*(1+c.tva/100),fact=sum(c.situations,s=>sitTTC(c,s)),paye=sum(c.situations.filter(s=>s.paye),s=>sitTTC(c,s)-sitRet(c,s)),ret=sum(c.situations,s=>sitRet(c,s));return {c,ttc,fact,paye,ret}});
  return `<div class="grid kpis">${tile('Marchés signés (TTC)',MAD(sum(rows,r=>r.ttc)))}${tile('Situations facturées',MAD(sum(rows,r=>r.fact)))}${tile('Réglé (net de retenue)',MAD(sum(rows,r=>r.paye)))}${tile('Retenues de garantie retenues',MAD(sum(rows,r=>r.ret)),'À libérer après réception')}</div>
  <div class="tw"><table><thead><tr><th>Entreprise</th><th>Objet</th><th class="num">Marché TTC</th><th class="num">Facturé</th><th class="num">%</th><th class="num">Réglé net</th><th class="num">Retenue</th><th class="num">Reste à facturer</th><th>Statut</th></tr></thead><tbody>${rows.map(({c,ttc,fact,paye,ret})=>`<tr class="click" onclick="showContrat('${c.id}')"><td><b>${esc(cn(c.entreprise))}</b></td><td>${esc(c.objet)}</td><td class="num">${m2(ttc)}</td><td class="num">${m2(fact)}</td><td class="num">${ttc?Math.round(fact/ttc*100):0} %</td><td class="num">${m2(paye)}</td><td class="num">${m2(ret)}</td><td class="num">${m2(ttc-fact)}</td><td><span class="chip ${c.statut==='Terminé'?'ok':c.statut==='En cours'?'blue':'gray'}">${esc(c.statut)}</span></td></tr>`).join('')}</tbody></table></div>`;
}
const CONTF=()=>[{k:'entreprise',l:'Entreprise',t:'select',o:contactOpts,req:1},{k:'objet',l:'Objet du marché',t:'text',req:1,full:1},{k:'ht',l:'Montant HT',t:'number'},{k:'tva',l:'TVA (%)',t:'number'},{k:'retenue',l:'Retenue de garantie (%)',t:'number'},{k:'date',l:'Date du marché',t:'date'},{k:'statut',l:'Statut',t:'select',o:['Prévu','En cours','Terminé']},{k:'notes',l:'Notes',t:'area',full:1}];
function newContrat(){openForm({title:'Nouveau contrat d’entreprise',fields:CONTF(),data:{tva:20,retenue:10,statut:'En cours',date:today()},onSave:o=>S.contrats.push({id:uid('k'),situations:[],...o})})}
function showContrat(id){
  const c=S.contrats.find(x=>x.id===id);if(!c)return;
  const ttc=c.ht*(1+c.tva/100);
  modal.innerHTML=`<div class="dlg wide"><div class="top"><div><h2 style="margin:0">${esc(cn(c.entreprise))}</h2><div class="mute">${esc(c.objet)} · ${MAD(ttc)} TTC · retenue ${c.retenue} %</div></div><div class="row"><button class="btn sm" onclick="closeModal();editContrat('${id}')">Modifier</button><button class="btn sm pri" onclick="closeModal();newSit('${id}')">+ Situation</button><button class="btn sm" onclick="closeModal()">Fermer</button></div></div>
  <div class="tw" style="margin-top:12px"><table><thead><tr><th>Date</th><th>Situation</th><th class="num">HT</th><th class="num">TTC</th><th class="num">Retenue</th><th class="num">Net à payer</th><th>Statut</th></tr></thead><tbody>${c.situations.map(s=>`<tr class="click" onclick="closeModal();editSit('${id}','${s.id}')"><td>${fd(s.date)}</td><td>${esc(s.libelle)}</td><td class="num">${m2(s.ht)}</td><td class="num">${m2(sitTTC(c,s))}</td><td class="num">${m2(sitRet(c,s))}</td><td class="num"><b>${m2(sitTTC(c,s)-sitRet(c,s))}</b></td><td>${s.paye?`<span class="chip ok">Payée ${fd(s.datePaiement)}</span>`:'<span class="chip bad">À payer</span>'}</td></tr>`).join('')||'<tr><td colspan="7" class="empty">Aucune situation.</td></tr>'}</tbody></table></div></div>`;
  modal.classList.add('on');
}
function editContrat(id){const c=S.contrats.find(x=>x.id===id);openForm({title:'Contrat',fields:CONTF(),data:c,onSave:o=>Object.assign(c,o),onDelete:()=>{S.contrats=S.contrats.filter(x=>x!==c)}});}
const SITF=()=>[{k:'date',l:'Date',t:'date',req:1},{k:'libelle',l:'Libellé (ex. Situation n°1)',t:'text',req:1,full:1},{k:'ht',l:'Montant HT de la situation',t:'number'},{k:'paye',l:'Réglée ?',t:'select',o:[['','Non'],['1','Oui']]},{k:'datePaiement',l:'Date de règlement',t:'date'}];
function newSit(id){const c=S.contrats.find(x=>x.id===id);openForm({title:'Nouvelle situation',fields:SITF(),data:{date:today(),libelle:'Situation n°'+(c.situations.length+1)},onSave:o=>{o.paye=!!o.paye;c.situations.push({id:uid('s'),...o});setTimeout(()=>showContrat(id),30)}})}
function editSit(id,sid){const c=S.contrats.find(x=>x.id===id),s=c.situations.find(x=>x.id===sid);openForm({title:'Situation',fields:SITF(),data:{...s,paye:s.paye?'1':''},onSave:o=>{o.paye=!!o.paye;Object.assign(s,o);setTimeout(()=>showContrat(id),30)},onDelete:()=>{c.situations=c.situations.filter(x=>x!==s);setTimeout(()=>showContrat(id),30)}})}
function chanAvanc(){
  const avg=S.phases.length?sum(S.phases,p=>phasePct(p))/S.phases.length:0,k=calc(),budPct=k.budTot?k.engTot/k.budTot*100:0;
  return `<div class="grid kpis">${tile('Avancement global',Math.round(avg)+' %','Moyenne des phases')}${tile('Budget engagé',Math.round(budPct)+' %','Terrain compris')}${tile('Phases terminées',S.phases.filter(p=>phasePct(p)>=100).length+' / '+S.phases.length)}</div>
  <div class="card">${S.phases.map((p,i)=>`<div class="bar" style="grid-template-columns:200px 1fr 120px"><div><b>${esc(p.nom)}</b><div class="small mute">${p.debut?fd(p.debut):''}${p.fin?' → '+fd(p.fin):''}</div></div><div><input type="range" min="0" max="100" step="5" value="${phasePct(p)}" ${p.auto&&p.contrat?'disabled title="Avancement mesuré automatiquement"':''} style="width:100%;padding:0" oninput="setPhase(${i},this.value,this)"></div><div class="num"><b id="ph${i}">${phasePct(p)} %</b>${p.auto&&p.contrat?' <span class="chip blue">mesuré</span>':''} <a href="#chan" class="small" onclick="editPhase(${i});return false">éditer</a></div></div>`).join('')}</div>`;
}
function setPhase(i,v,el){S.phases[i].pct=+v;document.getElementById('ph'+i).textContent=v+' %';clearTimeout(window._pt);window._pt=setTimeout(()=>{save();render()},500)}
const PHF=[{k:'nom',l:'Phase',t:'text',req:1},{k:'pct',l:'Avancement saisi (%)',t:'number'},{k:'contrat',l:'Contrat lié (pour l’avancement mesuré)',t:'select',o:()=>[['','—'],...S.contrats.map(c=>[c.id,cn(c.entreprise)+' · '+c.objet])]},{k:'auto',l:'Avancement',t:'select',o:[['','Saisi à la main'],['1','Mesuré : situations ÷ marché']]},{k:'debut',l:'Début',t:'date'},{k:'fin',l:'Fin prévue',t:'date'}];
function newPhase(){openForm({title:'Nouvelle phase',fields:PHF,data:{pct:0},onSave:o=>S.phases.push(o)})}
function editPhase(i){const p=S.phases[i];openForm({title:p.nom,fields:PHF,data:p,onSave:o=>Object.assign(p,o),onDelete:()=>{S.phases.splice(i,1)}})}
function chanJournal(){
  const L=S.journal.slice().sort((a,b)=>a.date<b.date?1:-1);
  if(!L.length)return '<div class="card empty">Aucune entrée. Notez visites, réunions de chantier, réserves et décisions, avec photos.</div>';
  return L.map(j=>`<div class="card" style="margin-bottom:10px"><div class="row" style="justify-content:space-between"><div><b>${fd(j.date)}</b> <span class="chip gray">${esc(j.type)}</span></div><a href="#chan" class="small" onclick="editJournal('${j.id}');return false">modifier</a></div><div style="margin:8px 0;white-space:pre-wrap">${esc(j.texte)}</div><div class="row">${(j.photos||[]).map(p=>`<a href="${FURL(p)}" target="_blank"><img src="${FURL(p,true)}" style="height:90px;border-radius:8px;border:1px solid var(--line)"></a>`).join('')}</div></div>`).join('');
}
const JT=['Visite','Réunion de chantier','Réserve','Décision','Livraison matériaux','Incident','Note'];
function newJournal(entry){
  const e=entry||{date:today(),type:'Visite',texte:'',photos:[]};
  modal.innerHTML=`<form class="dlg"><h2>${entry?'Modifier':'Nouvelle'} entrée de chantier</h2><div class="form"><div><label>Date</label><input type="date" name="date" value="${e.date}"></div><div><label>Type</label><select name="type">${optHtml(JT,e.type)}</select></div><div class="full"><label>Compte rendu</label><textarea name="texte" style="min-height:110px">${esc(e.texte)}</textarea></div><div class="full"><label>Photos ${SERVER?'(enregistrées dans CRM\\photos)':'(nécessite « Lancer le CRM.bat »)'}</label><input type="file" name="files" accept="image/*" multiple ${SERVER?'':'disabled'}></div></div><div class="acts">${entry?'<button type="button" class="btn danger left" data-x="del">Supprimer</button>':''}<button type="button" class="btn" data-x="c">Annuler</button><button class="btn pri">Enregistrer</button></div></form>`;
  modal.classList.add('on');const f=modal.querySelector('form');
  f.querySelector('[data-x=c]').onclick=closeModal;
  const d=f.querySelector('[data-x=del]');if(d)d.onclick=()=>{if(confirm('Supprimer ?')){S.journal=S.journal.filter(x=>x!==entry);save();closeModal();render()}};
  f.onsubmit=async ev=>{ev.preventDefault();const btn=f.querySelector('button.pri');btn.disabled=true;btn.textContent='Envoi…';
    const photos=[...(e.photos||[])];
    for(const file of f.elements.files.files||[]){try{const r=await fetch('/api/upload?kind=photo&name='+encodeURIComponent(f.elements.date.value+' '+file.name),{method:'POST',body:file});const j=await r.json();if(j.path)photos.push(j.path)}catch(_){}}
    const o={date:f.elements.date.value,type:f.elements.type.value,texte:f.elements.texte.value,photos};
    if(entry)Object.assign(entry,o);else S.journal.push({id:uid('j'),...o});
    save();closeModal();render()};
}
function editJournal(id){newJournal(S.journal.find(x=>x.id===id))}

/* ================= RAPPORT MENSUEL ================= */
function vRap(){
  const m=UI.rapMonth||ym(today()),k=calc();
  const inMonth=d=>d&&ym(d)===m;
  const bk=S.bank.filter(b=>inMonth(b.date)),inn=sum(bk,b=>b.credit),out=sum(bk,b=>b.debit);
  const soldeFin=(()=>{let r=0;for(const b of S.bank){if(b.date.slice(0,7)>m)break;r+=b.credit-b.debit}return r})();
  const facM=S.invoices.filter(i=>inMonth(i.date)),payM=S.invoices.filter(i=>inMonth(i.datePaiement)&&i.paye>0);
  const byCat={};facM.forEach(i=>byCat[i.categorie]=(byCat[i.categorie]||0)+i.ttc);
  const jm=S.journal.filter(j=>inMonth(j.date)),T=tvaData(),per=T.rows.find(r=>r.k===periodKey(m+'-15'));
  const avg=S.phases.length?sum(S.phases,p=>phasePct(p))/S.phases.length:0;
  const mn=new Date(m+'-01').toLocaleDateString('fr-FR',{month:'long',year:'numeric'});
  return `<div class="top"><div><h1>Rapport mensuel</h1><p class="sub">Synthèse imprimable (Ctrl+P → Enregistrer en PDF).</p></div><div class="row"><input type="month" value="${m}" onchange="UI.rapMonth=this.value;render()"><button class="btn pri" onclick="window.print()">Imprimer / PDF</button></div></div>
  <div class="card" style="margin-bottom:12px"><h2 style="margin:0 0 2px;text-transform:capitalize">${mn}</h2><div class="mute">${esc(S.societe.nom)} · ${esc(S.projet.nom)}</div></div>
  <div class="grid kpis">${tile('Solde banque fin de mois',MAD(soldeFin))}${tile('Entrées du mois',MAD(inn))}${tile('Sorties du mois',MAD(out))}${tile('Avancement travaux',Math.round(avg)+' %')}</div>
  <div class="grid cols2">
   <div class="card"><h3>Factures datées du mois (${facM.length}) · ${MAD(sum(facM,i=>i.ttc))}</h3>${Object.keys(byCat).map(c=>`<div class="row" style="justify-content:space-between"><span>${esc(c)}</span><b>${m2(byCat[c])}</b></div>`).join('')||'<div class="mute">Aucune facture.</div>'}<div class="small mute" style="margin-top:8px">Règlements effectués dans le mois : ${payM.length} facture(s), ${MAD(sum(payM,i=>i.paye))}.</div></div>
   <div class="card"><h3>Situation à fin ${mn}</h3><dl class="dl"><dt>Reste à payer</dt><dd>${MAD(sum(S.invoices.filter(i=>i.date<=m+'-31'),i=>i.ttc-(i.datePaiement&&i.datePaiement<=m+'-31'?i.paye:0)))}</dd><dt>Engagé total</dt><dd>${MAD(k.engTot)} (${k.budTot?Math.round(k.engTot/k.budTot*100):0} % du budget)</dd><dt>TVA période</dt><dd>${per?`collectée ${m2(per.col)} · déductible ${m2(per.ded)} · ${per.due?'à payer '+m2(per.due):'crédit '+m2(per.credit)}`:'—'}</dd><dt>Lots vendus</dt><dd>${k.vendus} / ${S.lots.length}</dd></dl></div>
   <div class="card"><h3>Avancement par phase</h3>${S.phases.map(p=>`<div class="bar" style="grid-template-columns:160px 1fr 50px;margin:6px 0"><span>${esc(p.nom)}</span><div class="track"><div class="fill" style="width:${phasePct(p)}%"></div></div><span class="num">${phasePct(p)} %</span></div>`).join('')}</div>
   <div class="card"><h3>Journal de chantier (${jm.length})</h3>${jm.map(j=>`<div style="margin-bottom:8px"><b>${fd(j.date)}</b> <span class="chip gray">${esc(j.type)}</span><div>${esc(j.texte)}</div></div>`).join('')||'<div class="mute">Aucune entrée ce mois-ci.</div>'}</div>
  </div>`;
}

/* ================= VENTES AVANCÉES ================= */
function salTabs(t){return [['ech','Échéanciers acheteurs'],['gen','Documents à imprimer'],['sim','Simulateur']].map(([k,l])=>`<button class="${t===k?'on':''}" onclick="UI.lotTab='${k}';render()">${l}</button>`).join('')}
function salExtra(t){return t==='ech'?salEch():t==='gen'?salGen():salSim()}
function salEch(){
  const all=S.lots.flatMap(l=>(l.echeances||[]).map(e=>({l,e})));
  const att=sum(all,x=>x.e.montant),rec=sum(all.filter(x=>x.e.recu),x=>x.e.montant),ret=sum(all.filter(x=>!x.e.recu&&x.e.date<today()),x=>x.e.montant);
  return `<div class="grid kpis">${tile('Attendu',MAD(att))}${tile('Encaissé',MAD(rec))}${tile('En retard',MAD(ret),'',ret?'color:var(--bad)':'')}</div>
  ${S.lots.map(l=>{const buyer=(S.prospects.find(p=>p.id===l.acheteur)||{}).nom||'';const prix=l.surface*l.prixM2,recl=sum((l.echeances||[]).filter(e=>e.recu),e=>e.montant);
   return `<div class="card" style="margin-bottom:10px"><div class="top" style="margin:0 0 8px"><div><b>${esc(l.nom)}</b> <span class="chip gray">${l.statut}</span> ${buyer?'· '+esc(buyer):''}<div class="small mute">Prix ${m2(prix)} · encaissé ${m2(recl)} · reste ${m2(prix-recl)}</div></div><button class="btn sm" onclick="newEch('${l.id}')">+ Échéance</button></div>
   ${(l.echeances||[]).length?`<table><tbody>${l.echeances.map(e=>`<tr><td>${fd(e.date)}</td><td>${esc(e.libelle)}</td><td class="num">${m2(e.montant)}</td><td>${e.recu?`<span class="chip ok">Reçu ${fd(e.dateRecu)}</span>`:e.date<today()?'<span class="chip bad">En retard</span>':'<span class="chip warn">À venir</span>'}</td><td class="num">${e.recu?'':`<button class="btn sm" onclick="recEch('${l.id}','${e.id}')">Marquer reçu</button> <button class="btn sm" onclick="relEch('${l.id}','${e.id}')">Relancer</button> `}<button class="btn sm" onclick="editEch('${l.id}','${e.id}')">Éditer</button></td></tr>`).join('')}</tbody></table>`:'<div class="small mute">Aucune échéance.</div>'}</div>`}).join('')}`;
}
const ECHF=()=>[{k:'date',l:'Date prévue',t:'date',req:1},{k:'libelle',l:'Libellé (acompte, tranche…)',t:'text',req:1,full:1},{k:'montant',l:'Montant (MAD)',t:'number'},{k:'recu',l:'Reçu ?',t:'select',o:[['','Non'],['1','Oui']]},{k:'dateRecu',l:'Date de réception',t:'date'}];
function syncAcompte(l){l.acompte=sum((l.echeances||[]).filter(e=>e.recu),e=>e.montant)}
function newEch(id){const l=S.lots.find(x=>x.id===id);openForm({title:'Échéance – '+l.nom,fields:ECHF(),data:{date:today()},onSave:o=>{o.recu=!!o.recu;l.echeances.push({id:uid('e'),...o});syncAcompte(l)}})}
function editEch(id,eid){const l=S.lots.find(x=>x.id===id),e=l.echeances.find(x=>x.id===eid);openForm({title:'Échéance',fields:ECHF(),data:{...e,recu:e.recu?'1':''},onSave:o=>{o.recu=!!o.recu;Object.assign(e,o);syncAcompte(l)},onDelete:()=>{l.echeances=l.echeances.filter(x=>x!==e);syncAcompte(l)}})}
function recEch(id,eid){const l=S.lots.find(x=>x.id===id),e=l.echeances.find(x=>x.id===eid);e.recu=true;e.dateRecu=today();syncAcompte(l);save();render()}
function relEch(id,eid){const l=S.lots.find(x=>x.id===id),e=l.echeances.find(x=>x.id===eid);const b=(S.prospects.find(p=>p.id===l.acheteur)||{}).nom||'acheteur';S.tasks.push({id:uid('t'),titre:`Relancer ${b} – ${l.nom} : ${m2(e.montant)} MAD (échéance ${fd(e.date)})`,echeance:today(),priorite:'Haute',statut:'À faire',lien:'Ventes',notes:''});save();alert('Tâche de relance créée dans « Tâches ».')}
function salGen(){
  const opts=S.lots.map(l=>`<option value="${l.id}">${esc(l.nom)}</option>`).join('');
  return `<div class="card"><h3>Générer un document</h3><div class="row"><select id="gl">${opts}</select><button class="btn" onclick="genContrat(gl.value)">Contrat de réservation</button><button class="btn" onclick="genRecu(gl.value)">Reçu d’acompte</button><button class="btn" onclick="genFiche(gl.value)">Fiche de lot</button></div>
  <p class="small mute">Les données de l’acheteur viennent du prospect rattaché au lot. Les modèles sont indicatifs : faites-les valider par le notaire avant signature (vente en l’état futur d’achèvement).</p></div>`;
}
const buyerOf=l=>S.prospects.find(p=>p.id===l.acheteur)||{nom:'',tel:'',email:''};
function genFiche(id){
  const l=S.lots.find(x=>x.id===id),p=S.projet;
  printDoc('Fiche lot '+l.nom,`${hdr()}<h1>FICHE DE LOT</h1><p style="text-align:center">${esc(p.nom)}<br>${esc(p.commune)} · T.F. ${esc(p.tf)}</p><table><tr><th>Lot</th><td>${esc(l.nom)}</td></tr><tr><th>Niveau</th><td>${esc(l.niveau)}</td></tr><tr><th>Surface</th><td>${m2(l.surface)} m²</td></tr><tr><th>Prix au m²</th><td>${m0(l.prixM2)} MAD</td></tr><tr><th>Prix total</th><td><b>${m2(l.surface*l.prixM2)} MAD</b></td></tr><tr><th>Statut</th><td>${esc(l.statut)}</td></tr></table><p><small>Document non contractuel – ${fd(today())}</small></p>`);
}
function genRecu(id){
  const l=S.lots.find(x=>x.id===id),b=buyerOf(l),rec=(l.echeances||[]).filter(e=>e.recu).sort((a,c)=>a.dateRecu<c.dateRecu?1:-1)[0];
  const m=rec?rec.montant:l.acompte||0,d=rec?rec.dateRecu:today();
  printDoc('Reçu '+l.nom,`${hdr()}<h1>REÇU D’ACOMPTE</h1><p style="text-align:center"><small>N° ${esc(l.id)}-${d.replace(/-/g,'')}</small></p><p>Nous, <b>${esc(S.societe.nom)}</b>, reconnaissons avoir reçu de <b>${esc(b.nom||'………………………………')}</b> la somme de <b>${m2(m)} MAD</b> (${enLettres(m)}), à titre d’acompte${rec&&rec.libelle?' ('+esc(rec.libelle)+')':''} sur la réservation du lot <b>${esc(l.nom)}</b> du projet ${esc(S.projet.nom)}, ${esc(S.projet.commune)}.</p><p>Prix convenu du lot : ${m2(l.surface*l.prixM2)} MAD.</p><p>Fait à Rabat, le ${fd(d)}.</p><div class="sig"><div>Le réservataire</div><div>Pour ${esc(S.societe.nom)}<br>${esc(S.societe.gerant)}</div></div>`);
}
function genContrat(id){
  const l=S.lots.find(x=>x.id===id),b=buyerOf(l),p=S.projet,s=S.societe,prix=l.surface*l.prixM2;
  printDoc('Contrat de réservation '+l.nom,`${hdr()}<h1>CONTRAT DE RÉSERVATION</h1>
  <h2>Entre les soussignés</h2><p><b>${esc(s.nom)}</b>, ${esc(s.forme)}, ICE ${esc(s.ice)}, siège : ${esc(s.adresse)}, représentée par ${esc(s.gerant)}, gérant, ci-après « le Promoteur » ;</p>
  <p>Et <b>${esc(b.nom||'………………………………………')}</b>, CIN n° ………………………, demeurant à ………………………………………, tél. ${esc(b.tel||'………………')}, e-mail ${esc(b.email||'………………')}, ci-après « le Réservataire ».</p>
  <h2>Article 1 – Objet</h2><p>Le Promoteur réserve au Réservataire le lot <b>${esc(l.nom)}</b>${l.niveau?' (niveau '+esc(l.niveau)+')':''}, d’une surface de ${m2(l.surface)} m², dans l’immeuble en cours de construction « ${esc(p.nom)} », ${esc(p.commune)}, titre foncier n° ${esc(p.tf)}, selon le permis de construire n° ${esc(p.permis)}.</p>
  <h2>Article 2 – Prix et paiement</h2><p>Prix : <b>${m2(prix)} MAD</b> (${enLettres(prix)}), soit ${m0(l.prixM2)} MAD/m². Modalités :</p>
  <table><tr><th>Date</th><th>Libellé</th><th class="r">Montant (MAD)</th></tr>${(l.echeances||[]).map(e=>`<tr><td>${fd(e.date)}</td><td>${esc(e.libelle)}</td><td class="r">${m2(e.montant)}</td></tr>`).join('')||'<tr><td>……</td><td>Acompte à la réservation</td><td class="r">……</td></tr><tr><td>……</td><td>Solde à la signature de l’acte</td><td class="r">……</td></tr>'}</table>
  <h2>Article 3 – Acte définitif</h2><p>Les parties s’engagent à signer l’acte définitif devant notaire au plus tard le …………………, sous réserve de la production des pièces requises.</p>
  <h2>Article 4 – Livraison</h2><p>La livraison est prévue au plus tard le ………………………, sous réserve des cas de force majeure.</p>
  <h2>Article 5 – Désistement</h2><p>En cas de désistement du Réservataire, les sommes versées sont ………………………………………………. En cas de défaillance du Promoteur, elles sont restituées intégralement.</p>
  <h2>Article 6 – Litiges</h2><p>Tout litige relève des tribunaux compétents de Rabat.</p>
  <p>Fait à Rabat, le ${fd(today())}, en deux exemplaires.</p><div class="sig"><div>Le Réservataire<br><small>(lu et approuvé)</small></div><div>Le Promoteur</div></div><p><small>Modèle indicatif, à faire valider par le notaire.</small></p>`);
}
function salSim(){
  return `<div class="card"><h3>Simulateur de prix et de coûts</h3>
  <div class="form"><div><label>Variation du prix de vente : <b id="svp">0 %</b></label><input type="range" id="sp" min="-20" max="20" step="1" value="0" style="padding:0" oninput="simCalc()"></div><div><label>Variation des coûts de construction : <b id="svc">0 %</b></label><input type="range" id="sc" min="-20" max="30" step="1" value="0" style="padding:0" oninput="simCalc()"></div></div>
  <div id="simout" style="margin-top:14px"></div></div>`;
}
function simCalc(){
  const p=+document.getElementById('sp').value,c=+document.getElementById('sc').value,C=S.compta,k=calc();
  document.getElementById('svp').textContent=(p>0?'+':'')+p+' %';document.getElementById('svc').textContent=(c>0?'+':'')+c+' %';
  const r=C.tvaVente/100,ca=k.ca*(1+p/100),caHT=C.venteTTC?ca/(1+r):ca,cout=budgetFiscal().coutsHT*(1+c/100),marge=caHT-cout,surf=sum(S.lots,l=>l.surface);
  const be=(cout*(C.venteTTC?(1+r):1))/surf;
  document.getElementById('simout').innerHTML=`<div class="grid kpis">${tile('CA HT',MAD(caHT))}${tile('Coûts HT',MAD(cout),'Budget − TVA déductible estimée')}${tile('Marge',MAD(marge),caHT?dec(Math.round(marge/caHT*1000)/10)+' % du CA HT':'',marge<0?'color:var(--bad)':'color:var(--ok)')}${tile('Prix de vente d’équilibre',m0(be)+' MAD/m²','Marge nulle',''
  )}</div>`;
}
window.addEventListener('load',()=>{});
document.addEventListener('click',()=>{if(document.getElementById('sp')&&!document.getElementById('simout').innerHTML)simCalc()});
new MutationObserver(()=>{if(document.getElementById('sp')&&!document.getElementById('simout').innerHTML)simCalc()}).observe(document.documentElement,{childList:true,subtree:true});

/* ================= COMPTABILITÉ AVANCÉE ================= */
function fiscalEvents(){
  const C=S.compta,T=tvaData(),ev=[],Y=new Date().getFullYear();
  const per=k=>T.rows.find(r=>r.k===k);
  if(C.regime==='trimestriel'){
    for(const y of [Y-1,Y,Y+1])[[1,'04-30'],[2,'07-31'],[3,'10-31'],[4,'01-31']].forEach(([q,dm])=>{
      const dy=q===4?y+1:y,d=`${dy}-${dm}`,k=`${y}-T${q}`,r=per(k);
      ev.push({key:'tva-'+k,date:d,label:`Déclaration et paiement TVA – T${q} ${y}`,amt:r?(r.due?`${m2(r.due)} à payer`:`crédit ${m2(r.credit)}`):''});
    });
  }else{
    for(let i=0;i<14;i++){const k=addMonths(ym(today()),i-2),nx=addMonths(k,1),d=new Date(Date.UTC(+nx.slice(0,4),+nx.slice(5),0)).toISOString().slice(0,10),r=per(k);
      ev.push({key:'tva-'+k,date:d,label:`Déclaration et paiement TVA – ${mlabel(k)}`,amt:r?(r.due?`${m2(r.due)} à payer`:`crédit ${m2(r.credit)}`):''})}
  }
  for(const y of [Y,Y+1]){
    ev.push({key:'is-decl-'+y,date:`${y}-03-31`,label:`Déclaration du résultat fiscal et paiement du solde d’IS (exercice ${y-1})`,amt:''});
    ['03-31','06-30','09-30','12-31'].forEach((dm,i)=>ev.push({key:`is-ac-${y}-${i}`,date:`${y}-${dm}`,label:`Acompte provisionnel d’IS n°${i+1} (non dû au 1er exercice)`,amt:''}));
  }
  return ev.filter(e=>e.date>=addMonths(ym(today()),-3)+'-01').sort((a,b)=>a.date<b.date?-1:1).slice(0,16);
}
function deductionRows(k){
  return S.invoices.filter(i=>i.tva>0).map(i=>{
    const base=S.compta.base==='facture'?i.date:i.datePaiement,part=S.compta.base==='facture'?1:Math.min(1,i.paye/i.ttc);
    return {i,base,part};
  }).filter(x=>x.base&&x.part>0&&periodKey(x.base)===k);
}
function cptExtra(){
  const T=tvaData(),keys=T.rows.map(r=>r.k),sel=UI.cptPer&&keys.includes(UI.cptPer)?UI.cptPer:keys[keys.length-1];
  const rows=sel?deductionRows(sel):[];
  const fe=fiscalEvents();
  return `<h3 class="mute" style="margin:26px 0 8px">Relevé des déductions de TVA – préparation de la déclaration</h3>
  <div class="tools"><select onchange="UI.cptPer=this.value;render()">${keys.map(k=>`<option value="${k}" ${k===sel?'selected':''}>${periodLabel(k)}</option>`).join('')}</select><button class="btn" onclick="exportDeductions('${sel}')">Exporter (CSV)</button></div>
  <div class="tw"><table><thead><tr><th>Fournisseur</th><th>ICE</th><th>N° facture</th><th>Date facture</th><th>Date paiement</th><th>Mode</th><th class="num">HT</th><th class="num">TVA déduite</th><th class="num">TTC</th></tr></thead><tbody>${rows.map(({i,part})=>{const c=S.contacts.find(x=>x.id===i.fournisseur)||{};return `<tr class="click" onclick="editInvoice('${i.id}')"><td>${esc(c.nom||'—')}</td><td class="small">${esc(c.ice||'')}</td><td>${esc(i.numero)}</td><td>${fd(i.date)}</td><td>${fd(i.datePaiement)}</td><td class="small">${esc(i.mode)}</td><td class="num">${m2(i.ht*part)}</td><td class="num">${m2(i.tva*part)}</td><td class="num">${m2(i.ttc*part)}</td></tr>`}).join('')||'<tr><td colspan="9" class="empty">Aucune déduction sur cette période.</td></tr>'}</tbody><tfoot><tr><td colspan="6">Total</td><td class="num">${m2(sum(rows,x=>x.i.ht*x.part))}</td><td class="num">${m2(sum(rows,x=>x.i.tva*x.part))}</td><td class="num">${m2(sum(rows,x=>x.i.ttc*x.part))}</td></tr></tfoot></table></div>
  <p class="small mute">Contenu type d’un état de déduction (fournisseur, ICE, n° et date de facture, mode et date de paiement, HT, TVA). Une facture réglée en espèces au-delà des plafonds légaux n’ouvre pas droit à déduction : à vérifier avec la fiduciaire.</p>
  <h3 class="mute" style="margin:26px 0 8px">Échéances fiscales</h3>
  <div class="card">${fe.map(e=>`<div class="task ${S.fiscal[e.key]?'done':''}"><input type="checkbox" ${S.fiscal[e.key]?'checked':''} onchange="S.fiscal['${e.key}']=this.checked;save();render()"><div style="flex:1"><div class="t"><b>${esc(e.label)}</b></div><div class="small mute"><span style="color:${e.date<today()&&!S.fiscal[e.key]?'var(--bad)':'inherit'}">Avant le ${fd(e.date)}</span>${e.amt?' · '+esc(e.amt):''}</div></div></div>`).join('')}<div class="small mute" style="margin-top:8px">Dates indicatives selon le régime choisi : à valider avec la fiduciaire.</div></div>
  <h3 class="mute" style="margin:26px 0 8px">Exports pour l’expert-comptable</h3>
  <div class="row"><button class="btn" onclick="exportBankJournal()">Journal de banque (CSV)</button><button class="btn" onclick="exportPieces()">Liste des pièces numérotées (CSV)</button><button class="btn" onclick="exportJournal()">Journal des achats (CSV)</button></div>${typeof cptXlsxBox==='function'?cptXlsxBox():''}`;
}
function csv(name,rows){const q=csvCell;download(name,'﻿'+rows.map(r=>r.map(q).join(';')).join('\r\n'),'text/csv')}
function exportDeductions(k){csv('releve_deductions_'+k+'.csv',[['Fournisseur','ICE','N° facture','Date facture','Date paiement','Mode','HT','TVA','TTC']].concat(deductionRows(k).map(({i,part})=>{const c=S.contacts.find(x=>x.id===i.fournisseur)||{};return [c.nom,c.ice,i.numero,fd(i.date),fd(i.datePaiement),i.mode,(i.ht*part).toFixed(2),(i.tva*part).toFixed(2),(i.ttc*part).toFixed(2)]})))}
function exportBankJournal(){
  const rows=[['Date','N° pièce','Libellé','Compte','Débit','Crédit','Factures']];
  S.bank.forEach((b,i)=>{const p='BQ-'+b.date.slice(0,4)+'-'+String(b.n).padStart(3,'0');
    rows.push([fd(b.date),p,b.label,'5141 Banque',b.credit||'',b.debit||'',(b.factures||[]).join(' ')]);
    rows.push([fd(b.date),p,b.label,b.type==='apport'?'4463 Associé compte courant':b.factures&&b.factures.length?'4411 Fournisseurs':b.categorie==='Frais bancaires'?'6147 Services bancaires':'à affecter',b.debit||'',b.credit||'',''])});
  csv('journal_banque_cymsar.csv',rows);
}
function exportPieces(){
  const rows=[['N° pièce','Date','Fournisseur','N° facture','HT','TVA','TTC','Fichier']];
  S.invoices.slice().sort((a,b)=>a.date<b.date?-1:1).forEach((i,n)=>rows.push(['AC-'+i.date.slice(0,4)+'-'+String(n+1).padStart(3,'0')+' ('+i.id+')',fd(i.date),cn(i.fournisseur),i.numero,i.ht,i.tva,i.ttc,i.fichier]));
  csv('pieces_cymsar.csv',rows);
}

/* ================= DÉPENSE RAPIDE (photo) ================= */
function qxInput(){ // champ fichier permanent dans la page : fiable sur téléphone (le navigateur peut se recharger pendant la prise de vue)
  let i=document.getElementById('qx');
  if(!i){i=document.createElement('input');i.type='file';i.id='qx';i.accept='image/*,application/pdf';i.style.cssText='position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0';i.onchange=qxChange;document.body.appendChild(i)}
  return i;
}
function quickExpense(){
  if(!SERVER){alert('La photo de facture nécessite le serveur : lancez « Lancer le CRM.bat » (voir Paramètres pour l’utiliser sur téléphone).');return}
  if(window.ME&&window.ME.role==='lecture'){alert('Accès en lecture seule.');return}
  const i=qxInput();i.value='';i.click();
}
async function qxChange(ev){
  const inp=ev.target,f=inp.files&&inp.files[0];if(!f)return;
  const nums=[...S.invoices.map(i=>i.id),...(typeof pendingInvoices==='function'?pendingInvoices().map(i=>i.id):[])].map(x=>+(x.match(/(\d+)$/)||[0,0])[1]);
  const id='A-'+String(Math.max(0,...nums)+1).padStart(3,'0'),ext=(f.name.match(/\.[A-Za-z0-9]+$/)||['.jpg'])[0];
  flash('1/3 Envoi de la photo vers Google Drive… ('+Math.round(f.size/1024)+' Ko)');
  let j;
  try{const r=await fetch('/api/upload?kind=achat&name='+encodeURIComponent('FA '+id+' photo'+ext),{method:'POST',body:f});j=await r.json()}
  catch(err){flash('Envoi impossible : '+(err.message||err)+'\nVérifiez la connexion Internet.','bad');return}
  if(!j.path){flash('Envoi refusé : '+(j.error||'réponse inattendue du script Google')+(/ROOT_ID|introuvable/i.test(j.error||'')?'\n→ vérifiez la propriété ROOT_ID du script (dossier CYMSAR).':/auth/i.test(j.error||'')?'\n→ code d’accès refusé : reconnectez-vous.':'')+'.','bad');return}
  flash('2/3 Photo enregistrée : '+j.path+'\nOuverture de la facture, lecture automatique en cours…','ok');
  if(!window.WEB){try{await loadScan()}catch(_){}}
  newInvoice({id,fichier:j.path},true);
}

/* ================= PARAMÈTRES : serveur ================= */
function setExtra(){
  return `<div class="card"><h3>Serveur & accès</h3>
  <p class="small">Mode actuel : ${SERVER?'<b style="color:var(--ok)">serveur local actif</b> (sauvegarde automatique dans le Drive, analyse du dossier, lecture des factures)':'<b style="color:var(--bad)">fichier ouvert directement</b> – fonctions limitées'}.</p>
  <p class="small mute">Pour utiliser le CRM sur téléphone : ouvrez <code>CRM\\config.json</code>, mettez <code>"lan": true</code> et choisissez un <code>"code"</code> d’accès, puis relancez « Lancer le CRM.bat ». L’adresse à saisir sur le téléphone (même Wi-Fi) s’affiche dans la fenêtre noire.</p>
  ${SERVER?'<button class="btn" onclick="loadScan().then(render)">Actualiser l’analyse du dossier</button>':''} ${window.WEB?'<button class="btn" onclick="webLogout()">Se déconnecter</button>':''}</div>
  <div class="card"><h3>Ajouter des éléments (fichier JSON)</h3><p class="small mute">Ajoute au CRM des entrées de journal, contacts ou tâches préparées dans un fichier, <b>sans rien écraser</b>. Les éléments déjà présents sont ignorés.</p><label class="btn">Choisir un fichier<input type="file" accept=".json,application/json" style="display:none" onchange="mergeImport(this)"></label></div>
  <div class="card"><h3>Sauvegardes</h3><p class="small mute">Une copie datée de <code>donnees.json</code> est conservée chaque jour dans <code>CRM\\sauvegardes</code> (60 jours).</p></div>`;
}

/* ================= VÉRIFICATION AUTOMATIQUE DES TÂCHES ================= */
const listOf=(p,sep)=>String(p||'').split(sep).map(x=>x.trim()).filter(Boolean);
const VERIFS={
  facturesPayees:{l:'Factures payées (param. : n° séparés par des virgules)',f:p=>{
    const bad=listOf(p,',').filter(id=>{const i=S.invoices.find(x=>x.id===id);return !i||i.ttc-i.paye>0.005});
    return {ok:!bad.length,detail:bad.length?'reste à régler : '+bad.join(', '):'toutes payées'}}},
  banqueAJour:{l:'Relevé bancaire à jour (param. : mois AAAA-MM)',f:p=>{
    const last=S.bank.map(b=>b.date).sort().pop()||'';
    return {ok:last>=p+'-01',detail:'dernière opération : '+(last?fd(last):'aucune')+', attendu : '+p}}},
  montantsBanque:{l:'Paiements enregistrés au bon montant (param. : n° de factures)',f:p=>{
    const lines=S.bank.concat(SC&&SC.bank||[]),bad=[];
    listOf(p,',').forEach(id=>{const b=lines.find(x=>(x.factures||[]).includes(id)&&x.debit>0),i=S.invoices.find(x=>x.id===id);
      if(!b)bad.push(id+' (paiement non trouvé)');
      else{const tot=sum(b.factures.map(f=>S.invoices.find(x=>x.id===f)).filter(Boolean),x=>x.ttc);if(Math.abs(tot-b.debit)>0.02)bad.push(`${id} (débit ${m2(b.debit)} ≠ ${m2(tot)})`)}});
    return {ok:!bad.length,detail:bad.join(' ; ')||'montants cohérents'}}},
  fichiersNonVides:{l:'Fichiers présents et non vides (param. : chemins séparés par |)',f:p=>{
    if(!SC)return null;
    const bad=listOf(p,'|').filter(x=>{const f=SC.files.find(y=>y.path===x);return !f||f.size===0});
    return {ok:!bad.length,detail:bad.length?'vide ou absent : '+bad.join(', '):'tous présents'}}},
  fichiersAbsents:{l:'Fichiers supprimés (param. : chemins séparés par |)',f:p=>{
    if(!SC)return null;
    const bad=listOf(p,'|').filter(x=>SC.files.some(y=>y.path===x));
    return {ok:!bad.length,detail:bad.length?'toujours présent : '+bad.join(', '):'supprimés'}}},
  lotsRenseignes:{l:'Lots renseignés (niveau et prix) et au moins 1 prospect actif',f:()=>{
    const bad=S.lots.filter(l=>!l.niveau||!(l.prixM2>0));
    const np=S.prospects.filter(p=>p.statut!=='Perdu').length,d=[];if(bad.length)d.push('niveau à renseigner : '+bad.map(l=>l.nom).join(', '));if(!np)d.push('aucun prospect actif');return {ok:!d.length,detail:d.join(' ; ')||'lots renseignés, '+np+' prospect(s) actif(s)'}}},
  aucuneAlerte:{l:'Plus aucune alerte de contrôle sur un mot (param. : mot, ex. A-025)',f:p=>{
    const bad=checks().filter(c=>c.msg.includes(p));return {ok:!bad.length,detail:bad.length?bad.length+' alerte(s) restante(s)':'aucune alerte'}}}
};
function verifOpts(){return [['','Aucune (cochée à la main)'],...Object.keys(VERIFS).map(k=>[k,VERIFS[k].l])]}
function taskResult(t){
  if(!t.verif||!VERIFS[t.verif])return undefined;
  try{return VERIFS[t.verif].f(t.param)}catch(e){return null}
}
function autoTasks(){
  let ch=false;
  S.tasks.forEach(t=>{
    if(t.statut==='Fait')return;
    const r=taskResult(t);
    if(r&&r.ok){t.statut='Fait';t.autoFait=today();ch=true}
  });
  if(ch)save();
}
function taskBadge(t){
  const r=taskResult(t);
  if(r===undefined)return '';
  if(r===null)return '<span class="chip gray">Vérification impossible : lancez le serveur</span>';
  if(r.ok)return `<span class="chip ok">✓ Vérifiée automatiquement${t.autoFait?' le '+fd(t.autoFait):''}</span>`;
  return t.statut==='Fait'?`<span class="chip bad">⚠ Cochée mais non vérifiée : ${esc(r.detail)}</span>`:`<span class="chip warn">⏳ ${esc(r.detail)}</span>`;
}
