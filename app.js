
(function(){
"use strict";
const AISLES=["Fruits et légumes","Boucherie et poisson","Crèmerie et œufs","Boulangerie","Épicerie salée","Épicerie sucrée","Épices et condiments","Surgelés","Boissons","Autres"];
const SLOTS=[["breakfast","Petit-déj"],["lunch","Déjeuner"],["dinner","Dîner"],["snack","En-cas"]];

const S={tab:"library",view:null,recipeId:null,cookbook:"all",quick:false,q:"",
  servings:null,metric:false,weekStart:mondayOf(new Date()),gmode:"aisle",
  recipes:{},cookbooks:{},plan:{},groceries:{},ready:false,offline:false,session:false,config:true};

/* ---------- connexion à Supabase ---------- */
const CFG=window.CUISINE_CONFIG||{};
const API=String(CFG.supabaseUrl||"").replace(/\/+$/,""),KEY=String(CFG.supabaseKey||"");
let session=null;
function lsGet(k){try{return JSON.parse(localStorage.getItem(k)||"null")}catch(e){return null}}
function lsSet(k,v){try{v==null?localStorage.removeItem(k):localStorage.setItem(k,JSON.stringify(v))}catch(e){}}
function saveSession(x){session=x;S.session=!!x;lsSet("cuisine.session",x)}
async function authCall(path,body){
  const r=await fetch(API+"/auth/v1/"+path,{method:"POST",headers:{apikey:KEY,"Content-Type":"application/json"},body:JSON.stringify(body)});
  const j=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(authMsg(j.msg||j.error_description||j.message||j.error||("Erreur "+r.status)));
  return j;
}
function authMsg(m){
  if(/invalid login|invalid_grant|credentials/i.test(m))return "Adresse ou mot de passe incorrect.";
  if(/not confirmed/i.test(m))return "Adresse pas encore confirmée : ouvrez le mail de Supabase, ou désactivez la confirmation (voir le guide).";
  if(/signups? not allowed|disabled/i.test(m))return "Les inscriptions sont fermées sur ce projet.";
  if(/already registered/i.test(m))return "Un compte existe déjà avec cette adresse : connectez-vous.";
  if(/password/i.test(m)&&/6|characters|short/i.test(m))return "Le mot de passe doit faire au moins 6 caractères.";
  return m;
}
function storeTok(j){saveSession({access_token:j.access_token,refresh_token:j.refresh_token,expires_at:Date.now()+(j.expires_in||3600)*1000,email:(j.user&&j.user.email)||(session&&session.email)||""})}
async function token(){
  if(!session)throw new Error("Vous n'êtes plus connecté.");
  if(Date.now()>session.expires_at-60000){
    try{storeTok(await authCall("token?grant_type=refresh_token",{refresh_token:session.refresh_token}))}
    catch(e){if(navigator.onLine===false)throw new Error("Pas de connexion internet.");saveSession(null);render();throw new Error("Session expirée, reconnectez-vous.")}
  }
  return session.access_token;
}
async function rest(method,path,body,prefer){
  const t=await token();const h={apikey:KEY,Authorization:"Bearer "+t,"Content-Type":"application/json"};if(prefer)h.Prefer=prefer;
  const r=await fetch(API+"/rest/v1/"+path,{method,headers:h,body:body?JSON.stringify(body):undefined});
  if(!r.ok){const j=await r.json().catch(()=>({}));throw new Error(j.message||("Erreur "+r.status))}
  if(r.status===204)return null;return r.json().catch(()=>null);
}
async function fn(body){
  const t=await token();
  const r=await fetch(API+"/functions/v1/import-recipe",{method:"POST",headers:{apikey:KEY,Authorization:"Bearer "+t,"Content-Type":"application/json"},body:JSON.stringify(body),signal:S.abort?S.abort.signal:undefined});
  const j=await r.json().catch(()=>({}));
  if(!r.ok||j.error){const e=new Error(j.error||("Le service d'import a répondu "+r.status+"."));e.code=j.code||r.status;throw e}
  return j;
}

/* ---------- utilitaires ---------- */
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,8)}
function $(id){return document.getElementById(id)}
function mondayOf(d){const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());const w=(x.getDay()+6)%7;x.setDate(x.getDate()-w);return x}
function iso(d){return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}
function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x}
function norm(s){return String(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/s\b/g,"").trim()}
function toast(msg){const t=$("toast");t.textContent=msg;t.hidden=false;clearTimeout(toast._t);toast._t=setTimeout(()=>t.hidden=true,2600)}
function host(u){try{return new URL(u).hostname.replace(/^www\./,"")}catch(e){return ""}}

const FR={0.25:"¼",0.5:"½",0.75:"¾",0.33:"⅓",0.67:"⅔"};
function fmtQ(q,unit){
  if(q==null||isNaN(q))return "";
  const fractional=!unit||/soupe|café|cup|pincée|gousse|tranche|boîte|sachet|botte|brin|feuille|verre|bol|poignée|pot|cube/i.test(unit);
  if(fractional){const w=Math.floor(q+1e-9),f=Math.round((q-w)*100)/100;const k=Object.keys(FR).find(x=>Math.abs(x-f)<0.04);
    if(k)return (w?w+" ":"")+FR[k]; if(f<0.04)return String(w||q)}
  const r=q>=100?Math.round(q):q>=10?Math.round(q*2)/2:Math.round(q*100)/100;
  return String(r).replace(".",",");
}
const IMP={cup:[240,"ml"],cups:[240,"ml"],oz:[28.35,"g"],"fl oz":[29.6,"ml"],lb:[453.6,"g"],lbs:[453.6,"g"],pound:[453.6,"g"],pounds:[453.6,"g"],quart:[946,"ml"],pint:[473,"ml"],stick:[113,"g"],sticks:[113,"g"],inch:[2.54,"cm"],tbsp:[1,"c. à soupe"],tsp:[1,"c. à café"],tablespoon:[1,"c. à soupe"],teaspoon:[1,"c. à café"]};
function isImperial(u){return !!IMP[String(u||"").toLowerCase().trim()]}
function convert(q,u){const k=IMP[String(u||"").toLowerCase().trim()];if(!k||q==null)return [q,u];let v=q*k[0],nu=k[1];
  if(nu==="ml"&&v>=1000){v=v/1000;nu="l"}if(nu==="g"&&v>=1000){v=v/1000;nu="kg"}return [v,nu]}
function stepHtml(t,metric){
  let s=esc(t);
  s=s.replace(/(\d{2,3})\s*°\s*F\b|(\d{2,3})\s*(?:degrés|degrees)\s*F(?:ahrenheit)?\b/gi,(m,a,b)=>{const f=+(a||b);const c=Math.round((f-32)*5/9/5)*5;return metric?`<span class="temp">${c} °C</span>`:`<span class="temp">${f} °F (${c} °C)</span>`});
  s=s.replace(/(\d{2,3})\s*°\s*C?(?![^<]*<\/span>)/g,m=>`<span class="temp">${m}</span>`);
  s=s.replace(/\b(th(?:ermostat)?\.?\s*\d{1,2})\b/gi,m=>`<span class="temp">${m}</span>`);
  return s;
}

/* ---------- analyse locale d'une ligne d'ingrédient ---------- */
const UNIT_RX="kg|mg|g|cl|dl|ml|l|c\\.? ?à ?s(?:oupe)?\\.?|c\\.? ?à ?c(?:afé)?\\.?|cuill(?:ère|eres|ères)? à (?:soupe|café)|cs|cc|tbsp|tsp|tablespoons?|teaspoons?|cups?|fl oz|oz|lbs?|pincées?|gousses?|tranches?|boîtes?|sachets?|bottes?|brins?|feuilles?|verres?|bols?|poignées?|pots?|cubes?|morceaux|morceau|filets?|sticks?";
const LINE_RX=new RegExp("^\\s*(\\d+\\s+\\d+\\s*/\\s*\\d+|\\d+(?:[.,]\\d+)?(?:\\s*/\\s*\\d+)?|[½¼¾⅓⅔])(?:\\s*(?:-|à)\\s*(\\d+(?:[.,]\\d+)?))?\\s*(?:("+UNIT_RX+")(?=\\s|$))?\\s*(?:de |d'|d’)?(.*)$","i");
function num(t){t=String(t).trim();const u={"½":.5,"¼":.25,"¾":.75,"⅓":1/3,"⅔":2/3};if(u[t]!=null)return u[t];
  let m=t.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);if(m)return +m[1]+ +m[2]/ +m[3];
  m=t.match(/^(\d+)\s*\/\s*(\d+)$/);if(m)return +m[1]/ +m[2];return parseFloat(t.replace(",","."))}
