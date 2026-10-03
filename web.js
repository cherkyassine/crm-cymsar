/* Adaptateur « version web » : remplace les appels /api/... du serveur local par des appels au script Google (Apps Script).
   Chargé uniquement dans CRM-WEB (voir outils/build-web.js). Aucune donnée n'est contenue dans ce fichier. */
"use strict";
window.WEB=true;
window.SEED={version:1,societe:{nom:'',forme:'',gerant:'',ice:'',adresse:'',tel:'',email:'',compte:'',banque:''},projet:{nom:'',commune:'',tf:'',terrain:0,permis:'',datePermis:'',surfaces:[],architecte:'',controle:'',labo:'',notaire:'',statut:'Étude',notes:''},contacts:[],invoices:[],bank:[],caisse:[],budget:[],lots:[],prospects:[],docs:[],tasks:[]};

(function(){
const _fetch=window.fetch.bind(window);
const LS=localStorage;
const cfg=()=>({url:LS.getItem('cymsar_web_url')||'',key:LS.getItem('cymsar_web_key')||''});
let ME=null,PROJ=[{id:'principal',nom:'Projet principal',file:'donnees.json',dossier:''}];

async function gas(action,payload){
  const c=cfg();
  const r=await _fetch(c.url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(Object.assign({key:c.key,action},payload||{})),redirect:'follow'});
  return r.json();
}
const resp=(obj,status)=>new Response(JSON.stringify(obj),{status:status||200,headers:{'Content-Type':'application/json'}});

/* ---------- connexion ---------- */
window.webReady=function(){
  return new Promise(async resolve=>{
    async function essayer(url,key){
      LS.setItem('cymsar_web_url',url);LS.setItem('cymsar_web_key',key);
      try{const j=await gas('ping');if(j&&j.ok){ME={nom:j.nom,role:j.role};return {ok:true}}return {ok:false,msg:j&&j.message||'Code incorrect.'}}
      catch(e){return {ok:false,msg:'Adresse du script injoignable.'}}
    }
    const c=cfg();
    if(c.url&&c.key){const r=await essayer(c.url,c.key);if(r.ok)return resolve()}
    const box=document.createElement('div');
    box.style.cssText='position:fixed;inset:0;background:#13283b;display:grid;place-items:center;z-index:99;font:16px system-ui';
    box.innerHTML=`<form style="background:#fff;color:#16202b;padding:26px;border-radius:14px;width:min(380px,92vw)"><b style="font-size:20px">CRM CYMSAR</b><br><small>Connexion à votre Google Drive</small>
    <input name="url" placeholder="Adresse du script (https://script.google.com/macros/s/…/exec)" value="${c.url}" style="width:100%;padding:10px;margin-top:12px;border:1px solid #ccd;border-radius:8px;box-sizing:border-box">
    <input name="key" type="password" placeholder="Code d'accès" style="width:100%;padding:10px;margin-top:10px;border:1px solid #ccd;border-radius:8px;box-sizing:border-box">
    <p id="err" style="color:#c2410c;margin:8px 0 0"></p><button style="width:100%;padding:11px;margin-top:10px;background:#0f766e;color:#fff;border:0;border-radius:8px;font-weight:700;cursor:pointer">Entrer</button></form>`;
    document.body.appendChild(box);
    box.querySelector('form').onsubmit=async e=>{e.preventDefault();const f=e.target.elements;const b=e.target.querySelector('button');b.disabled=true;b.textContent='Connexion…';
      const r=await essayer(f.url.value.trim(),f.key.value);b.disabled=false;b.textContent='Entrer';
      if(r.ok){box.remove();resolve()}else{box.querySelector('#err').textContent=r.msg}};
  });
};
window.webLogout=function(){LS.removeItem('cymsar_web_key');location.reload()};

/* ---------- outils fichiers ---------- */
const b64=blob=>new Promise(res=>{const r=new FileReader();r.onload=()=>res(String(r.result).split(',')[1]);r.readAsDataURL(blob)});
async function reduire(file){ // photos : 2000 px max, JPEG
  if(!/^image\//.test(file.type)||file.size<400e3)return file;
  try{
    const bmp=await createImageBitmap(file),k=Math.min(1,2000/Math.max(bmp.width,bmp.height));
    const cv=document.createElement('canvas');cv.width=Math.round(bmp.width*k);cv.height=Math.round(bmp.height*k);
    cv.getContext('2d').drawImage(bmp,0,0,cv.width,cv.height);
    return await new Promise(res=>cv.toBlob(b=>res(b||file),'image/jpeg',.85));
  }catch(e){return file}
}
function fileId(path){return (typeof S!=='undefined'&&S.drive&&S.drive[path])||(window.SCID&&SCID[path])||''}

/* ---------- analyse des textes OCR ---------- */
const amt=s=>parseFloat(s.replace(/[\s  ]/g,'').replace(',','.'));
function parseInvoice(text){
  const out={text,ices:[],amounts:[],ht:0,tva:0,ttc:0,date:'',numero:''};
  const own=(typeof S!=='undefined'&&S.societe&&S.societe.ice)||'';
  out.ices=[...new Set((text.match(/\b00\d{13}\b/g)||[]).filter(x=>x!==own))];
  const am=[...new Set((text.match(/\b\d{1,3}(?:[   .]?\d{3})*[,.]\d{2}\b/g)||[]).map(amt).filter(x=>x>0))];
  out.amounts=am;let best=null;
  for(const ttc of am)for(const ht of am){if(ht>=ttc||ht<ttc/2)continue;const tva=Math.round((ttc-ht)*100)/100;if(am.some(x=>Math.abs(x-tva)<0.02)&&(!best||ttc>best.ttc))best={ht,tva,ttc}}
  if(best)Object.assign(out,best);else if(am.length)out.ttc=Math.max(...am);
  for(const d of text.match(/\b(\d{2})[\/.-](\d{2})[\/.-](\d{4}|\d{2})\b/g)||[]){const m=d.match(/(\d{2})[\/.-](\d{2})[\/.-](\d{4}|\d{2})/);const y=m[3].length===2?'20'+m[3]:m[3];if(+y>=2025&&+y<=2030&&+m[2]<=12&&+m[1]<=31){out.date=`${y}-${m[2]}-${m[1]}`;break}}
  const nm=text.match(/(?:facture|invoice)\s*(?:n[°o]|num[ée]ro)?\s*[:.]?\s*([A-Z]{0,4}[\w\/-]*\d[\w\/-]*)/i)||text.match(/\b([A-Z]{2,4}\d{4}-\d{4,6})\b/)||text.match(/\b(\d{8,10})\b/);
  if(nm)out.numero=nm[1];
  return out;
}
function parseReleve(text){
  const L=text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const last=l=>{const m=(l||'').match(/\d{2}\/\d{2}\/\d{4}\s+(-?\d{1,3}(?: \d{3})*,\d{2})\s*$/);return m?amt(m[1]):0};
  const sd=L.find(l=>/SOLDE DEPART/i.test(l)),nd=L.find(l=>/NOUVEAU SOLDE/i.test(l)),debut=last(sd),fin=last(nd);
  const em=nd&&nd.match(/(\d\d)\/(\d\d)\/(\d{4})/),endY=em?+em[3]:new Date().getFullYear(),endM=em?+em[2]:12,lignes=[];
  for(const l of L){
    const m=l.match(/^(\d\d)\/(\d\d)\s*(\d\d)\/(\d\d)\s+(.+?)\s+(\d{1,3}(?: \d{3})*,\d{2})$/);if(!m)continue;
    const mo=+m[2],y=mo>endM?endY-1:endY,credit=/RECU|VERSEMENT|REMISE|CREDIT|ALIMENT|RETOUR/i.test(m[5]),a=amt(m[6]);
    lignes.push({date:y+'-'+m[2]+'-'+m[1],label:m[5],debit:credit?0:a,credit:credit?a:0});
  }
  const calc=debut-lignes.reduce((s,x)=>s+x.debit,0)+lignes.reduce((s,x)=>s+x.credit,0);
  return {debutSolde:debut,finSolde:fin,lignes,ok:lignes.length>0&&Math.abs(calc-fin)<0.02};
}
const isGerant=l=>{const n=String((typeof S!=='undefined'&&S.societe&&S.societe.gerant)||'').split(' ').pop().toUpperCase();return !!n&&String(l).toUpperCase().includes(n)};
function bankFromRows(rows){
  const num=v=>typeof v==='number'?v:parseFloat(String(v||'0').replace(/,/g,''))||0;
  const iso=d=>{const m=String(d).match(/(\d+)\/(\d+)\/(\d+)/);return m?`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`:''};
  const bank=[];
  for(const r of rows){
    if(typeof r[0]!=='number')continue;
    const lib=String(r[3]),deb=num(r[4]),cre=num(r[5]);let type='depense',categorie='';
    if(/COMMISSION|FRAIS DE TENUE/i.test(lib)){type='frais';categorie='Frais bancaires'}
    else if(cre>0&&isGerant(lib)){type='apport';categorie='Apport associé'}
    else if(cre>0)type='neutre';
    const note=String(r[8]||'').replace(/\s+/g,' ').trim();
    bank.push({n:r[0],date:iso(r[1]),label:lib,debit:deb,credit:cre,solde:num(r[6]),note,factures:[...new Set(note.match(/A-\d{3}/g)||[])],categorie,type});
  }
  return bank;
}

/* ---------- routage des appels /api ---------- */
window.fetch=async function(input,init){
  const u=typeof input==='string'?input:input.url;
  if(!u.startsWith('/api/'))return _fetch(input,init);
  const url=new URL(u,'http://x'),path=url.pathname,p=url.searchParams.get('p')||'principal',method=((init&&init.method)||'GET').toUpperCase();
  try{
    if(path==='/api/ping')return resp({ok:true});
    if(path==='/api/me')return resp(ME||{nom:'?',role:'lecture'});
    if(path==='/api/projets'&&method==='GET'){const j=await gas('projets');if(j.projets)PROJ=j.projets;return resp(PROJ)}
    if(path==='/api/projets'&&method==='POST'){const b=JSON.parse(init.body);const j=await gas('creerProjet',b);return j.error?resp(j,403):resp(j)}
    if(path==='/api/data'&&method==='GET'){const j=await gas('load',{p});if(j.error)return resp(j,401);if(!j.data)return resp({error:'vide'},404);return resp(j.data)}
    if(path==='/api/data'&&method==='PUT'){
      const data=JSON.parse(init.body),j=await gas('save',{p,data,v:data._v,force:!!window.__forceSave});
      if(j.conflict)return resp({conflict:true,v:j.v},409);
      if(j.error)return resp(j,j.error==='lecture seule'?403:500);
      if(typeof S!=='undefined')S._v=j.v;
      return resp({ok:true,v:j.v});
    }
    if(path==='/api/scan'){
      const pr=PROJ.find(x=>x.id===p)||PROJ[0],exclude=pr.dossier?[]:PROJ.filter(x=>x.id!==pr.id&&x.dossier).map(x=>x.dossier);
      const j=await gas('scan',{dossier:pr.dossier,exclude});if(j.error)return resp(j,500);
      let bank=[],bankFile='';
      const x=j.files.filter(f=>/SITUATION BANQUE.*\.xlsx$/i.test(f.path)&&!/~\$/.test(f.path)).sort((a,b)=>b.mtime.localeCompare(a.mtime))[0];
      if(x){
        const cacheKey='xlsx_'+x.id+'_'+x.mtime;
        try{
          let rows=JSON.parse(sessionStorage.getItem(cacheKey)||'null');
          if(!rows){const r=await gas('xlsx',{id:x.id});if(r.rows){rows=r.rows;try{sessionStorage.setItem(cacheKey,JSON.stringify(rows))}catch(e){}}}
          if(rows){bank=bankFromRows(rows);bankFile=x.path}
        }catch(e){}
      }
      return resp({date:new Date().toISOString(),files:j.files,bank,bankFile});
    }
    if(path==='/api/extract'||path==='/api/releve'){
      const id=fileId(url.searchParams.get('path')||'');if(!id)return resp({error:'fichier introuvable (actualisez l’analyse du dossier)'},404);
      const j=await gas('ocr',{id});if(j.error)return resp(j,500);
      return resp(path==='/api/releve'?parseReleve(j.text):parseInvoice(j.text));
    }
    if(path==='/api/upload'&&method==='POST'){
      const kind=url.searchParams.get('kind')==='photo'?'photo':'achat',name=url.searchParams.get('name')||'fichier';
      const file=await reduire(init.body),pr=PROJ.find(x=>x.id===p)||PROJ[0];
      const j=await gas('upload',{kind,name,mime:file.type||'application/octet-stream',b64:await b64(file),dossier:pr.dossier});
      if(j.error)return resp(j,500);
      if(typeof S!=='undefined'){S.drive=S.drive||{};S.drive[j.path]=j.id}
      return resp({path:j.path,id:j.id});
    }
    return resp({error:'inconnu'},404);
  }catch(e){return resp({error:'réseau : '+(e.message||e)},502)}
};
})();
