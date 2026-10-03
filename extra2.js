/* CRM CYMSAR – module 2 : historique/annulation, droits, rapprochement bancaire, import de relevés PDF,
   versions de budget, projets multiples, avancement mesuré, recherche globale, application installable. */
"use strict";
window.EXTRA_PAGES.push({at:12,page:['hist','Historique','hist']});
Object.assign(window.EXTRA_ICONS,{hist:'<svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></svg>'});
Object.assign(window.EXTRA_VIEWS,{hist:vHist});

const normS=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const gerantDans=l=>{const n=normS(String(S.societe.gerant||'').split(' ').pop());return !!n&&normS(l).includes(n)};
const isRO=()=>!!(window.ME&&window.ME.role==='lecture');

/* ---------- projets ---------- */
function curProj(){try{return localStorage.getItem('cymsar_proj')||'principal'}catch(e){return 'principal'}}
function PQ(){return '?p='+encodeURIComponent(curProj())}
window.PROJETS=[{id:'principal',nom:'Projet principal'}];
async function bootX(){
  try{const r=await fetch('/api/me');if(r.ok)window.ME=await r.json()}catch(e){}
  try{const r=await fetch('/api/projets');if(r.ok)window.PROJETS=await r.json()}catch(e){}
  const nav=document.getElementById('nav');
  if(nav&&!document.getElementById('projsel')){
    const box=document.createElement('div');box.style.cssText='padding:0 4px 10px';
    box.innerHTML=`<button class="btn" id="gs" style="width:100%;margin-bottom:8px;font-weight:500;opacity:.9" onclick="openSearch()">🔍 Rechercher <small style="opacity:.6">Ctrl+K</small></button>
    <select id="projsel" style="width:100%" onchange="switchProj(this.value)">${window.PROJETS.map(p=>`<option value="${p.id}" ${p.id===curProj()?'selected':''}>${esc(p.nom)}</option>`).join('')}<option value="__new">+ Nouveau projet…</option></select>`;
    nav.parentNode.insertBefore(box,nav);
  }
  if('serviceWorker' in navigator&&(location.hostname==='localhost'||location.protocol==='https:'))navigator.serviceWorker.register('sw.js').catch(()=>{});
}
async function switchProj(v){
  if(v==='__new'){
    const nom=prompt('Nom du nouveau projet :');if(!nom){document.getElementById('projsel').value=curProj();return}
    const dossier=prompt('Dossier du projet dans le Drive (ex. PROJET2). Laissez vide s’il n’en a pas encore :','')||'';
    const r=await fetch('/api/projets',{method:'POST',body:JSON.stringify({nom,dossier})});
    if(!r.ok){alert('Création impossible (droits ?).');return}
    const pr=await r.json();
    const T=JSON.parse(JSON.stringify(S));
    ['invoices','bank','caisse','lots','prospects','docs','tasks','contrats','journal','previsions','audit','budgetVersions','ignored'].forEach(k=>T[k]=[]);
    T.fiscal={};T.projet=Object.assign({},S.projet,{nom,tf:'',terrain:0,permis:'',datePermis:'',surfaces:[],architecte:'',controle:'',labo:'',notaire:'',statut:'Étude',notes:'',dossier});
    T.budget=S.budget.map(b=>({categorie:b.categorie,estime:0,note:''}));
    T.phases=S.phases.map(p=>({nom:p.nom,pct:0,debut:'',fin:''}));
    await fetch('/api/data?p='+encodeURIComponent(pr.id),{method:'PUT',body:JSON.stringify(T)});
    localStorage.setItem('cymsar_proj',pr.id);location.reload();return;
  }
  localStorage.setItem('cymsar_proj',v);location.reload();
}