function unitNorm(u){if(!u)return null;const l=u.toLowerCase();
  if(/^c\.? ?à ?s|soupe|^cs$|tbsp|tablespoon/.test(l))return "c. à soupe";
  if(/^c\.? ?à ?c|café|^cc$|tsp|teaspoon/.test(l))return "c. à café";return l}
const AISLE_KW=[["Fruits et légumes","tomate oignon ail échalote carotte pomme poire citron salade courgette aubergine poivron champignon persil coriandre basilic menthe épinard pomme de terre patate avocat banane fraise gingembre ciboulette concombre poireau chou brocoli herbe fruit légume"],
 ["Boucherie et poisson","poulet boeuf bœuf porc veau agneau dinde lardon jambon saucisse viande steak saumon thon cabillaud crevette poisson chorizo bacon"],
 ["Crèmerie et œufs","oeuf œuf lait beurre crème fromage yaourt parmesan mozzarella feta ricotta mascarpone emmental gruyère comté"],
 ["Boulangerie","pain baguette brioche tortilla wrap pita"],
 ["Épices et condiments","sel poivre paprika cumin curry cannelle muscade origan thym laurier piment moutarde vinaigre sauce soja ketchup mayonnaise épice"],
 ["Épicerie sucrée","sucre farine levure chocolat miel vanille cacao confiture sirop amande noisette"],
 ["Épicerie salée","pâte spaghetti riz huile lentille pois chiche haricot bouillon conserve semoule quinoa nouille coulis concentré"],
 ["Surgelés","surgelé glace"],["Boissons","vin bière jus eau"]];
function guessAisle(name){const n=" "+norm(name)+" ";for(const [a,kw] of AISLE_KW){for(const k of kw.split(" ")){if(n.includes(" "+norm(k)))return a}}return "Autres"}
function parseLine(line){
  const raw=line.trim();if(!raw)return null;
  const m=raw.match(LINE_RX);let q=null,q2=null,unit=null,rest=raw;
  if(m){q=num(m[1]);q2=m[2]?num(m[2]):null;unit=unitNorm(m[3]);rest=m[4]||""}
  let name=rest.trim(),note=null;const ci=name.indexOf(",");if(ci>0){note=name.slice(ci+1).trim()||null;name=name.slice(0,ci).trim()}
  if(!name){name=raw;q=null;unit=null}
  return {group:null,q,q2,unit,name,note,aisle:guessAisle(name)};
}
function linesToIngredients(text,old){
  const out=[];let group=null;const prev={};(old||[]).forEach(i=>prev[norm(i.name)]=i.aisle);
  text.split("\n").forEach(l=>{const t=l.trim();if(!t)return;
    if(/^#/.test(t)||/:$/.test(t)){group=t.replace(/^#+\s*/,"").replace(/:$/,"").trim()||null;return}
    const p=parseLine(t);if(p){p.group=group;if(prev[norm(p.name)])p.aisle=prev[norm(p.name)];out.push(p)}});
  return out;
}
function ingredientsToLines(ings){let g=null;const out=[];(ings||[]).forEach(i=>{if((i.group||null)!==g){g=i.group||null;if(g)out.push(g+" :")}
  const dq=v=>String(Math.round(v*100)/100).replace(".",",");const q=i.q!=null?dq(i.q)+(i.q2!=null?" à "+dq(i.q2):""):"";out.push([q,i.unit||"",i.name].filter(Boolean).join(" ")+(i.note?", "+i.note:""))});return out.join("\n")}

/* ---------- stockage ---------- */
const COLS=["recipes","cookbooks","plan","groceries"];
function cacheSave(){lsSet("cuisine.cache",{recipes:S.recipes,cookbooks:S.cookbooks,plan:S.plan,groceries:S.groceries})}
async function upsert(col,id,data){try{await rest("POST",col+"?on_conflict=id",{id,data:clean(data)},"resolution=merge-duplicates,return=minimal")}catch(e){toast("Enregistrement impossible : "+e.message)}}
async function put(col,id,data){S[col][id]=Object.assign({},data,{id});cacheSave();render();await upsert(col,id,data)}
async function patch(col,id,data){if(!S[col][id])return;Object.assign(S[col][id],data);cacheSave();render();await upsert(col,id,S[col][id])}
async function del(col,id){delete S[col][id];cacheSave();render();try{await rest("DELETE",col+"?id=eq."+encodeURIComponent(id),null,"return=minimal")}catch(e){toast("Suppression impossible : "+e.message)}}
function clean(o){const r={};for(const k in o){if(k!=="id"&&o[k]!==undefined)r[k]=o[k]}return r}
async function loadAll(){
  const res=await Promise.all(COLS.map(c=>rest("GET",c+"?select=id,data&limit=5000")));
  COLS.forEach((c,i)=>{const o={};(res[i]||[]).forEach(r=>{o[r.id]=Object.assign({},r.data,{id:r.id})});S[c]=o});
  S.ready=true;S.offline=false;cacheSave();render();
}
async function refresh(){try{await loadAll()}catch(e){S.ready=true;if(S.session){S.offline=true;S.loadErr=e.message}render()}}
async function boot(){
  if(!API||!KEY||/VOTRE|XXXX/i.test(API+KEY)){S.config=false;render();return}
  session=lsGet("cuisine.session");S.session=!!session;
  const c=lsGet("cuisine.cache");if(c&&session){COLS.forEach(k=>S[k]=c[k]||{});S.ready=true}
  render();
  if(session){await refresh();handleShare()}
}
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&session&&S.view!=="edit"&&$("sheet").hidden)refresh()});

/* ---------- rendu ---------- */
const ICON={
  back:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  cook:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 11h16v3a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6z"/><path d="M2 11h2M20 11h2M9 4c0 2 2 2 2 4M13 4c0 2 2 2 2 4"/></svg>',
  plan:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
  cart:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"><path d="M4 5h2l2 11h10l2-8H7"/><circle cx="10" cy="19.5" r="1.3"/><circle cx="17" cy="19.5" r="1.3"/></svg>',
  edit:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
  link:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
  photo:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="3" y="6" width="18" height="14" rx="2"/><circle cx="12" cy="13" r="3.5"/><path d="M8 6l1.5-2h5L16 6"/></svg>',
  text:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 6h14M5 10h14M5 14h9M5 18h6"/></svg>',
  pen:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4"/></svg>'
};

function render(){
  const app=$("app");
  document.querySelectorAll("#tabs button").forEach(b=>b.setAttribute("aria-current",b.dataset.tab===S.tab&&!S.view?"page":"false"));
  $("fab").hidden=!(S.tab==="library"&&!S.view);
  $("tabs").hidden=!S.session||!S.config;
  if(!S.config){$("fab").hidden=true;app.innerHTML=viewConfig();return}
  if(!S.session){$("fab").hidden=true;if(!app.querySelector("#authForm"))app.innerHTML=viewAuth();return}
  let h="";
  if(S.offline)h+=`<div class="banner">Pas de connexion au serveur : vous voyez la dernière version enregistrée sur cet appareil. Les modifications risquent de ne pas être sauvegardées.</div>`;
  if(S.view==="recipe")h+=viewRecipe();
  else if(S.view==="edit")h+=viewEdit();
  else if(S.tab==="library")h+=viewLibrary();
  else if(S.tab==="plan")h+=viewPlan();
  else h+=viewGroceries();
  const ae=document.activeElement;const keep=ae&&ae.id;const sel=keep&&ae.selectionStart;const keepVal=keep==="notes"?ae.value:null;
  if(S.view==="edit"&&app.querySelector("#editForm")){return} // ne pas écraser un formulaire en cours
  app.innerHTML=h;
  if(keep){const el=$(keep);if(el&&el!==document.body){if(keepVal!=null)el.value=keepVal;el.focus();try{if(sel!=null)el.setSelectionRange(sel,sel)}catch(e){}}}
}

