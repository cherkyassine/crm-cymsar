/* Analyse du texte lu (OCR ou PDF) : factures et relevés bancaires.
   Fichier partagé par la version ordinateur (Node) et la version web (navigateur). */
(function(root){
  const r2=x=>Math.round(x*100)/100;
  // "42.000.00" "19 720,00" "7963.00" "1.790,00" -> nombre
  function amt(s){
    s=String(s).replace(/[\s  ]/g,'');
    const m=s.match(/^(.*?)[.,](\d{1,2})$/);
    const ip=(m?m[1]:s).replace(/[.,]/g,''),dec=m?m[2]:'0';
    return parseFloat(ip+'.'+dec);
  }
  const AMT=/(?<![\d.,\/])(?:\d{1,3}(?:[   .,]\d{3})+|\d+)[.,]\d{2}(?![\d%\/])/g;
  const amountsOf=l=>(l.match(AMT)||[]).map(amt).filter(x=>x>0&&isFinite(x));
  const L_TTC=/(total|montant|net)\s*(t\.?\s?t\.?\s?c|[àa]\s*payer)|[àa]\s*payer|soit un total|total\s*net|\bttc\b/i;
  const L_HT=/total\s*h\.?\s?t|montant\s*h\.?\s?t|participations\s*&?\s*contributions\s*h|\bht\b/i;
  const L_TVA=/\btva\b|t\.\s?v\.\s?a|taxe/i;

  function parseInvoice(text,opts){
    opts=opts||{};
    const own=opts.ownIce||'';
    const out={text,ices:[],amounts:[],ht:0,tva:0,ttc:0,date:'',numero:'',confiance:0};
    const lines=String(text||'').split(/\r?\n/);
    out.ices=[...new Set((text.match(/\b00\d{13}\b/g)||[]).filter(x=>x!==own))];
    // montants
    const am=[...new Set(lines.flatMap(amountsOf))];out.amounts=am;
    const lab=(re)=>{const s=new Set();lines.forEach((l,i)=>{if(re.test(l)){let a=amountsOf(l);if(!a.length)a=[1,2].flatMap(k=>amountsOf(lines[i+k]||''));a.forEach(v=>s.add(v))}});return s};
    const LT=lab(L_TTC),LH=lab(L_HT),LV=lab(L_TVA);
    const seq=lines.flatMap(amountsOf);
    const near=(x,y)=>Math.abs(x-y)<0.02;
    const adj=(ht,tva,ttc)=>{for(let i=0;i<seq.length-2;i++){if(near(seq[i],ht)&&near(seq[i+1],tva)&&near(seq[i+2],ttc))return 90;if(near(seq[i],ttc)&&near(seq[i+1],ht)&&near(seq[i+2],tva))return 60}return 0};
    let best=null;
    for(const ttc of am)for(const ht of am){
      if(ht>=ttc||ht<ttc/2)continue;
      const tva=r2(ttc-ht);
      if(!am.some(x=>Math.abs(x-tva)<0.02))continue;
      const score=(LT.has(ttc)?100:0)+(LH.has(ht)?20:0)+(LV.has(tva)?20:0)+adj(ht,tva,ttc)+ttc/1e9;
      if(!best||score>best.score)best={ht,tva,ttc,score};
    }
    if(best&&best.score>=90){Object.assign(out,{ht:best.ht,tva:best.tva,ttc:best.ttc});out.confiance=best.score>=120?95:80}
    else if(LT.size){ // pas de triplet cohérent : on s'appuie sur « Total / Net à payer »
      const ttc=Math.max(...LT);out.ttc=ttc;
      const tv=[...LV].filter(v=>v<ttc*0.3&&v>0);
      if(tv.length){out.tva=Math.max(...tv);out.ht=r2(ttc-out.tva)}else{out.ht=ttc}
      out.confiance=50;
    }
    else if(best){Object.assign(out,{ht:best.ht,tva:best.tva,ttc:best.ttc});out.confiance=35}
    else if(am.length){out.ttc=Math.max(...am);out.ht=out.ttc;out.confiance=15}
    // date
    let bd=null;
    lines.forEach((l,i)=>{
      for(const d of l.match(/\b\d{2}[\/.-]\d{2}[\/.-](?:\d{4}|\d{2})\b/g)||[]){
        const m=d.match(/(\d{2})[\/.-](\d{2})[\/.-](\d{4}|\d{2})/),y=m[3].length===2?'20'+m[3]:m[3];
        if(!(+y>=2025&&+y<=2030&&+m[2]>=1&&+m[2]<=12&&+m[1]>=1&&+m[1]<=31))continue;
        let sc=0;
        if(/date|rabat le|\ble\b|fait\b|[ée]dit/i.test(l+' '+(lines[i-1]||'')))sc+=10;
        if(/limite|lettre|[ée]ch[ée]ance|paiement|r[èe]glement|virement|exon/i.test(l))sc-=20;
        if(!bd||sc>bd.sc)bd={sc,v:`${y}-${m[2]}-${m[1]}`};
      }
    });
    if(bd)out.date=bd.v;
    // numéro de facture
    const flat=lines.join('\n'),fixSp=s=>/^\d+(\s\d{3})+$/.test(s.trim())?s.replace(/\s/g,''):s.trim();
    let nm=flat.match(/(?:facture|invoice)\s*(?:n\s*[°o]|num[ée]ro|n)\s*[:.]?\s*([A-Z0-9][A-Z0-9\/-]*(?:\s\d{3})?)/i);
    const fmts=[/\b(INV-\d+)\b/,/\b(FVE\d{2}-\d{5})\b/,/\b(F\d{6}-\d{4})\b/,/\b(FA\d{4}-\d{5})\b/,/\b(FA\d{8})\b/,/\b(\d{3,4}\/20\d{2})\b/,/\b(0\d{14})\b/,/\b(\d{8,10})\b/];
    if(nm&&/\d/.test(nm[1]))out.numero=fixSp(nm[1]);
    else for(const re of fmts){const m=flat.match(re);if(m&&!/^00\d{13}$/.test(m[1])){out.numero=m[1];break}}
    return out;
  }

  /* relevé bancaire : lignes « JJ/MMJJ/MM LIBELLÉ MONTANT » ; si les montants sont séparés des libellés (OCR en colonnes),
     on les apparie dans l'ordre et on vérifie par le solde. */
  function parseReleve(text){
    const L=String(text||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    const last=l=>{const m=(l||'').match(/\d{2}\/\d{2}\/\d{4}\s+(-?(?:\d{1,3}(?: \d{3})*|\d+),\d{2})\s*$/);return m?amt(m[1]):NaN};
    const iD=L.findIndex(l=>/SOLDE DEPART/i.test(l)),iN=L.findIndex(l=>/NOUVEAU SOLDE/i.test(l)),iT=L.findIndex(l=>/TOTAL DES MOUVEMENTS/i.test(l));
    const sd=L[iD],nd=L[iN];
    let debut=last(sd),fin=last(nd);
    const em=nd&&nd.match(/(\d\d)\/(\d\d)\/(\d{4})/),endY=em?+em[3]:new Date().getFullYear(),endM=em?+em[2]:12;
    // montants isolés (colonne) trouvés après le solde de départ
    if(isNaN(debut)){ // solde sur la ligne suivante ou absent
      const nx=amt((L[iD+1]||'').match(/^(-?[\d ]+,\d{2})$/)?.[1]||'0');debut=isNaN(nx)?0:nx;
    }
    if(isNaN(fin)){const m=(L.slice(iN,iN+3).join(' ')).match(/(\d{1,3}(?: \d{3})*,\d{2})/);fin=m?amt(m[1]):NaN}
    const cre=l=>/RECU|VERSEMENT|REMISE|CREDIT|ALIMENT|RETOUR/i.test(l);
    const dateOf=(dd,mm)=>{const y=+mm>endM?endY-1:endY;return `${y}-${mm}-${dd}`};
    const OPS=/^(\d\d)\/(\d\d)\s*(\d\d)\/(\d\d)\s+(.+?)(?:\s+((?:\d{1,3}(?: \d{3})*|\d+),\d{2}))?$/;
    const ops=[];
    for(const l of L){ if(/^(PAGE|TOTAL|NOUVEAU|SOLDE)/i.test(l))continue;
      const m=l.match(OPS);if(m)ops.push({dd:m[1],mm:m[2],label:m[5],a:m[6]?amt(m[6]):null}) }
    if(ops.some(o=>o.a===null)){ // appariement par ordre
      const seg=L.slice(iD+1,iT>0?iT:L.length),pool=[];
      seg.forEach(l=>{if(/^(?:\d{1,3}(?: \d{3})*|\d+),\d{2}$/.test(l))pool.push(amt(l))});
      const sans=ops.filter(o=>o.a===null);
      if(pool.length>=sans.length){let k=pool.length-sans.length;sans.forEach(o=>{o.a=pool[k++]})}
    }
    const lignes=ops.filter(o=>o.a!==null).map(o=>({date:dateOf(o.dd,o.mm),label:o.label.replace(/\s+/g,' '),debit:cre(o.label)?0:o.a,credit:cre(o.label)?o.a:0}));
    const calc=debut-lignes.reduce((s,x)=>s+x.debit,0)+lignes.reduce((s,x)=>s+x.credit,0);
    return {debutSolde:debut,finSolde:fin,lignes,ok:lignes.length>0&&Math.abs(calc-fin)<0.02};
  }
  /* lignes de texte reconstituées à partir des éléments de pdf.js ({str, transform:[,,,,x,y]}) : regroupés par hauteur, triés par x */
  function linesFromPdfItems(pages){
    const out=[];
    pages.forEach(items=>{
      const rows=[];
      items.filter(i=>i.str&&i.str.trim()).forEach(i=>{
        const y=i.transform[5],x=i.transform[4];
        let r=rows.find(r=>Math.abs(r.y-y)<=3);
        if(!r){r={y,cells:[]};rows.push(r)}
        r.cells.push({x,s:i.str});
      });
      rows.sort((a,b)=>b.y-a.y).forEach(r=>out.push(r.cells.sort((a,b)=>a.x-b.x).map(c=>c.s.trim()).join(' ').replace(/\s+/g,' ')));
    });
    return out.join('\n');
  }
  root.Parsers={parseInvoice,parseReleve,amt,linesFromPdfItems};
  if(typeof module!=='undefined')module.exports={parseInvoice,parseReleve,amt,linesFromPdfItems};
})(typeof window!=='undefined'?window:globalThis);