/* ---------- initialisation des données ---------- */
function ensureX(){
  S.audit=S.audit||[];S.releves=S.releves||{};
  if(!S.budgetVersions||!S.budgetVersions.length)S.budgetVersions=[{id:'v0',nom:'Estimation initiale',date:new Date().toISOString().slice(0,10),lignes:S.budget.map(b=>({categorie:b.categorie,estime:b.estime}))}];
  S.phases.forEach(p=>{p.contrat=p.contrat||'';p.auto=p.auto||''});
}

/* ---------- historique des modifications ---------- */
const AUD={
  invoices:{n:'Facture',k:o=>o.id,l:o=>o.id+' · '+cn(o.fournisseur)},
  contacts:{n:'Contact',k:o=>o.id,l:o=>o.nom},
  bank:{n:'Opération bancaire',k:o=>String(o.n)+'|'+o.date,l:o=>'ligne '+o.n+' '+String(o.label).slice(0,40)},
  lots:{n:'Lot',k:o=>o.id,l:o=>o.nom},
  prospects:{n:'Prospect',k:o=>o.id,l:o=>o.nom},
  tasks:{n:'Tâche',k:o=>o.id,l:o=>String(o.titre).slice(0,60)},
  budget:{n:'Budget',k:o=>o.categorie,l:o=>o.categorie},
  contrats:{n:'Contrat',k:o=>o.id,l:o=>o.objet},
  journal:{n:'Journal chantier',k:o=>o.id,l:o=>fd(o.date)+' '+o.type},
  previsions:{n:'Prévision',k:o=>o.id,l:o=>o.libelle},
  phases:{n:'Phase',k:o=>o.nom,l:o=>o.nom},
  docs:{n:'Document',k:o=>o.id,l:o=>o.titre},
  caisse:{n:'Caisse',k:o=>o.date+'|'+o.label+'|'+o.debit+'|'+o.credit,l:o=>o.label}
};
const AUD_ONE={societe:'Société',projet:'Projet',compta:'Paramètres comptables'};
let _snap=null;
const clone=x=>JSON.parse(JSON.stringify(x));
function snapshot(){const o={};Object.keys(AUD).forEach(k=>o[k]=clone(S[k]||[]));Object.keys(AUD_ONE).forEach(k=>o[k]=clone(S[k]||{}));return o}
function auditInit(){_snap=snapshot()}
function auditStep(){
  if(!_snap){auditInit();return}
  const now=snapshot(),ents=[],t=new Date().toISOString(),u=(window.ME&&window.ME.nom)||'Local';
  for(const c of Object.keys(AUD)){
    const A=AUD[c],old=new Map(_snap[c].map(o=>[A.k(o),o])),cur=new Map(now[c].map(o=>[A.k(o),o]));
    for(const [k,o] of cur){
      if(!old.has(k)){ents.push({t,u,a:'créé',c,key:k,label:A.l(o),obj:o});continue}
      const p=old.get(k),before={},after={};
      for(const f of new Set([...Object.keys(p),...Object.keys(o)]))if(JSON.stringify(p[f])!==JSON.stringify(o[f])){before[f]=p[f];after[f]=o[f]}
      if(Object.keys(after).length)ents.push({t,u,a:'modifié',c,key:k,label:A.l(o),before,after});
    }
    for(const [k,o] of old)if(!cur.has(k))ents.push({t,u,a:'supprimé',c,key:k,label:A.l(o),obj:o});
  }
  for(const c of Object.keys(AUD_ONE)){
    const before={},after={};
    for(const f of new Set([...Object.keys(_snap[c]),...Object.keys(now[c])]))if(JSON.stringify(_snap[c][f])!==JSON.stringify(now[c][f])){before[f]=_snap[c][f];after[f]=now[c][f]}
    if(Object.keys(after).length)ents.push({t,u,a:'modifié',c,key:c,label:AUD_ONE[c],before,after,one:true});
  }
  if(ents.length){S.audit.push(...ents);if(S.audit.length>3000)S.audit.splice(0,S.audit.length-3000)}
  _snap=now;
}
function auditUndo(i){
  const e=S.audit[i];if(!e||e.undone)return;
  if(!confirm(`Annuler cette modification ?\n${e.a} · ${AUD[e.c]?AUD[e.c].n:AUD_ONE[e.c]} · ${e.label}`))return;
  const A=AUD[e.c];
  if(e.one){Object.assign(S[e.c],clone(e.before))}
  else if(e.a==='créé'){S[e.c]=S[e.c].filter(o=>A.k(o)!==e.key)}
  else if(e.a==='supprimé'){S[e.c].push(clone(e.obj))}
  else{const o=S[e.c].find(o=>A.k(o)===e.key);if(!o){alert('L’élément n’existe plus.');return}Object.assign(o,clone(e.before))}
  e.undone=true;save();render();
}
const short=v=>{const s=typeof v==='object'?JSON.stringify(v):String(v??'');return s.length>40?s.slice(0,38)+'…':s};
function vHist(){
  const f=UI.hist||(UI.hist={q:'',c:''}),q=normS(f.q);
  const all=S.audit.map((e,i)=>({e,i})).reverse().filter(({e})=>(!f.c||e.c===f.c)&&(!q||normS(e.label+' '+e.u+' '+Object.keys(e.after||{}).join(' ')).includes(q)));
  const cats=[...Object.keys(AUD),...Object.keys(AUD_ONE)];
  return `<div class="top"><div><h1>Historique des modifications</h1><p class="sub">${S.audit.length} modification(s) enregistrées. Vous pouvez annuler une modification (elle est alors elle-même tracée).</p></div></div>
  <div class="tools"><input type="search" placeholder="Rechercher…" value="${esc(f.q)}" oninput="UI.hist.q=this.value;rk()"><select onchange="UI.hist.c=this.value;render()"><option value="">Tout</option>${cats.map(c=>`<option value="${c}" ${f.c===c?'selected':''}>${esc(AUD[c]?AUD[c].n:AUD_ONE[c])}</option>`).join('')}</select></div>
  <div class="tw"><table><thead><tr><th>Date</th><th>Utilisateur</th><th>Action</th><th>Élément</th><th>Détail</th><th></th></tr></thead><tbody>
  ${all.slice(0,300).map(({e,i})=>`<tr><td class="small">${new Date(e.t).toLocaleString('fr-FR')}</td><td>${esc(e.u)}</td><td><span class="chip ${e.a==='créé'?'ok':e.a==='supprimé'?'bad':'blue'}">${e.a}</span></td><td><b>${esc(AUD[e.c]?AUD[e.c].n:AUD_ONE[e.c])}</b><div class="small mute">${esc(e.label)}</div></td><td class="small">${e.a==='modifié'?Object.keys(e.after).slice(0,4).map(k=>`${esc(k)} : ${esc(short(e.before[k]))} → <b>${esc(short(e.after[k]))}</b>`).join('<br>'):''}</td><td>${e.undone?'<span class="chip gray">Annulée</span>':isRO()?'':`<button class="btn sm" onclick="auditUndo(${i})">Annuler</button>`}</td></tr>`).join('')||'<tr><td colspan="6" class="empty">Aucune modification.</td></tr>'}
  </tbody></table></div>${all.length>300?'<p class="small mute">300 plus récentes affichées.</p>':''}`;
}