function viewConfig(){return `<header class="top"><h1>Cuisine de François</h1></header><section class="blk"><h3>Configuration à terminer</h3><p>Le fichier <b>config.js</b> ne contient pas encore l'adresse et la clé de votre projet Supabase. Suivez l'étape 2 du guide d'installation, puis rechargez cette page.</p></section>`}
function viewAuth(){return `<header class="top"><h1>Cuisine de François</h1></header>
  <section class="blk"><form id="authForm"><h3>Connexion</h3>
  <label class="f" for="a_mail">Adresse e-mail</label><input type="email" id="a_mail" autocomplete="username" required style="width:100%;border:1px solid var(--line);background:var(--surface);border-radius:10px;padding:10px 12px">
  <label class="f" for="a_pass">Mot de passe</label><input type="password" id="a_pass" autocomplete="current-password" required minlength="6" style="width:100%;border:1px solid var(--line);background:var(--surface);border-radius:10px;padding:10px 12px">
  <div id="authMsg"></div>
  <div class="sheetfoot" style="position:static;background:transparent"><button type="button" class="btn ghost" data-action="signup">Créer mon compte</button><button type="submit" class="btn">Se connecter</button></div>
  <p class="hint">Première fois : saisissez votre adresse et un mot de passe, puis touchez « Créer mon compte ».</p></form></section>`}
function settingsSheet(){
  openSheet(`<h2>Réglages</h2>
  <p class="hint" style="margin-top:-6px">Connecté : ${esc(session&&session.email||"")}</p>
  <div class="checks">
    <button class="btn ghost block" data-action="export">Télécharger une sauvegarde</button>
    <button class="btn ghost block" data-action="importbak">Restaurer une sauvegarde</button>
    <button class="btn ghost block" data-action="reload">Recharger depuis le serveur</button>
  </div>
  <div id="bakMsg"></div>
  <div class="sheetfoot"><button class="btn ghost" data-action="close">Fermer</button><button class="btn danger" data-action="logout">Se déconnecter</button></div>`);
}
function recipeList(){
  let rs=Object.values(S.recipes);
  if(S.cookbook!=="all")rs=rs.filter(r=>(r.cookbookIds||[]).includes(S.cookbook));
  if(S.quick)rs=rs.filter(r=>r.time&&r.time<=30);
  const q=norm(S.q);
  if(q)rs=rs.filter(r=>norm(r.title).includes(q)||(r.ingredients||[]).some(i=>norm(i.name).includes(q))||(r.tags||[]).some(t=>norm(t).includes(q)));
  return rs.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
}
function card(r,action){
  const meta=[r.time?r.time+" min":"",r.servings?r.servings+" pers.":"",(r.tags||[]).slice(0,2).join(", "),host(r.sourceUrl)].filter(Boolean).join(" · ");
  return `<button class="card" data-action="${action}" data-id="${esc(r.id)}"><span class="tile" aria-hidden="true">${esc((r.title||"?").trim().charAt(0).toUpperCase())}</span><div><div class="t">${esc(r.title||"Sans titre")}${r.example?'<span class="ex">exemple</span>':""}</div><div class="m">${esc(meta)}</div></div></button>`;
}
function viewLibrary(){
  const cbs=Object.values(S.cookbooks).sort((a,b)=>(a.name||"").localeCompare(b.name||"","fr"));
  let h=`<header class="top"><h1>Mes recettes</h1><button class="iconbtn" data-action="settings" aria-label="Réglages"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/></svg></button></header>
  <input class="search" id="search" type="search" placeholder="Chercher un plat, un ingrédient…" value="${esc(S.q)}" aria-label="Chercher">
  <div class="chips" role="toolbar" aria-label="Cookbooks">
    <button class="chip" data-action="cb" data-id="all" aria-pressed="${S.cookbook==="all"}">Toutes</button>
    ${cbs.map(c=>`<button class="chip" data-action="cb" data-id="${esc(c.id)}" aria-pressed="${S.cookbook===c.id}">${esc(c.name)}</button>`).join("")}
    <button class="chip" data-action="quick" aria-pressed="${S.quick}">30 min max</button>
    <button class="chip dashed" data-action="newcb">+ Cookbook</button>
  </div>`;
  if(S.cookbook!=="all"&&S.cookbooks[S.cookbook])h+=`<div class="subtools"><button class="link" data-action="renamecb">Renommer « ${esc(S.cookbooks[S.cookbook].name)} »</button><button class="link danger" data-action="delcb">Supprimer ce cookbook</button></div>`;
  h+=`<div id="rlist">${libraryList()}</div>`;
  return h;
}
function libraryList(){
  if(!S.ready)return `<div class="busy"><div class="spin"></div>${S.slow?"La connexion est lente, vos recettes arrivent…":"Chargement de vos recettes…"}</div>`;
  const rs=recipeList();
  if(!Object.keys(S.recipes).length)return `<div class="empty"><h2>Votre carnet est vide</h2><p>Touchez le bouton + pour importer une recette depuis un lien, une capture d'écran ou un texte copié.</p><button class="btn" data-action="import">Importer une recette</button></div>`;
  if(!rs.length)return `<div class="empty"><h2>Aucune recette ne correspond</h2><p>Changez la recherche ou le filtre.</p></div>`;
  return `<div class="list">${rs.map(r=>card(r,"open")).join("")}</div>`;
}

