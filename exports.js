/* Exports Excel : fichier de TVA (type SIMPL) et dossier trimestriel pour la fiduciaire. */
"use strict";
const pad2=n=>String(n).padStart(2,'0');
function qRange(q){const [y,t]=q.split('-T').map(Number),m1=(t-1)*3+1;return {start:`${y}-${pad2(m1)}-01`,end:new Date(Date.UTC(y,m1+2,0)).toISOString().slice(0,10)}}
function listQuarters(){
  const ds=[today(),...S.invoices.map(i=>i.date),...S.bank.map(b=>b.date)].filter(Boolean),set=new Set(ds.map(d=>`${d.slice(0,4)}-T${Math.ceil(+d.slice(5,7)/3)}`));
  return [...set].sort().reverse();
}
const inRange=(d,r)=>!!d&&d>=r.start&&d<=r.end;
const num2=x=>Math.round((+x||0)*100)/100;
function pieceNo(inv){
  const l=S.invoices.slice().sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:a.id<b.id?-1:1);
  return 'AC-'+inv.date.slice(0,4)+'-'+String(l.findIndex(x=>x.id===inv.id)+1).padStart(3,'0');
}
function encaissements(pred){ // [{lot, acheteur, date, enc, ht, tva}]
  const C=S.compta,r=C.tvaVente/100,out=[];
  S.lots.forEach(l=>{
    const buyer=(S.prospects.find(p=>p.id===l.acheteur)||{}).nom||'';
    let es=(l.echeances||[]).filter(e=>e.recu).map(e=>({date:e.dateRecu||e.date,enc:e.montant}));
    if(!es.length&&l.acompte>0)es=[{date:l.dateVente||today(),enc:l.acompte}];
    es.forEach(e=>{
      if(!pred(e.date))return;
      const tva=C.venteTTC?e.enc*r/(1+r):e.enc*r;
      out.push({lot:l.nom,acheteur:buyer,date:e.date,enc:C.venteTTC?e.enc:e.enc+tva,ht:C.venteTTC?e.enc-tva:e.enc,tva});
    });
  });
  return out;
}
function cptXlsxBox(){
  const T=tvaData(),keys=T.rows.map(r=>r.k),qs=listQuarters();
  return `<h3 class="mute" style="margin:26px 0 8px">Fichiers Excel</h3>
  <div class="card"><div class="small mute" style="margin-bottom:8px"><b>Déclaration de TVA</b> – fichier de travail pour saisir ou importer dans SIMPL : synthèse, relevé des déductions (colonnes du relevé de déduction) et encaissements de la période. Ce n’est pas le fichier officiel de la DGI : la fiduciaire le contrôle et le dépose.</div>
  <div class="row"><select id="xp">${keys.map(k=>`<option value="${k}">${periodLabel(k)}</option>`).join('')||'<option value="">—</option>'}</select><button class="btn pri" onclick="exportTvaXlsx(document.getElementById('xp').value)">Télécharger le fichier de TVA (.xlsx)</button></div>
  <hr style="border:0;border-top:1px solid var(--line);margin:14px 0">
  <div class="small mute" style="margin-bottom:8px"><b>Dossier trimestriel pour la fiduciaire</b> – un seul classeur : résumé, achats avec numéros de pièces, banque, déductions de TVA, encaissements, liste des fichiers.</div>
  <div class="row"><select id="xq">${qs.map(q=>`<option value="${q}">${q.replace(/(\d+)-(T\d)/,'$2 $1')}</option>`).join('')}</select><button class="btn pri" onclick="exportDossierXlsx(document.getElementById('xq').value)">Télécharger le dossier (.xlsx)</button></div></div>`;
}
function tvaSheets(k){
  const T=tvaData(),C=S.compta,row=T.rows.find(r=>r.k===k)||{col:0,ded:0,credReport:0,due:0,credit:0};
  const ded=deductionRows(k),enc=encaissements(d=>!!d&&periodKey(d)===k),so=S.societe;
  const synth=[['Rubrique','Valeur'],
    ['Société',so.nom],['ICE',so.ice],['Période',periodLabel(k)],['Régime de déclaration',C.regime],['Date de référence de la déduction',C.base],['',''],
    ['Chiffre d’affaires imposable (HT) – taux '+C.tvaVente+' %',num2(sum(enc,x=>x.ht))],
    ['TVA due (collectée)',num2(row.col)],
    ['TVA déductible sur biens et services (charges)',num2(row.ded)],
    ['TVA déductible sur immobilisations','0 – à ventiler avec la fiduciaire'],
    ['Crédit de TVA reporté de la période précédente',num2(row.credReport)],
    ['TVA à payer',num2(row.due)],
    ['Crédit de TVA à reporter',num2(row.credit)],['',''],
    ['Avertissement','Fichier de travail généré par le CRM. À contrôler par la fiduciaire avant toute déclaration.']];
  const dedSheet=[['N° d’ordre','N° de la facture','Date de la facture','Nom du fournisseur','Identifiant fiscal (IF)','ICE','Désignation','Montant HT','Taux %','Montant de la TVA','Montant TTC','Mode de paiement','Date de paiement']];
  ded.forEach(({i,part},n)=>{
    const c=S.contacts.find(x=>x.id===i.fournisseur)||{},ht=num2(i.ht*part),tv=num2(i.tva*part);
    dedSheet.push([n+1,i.numero,fd(i.date),c.nom||'',c.ifisc||'',c.ice||'',i.designation,ht,ht?Math.round(tv/ht*100):0,tv,num2(i.ttc*part),i.mode||'',fd(i.datePaiement)]);
  });
  dedSheet.push(['','','','','','','Total',num2(sum(ded,x=>x.i.ht*x.part)),'',num2(sum(ded,x=>x.i.tva*x.part)),num2(sum(ded,x=>x.i.ttc*x.part)),'','']);
  const ven=[['Lot','Acheteur','Date d’encaissement','Montant encaissé TTC','Montant HT','TVA']];
  enc.forEach(e=>ven.push([e.lot,e.acheteur,fd(e.date),num2(e.enc),num2(e.ht),num2(e.tva)]));
  return [
    {name:'Synthèse TVA',rows:synth,widths:[58,34]},
    {name:'Relevé des déductions',rows:dedSheet,widths:[10,20,14,32,16,18,50,14,8,14,14,18,14]},
    {name:'Encaissements',rows:ven,widths:[26,26,18,20,14,14]}];
}
function exportTvaXlsx(k){
  if(!k){alert('Aucune période.');return}
  downloadXlsx(`TVA_${k}_${(S.societe.nom||'societe').replace(/\W+/g,'_')}.xlsx`,tvaSheets(k));
}
function dossierSheets(q){
  const R=qRange(q),so=S.societe;
  const achats=S.invoices.filter(i=>inRange(i.date,R)).sort((a,b)=>a.date<b.date?-1:1);
  const bank=S.bank.filter(b=>inRange(b.date,R));
  const ded=S.invoices.filter(i=>i.tva>0).map(i=>{
    const d=S.compta.base==='facture'?i.date:i.datePaiement,part=S.compta.base==='facture'?1:Math.min(1,i.paye/i.ttc);
    return {i,d,part};
  }).filter(x=>inRange(x.d,R)&&x.part>0);
  const enc=encaissements(d=>inRange(d,R));
  const soldeFin=(()=>{let r=0;for(const b of S.bank){if(b.date>R.end)break;r+=b.credit-b.debit}return r})();
  const resume=[['Rubrique','Valeur'],['Société',so.nom],['ICE',so.ice],['Période',q.replace(/(\d+)-(T\d)/,'$2 $1')+'  ('+fd(R.start)+' → '+fd(R.end)+')'],['',''],
    ['Factures d’achat de la période (nombre)',achats.length],['Total HT',num2(sum(achats,i=>i.ht))],['Total TVA',num2(sum(achats,i=>i.tva))],['Total TTC',num2(sum(achats,i=>i.ttc))],
    ['Dont payé',num2(sum(achats,i=>i.paye))],['Dont restant à payer',num2(sum(achats,i=>i.ttc-i.paye))],['',''],
    ['Entrées bancaires',num2(sum(bank,b=>b.credit))],['Sorties bancaires',num2(sum(bank,b=>b.debit))],['Solde bancaire en fin de période',num2(soldeFin)],['',''],
    ['TVA déductible de la période',num2(sum(ded,x=>x.i.tva*x.part))],['TVA collectée de la période',num2(sum(enc,x=>x.tva))],['Encaissements de ventes (TTC)',num2(sum(enc,x=>x.enc))],['',''],
    ['Généré par le CRM le',fd(today())]];
  const A=[['N° pièce','N° interne','Date','Fournisseur','ICE','N° facture','Catégorie','Compte suggéré','Désignation','HT','TVA','TTC','Payé','Date de paiement','Mode','Réf. banque','Fichier']];
  achats.forEach(i=>{const c=S.contacts.find(x=>x.id===i.fournisseur)||{};A.push([pieceNo(i),i.id,fd(i.date),c.nom||'',c.ice||'',i.numero,i.categorie,compteOf(i.categorie),i.designation,num2(i.ht),num2(i.tva),num2(i.ttc),num2(i.paye),fd(i.datePaiement),i.mode||'',i.refBanque||'',i.fichier||''])});
  A.push(['','','','','','','','','Total',num2(sum(achats,i=>i.ht)),num2(sum(achats,i=>i.tva)),num2(sum(achats,i=>i.ttc)),num2(sum(achats,i=>i.paye)),'','','','']);
  const B=[['Date','N° ligne','Libellé','Débit','Crédit','Factures liées','Catégorie','Compte de contrepartie']];
  bank.forEach(b=>B.push([fd(b.date),b.n,b.label,num2(b.debit),num2(b.credit),(b.factures||[]).join(' '),b.categorie||'',b.type==='apport'?'4463 Associé – compte courant':(b.factures||[]).length?'4411 Fournisseurs':b.categorie==='Frais bancaires'?'6147 Services bancaires':'à affecter']));
  const D=[['N° d’ordre','N° de la facture','Date de la facture','Fournisseur','IF','ICE','HT','TVA déduite','TTC','Date de paiement','Mode']];
  ded.forEach(({i,part},n)=>{const c=S.contacts.find(x=>x.id===i.fournisseur)||{};D.push([n+1,i.numero,fd(i.date),c.nom||'',c.ifisc||'',c.ice||'',num2(i.ht*part),num2(i.tva*part),num2(i.ttc*part),fd(i.datePaiement),i.mode||''])});
  const V=[['Lot','Acheteur','Date','Encaissé TTC','HT','TVA']];
  enc.forEach(e=>V.push([e.lot,e.acheteur,fd(e.date),num2(e.enc),num2(e.ht),num2(e.tva)]));
  const F=[['N° pièce','Type','Chemin du fichier']];
  achats.forEach(i=>F.push([pieceNo(i),'Facture d’achat '+i.id,i.fichier||'(aucun fichier)']));
  if(SC)SC.files.filter(f=>/RELEVES BANCAIRE/i.test(f.path)).forEach(f=>{
    const m=f.path.match(/(\d\d)-(\d\d)-(\d{4})_(\d\d)-(\d\d)-(\d{4})/);
    if(m&&inRange(`${m[3]}-${m[2]}-${m[1]}`,R))F.push(['','Relevé bancaire',f.path]);
  });
  return [
    {name:'Résumé',rows:resume,widths:[46,40]},
    {name:'Achats',rows:A,widths:[14,9,12,30,18,18,26,22,48,12,12,12,12,14,16,10,40]},
    {name:'Banque',rows:B,widths:[12,9,48,13,13,16,24,30]},
    {name:'Déductions TVA',rows:D,widths:[10,18,14,30,14,18,12,12,12,14,16]},
    {name:'Encaissements',rows:V,widths:[26,26,12,14,12,12]},
    {name:'Pièces',rows:F,widths:[14,30,70]}];
}
function exportDossierXlsx(q){
  if(!q)return;
  downloadXlsx(`Dossier_${q}_${(S.societe.nom||'societe').replace(/\W+/g,'_')}.xlsx`,dossierSheets(q));
}