/* ---------- rapprochement bancaire automatique ---------- */
function dedupBank(list){
  const cnt={};S.bank.forEach(b=>{const k=b.date+'|'+b.debit+'|'+b.credit;cnt[k]=(cnt[k]||0)+1});
  return list.filter(b=>{const k=b.date+'|'+b.debit+'|'+b.credit;if(cnt[k]>0){cnt[k]--;return false}return true});
}
function suggestMatches(){
  const lines=S.bank.filter(b=>b.debit>0&&!(b.factures||[]).length&&b.type==='depense'&&!b.categorie);
  const unpaid=S.invoices.filter(i=>i.ttc-i.paye>0.005);
  const out=[];
  lines.forEach(b=>{
    const lab=normS(b.label),cands=[];
    const n=unpaid.length;
    for(let a=0;a<n;a++){
      const ra=unpaid[a].ttc-unpaid[a].paye;
      if(Math.abs(ra-b.debit)<0.02)cands.push([unpaid[a]]);
      for(let c=a+1;c<n;c++){
        const rc=ra+unpaid[c].ttc-unpaid[c].paye;
        if(Math.abs(rc-b.debit)<0.02)cands.push([unpaid[a],unpaid[c]]);
        for(let d=c+1;d<n;d++)if(Math.abs(rc+unpaid[d].ttc-unpaid[d].paye-b.debit)<0.02)cands.push([unpaid[a],unpaid[c],unpaid[d]]);
      }
    }
    cands.forEach(set=>{
      let sc=60;
      const names=set.map(i=>normS(cn(i.fournisseur)).split(/[^a-z0-9]+/).filter(w=>w.length>=4));
      if(names.some(ws=>ws.some(w=>lab.includes(w))))sc+=30;
      const dd=Math.min(...set.map(i=>Math.abs((new Date(b.date)-new Date(i.date))/864e5)));
      if(dd<=45)sc+=10;
      sc-=(set.length-1)*5;
      out.push({b,set,sc});
    });
  });
  return out.sort((x,y)=>y.sc-x.sc);
}
function reconBox(){
  const sug=suggestMatches(),seen=new Set(),top=sug.filter(s=>{if(seen.has(s.b.n))return false;seen.add(s.b.n);return true}).slice(0,8);
  const orph=S.bank.filter(b=>b.debit>0&&!(b.factures||[]).length&&b.type==='depense'&&!b.categorie);
  if(!top.length&&!orph.length)return '';
  return `<div class="card" style="margin-bottom:12px"><h3>Rapprochement bancaire automatique</h3>
  ${top.map(s=>`<div class="row" style="justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--line)"><span class="small">${fd(s.b.date)} · <b>${esc(s.b.label.slice(0,45))}</b> · ${m2(s.b.debit)} <span class="mute">↔</span> ${s.set.map(i=>`<span class="chip blue">${i.id}</span> ${esc(cn(i.fournisseur))}`).join(' + ')} <span class="chip ${s.sc>=90?'ok':'warn'}">${s.sc>=90?'très probable':'à vérifier'}</span></span><button class="btn sm pri" onclick="acceptMatch(${s.b.n},'${s.set.map(i=>i.id).join(',')}')">Accepter</button></div>`).join('')||'<div class="small mute">Aucune correspondance automatique trouvée.</div>'}
  ${orph.length>top.length?`<div class="small mute" style="margin-top:8px">${orph.length-top.length} opération(s) sans facture restent à affecter à la main (cliquez la ligne dans le relevé).</div>`:''}</div>`;
}
function acceptMatch(n,ids){
  const b=S.bank.find(x=>x.n===n);if(!b)return;
  const set=ids.split(',').map(id=>S.invoices.find(i=>i.id===id)).filter(Boolean);
  b.factures=set.map(i=>i.id);b.categorie=b.categorie||set[0].categorie;
  set.forEach(i=>{i.paye=i.ttc;i.datePaiement=b.date;i.mode=modeOf(b.label);i.refBanque=String(b.n)});
  save();render();
}