function curRecipe(){return S.recipes[S.recipeId]}
function scaled(r,servings,metric){
  const f=r.servings&&servings?servings/r.servings:1;
  return (r.ingredients||[]).map(i=>{let q=i.q!=null?i.q*f:null,q2=i.q2!=null?i.q2*f:null,u=i.unit;
    if(metric&&isImperial(u)){const a=convert(q,u);if(q2!=null)q2=convert(q2,u)[0];q=a[0];u=a[1]}
    return Object.assign({},i,{q,q2,unit:u})});
}
function viewRecipe(){
  const r=curRecipe();if(!r){S.view=null;return viewLibrary()}
  const sv=S.servings||r.servings||null;const ings=scaled(r,sv,S.metric);
  const hasImp=(r.ingredients||[]).some(i=>isImperial(i.unit))||(r.steps||[]).some(s=>/°\s*F\b/i.test(s));
  const cbn=(r.cookbookIds||[]).map(id=>S.cookbooks[id]&&S.cookbooks[id].name).filter(Boolean).join(", ");
  let ingH="";let g=null;
  ings.forEach(i=>{if((i.group||null)!==g){g=i.group||null;if(g)ingH+=`<div class="grp">${esc(g)}</div>`}
    const q=i.q!=null?fmtQ(i.q,i.unit)+(i.q2!=null?" à "+fmtQ(i.q2,i.unit):"")+(i.unit?" "+i.unit:""):"";
    ingH+=`<dt>${esc(q)}</dt><dd>${esc(i.name)}${i.note?` <small>${esc(i.note)}</small>`:""}</dd>`});
  const n=r.nutrition;
  return `<header class="top"><button class="iconbtn" data-action="back" aria-label="Retour">${ICON.back}</button><h1 style="font-size:1.05rem;font-family:var(--body);font-weight:600">${esc(cbn||"Recette")}</h1></header>
  <div class="rhead"><h2>${esc(r.title||"Sans titre")}${r.example?'<span class="ex">exemple</span>':""}</h2>
  <div class="meta">${r.time?`<span>${r.time} min</span>`:""}${(r.tags||[]).length?`<span>${esc(r.tags.join(", "))}</span>`:""}${r.cooked?`<span>Cuisinée ${r.cooked} fois</span>`:""}${r.sourceUrl?`<a href="${esc(r.sourceUrl)}" target="_blank" rel="noopener">${esc(host(r.sourceUrl)||"source")}</a>`:""}</div></div>
  <div class="actions">
    <button class="act" data-action="cook">${ICON.cook}Cuisiner</button>
    <button class="act" data-action="toplan">${ICON.plan}Planifier</button>
    <button class="act" data-action="togroc">${ICON.cart}Courses</button>
    <button class="act" data-action="edit">${ICON.edit}Modifier</button>
  </div>
  <section class="blk"><div class="blkhead"><h3>Ingrédients</h3>
    <div class="row" style="flex:none;gap:8px">${hasImp?`<div class="toggle" role="group" aria-label="Unités"><button data-action="metric" data-v="0" aria-pressed="${!S.metric}">D'origine</button><button data-action="metric" data-v="1" aria-pressed="${S.metric}">Métrique</button></div>`:""}
    ${sv?`<div class="stepper"><button data-action="sv" data-d="-1" aria-label="Moins de portions">−</button><span>${sv} portion${sv>1?"s":""}</span><button data-action="sv" data-d="1" aria-label="Plus de portions">+</button></div>`:""}</div></div>
    ${ings.length?`<dl class="ing">${ingH}</dl>`:`<p class="hint">Aucun ingrédient.</p>`}</section>
  <section class="blk"><div class="blkhead"><h3>Préparation</h3></div>
    ${(r.steps||[]).length?`<ol class="steps">${r.steps.map(s=>`<li>${stepHtml(s,S.metric)}</li>`).join("")}</ol>`:`<p class="hint">Aucune étape.</p>`}</section>
  <section class="blk"><div class="blkhead"><h3>Nutrition par portion</h3>${n?`<span class="hint">estimation</span>`:""}</div>
    ${n?`<div class="nut"><div><b>${n.kcal}</b><span>kcal</span></div><div><b>${n.prot} g</b><span>protéines</span></div><div><b>${n.gluc} g</b><span>glucides</span></div><div><b>${n.lip} g</b><span>lipides</span></div></div>`
      :`<p class="hint" style="margin:0 0 10px">L'app peut estimer les calories et les macros à partir des ingrédients.</p><button class="btn ghost" data-action="nutrition">Estimer</button>`}</section>
  <section class="blk"><div class="blkhead"><h3>Mes notes</h3></div>
    <textarea id="notes" placeholder="Ce que vous changeriez la prochaine fois…">${esc(r.notes||"")}</textarea></section>
  <div id="delzone" style="margin:18px 0"><button class="link danger" data-action="delrecipe">Supprimer cette recette</button></div>`;
}

function viewEdit(){
  const r=S.draft||{};
  const cbs=Object.values(S.cookbooks).sort((a,b)=>(a.name||"").localeCompare(b.name||"","fr"));
  return `<header class="top"><button class="iconbtn" data-action="canceledit" aria-label="Annuler">${ICON.back}</button><h1>${r.id&&S.recipes[r.id]?"Modifier la recette":"Nouvelle recette"}</h1></header>
  ${r._fromImport?`<div class="banner">Relisez ce que Claude a extrait, corrigez si besoin, puis enregistrez.</div>`:""}
  <form id="editForm">
    <label class="f" for="e_title">Titre</label><input type="text" id="e_title" value="${esc(r.title||"")}" required>
    <div class="row"><div><label class="f" for="e_serv">Portions</label><input type="number" id="e_serv" min="1" value="${esc(r.servings||"")}"></div>
    <div><label class="f" for="e_time">Durée totale (min)</label><input type="number" id="e_time" min="0" value="${esc(r.time||"")}"></div></div>
    <label class="f" for="e_tags">Étiquettes</label><input type="text" id="e_tags" value="${esc((r.tags||[]).join(", "))}" placeholder="dîner, italien, végétarien">
    <label class="f">Cookbooks</label>
    <div class="chips" style="flex-wrap:wrap;overflow:visible;padding-block:4px">${cbs.map(c=>`<label class="chip" style="display:inline-flex;gap:6px;align-items:center"><input type="checkbox" name="cb" value="${esc(c.id)}" ${(r.cookbookIds||[]).includes(c.id)?"checked":""}>${esc(c.name)}</label>`).join("")||`<span class="hint">Aucun cookbook pour l'instant.</span>`}</div>
    <label class="f" for="e_newcb">Nouveau cookbook</label><input type="text" id="e_newcb" placeholder="Laisser vide si inutile">
    <label class="f" for="e_ing">Ingrédients</label><textarea id="e_ing" rows="9" placeholder="200 g farine&#10;3 oeufs&#10;1 c. à soupe huile d'olive, vierge extra">${esc(ingredientsToLines(r.ingredients))}</textarea>
    <div class="hint">Un ingrédient par ligne : quantité, unité, nom, puis les précisions après une virgule. Une ligne finissant par « : » ouvre un sous-groupe.</div>
    <label class="f" for="e_steps">Étapes</label><textarea id="e_steps" rows="9" placeholder="Une étape par ligne">${esc((r.steps||[]).join("\n"))}</textarea>
    <label class="f" for="e_src">Lien d'origine</label><input type="url" id="e_src" value="${esc(r.sourceUrl||"")}" placeholder="https://">
    <div class="sheetfoot"><button type="button" class="btn ghost" data-action="canceledit">Annuler</button><button type="submit" class="btn">Enregistrer</button></div>
  </form>`;
}

function viewPlan(){
  const ws=S.weekStart,today=iso(new Date());
  const end=addDays(ws,6);
  const lab="Du "+ws.toLocaleDateString("fr-FR",{day:"numeric",month:"short"})+" au "+end.toLocaleDateString("fr-FR",{day:"numeric",month:"short"});
  const entries=Object.values(S.plan);
  let h=`<header class="top"><h1>Semaine</h1></header>
  <div class="weeknav"><button class="iconbtn" data-action="week" data-d="-7" aria-label="Semaine précédente">${ICON.back}</button><b>${esc(lab)}</b><button class="iconbtn" data-action="week" data-d="7" aria-label="Semaine suivante" style="transform:scaleX(-1)">${ICON.back}</button></div>`;
  const weekEntries=entries.filter(e=>e.date>=iso(ws)&&e.date<=iso(end));
  h+=`<button class="btn block" data-action="weektogroc" ${weekEntries.length?"":"disabled"} style="margin-bottom:12px">Envoyer la semaine aux courses</button>`;
  for(let i=0;i<7;i++){const d=addDays(ws,i),k=iso(d);
    const es=entries.filter(e=>e.date===k).sort((a,b)=>SLOTS.findIndex(s=>s[0]===a.slot)-SLOTS.findIndex(s=>s[0]===b.slot));
    h+=`<div class="day${k===today?" today":""}"><div class="dayhead"><b>${esc(d.toLocaleDateString("fr-FR",{weekday:"long",day:"numeric"}))}</b><button class="link" data-action="plandd" data-date="${k}">+ Ajouter</button></div>
    ${es.map(e=>{const r=S.recipes[e.recipeId];const sl=(SLOTS.find(s=>s[0]===e.slot)||["","Repas"])[1];
      return `<div class="meal"><span class="slot">${esc(sl)}</span><button class="name" data-action="open" data-id="${esc(e.recipeId)}">${esc(r?r.title:"Recette supprimée")}${e.servings?` <small class="hint">· ${e.servings} pers.</small>`:""}</button><button class="x" data-action="unplan" data-id="${esc(e.id)}" aria-label="Retirer">×</button></div>`}).join("")}
    </div>`}
  return h;
}

function viewGroceries(){
  const items=Object.values(S.groceries);
  let h=`<header class="top"><h1>Courses</h1>${items.length?`<button class="iconbtn" data-action="copygroc" aria-label="Copier la liste"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg></button>`:""}</header>
  <form class="gadd" id="gaddForm"><input type="text" id="gadd" placeholder="Ajouter : 1 kg pommes, lait…" aria-label="Ajouter un article"><button class="btn" type="submit">Ajouter</button></form>`;
  if(!S.ready)return h+`<div class="busy"><div class="spin"></div>Chargement…</div>`;
  if(!items.length)return h+`<div class="empty"><h2>Liste vide</h2><p>Ajoutez des articles ici, depuis une recette (bouton Courses) ou depuis le planning de la semaine.</p></div>`;
  h+=`<div class="row" style="align-items:center;margin-bottom:12px"><div class="toggle" role="group" aria-label="Classement" style="flex:none"><button data-action="gmode" data-v="aisle" aria-pressed="${S.gmode==="aisle"}">Par rayon</button><button data-action="gmode" data-v="recipe" aria-pressed="${S.gmode==="recipe"}">Par recette</button></div>
  <div style="text-align:right" id="clearzone">${items.some(i=>i.checked)?`<button class="link danger" data-action="clearchecked">Retirer les articles cochés</button>`:""}</div></div>`;
  const groups={};
  items.forEach(i=>{const k=S.gmode==="aisle"?(i.aisle||"Autres"):(i.recipeTitle||"Ajouts manuels");(groups[k]=groups[k]||[]).push(i)});
  const keys=Object.keys(groups).sort((a,b)=>S.gmode==="aisle"?AISLES.indexOf(a)-AISLES.indexOf(b):a.localeCompare(b,"fr"));
  keys.forEach(k=>{const arr=groups[k].sort((a,b)=>(a.checked-b.checked)||(a.name||"").localeCompare(b.name||"","fr"));
    h+=`<div class="aisle"><h4>${esc(k)}</h4>${arr.map(i=>{const q=i.q!=null?fmtQ(i.q,i.unit)+(i.unit?" "+i.unit:""):"";
      return `<div class="gitem${i.checked?" done":""}"><input type="checkbox" data-action="check" data-id="${esc(i.id)}" ${i.checked?"checked":""} aria-label="Coché : ${esc(i.name)}"><button class="g" data-action="gedit" data-id="${esc(i.id)}"><span>${q?`<span class="qty">${esc(q)}</span> `:""}${esc(i.name)}</span>${S.gmode==="aisle"&&i.recipeTitle?`<small>${esc(i.recipeTitle)}</small>`:""}</button></div>`}).join("")}</div>`});
  return h;
}

/* ---------- feuilles ---------- */
function openSheet(html){$("pane").innerHTML=html;$("sheet").hidden=false;const f=$("pane").querySelector("input,textarea,button");if(f)f.focus()}
function closeSheet(){$("sheet").hidden=true;$("pane").innerHTML="";if(S.abort){S.abort.abort();S.abort=null}}
$("sheet").addEventListener("click",e=>{if(e.target.id==="sheet")closeSheet()});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("sheet").hidden)closeSheet()});

function importSheet(){
  openSheet(`<h2>Importer une recette</h2>
  <div class="opts">
    <button class="opt" data-action="imp-link">${ICON.link}<b>Depuis un lien</b><span>Instagram, TikTok, YouTube, un site de recettes</span></button>
    <button class="opt" data-action="imp-photo">${ICON.photo}<b>Depuis des photos</b><span>Captures d'écran, livre, fiche manuscrite</span></button>
    <button class="opt" data-action="imp-text">${ICON.text}<b>Texte copié</b><span>Légende de post, note, message</span></button>
    <button class="opt" data-action="imp-manual">${ICON.pen}<b>Saisie libre</b><span>Écrire la recette vous-même</span></button>
  </div>
  <p class="hint" style="margin-top:12px">Astuce : depuis Instagram, Facebook ou TikTok, utilisez le bouton Partager et choisissez « Cuisine ». Une capture d'écran partagée de la même façon fonctionne aussi.</p>`);
}
function linkSheet(prefill){
  openSheet(`<h2>Importer depuis un lien</h2>
  <form id="linkForm"><label class="f" for="l_url">Adresse de la recette</label><input type="url" id="l_url" required placeholder="https://www.instagram.com/p/…" value="${esc(prefill||"")}">
  <p class="hint">Marche bien avec les sites de recettes. Instagram et Facebook bloquent souvent la lecture : dans ce cas, importez une capture d'écran de la légende.</p>
  <div id="linkMsg"></div>
  <div class="sheetfoot"><button type="button" class="btn ghost" data-action="close">Annuler</button><button class="btn" type="submit">Importer</button></div></form>`);
}
function textSheet(){
  openSheet(`<h2>Importer un texte</h2>
  <form id="textForm"><label class="f" for="t_txt">Collez la recette</label><textarea id="t_txt" rows="10" required placeholder="Collez ici la légende du post ou le texte de la recette"></textarea>
  <label class="f" for="t_src">Lien d'origine (facultatif)</label><input type="url" id="t_src" placeholder="https://">
  <div id="textMsg"></div>
  <div class="sheetfoot"><button type="button" class="btn ghost" data-action="close">Annuler</button><button class="btn" type="submit">Analyser</button></div></form>`);
}
function busy(msg){openSheet(`<h2>Import en cours</h2><div class="busy"><div class="spin"></div><span>${esc(msg)}</span></div><div class="sheetfoot"><button class="btn ghost" data-action="close">Annuler</button></div>`)}
function failSheet(msg,retry){openSheet(`<h2>Import impossible</h2><div class="err">${esc(msg)}</div><div class="sheetfoot"><button class="btn ghost" data-action="close">Fermer</button>${retry?`<button class="btn" data-action="${retry}">Essayer autrement</button>`:""}</div>`)}

