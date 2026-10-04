/* Mise à jour du budget depuis le fichier Excel « SITUATION BANQUE CYMSAR_2026.xlsx » (feuille Frais_Acquisition_Terrain).
   Lecture du classeur dans le navigateur (aucune bibliothèque) ; les lignes sont retrouvées par leur libellé. */
"use strict";

/* ---------- lecture d'un .xlsx ---------- */
async function xlInflate(u8){
  const s=new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}
async function xlUnzip(buf){
  const u8=new Uint8Array(buf),dv=new DataView(buf),dec=new TextDecoder();
  let e=u8.length-22;while(e>=0&&dv.getUint32(e,true)!==0x06054b50)e--;
  if(e<0)throw new Error('ce fichier n’est pas un classeur Excel (.xlsx)');
  const n=dv.getUint16(e+10,true);let p=dv.getUint32(e+16,true);const files={};
  for(let i=0;i<n;i++){
    if(dv.getUint32(p,true)!==0x02014b50)break;
    const method=dv.getUint16(p+10,true),csize=dv.getUint32(p+20,true),nl=dv.getUint16(p+28,true),el=dv.getUint16(p+30,true),cl=dv.getUint16(p+32,true),off=dv.getUint32(p+42,true);
    files[dec.decode(u8.subarray(p+46,p+46+nl))]={method,csize,off};
    p+=46+nl+el+cl;
  }
  return async name=>{
    const f=files[name];if(!f)return null;
    const lnl=dv.getUint16(f.off+26,true),lel=dv.getUint16(f.off+28,true),s=f.off+30+lnl+lel,data=u8.subarray(s,s+f.csize);
    return dec.decode(f.method===0?data:await xlInflate(data));
  };
}
async function xlRead(buf){
  const get=await xlUnzip(buf),P=new DOMParser(),doc=t=>P.parseFromString(t,'application/xml');
  const wb=doc(await get('xl/workbook.xml')),rels=doc(await get('xl/_rels/workbook.xml.rels')),relMap={};
  [...rels.getElementsByTagName('Relationship')].forEach(r=>relMap[r.getAttribute('Id')]=r.getAttribute('Target'));
  const ss=[],sst=await get('xl/sharedStrings.xml');
  if(sst)[...doc(sst).getElementsByTagName('si')].forEach(si=>ss.push([...si.getElementsByTagName('t')].map(t=>t.textContent).join('')));
  const sheets={};
  for(const s of wb.getElementsByTagName('sheet')){
    const name=s.getAttribute('name'),rid=s.getAttribute('r:id')||s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id');
    let t=relMap[rid];if(!t)continue;t=t.replace(/^\//,'');
    const x=await get(t.startsWith('xl/')?t:'xl/'+t);if(!x)continue;
    const cells={};
    for(const c of doc(x).getElementsByTagName('c')){
      const r=c.getAttribute('r'),ty=c.getAttribute('t'),v=c.getElementsByTagName('v')[0];let val;
      if(ty==='inlineStr')val=[...c.getElementsByTagName('t')].map(q=>q.textContent).join('');
      else if(!v)continue;
      else if(ty==='s')val=ss[+v.textContent];
      else if(ty==='str'||ty==='e')val=v.textContent;
      else val=parseFloat(v.textContent);
      cells[r]=val;
    }
    sheets[name]=cells;
  }
  return sheets;
}

/* ---------- extraction du budget (lignes retrouvées par libellé) ---------- */
const xlNrm=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
function xlBudget(cells,equipCRM){
  const rows={};
  for(const ref in cells){const m=ref.match(/^([A-Z]+)(\d+)$/);if(m)(rows[+m[2]]=rows[+m[2]]||{})[m[1]]=cells[ref]}
  const order=Object.keys(rows).map(Number).sort((a,b)=>a-b);
  const find=(re,cols)=>{for(const r of order)for(const c of cols){const v=rows[r][c];if(typeof v==='string'&&re.test(xlNrm(v)))return r}return 0};
  const need=(re,cols,nom)=>{const r=find(re,cols);if(!r)throw new Error('ligne « '+nom+' » introuvable dans la feuille (a-t-elle été renommée ?)');return r};
  const num=(r,c)=>{const v=(rows[r]||{})[c];return typeof v==='number'?v:0};
  const R=n=>Math.round(n*100)/100;
  const A=['A'];
  const rSTE=need(/^creation de ste/,A,'Création de société'),rNoir=need(/^prix non declar/,A,'Prix non déclaré'),rAcq=need(/^total ac?quisition terrain/,A,'Total acquisition terrain'),
    rAgence=need(/^agence urbain/,A,'Agence urbaine'),rPC=need(/^protection civile/,A,'Protection civile'),rTaxe=need(/taxe sur les operations de construction/,A,'Taxe commune'),
    rRedev=need(/redevance d.occupation/,A,'Redevance d’occupation'),rArchi=need(/^architecte/,A,'Architecte'),rTerr=need(/^terrassement/,A,'Terrassement'),
    rDivers=need(/^divers/,A,'Divers'),rEtanch=need(/etanch/,['B'],'Étanchéité'),rElec=need(/^redal\/srm abonnement elec/,A,'Abonnement électricité'),rEau=need(/^redal\/srm abonnement eau/,A,'Abonnement eau'),
    rContrat=need(/^contrat/,['G'],'Contrat gros œuvre'),rSO=need(/^total second .?uvres/,A,'Total second œuvre'),rElect=need(/^electricite/,A,'Électricité'),rPlomb=need(/^pl[a-z]*mberie/,A,'Plomberie'),rPlatre=need(/^platre/,A,'Plâtre'),
    rFin=need(/^total finition/,A,'Total finitions'),rExt=need(/^travaux exterieurs/,A,'Travaux extérieurs'),rTitre=need(/^titre foncier/,A,'Titre foncier'),rAss=need(/^assurance decenal/,A,'Assurance décennale'),
    rPH=need(/^total permis d.habiter/,A,'Permis d’habiter'),rImpr=need(/^provision imprevus/,A,'Provision imprévus');
  const rTot=find(/^total investis+ement/,['C']);
  const totalExcel=rTot?num(rTot,'E'):0;
  const B=(c,e,n)=>({categorie:c,estime:R(e),note:n});
  const noir=num(rNoir,'D');
  const permis=num(rAgence,'D')+num(rPC,'D')+num(rTaxe,'D')+num(rRedev,'D');
  const raccord=num(rElec,'D')+num(rEau,'D');
  const faithful=[
    B('Acquisition terrain & société',num(rSTE,'D')+num(rAcq,'D')-noir,'Excel : création société + acquisition (D) − prix non déclaré = terrain déclaré + frais notaire + société.'),
    B('Prix non déclaré (hors acte)',noir,'Excel : 1 500 MAD/m² × surface du terrain. Estimation, aucun paiement bancaire correspondant.'),
    B('Permis & taxes',permis,'Excel : agence urbaine + protection civile + taxe commune + redevance d’occupation.'),
    B('Architecte, BET & contrôle',num(rArchi,'D'),'Excel : architecte + étude géotechnique.'),
    B('Terrassement',num(rTerr,'D'),'Excel : facture de terrassement.'),
    B('Gros œuvre',num(rContrat,'F'),'Excel : montant du contrat de gros œuvre.'),
    B('Second œuvre',num(rSO,'F'),'Excel : total second œuvre de la feuille (électricité + plomberie ; le plâtre n’est pas dans ce total).'),
    B('Finitions',num(rFin,'F'),'Excel : total finitions de la feuille (les travaux extérieurs n’y sont pas).'),
    B('Raccordements (eau/élec./assain.)',raccord,'Excel : abonnements électricité et eau (montants réels).'),
    B('Équipements de chantier',0,'Pas de ligne dans l’Excel.'),
    B('Assurances, titres & réception',num(rTitre,'F')+num(rAss,'F')+num(rPH,'F'),'Excel : titre foncier + assurance décennale + permis d’habiter.'),
    B('Divers',num(rImpr,'F')+num(rDivers,'D')+num(rEtanch,'D'),'Excel : provision imprévus + divers + étanchéité du sous-sol.')
  ];
  const withEquip=equipCRM>0;
  const corriges=[
    B('Second œuvre',num(rElect,'F')+num(rPlomb,'F')+num(rPlatre,'F'),'Correction : avec le plâtre, omis par la formule du total de l’Excel.'),
    B('Raccordements (eau/élec./assain.)',raccord+num(rExt,'F'),'Correction : avec le forfait travaux extérieurs / branchements, omis du total de l’Excel.'),
    B('Équipements de chantier',R(equipCRM),'Correction : factures de la catégorie dans le CRM (panneaux solaires, pompe, disjoncteur), absentes de l’Excel.'),
    B('Divers',num(rImpr,'F')+num(rEtanch,'D')+(withEquip?0:num(rDivers,'D')),'Correction : imprévus + étanchéité'+(withEquip?' (le disjoncteur passe en Équipements).':'.'))
  ];
  const totF=R(faithful.reduce((s,l)=>s+l.estime,0));
  return {faithful,corriges,totalFaithful:totF,totalExcel:R(totalExcel)};
}

/* ---------- interface ---------- */
function xlLignes(res,mode){
  const lines=res.faithful.map(l=>({...l}));
  if(mode==='corr')res.corriges.forEach(c=>{const i=lines.findIndex(l=>l.categorie===c.categorie);if(i>=0)lines[i]=c;else lines.push(c)});
  return lines;
}
function xlApercu(res,src){
  const cur=Object.fromEntries(S.budget.map(b=>[b.categorie,+b.estime||0]));
  const dist=m=>xlLignes(res,m).reduce((s,l)=>s+Math.abs((cur[l.categorie]||0)-l.estime),0);
  const defaut=dist('corr')<dist('excel')?'corr':'excel';
  const render=mode=>{
    const lines=xlLignes(res,mode),tOld=sum(S.budget,b=>b.estime);
    const tNew=tOld+sum(lines,l=>l.estime-(cur[l.categorie]||0));
    const ch=lines.filter(l=>Math.abs((cur[l.categorie]||0)-l.estime)>0.004);
    const equal=Math.abs(res.totalFaithful-res.totalExcel)<0.01;
    return `<table><thead><tr><th>Catégorie</th><th class="num">Budget actuel</th><th class="num">Nouveau</th><th class="num">Variation</th></tr></thead><tbody>
    ${lines.map(l=>{const o=cur[l.categorie]||0,d=l.estime-o;return `<tr style="${Math.abs(d)>0.004?'':'opacity:.55'}"><td>${esc(l.categorie)}</td><td class="num">${m2(o)}</td><td class="num"><b>${m2(l.estime)}</b></td><td class="num" style="color:${d>0?'var(--bad)':d<0?'var(--ok)':'inherit'}">${Math.abs(d)>0.004?(d>0?'+':'')+m2(d):'—'}</td></tr>`}).join('')}
    </tbody><tfoot><tr><td>Total du budget</td><td class="num">${m2(tOld)}</td><td class="num">${m2(tNew)}</td><td class="num">${m2(tNew-tOld)}</td></tr></tfoot></table>
    <p class="small ${equal?'':'mute'}" style="margin:8px 0 0">${equal?`✓ Mode « Excel tel quel » : total = TOTAL INVESTISSEMENT de l’Excel (${m2(res.totalExcel)}).`:`⚠ Le total « Excel tel quel » (${m2(res.totalFaithful)}) diffère du TOTAL INVESTISSEMENT lu dans la feuille (${m2(res.totalExcel)}) : une ligne a peut-être changé. Vérifiez l’aperçu.`}</p>
    <p class="small mute" style="margin:4px 0 0">${ch.length} catégorie(s) modifiée(s). Une version « avant mise à jour » du budget est conservée.</p>`;
  };
  modal.innerHTML=`<div class="dlg wide"><h2>Mise à jour du budget depuis l’Excel</h2>
  <p class="small mute" style="margin:0 0 10px">Source : ${esc(src)} – feuille « Frais_Acquisition_Terrain ».</p>
  <div class="row" style="margin-bottom:10px"><label><input type="radio" name="xlm" value="excel" ${defaut==='excel'?'checked':''}> <b>Excel tel quel</b></label>
  <label><input type="radio" name="xlm" value="corr" ${defaut==='corr'?'checked':''}> <b>Excel + corrections</b> <span class="small mute">(plâtre, travaux extérieurs, équipements de chantier)</span></label></div>
  <div id="xlprev"></div>
  <div class="acts"><button type="button" class="btn" id="xl-ann">Annuler</button><button type="button" class="btn pri" id="xl-ok">Appliquer au budget</button></div></div>`;
  modal.classList.add('on');
  const upd=()=>{document.getElementById('xlprev').innerHTML=render(modal.querySelector('input[name=xlm]:checked').value)};
  modal.querySelectorAll('input[name=xlm]').forEach(i=>i.onchange=upd);upd();
  document.getElementById('xl-ann').onclick=closeModal;
  document.getElementById('xl-ok').onclick=()=>{
    const mode=modal.querySelector('input[name=xlm]:checked').value,lines=xlLignes(res,mode);
    S.budgetVersions=S.budgetVersions||[];
    S.budgetVersions.push({id:uid('v'),nom:'Avant mise à jour du '+fd(today())+' (fichier Excel)',date:today(),lignes:S.budget.map(b=>({categorie:b.categorie,estime:b.estime}))});
    lines.forEach(l=>{const c=S.budget.find(b=>b.categorie===l.categorie);if(c){c.estime=l.estime;if(l.note)c.note=l.note}else S.budget.push({categorie:l.categorie,estime:l.estime,note:l.note||''})});
    S.budgetVersions.push({id:uid('v'),nom:'Mise à jour du '+fd(today())+' (fichier Excel, '+(mode==='corr'?'avec corrections':'tel quel')+')',date:today(),lignes:S.budget.map(b=>({categorie:b.categorie,estime:b.estime}))});
    save();closeModal();render();
    flash('Budget mis à jour depuis l’Excel ('+(mode==='corr'?'avec corrections':'tel quel')+'). Total : '+m2(sum(S.budget,b=>b.estime))+' MAD.','ok');
  };
}
async function xlAnalyser(buf,src){
  try{
    const sheets=await xlRead(buf);
    const nom=Object.keys(sheets).find(n=>/^frais_acquisition_terrain$/i.test(n))||Object.keys(sheets).find(n=>/frais/i.test(n));
    if(!nom)throw new Error('feuille « Frais_Acquisition_Terrain » absente de ce classeur');
    const equip=sum(S.invoices.filter(i=>i.categorie==='Équipements de chantier'),i=>i.ttc);
    xlApercu(xlBudget(sheets[nom],equip),src);
  }catch(e){flash('Mise à jour impossible : '+(e.message||e)+'.','bad')}
}
async function majBudgetExcel(){
  if(window.ME&&window.ME.role==='lecture'){alert('Accès en lecture seule.');return}
  if(typeof DecompressionStream==='undefined'){alert('Ce navigateur est trop ancien pour lire le fichier Excel (mettez-le à jour).');return}
  flash('Lecture du fichier Excel…');
  let buf=null,src='';
  try{
    const f=SC&&SC.files.filter(x=>/SITUATION BANQUE.*\.xlsx$/i.test(x.path)&&!/~\$/.test(x.path)).sort((a,b)=>b.mtime.localeCompare(a.mtime))[0];
    if(f){
      const r=await fetch(window.WEB?'/api/fichier?path='+encodeURIComponent(f.path):FURL(f.path),{cache:'no-store'});
      if(r.ok){buf=await r.arrayBuffer();src=f.path.split('/').pop()+' (modifié le '+fd(f.mtime)+')'}
    }
  }catch(e){}
  if(buf){await xlAnalyser(buf,src);return}
  // pas de lecture automatique possible : choix du fichier à la main
  flash('Choisissez le fichier SITUATION BANQUE CYMSAR_2026.xlsx.');
  const inp=document.getElementById('xlfile')||Object.assign(document.createElement('input'),{type:'file',id:'xlfile',accept:'.xlsx'});
  inp.style.cssText='position:fixed;left:-9999px;opacity:0';if(!inp.parentNode)document.body.appendChild(inp);
  inp.value='';inp.onchange=async()=>{const f=inp.files[0];if(!f)return;await xlAnalyser(await f.arrayBuffer(),f.name+' (fichier choisi)')};
  inp.click();
}