/* ---------- import des relevés PDF ---------- */
function flash(msg,kind){
  const m=document.getElementById('main');if(!m)return;
  const old=document.getElementById('flash');if(old)old.remove();
  const col=kind==='bad'?'var(--bad-soft);color:var(--bad)':kind==='ok'?'var(--ok-soft);color:var(--ok)':'var(--blue-soft);color:var(--blue)';
  m.insertAdjacentHTML('afterbegin','<div class="banner" id="flash" style="background:'+col+';font-size:13px;white-space:pre-line">'+esc(msg)+'</div>');
  window.scrollTo(0,0);
}
function releveBox(){
  if(!SC||!SERVER)return '<div class="card" style="margin-bottom:12px"><h3>Importer un relevé bancaire (PDF)</h3><div class="small mute">Analyse du dossier indisponible : cliquez sur « Actualiser l’analyse du dossier » dans Paramètres.</div></div>';
  const files=SC.files.filter(f=>/RELEVES BANCAIRE/i.test(f.path)&&/\.pdf$/i.test(f.path)).sort((a,b)=>a.path<b.path?-1:1);
  const R=S.releves||{};
  const lab=f=>{const m=f.path.match(/(\d\d)-(\d\d)-(\d{4})_/);return m?mlabel(m[3]+'-'+m[2]):f.path.split('/').pop()};
  return `<div class="card" style="margin-bottom:12px"><h3>Importer un relevé bancaire (PDF)</h3>
  <div class="small mute" style="margin-bottom:8px">Cliquez sur le mois voulu : le CRM lit le relevé, contrôle le solde, puis vous propose d’ajouter <b>seulement les lignes qui ne sont pas déjà dans la banque</b>. ${files.length?'':'Aucun relevé PDF trouvé dans les dossiers RELEVES BANCAIRE.'}</div>
  <div class="row">${files.map(f=>{const d=R[f.path];return `<button class="btn sm ${d?'':'pri'}" onclick="importReleve('${esc(f.path).replace(/'/g,"\\'")}')">${d?'✓ ':'⬇ Importer '}${esc(lab(f))}${d?` <span class="mute">· ${d.n} lignes, à jour</span>`:''}</button>`}).join('')}</div></div>`;
}
async function importReleve(path){
  const nom=path.split('/').pop();
  flash('Lecture du relevé « '+nom+' »… (quelques secondes)');
  let r;try{r=await (await fetch('/api/releve?path='+encodeURIComponent(path))).json()}catch(e){flash('Lecture impossible : '+e.message,'bad');return}
  if(r.error||!r.lignes){flash('Lecture impossible : '+(r.error||'réponse vide')+'.\nSi le message parle d’une action inconnue, le script Google n’est pas à jour (Déployer → Nouvelle version).','bad');return}
  if(!r.lignes.length){flash('Aucune ligne reconnue dans ce relevé (PDF scanné ou format inattendu).','bad');return}
  S.releves=S.releves||{};
  const nouv=dedupBank(r.lignes.map(l=>({...l})));
  if(!nouv.length){
    S.releves[path]={n:r.lignes.length,at:new Date().toISOString().slice(0,10)};save();render();
    flash('Ce relevé est déjà entièrement importé : '+r.lignes.length+' lignes, aucune nouvelle. Contrôle du solde : '+(r.ok?'OK':'écart à vérifier')+'.','ok');return;
  }
  const msg=nouv.length+' ligne(s) nouvelle(s) sur '+r.lignes.length+'.\nContrôle du solde ('+m2(r.debutSolde)+' → '+m2(r.finSolde)+') : '+(r.ok?'OK':'ÉCART – vérifiez après import')+'.\n\nImporter ?';
  if(!confirm(msg)){flash('Import annulé.');return}
  let n=Math.max(0,...S.bank.map(b=>+b.n||0));
  nouv.forEach(l=>{
    let cat='',type='depense';
    if(/COMMISSION|FRAIS DE TENUE/i.test(l.label)){cat='Frais bancaires';type='frais'}
    else if(l.credit>0&&gerantDans(l.label)){cat='Apport associé';type='apport'}
    else if(l.credit>0)type='neutre';
    S.bank.push({n:++n,date:l.date,label:l.label,debit:l.debit,credit:l.credit,solde:0,note:'import relevé PDF',factures:[],categorie:cat,type});
  });
  S.releves[path]={n:r.lignes.length,at:new Date().toISOString().slice(0,10)};
  save();render();
  flash(nouv.length+' ligne(s) ajoutée(s) à la banque. Le rapprochement avec les factures est proposé juste en dessous.','ok');
}