function sanitize(x,sourceUrl,src){
  if(!x||x.found===false||!x.title)return null;
  const ings=Array.isArray(x.ingredients)?x.ingredients.filter(i=>i&&i.name).map(i=>({group:i.group||null,q:typeof i.q==="number"?i.q:null,q2:typeof i.q2==="number"?i.q2:null,unit:i.unit?unitNorm(String(i.unit)):null,name:String(i.name),note:i.note?String(i.note):null,aisle:AISLES.includes(i.aisle)?i.aisle:guessAisle(i.name)})):[];
  return {title:String(x.title).slice(0,200),servings:+x.servings||null,time:+x.time||null,tags:Array.isArray(x.tags)?x.tags.slice(0,3).map(String):[],ingredients:ings,steps:Array.isArray(x.steps)?x.steps.map(String).filter(Boolean):[],sourceUrl:sourceUrl||null,source:src,cookbookIds:S.cookbook!=="all"?[S.cookbook]:[],_fromImport:true};
}
function errMsg(e){
  if(e&&(e.code==="quota"||e.code===429))return "Le quota gratuit de Gemini est épuisé pour aujourd'hui. Réessayez demain, ou saisissez la recette à la main.";
  if(navigator.onLine===false)return "Pas de connexion internet.";
  return (e&&e.message)||"L'import a échoué.";
}
async function runExtract(body,src,sourceUrl,retry){
  S.abort=new AbortController();
  try{const j=await fn(body);S.abort=null;
    const d=sanitize(j.recipe||{found:false},sourceUrl||j.sourceUrl||null,src);
    if(!d){failSheet(j.reason||"Aucune recette trouvée dans ce contenu.",retry);return}
    closeSheet();openEdit(d);
  }catch(e){S.abort=null;if(e&&e.name==="AbortError")return;failSheet(errMsg(e),retry)}
}
async function importLink(url){
  busy("Lecture de la page…");
  await runExtract({mode:"url",url},host(url)||"web",url,"imp-photo");
}
async function shrink(file,max){
  try{const bmp=await createImageBitmap(file);const k=Math.min(1,max/Math.max(bmp.width,bmp.height));
    const c=document.createElement("canvas");c.width=Math.round(bmp.width*k);c.height=Math.round(bmp.height*k);c.getContext("2d").drawImage(bmp,0,0,c.width,c.height);
    const u=c.toDataURL("image/jpeg",0.85);return {mime:"image/jpeg",data:u.slice(u.indexOf(",")+1)};}
  catch(e){const u=await new Promise((ok,ko)=>{const fr=new FileReader();fr.onload=()=>ok(fr.result);fr.onerror=ko;fr.readAsDataURL(file)});
    return {mime:file.type||"image/jpeg",data:String(u).slice(String(u).indexOf(",")+1)}}
}
async function importPhotos(files){
  const arr=Array.from(files||[]).filter(f=>f&&f.size).slice(0,4);if(!arr.length)return;
  busy("Préparation des photos…");
  const images=[];for(const f of arr)images.push(await shrink(f,1600));
  busy("Lecture de la recette sur "+(images.length>1?images.length+" photos":"la photo")+"…");
  await runExtract({mode:"images",images},"photo",null,"imp-text");
}
async function handleShare(){
  const p=new URLSearchParams(location.search);if(!p.has("shared"))return;
  history.replaceState(null,"",location.pathname);
  let meta=null;const files=[];
  try{const c=await caches.open("cuisine-share");const m=await c.match("meta");
    if(m){meta=await m.json();for(let i=0;i<(meta.files||0);i++){const r=await c.match("file-"+i);if(r)files.push(await r.blob())}}
    await caches.delete("cuisine-share");}catch(e){}
  if(!meta)return;
  if(files.length){importPhotos(files);return}
  const all=[meta.url,meta.text,meta.title].filter(Boolean).join(" ");const m=all.match(/https?:\/\/[^\s"'<>]+/);
  if(m){importLink(m[0].replace(/[).,;!?]+$/,""));return}
  if(meta.text){busy("Lecture du texte partagé…");runExtract({mode:"text",text:meta.text.slice(0,30000)},"texte",null,"imp-manual")}
}
$("bakInput").addEventListener("change",async e=>{const f=e.target.files&&e.target.files[0];e.target.value="";if(!f)return;
  try{const j=JSON.parse(await f.text());if(j.app!=="cuisine-de-francois")throw new Error("Ce fichier n'est pas une sauvegarde de l'app.");
    let n=0;for(const col of COLS){for(const [id,d] of Object.entries(j[col]||{})){if(!S[col][id]){await put(col,id,clean(d));n++}}}
    toast(n+" élément"+(n>1?"s":"")+" restauré"+(n>1?"s":""));closeSheet()}
  catch(err){const m=$("bakMsg");if(m)m.innerHTML=`<div class="err">${esc(err.message)}</div>`;else toast(err.message)}});
$("photoInput").addEventListener("change",e=>{const f=e.target.files;importPhotos(f).finally(()=>{e.target.value=""})});

function openEdit(d){S.draft=d;S.view="edit";$("app").innerHTML="";render();window.scrollTo(0,0)}
async function saveEdit(){
  const d=S.draft||{};const title=$("e_title").value.trim();if(!title){$("e_title").focus();return}
  let cbIds=Array.from(document.querySelectorAll('#editForm input[name=cb]:checked')).map(x=>x.value);
  const ncb=$("e_newcb").value.trim();
  if(ncb){const id=uid();await put("cookbooks",id,{name:ncb,createdAt:Date.now()});cbIds.push(id)}
  const rec={title,servings:+$("e_serv").value||null,time:+$("e_time").value||null,
    tags:$("e_tags").value.split(",").map(s=>s.trim()).filter(Boolean).slice(0,6),
    cookbookIds:cbIds,ingredients:linesToIngredients($("e_ing").value,d.ingredients),
    steps:$("e_steps").value.split("\n").map(s=>s.replace(/^\s*\d+[.)]\s*/,"").trim()).filter(Boolean),
    sourceUrl:$("e_src").value.trim()||null,source:d.source||"manuel",notes:d.notes||"",
    nutrition:d.nutrition||null,cooked:d.cooked||0,createdAt:d.createdAt||Date.now(),example:false};
  const old=d.id&&S.recipes[d.id];
  if(old&&JSON.stringify(old.ingredients)!==JSON.stringify(rec.ingredients))rec.nutrition=null;
  const id=d.id||uid();S.draft=null;S.view="recipe";S.recipeId=id;S.servings=null;
  $("app").innerHTML="";await put("recipes",id,rec);window.scrollTo(0,0);toast("Recette enregistrée");
}

