/* Fusion à trois voies des données du CRM (version de départ, ma version, version du serveur).
   Utilisé quand deux appareils ont modifié les données en même temps. Les modifications qui ne se touchent pas
   sont toutes conservées ; en cas de modification du même champ, MA version est retenue (et comptée comme conflit). */
(function(root){
  const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const isObj=x=>x&&typeof x==='object'&&!Array.isArray(x);
  const KEYS={
    invoices:o=>o.id,contacts:o=>o.id,bank:o=>o.n+'|'+o.date,caisse:o=>o.date+'|'+o.label+'|'+o.debit+'|'+o.credit,
    lots:o=>o.id,prospects:o=>o.id,tasks:o=>o.id,budget:o=>o.categorie,contrats:o=>o.id,journal:o=>o.id,
    previsions:o=>o.id,phases:o=>o.nom,docs:o=>o.id,budgetVersions:o=>o.id,audit:o=>o.t+'|'+o.c+'|'+o.key+'|'+o.a
  };
  function keyFnFor(name,depth,arrs){
    if(depth===1&&KEYS[name])return KEYS[name];
    if(arrs.every(a=>a.every(o=>isObj(o)&&o.id!=null)))return o=>o.id;
    return null;
  }
  function merge(b,m,t,name,depth,st){
    if(eq(m,t))return m;
    if(eq(b,m))return t;
    if(eq(b,t))return m;
    if(isObj(m)&&isObj(t)){
      const bb=isObj(b)?b:{},out={};
      for(const k of new Set([...Object.keys(m),...Object.keys(t)])){
        const r=merge(bb[k],m[k],t[k],k,depth+1,st);
        if(r!==undefined)out[k]=r;
      }
      return out;
    }
    if(Array.isArray(m)&&Array.isArray(t)){
      const ba=Array.isArray(b)?b:[];
      if(m.concat(t,ba).every(x=>x===null||typeof x!=='object')){ // listes simples : union
        return [...new Set([...m,...t])];
      }
      const kf=keyFnFor(name,depth,[m,t,ba]);
      if(!kf){st.c++;return m}
      const mk=new Map(m.map(o=>[kf(o),o])),tk=new Map(t.map(o=>[kf(o),o])),bk=new Map(ba.map(o=>[kf(o),o]));
      const out=[];
      for(const [k,mo] of mk){
        if(tk.has(k)){out.push(merge(bk.get(k),mo,tk.get(k),name,depth+1,st));continue}
        if(bk.has(k)){ // supprimé de l'autre côté
          if(!eq(bk.get(k),mo))st.c++; // j'ai modifié ce qu'il a supprimé : je garde
          else continue;
        }
        out.push(mo);
      }
      for(const [k,to] of tk){
        if(mk.has(k))continue;
        if(bk.has(k)){ if(!eq(bk.get(k),to))st.c++; continue } // je l'ai supprimé (conflit si modifié chez l'autre)
        out.push(to);
      }
      return out;
    }
    st.c++;return m;
  }
  function mergeData(base,mine,theirs){
    const st={c:0},data=merge(base,mine,theirs,'',0,st);
    if(theirs&&theirs._v!=null)data._v=theirs._v;
    return {data,conflicts:st.c};
  }
  root.mergeData=mergeData;
  if(typeof module!=='undefined')module.exports={mergeData};
})(typeof window!=='undefined'?window:globalThis);