/* ---------- versions du budget ---------- */
function budExtra(){
  const V=S.budgetVersions,sel=V.find(v=>v.id===UI.budVer)||V[0],k=calc();
  const cur=Object.fromEntries(S.budget.map(b=>[b.categorie,b.estime]));
  const old=Object.fromEntries(sel.lignes.map(l=>[l.categorie,l.estime]));
  const cats=[...new Set([...Object.keys(old),...Object.keys(cur)])];
  return `<h3 class="mute" style="margin:26px 0 8px">Versions du budget</h3>
  <div class="tools"><select onchange="UI.budVer=this.value;render()">${V.map(v=>`<option value="${v.id}" ${v===sel?'selected':''}>${esc(v.nom)} (${fd(v.date)})</option>`).join('')}</select>
  <button class="btn" onclick="saveBudVer()">Enregistrer le budget actuel comme nouvelle version</button>${V.length>1&&!isRO()?`<button class="btn danger" onclick="delBudVer('${sel.id}')">Supprimer cette version</button>`:''}</div>
  <div class="tw"><table><thead><tr><th>Catégorie</th><th class="num">${esc(sel.nom)}</th><th class="num">Budget actuel</th><th class="num">Variation</th></tr></thead><tbody>${cats.map(c=>{const a=old[c]||0,b=cur[c]||0,d=b-a;return `<tr><td>${esc(c)}</td><td class="num">${m2(a)}</td><td class="num">${m2(b)}</td><td class="num" style="color:${d>0?'var(--bad)':d<0?'var(--ok)':'inherit'}">${d?(d>0?'+':'')+m2(d):'—'}</td></tr>`}).join('')}</tbody><tfoot><tr><td>Total</td><td class="num">${m2(sum(sel.lignes,l=>l.estime))}</td><td class="num">${m2(k.budTot)}</td><td class="num">${m2(k.budTot-sum(sel.lignes,l=>l.estime))}</td></tr></tfoot></table></div>`;
}
function saveBudVer(){if(isRO()){alert('Accès en lecture seule.');return}const nom=prompt('Nom de la version (ex. Révision octobre 2026) :');if(!nom)return;const id=uid('v');S.budgetVersions.push({id,nom,date:today(),lignes:S.budget.map(b=>({categorie:b.categorie,estime:b.estime}))});UI.budVer=id;save();render()}
function delBudVer(id){if(confirm('Supprimer cette version ?')){S.budgetVersions=S.budgetVersions.filter(v=>v.id!==id);UI.budVer='';save();render()}}