function planSheet(recipeId){
  const r=S.recipes[recipeId];S.pdraft={recipeId,date:iso(new Date())<iso(S.weekStart)?iso(S.weekStart):iso(new Date()),slot:"dinner",servings:r&&r.servings||2,ws:mondayOf(new Date())};drawPlanSheet()}
function drawPlanSheet(){
  const p=S.pdraft,r=S.recipes[p.recipeId];let days="";
  for(let i=0;i<14;i++){const d=addDays(mondayOf(new Date()),i),k=iso(d);days+=`<button class="chip" data-action="pdate" data-v="${k}" aria-pressed="${p.date===k}">${esc(d.toLocaleDateString("fr-FR",{weekday:"short",day:"numeric"}))}</button>`}
  openSheet(`<h2>Planifier ${esc(r?r.title:"")}</h2>
  <label class="f">Jour</label><div class="chips" style="flex-wrap:wrap;overflow:visible;padding-block:4px">${days}</div>
  <label class="f">Repas</label><div class="chips" style="flex-wrap:wrap;overflow:visible;padding-block:4px">${SLOTS.map(s=>`<button class="chip" data-action="pslot" data-v="${s[0]}" aria-pressed="${p.slot===s[0]}">${s[1]}</button>`).join("")}</div>
  <label class="f">Portions</label><div class="stepper"><button data-action="psv" data-d="-1" aria-label="Moins">−</button><span>${p.servings} portion${p.servings>1?"s":""}</span><button data-action="psv" data-d="1" aria-label="Plus">+</button></div>
  <div class="sheetfoot"><button class="btn ghost" data-action="close">Annuler</button><button class="btn" data-action="psave">Ajouter au planning</button></div>`);
}
function pickSheet(date){
  S.pickDate=date;S.pickQ="";drawPick();
}
function drawPick(){
  const q=norm(S.pickQ);const rs=Object.values(S.recipes).filter(r=>!q||norm(r.title).includes(q)).sort((a,b)=>(a.title||"").localeCompare(b.title||"","fr"));
  const d=new Date(S.pickDate+"T12:00:00");
  openSheet(`<h2>${esc(d.toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"}))}</h2>
  <input class="search" id="pickq" type="search" placeholder="Chercher une recette" value="${esc(S.pickQ)}" aria-label="Chercher une recette">
  <div class="list" id="picklist" style="margin-top:12px">${rs.map(r=>card(r,"pick")).join("")||`<p class="hint">Aucune recette.</p>`}</div>`);
  const el=$("pickq");el.focus();el.setSelectionRange(el.value.length,el.value.length);
}

function grocSheet(lines,title){
  S.gdraft=lines;
  openSheet(`<h2>${esc(title)}</h2>
  <p class="hint" style="margin-top:-6px">Décochez ce que vous avez déjà. Les ingrédients identiques s'additionnent avec ceux de la liste.</p>
  <div class="checks">${lines.map((l,i)=>{const q=l.q!=null?fmtQ(l.q,l.unit)+(l.unit?" "+l.unit:""):"";return `<label><input type="checkbox" data-gi="${i}" checked><span>${q?`<span class="qty">${esc(q)}</span> `:""}${esc(l.name)}${l.recipeTitle&&title.indexOf("semaine")>-1?` <small class="hint">· ${esc(l.recipeTitle)}</small>`:""}</span></label>`}).join("")}</div>
  <div class="sheetfoot"><button class="btn ghost" data-action="close">Annuler</button><button class="btn" data-action="gsave" id="gsaveBtn">Ajouter ${lines.length} article${lines.length>1?"s":""}</button></div>`);
}
function mergeLines(lines){
  const out=[],idx={};
  lines.forEach(l=>{const k=norm(l.name)+"|"+(l.unit||"");if(idx[k]!=null){const o=out[idx[k]];if(o.q!=null&&l.q!=null)o.q+=l.q;else if(o.q==null)o.q=l.q;
      if(l.recipeTitle&&o.recipeTitle&&o.recipeTitle.indexOf(l.recipeTitle)<0)o.recipeTitle+=", "+l.recipeTitle}
    else{idx[k]=out.length;out.push(Object.assign({},l))}});
  return out;
}
async function addGroceries(lines){
  const items=Object.values(S.groceries);
  for(const l of lines){
    const ex=items.find(i=>!i.checked&&norm(i.name)===norm(l.name)&&(i.unit||"")===(l.unit||""));
    if(ex){const q=ex.q!=null&&l.q!=null?ex.q+l.q:(ex.q!=null?ex.q:l.q);let rt=ex.recipeTitle||"";if(l.recipeTitle&&rt.indexOf(l.recipeTitle)<0)rt=rt?rt+", "+l.recipeTitle:l.recipeTitle;
      await patch("groceries",ex.id,{q:q==null?null:q,recipeTitle:rt||null})}
    else{const id=uid();const it={name:l.name,q:l.q==null?null:Math.round(l.q*100)/100,unit:l.unit||null,aisle:l.aisle||guessAisle(l.name),checked:false,recipeTitle:l.recipeTitle||null,createdAt:Date.now()};
      await put("groceries",id,it);items.push(Object.assign({id},it))}
  }
}
function gEditSheet(id){
  const i=S.groceries[id];if(!i)return;
  openSheet(`<h2>Modifier l'article</h2><form id="gEditForm" data-id="${esc(id)}">
  <label class="f" for="ge_name">Article</label><input type="text" id="ge_name" value="${esc(i.name)}" required>
  <div class="row"><div><label class="f" for="ge_q">Quantité</label><input type="text" id="ge_q" inputmode="decimal" value="${i.q!=null?esc(String(i.q).replace(".",",")):""}"></div>
  <div><label class="f" for="ge_u">Unité</label><input type="text" id="ge_u" value="${esc(i.unit||"")}"></div></div>
  <label class="f" for="ge_a">Rayon</label><select id="ge_a">${AISLES.map(a=>`<option ${a===(i.aisle||"Autres")?"selected":""}>${esc(a)}</option>`).join("")}</select>
  <div class="sheetfoot"><button type="button" class="btn danger" data-action="gdel" data-id="${esc(id)}">Supprimer</button><button type="submit" class="btn">Enregistrer</button></div></form>`);
}

/* ---------- mode cuisine ---------- */
let wake=null;
async function startCook(){
  const r=curRecipe();if(!r||!(r.steps||[]).length){toast("Cette recette n'a pas d'étapes.");return}
  S.cookStep=0;$("cook").hidden=false;drawCook();
  try{wake=await navigator.wakeLock.request("screen")}catch(e){wake=null}
}
function drawCook(){
  const r=curRecipe(),n=r.steps.length,i=S.cookStep;
  if(i>=n){$("cook").innerHTML=`<div class="ctop"><div>${esc(r.title)}</div><button class="iconbtn" data-action="cookclose" aria-label="Fermer">×</button></div><div class="cbody" style="text-align:center"><p class="stepx" style="font-family:var(--display)">Bon appétit</p><p class="hint">Recette cuisinée ${(r.cooked||0)+1} fois avec celle-ci.</p></div><div class="cfoot"><button class="btn ghost" data-action="cookprev">Revenir</button><button class="btn" data-action="cookdone">Terminer</button></div>`;return}
  $("cook").innerHTML=`<div class="ctop"><div>${esc(r.title)}</div><button class="iconbtn" data-action="cookclose" aria-label="Fermer">×</button></div>
  <div class="prog"><i style="width:${Math.round((i+1)/n*100)}%"></i></div>
  <div class="cbody"><div class="num">Étape ${i+1} sur ${n}</div><p class="stepx">${stepHtml(r.steps[i],S.metric)}</p></div>
  <div class="cfoot"><button class="btn ghost" data-action="cookprev" ${i===0?"disabled":""}>Précédente</button><button class="btn" data-action="cooknext">${i===n-1?"J'ai fini":"Suivante"}</button></div>`;
}
function endCook(){$("cook").hidden=true;$("cook").innerHTML="";if(wake){wake.release().catch(()=>{});wake=null}}