/* ---------- avancement mesuré ---------- */
function phasePct(p){
  if(p.auto&&p.contrat){const c=S.contrats.find(x=>x.id===p.contrat);if(c&&c.ht>0)return Math.min(100,Math.round(sum(c.situations,s=>s.ht)/c.ht*100))}
  return p.pct;
}

/* ---------- recherche globale ---------- */
function openSearch(){
  modal.innerHTML=`<div class="dlg wide"><input id="gq" placeholder="Rechercher une facture, un contact, un document, un lot, une tâche…" style="width:100%;font-size:16px" oninput="runSearch(this.value)" autocomplete="off"><div id="gr" style="margin-top:12px"></div></div>`;
  modal.classList.add('on');document.getElementById('gq').focus();
}
function runSearch(raw){
  const q=normS(raw).trim(),gr=document.getElementById('gr');
  if(q.length<2){gr.innerHTML='<div class="small mute">Tapez au moins 2 caractères.</div>';return}
  const has=(...a)=>normS(a.join(' ')).includes(q);
  const G=[
   ['Factures',S.invoices.filter(i=>has(i.id,i.numero,i.designation,cn(i.fournisseur),i.categorie,i.ttc)).map(i=>[i.id+' · '+cn(i.fournisseur),`${m2(i.ttc)} MAD · ${fd(i.date)}`,`closeModal();editInvoice('${i.id}')`])],
   ['Contacts',S.contacts.filter(c=>has(c.nom,c.type,c.tel,c.email,c.ice,c.notes)).map(c=>[c.nom,c.type,`closeModal();showContact('${c.id}')`])],
   ['Documents',S.docs.filter(d=>has(d.titre,d.chemin,d.categorie)).map(d=>[d.titre,d.categorie,`window.open(FURL('${d.chemin.replace(/'/g,"\\'")}'),'_blank')`])],
   ['Banque',S.bank.filter(b=>has(b.label,b.note,b.categorie,b.debit,b.credit)).map(b=>[b.label.slice(0,60),`${fd(b.date)} · ${m2(b.debit||b.credit)}`,`closeModal();UI.bq='${b.label.slice(0,20).replace(/'/g,"\\'")}';location.hash='bank';render()`])],
   ['Lots',S.lots.filter(l=>has(l.nom,l.niveau,l.statut)).map(l=>[l.nom,l.statut,`closeModal();editLot('${l.id}')`])],
   ['Prospects',S.prospects.filter(p=>has(p.nom,p.tel,p.email,p.notes)).map(p=>[p.nom,p.statut,`closeModal();editProspect('${p.id}')`])],
   ['Tâches',S.tasks.filter(t=>has(t.titre,t.notes)).map(t=>[t.titre.slice(0,80),t.statut,`closeModal();editTask('${t.id}')`])],
   ['Contrats',S.contrats.filter(c=>has(c.objet,cn(c.entreprise))).map(c=>[cn(c.entreprise)+' · '+c.objet,c.statut,`showContrat('${c.id}')`])],
   ['Journal de chantier',S.journal.filter(j=>has(j.texte,j.type)).map(j=>[fd(j.date)+' · '+j.type,j.texte.slice(0,70),`closeModal();editJournal('${j.id}')`])]
  ].filter(g=>g[1].length);
  gr.innerHTML=G.map(([t,items])=>`<div class="small mute" style="margin:10px 0 4px;text-transform:uppercase;letter-spacing:.05em">${t} (${items.length})</div>${items.slice(0,8).map(([a,b,act])=>`<div class="row click" style="padding:6px 8px;border-radius:8px;cursor:pointer;justify-content:space-between" onmouseover="this.style.background='var(--acc-soft)'" onmouseout="this.style.background=''" onclick="${act.replace(/"/g,'&quot;')}"><span>${esc(a)}</span><span class="small mute">${esc(b)}</span></div>`).join('')}`).join('')||'<div class="empty">Aucun résultat.</div>';
}
document.addEventListener('keydown',e=>{
  const typing=/INPUT|TEXTAREA|SELECT/.test((document.activeElement||{}).tagName||'');
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openSearch()}
  else if(e.key==='/'&&!typing){e.preventDefault();openSearch()}
});

/* ---------- fusion automatique en cas de modification simultanée ---------- */
async function resolveConflict(){
  try{
    if(!window.__base||typeof mergeData!=='function')return false;
    const theirs=await (await fetch('/api/data'+PQ(),{cache:'no-store'})).json();
    if(!theirs||!theirs.invoices)return false;
    const {data,conflicts}=mergeData(window.__base,clone(S),theirs);
    S=data;ensure();S._v=theirs._v;auditInit();
    window.__base=clone(theirs);
    await push();
    render();
    const msg=conflicts?`Fusion automatique : ${conflicts} champ(s) modifié(s) des deux côtés ; votre version a été retenue (voir Historique).`:'Les modifications faites sur un autre appareil ont été fusionnées avec les vôtres.';
    document.getElementById('main').insertAdjacentHTML('afterbegin','<div class="banner" style="background:var(--blue-soft);color:var(--blue)">'+msg+'</div>');
    return true;
  }catch(e){return false}
}