/* ---------- événements ---------- */
document.addEventListener("click",async e=>{
  const b=e.target.closest("[data-action]");if(!b)return;const a=b.dataset.action,id=b.dataset.id;
  switch(a){
    case "close":closeSheet();break;
    case "cb":S.cookbook=id;render();break;
    case "quick":S.quick=!S.quick;render();break;
    case "newcb":openSheet(`<h2>Nouveau cookbook</h2><form id="cbForm"><label class="f" for="cb_name">Nom</label><input type="text" id="cb_name" required placeholder="Repas rapides en semaine"><div class="sheetfoot"><button type="button" class="btn ghost" data-action="close">Annuler</button><button class="btn" type="submit">Créer</button></div></form>`);break;
    case "renamecb":{const c=S.cookbooks[S.cookbook];openSheet(`<h2>Renommer</h2><form id="cbForm" data-id="${esc(c.id)}"><label class="f" for="cb_name">Nom</label><input type="text" id="cb_name" required value="${esc(c.name)}"><div class="sheetfoot"><button type="button" class="btn ghost" data-action="close">Annuler</button><button class="btn" type="submit">Renommer</button></div></form>`);break}
    case "delcb":{const c=S.cookbooks[S.cookbook];openSheet(`<h2>Supprimer « ${esc(c.name)} » ?</h2><p>Les recettes restent dans votre carnet, seul le cookbook disparaît.</p><div class="sheetfoot"><button class="btn ghost" data-action="close">Annuler</button><button class="btn danger" data-action="delcbok">Supprimer</button></div>`);break}
    case "delcbok":{const cid=S.cookbook;closeSheet();S.cookbook="all";for(const r of Object.values(S.recipes)){if((r.cookbookIds||[]).includes(cid))await patch("recipes",r.id,{cookbookIds:r.cookbookIds.filter(x=>x!==cid)})}await del("cookbooks",cid);toast("Cookbook supprimé");break}
    case "import":importSheet();break;
    case "imp-link":linkSheet();break;
    case "imp-text":textSheet();break;
    case "imp-photo":closeSheet();$("photoInput").click();break;
    case "imp-manual":closeSheet();openEdit({title:"",ingredients:[],steps:[],cookbookIds:S.cookbook!=="all"?[S.cookbook]:[],source:"manuel"});break;
    case "open":case "pick":
      if(a==="pick"){const r=S.recipes[id];closeSheet();S.pdraft={recipeId:id,date:S.pickDate,slot:"dinner",servings:r&&r.servings||2};drawPlanSheet();break}
      if(!S.recipes[id])break;S.recipeId=id;S.view="recipe";S.servings=null;S.metric=false;render();window.scrollTo(0,0);break;
    case "back":S.view=null;render();break;
    case "sv":{const r=curRecipe();const cur=S.servings||r.servings;S.servings=Math.max(1,cur+ +b.dataset.d);render();break}
    case "metric":S.metric=b.dataset.v==="1";render();break;
    case "cook":startCook();break;
    case "cookprev":S.cookStep=Math.max(0,S.cookStep-1);drawCook();break;
    case "cooknext":S.cookStep++;drawCook();break;
    case "cookclose":endCook();break;
    case "cookdone":{const r=curRecipe();endCook();await patch("recipes",r.id,{cooked:(r.cooked||0)+1});toast("Bien joué");break}
    case "toplan":planSheet(S.recipeId);break;
    case "pdate":S.pdraft.date=b.dataset.v;drawPlanSheet();break;
    case "pslot":S.pdraft.slot=b.dataset.v;drawPlanSheet();break;
    case "psv":S.pdraft.servings=Math.max(1,S.pdraft.servings+ +b.dataset.d);drawPlanSheet();break;
    case "psave":{const p=S.pdraft;closeSheet();await put("plan",uid(),{date:p.date,slot:p.slot,recipeId:p.recipeId,servings:p.servings,createdAt:Date.now()});
      const d=new Date(p.date+"T12:00:00");toast("Ajouté au "+d.toLocaleDateString("fr-FR",{weekday:"long",day:"numeric"}));break}
    case "togroc":{const r=curRecipe();const sv=S.servings||r.servings;const lines=scaled(r,sv,S.metric).map(i=>({name:i.name,q:i.q,unit:i.unit,aisle:i.aisle,recipeTitle:r.title}));
      if(!lines.length){toast("Pas d'ingrédients à ajouter.");break}grocSheet(mergeLines(lines),"Ajouter aux courses");break}
    case "weektogroc":{const ws=iso(S.weekStart),we=iso(addDays(S.weekStart,6));let lines=[];
      Object.values(S.plan).filter(e=>e.date>=ws&&e.date<=we).forEach(e=>{const r=S.recipes[e.recipeId];if(!r)return;
        scaled(r,e.servings||r.servings,true).forEach(i=>lines.push({name:i.name,q:i.q,unit:i.unit,aisle:i.aisle,recipeTitle:r.title}))});
      if(!lines.length){toast("Aucun ingrédient dans cette semaine.");break}grocSheet(mergeLines(lines),"Courses de la semaine");break}
    case "gsave":{const keep=[];document.querySelectorAll("#pane [data-gi]").forEach(c=>{if(c.checked)keep.push(S.gdraft[+c.dataset.gi])});closeSheet();
      if(keep.length){await addGroceries(keep);toast(keep.length+" article"+(keep.length>1?"s":"")+" ajouté"+(keep.length>1?"s":""))}break}
    case "edit":{const r=curRecipe();openEdit(JSON.parse(JSON.stringify(r)));break}
    case "canceledit":{const d=S.draft;S.draft=null;$("app").innerHTML="";S.view=d&&d.id&&S.recipes[d.id]?"recipe":null;render();break}
    case "delrecipe":$("delzone").innerHTML=`<p style="margin:0 0 8px">Supprimer définitivement cette recette ?</p><div class="row"><button class="btn ghost" data-action="back2">Garder</button><button class="btn danger" data-action="delrecipeok">Supprimer</button></div>`;break;
    case "back2":render();break;
    case "delrecipeok":{const rid=S.recipeId;S.view=null;for(const e of Object.values(S.plan)){if(e.recipeId===rid)await del("plan",e.id)}await del("recipes",rid);toast("Recette supprimée");break}
    case "nutrition":{const r=curRecipe();b.disabled=true;b.textContent="Estimation…";
      try{const j=await fn({mode:"nutrition",servings:r.servings||null,ingredients:ingredientsToLines(r.ingredients)});const x=j.nutrition||{};
        const n={kcal:Math.round(+x.kcal||0),prot:Math.round(+x.prot||0),gluc:Math.round(+x.gluc||0),lip:Math.round(+x.lip||0)};await patch("recipes",r.id,{nutrition:n})}
      catch(err){b.disabled=false;b.textContent="Estimer";toast(errMsg(err))}break}
    case "settings":settingsSheet();break;
    case "logout":closeSheet();saveSession(null);lsSet("cuisine.cache",null);COLS.forEach(k=>S[k]={});S.ready=false;S.view=null;S.tab="library";$("app").innerHTML="";render();break;
    case "reload":closeSheet();await refresh();toast(S.offline?"Serveur injoignable":"À jour");break;
    case "export":{const data=JSON.stringify({app:"cuisine-de-francois",date:new Date().toISOString(),recipes:S.recipes,cookbooks:S.cookbooks,plan:S.plan,groceries:S.groceries},null,1);
      const a2=document.createElement("a");a2.href=URL.createObjectURL(new Blob([data],{type:"application/json"}));a2.download="cuisine-sauvegarde-"+iso(new Date())+".json";document.body.appendChild(a2);a2.click();setTimeout(()=>{URL.revokeObjectURL(a2.href);a2.remove()},2000);break}
    case "importbak":$("bakInput").click();break;
    case "signup":{const f=$("authForm");const em=$("a_mail").value.trim(),pw=$("a_pass").value;if(!em||pw.length<6){$("authMsg").innerHTML=`<div class="err">Saisissez une adresse et un mot de passe d'au moins 6 caractères.</div>`;break}
      b.disabled=true;try{const j=await authCall("signup",{email:em,password:pw});
        if(j.access_token){storeTok(j);$("app").innerHTML="";S.ready=false;render();await refresh()}
        else $("authMsg").innerHTML=`<div class="banner" style="margin-top:10px">Compte créé. Confirmez l'adresse avec le mail reçu, puis connectez-vous.</div>`}
      catch(e){$("authMsg").innerHTML=`<div class="err">${esc(e.message)}</div>`}b.disabled=false;break}
    case "week":S.weekStart=addDays(S.weekStart,+b.dataset.d);render();break;
    case "plandd":if(!Object.keys(S.recipes).length){toast("Ajoutez d'abord une recette.");break}pickSheet(b.dataset.date);break;
    case "unplan":await del("plan",id);break;
    case "gmode":S.gmode=b.dataset.v;render();break;
    case "check":break;
    case "gedit":gEditSheet(id);break;
    case "gdel":closeSheet();await del("groceries",id);break;
    case "clearchecked":$("clearzone").innerHTML=`<button class="link danger" data-action="clearok">Confirmer le retrait</button>`;break;
    case "clearok":for(const i of Object.values(S.groceries)){if(i.checked)await del("groceries",i.id)}toast("Articles cochés retirés");break;
    case "copygroc":{const groups={};Object.values(S.groceries).filter(i=>!i.checked).forEach(i=>{(groups[i.aisle||"Autres"]=groups[i.aisle||"Autres"]||[]).push(i)});
      const txt=AISLES.filter(a=>groups[a]).map(a=>a+"\n"+groups[a].map(i=>"- "+[i.q!=null?fmtQ(i.q,i.unit):"",i.unit||"",i.name].filter(Boolean).join(" ")).join("\n")).join("\n\n");
      try{await navigator.clipboard.writeText(txt);toast("Liste copiée")}catch(err){openSheet(`<h2>Liste de courses</h2><textarea id="copytxt" rows="14" readonly>${esc(txt)}</textarea><p class="hint">Sélectionnez le texte et copiez-le.</p><div class="sheetfoot"><button class="btn" data-action="close">Fermer</button></div>`);$("copytxt").select()}break}
  }
});
document.addEventListener("change",async e=>{
  const t=e.target;
  if(t.dataset&&t.dataset.action==="check"){await patch("groceries",t.dataset.id,{checked:t.checked})}
  if(t.id==="notes"){const r=curRecipe();if(r&&t.value!==(r.notes||""))await patch("recipes",r.id,{notes:t.value})}
  if(t.dataset&&t.dataset.gi!=null){const n=document.querySelectorAll("#pane [data-gi]:checked").length;const btn=$("gsaveBtn");if(btn){btn.textContent=n?"Ajouter "+n+" article"+(n>1?"s":""):"Rien à ajouter";btn.disabled=!n}}
});
document.addEventListener("input",e=>{
  if(e.target.id==="search"){S.q=e.target.value;$("rlist").innerHTML=libraryList()}
  if(e.target.id==="pickq"){S.pickQ=e.target.value;const q=norm(S.pickQ);$("picklist").innerHTML=Object.values(S.recipes).filter(r=>!q||norm(r.title).includes(q)).map(r=>card(r,"pick")).join("")||`<p class="hint">Aucune recette.</p>`}
});
document.addEventListener("submit",async e=>{
  e.preventDefault();const f=e.target;
  if(f.id==="editForm")return saveEdit();
  if(f.id==="authForm"){const btn=f.querySelector('[type=submit]');btn.disabled=true;
    try{const j=await authCall("token?grant_type=password",{email:$("a_mail").value.trim(),password:$("a_pass").value});storeTok(j);$("app").innerHTML="";S.ready=false;render();await refresh();handleShare()}
    catch(err){$("authMsg").innerHTML=`<div class="err">${esc(err.message)}</div>`;btn.disabled=false}return}
  if(f.id==="cbForm"){const name=$("cb_name").value.trim();if(!name)return;const cid=f.dataset.id;closeSheet();
    if(cid)await patch("cookbooks",cid,{name});else{const nid=uid();await put("cookbooks",nid,{name,createdAt:Date.now()});S.cookbook=nid;render()}return}
  if(f.id==="linkForm"){const u=$("l_url").value.trim();if(u)importLink(u);return}
  if(f.id==="textForm"){const t=$("t_txt").value.trim();const src=$("t_src").value.trim();if(!t)return;
    if(/^https?:\/\/\S+$/.test(t)){linkSheet(t);return}
    busy("Mise en forme de la recette…");runExtract({mode:"text",text:t.slice(0,30000),sourceUrl:src||null},src?host(src):"texte",src||null,"imp-manual");return}
  if(f.id==="gaddForm"){const v=$("gadd").value.trim();if(!v)return;$("gadd").value="";const p=parseLine(v);await addGroceries([{name:p.name,q:p.q,unit:p.unit,aisle:p.aisle,recipeTitle:null}]);$("gadd").focus();return}
  if(f.id==="gEditForm"){const id=f.dataset.id;const qv=$("ge_q").value.trim();closeSheet();
    await patch("groceries",id,{name:$("ge_name").value.trim()||"Article",q:qv?num(qv):null,unit:$("ge_u").value.trim()||null,aisle:$("ge_a").value});return}
});
$("fab").addEventListener("click",importSheet);
document.querySelectorAll("#tabs button").forEach(b=>b.addEventListener("click",()=>{if(S.view==="edit"){S.draft=null;$("app").innerHTML=""}S.tab=b.dataset.tab;S.view=null;render();window.scrollTo(0,0)}));
document.addEventListener("visibilitychange",async()=>{if(!$("cook").hidden&&document.visibilityState==="visible"&&!wake){try{wake=await navigator.wakeLock.request("screen")}catch(e){}}});

boot();
if("serviceWorker" in navigator){window.addEventListener("load",()=>{navigator.serviceWorker.register("./sw.js").catch(()=>{})})}
})();
