(function(){
'use strict';
var SB_URL='https://ipkfinjfohuyxkvcsrla.supabase.co';
var SB_KEY='sb_publishable_2SG-qY0Dr7wRO_M0l62ZMw_-QujGjGK';
var sb=window.__SB__||window.supabase.createClient(SB_URL,SB_KEY);

var PROGRAM=['Victor','Roland','Stefano','Roberto','Federico'];
var ST={da_contattare:'Da contattare',contattato:'Contattato',promemoria:'Promemoria inviato',link_aperto:'Link aperto',dichiarata:'Dichiarata dal cliente',verificata:'Verificata su Google',non_interessato:'Non interessato',non_raggiungibile:'Non raggiungibile'};
var MS={da_scrivere:'Da scrivere',bozza:'Bozza',pronto:'Pronto per l\'agente',inviato:'Inviato'};
var ROLE_L={admin:'Amministratore',editor:'Redazione (Valentina)',agent:'Agente'};
var PED_ST={idea:'Idea',in_lavorazione:'In lavorazione',pronto:'Pronto',pubblicato:'Pubblicato'};
var FORMATS={tour:'Tour immobile',venduta:'Venduta',persona:'Persona / rubrica',semplice:'Linguaggio semplice',territorio:'Territorio',istituzionale:'Istituzionale',recensioni:'Recensioni',altro:'Altro'};
var MIX=[['tour',5],['venduta',2],['persona',2],['semplice',1],['territorio',1],['istituzionale',1]];

var S={me:null,tab:'guide',contacts:[],agents:[],agentMap:{},voices:{},settings:null,inits:[],ped:[],missing:[],users:[],crm:[],usersLoaded:false,cred:null,
  f:{seg:'prio',agent:'',year:'',status:'',msg:'',q:'',nophone:false},limit:100,chip:'send',pedMonth:ym(new Date(Date.now()+10*864e5)),modal:null,voiceAgent:null,loading:true,pillars:[],events:[],pv:'home',pa:'',pch:'',pst:'',open:{},reels:[],rc:'',rp:'',p27:[],p27m:[],pm:0,pk:'',pv7:'',pq:''};

function $(s,el){return (el||document).querySelector(s)}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function cap(s){return String(s||'').toLowerCase().replace(/(^|[\s'’-])([a-zà-ÿ])/g,function(m,a,b){return a+b.toUpperCase()})}
function ym(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')}
function fdate(d){return d?new Date(d).toLocaleDateString('it-IT',{day:'2-digit',month:'short',year:'numeric'}):'—'}
function norm(t){return String(t||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z ]/g,' ').replace(/\s+/g,' ').trim()}
function toast(m,err){var t=$('#toast');t.textContent=m;t.className='show'+(err?' err':'');clearTimeout(toast._t);toast._t=setTimeout(function(){t.className=''},err?5000:2200)}
function agentName(id){var a=S.agentMap[id];return a?(a.first_name+' '+a.last_name).trim():'—'}
function agentFirst(id){var a=S.agentMap[id];return a?a.first_name:''}
function isStaff(){return S.me&&S.me.staff}
function isAdmin(){return S.me&&S.me.admin}
function inviteUrl(c){return location.origin+'/r/'+c.token}
function isPrio(c){return c.source==='crm_op'||c.op_year===2025||c.op_year===2026}
function fullName(c){return cap(c.first_name)+' '+cap(c.last_name)}
function pill(st){return '<span class="pill st-'+st+'">'+esc(ST[st]||st)+'</span>'}
function mpill(st){return '<span class="pill ms-'+st+'">'+esc(MS[st]||st)+'</span>'}
function pct(a,b){return b>0?Math.min(100,Math.round(a/b*100)):0}
function fmtDraft(c,reg){
  var v=S.voices[c.agent_id];if(!v)return 'Ciao '+cap(c.first_name)+', ';
  var r=reg||c.register||v.register||'tu';
  var tpl=v['tpl_first_'+r]||'';
  return tpl.split('{nome}').join(cap(c.first_name)).split('{agente}').join(agentFirst(c.agent_id));
}
function finalMsg(c,txt){
  var t=String(txt!=null?txt:(c.msg_text||'')).trim();if(!t)return '';
  var l=inviteUrl(c);
  return t.indexOf('{link}')>=0?t.split('{link}').join(l):t+'\n\n'+l;
}
function waLink(c,txt){return c.phone_wa?'https://wa.me/'+c.phone_wa+'?text='+encodeURIComponent(txt):null}

/* ---------- data ---------- */
async function fetchAll(mk){
  var out=[],from=0,step=1000;
  for(;;){
    var r=await mk(from,from+step-1);
    if(r.error)return {data:out,error:r.error};
    out=out.concat(r.data||[]);
    if(!r.data||r.data.length<step)break;
    from+=step;
  }
  return {data:out};
}
async function loadContacts(){
  var r=await fetchAll(function(a,b){return sb.from('vale_contacts').select('*').order('last_name').order('id').range(a,b)});
  if(r.error)toast('Errore nel caricamento dei contatti: '+r.error.message,true);
  S.contacts=r.data;
}
async function loadAll(){
  var r=await Promise.all([
    sb.rpc('vale_agent_list'),
    sb.from('vale_agent_voice').select('*'),
    sb.from('vale_settings').select('*').eq('id',1).maybeSingle(),
    sb.from('vale_initiatives').select('*').order('created_at'),
    sb.from('vale_ped').select('*').order('publish_date',{ascending:true,nullsFirst:false}),
    sb.rpc('vale_ops_missing'),
    sb.from('vale_pillars').select('*').order('sort'),
    sb.from('vale_events').select('*').order('event_date'),
    sb.from('vale_reels').select('*').order('posted_at',{ascending:false}),
    loadContacts()
  ]);
  var bad=r.slice(0,9).find(function(x){return x&&x.error});
  if(bad){toast('Errore nel caricamento: '+bad.error.message,true)}
  S.agents=(r[0].data||[]);S.agentMap={};S.agents.forEach(function(a){S.agentMap[a.id]=a});
  S.voices={};(r[1].data||[]).forEach(function(v){S.voices[v.agent_id]=v});
  S.settings=r[2].data;S.inits=r[3].data||[];S.ped=r[4].data||[];S.missing=r[5].data||[];S.pillars=r[6].data||[];S.events=r[7].data||[];S.reels=r[8].data||[];
  var r2=await Promise.all([sb.from('vale_ped_2027').select('*').order('n'),sb.from('vale_ped_2027_months').select('*').order('month')]);
  S.p27=r2[0].data||[];S.p27m=r2[1].data||[];
  S.loading=false;
}
function merge(list,row){var i=list.findIndex(function(x){return x.id===row.id});if(i>=0)list[i]=row;else list.push(row)}
async function updContact(id,patch,quiet){
  var r=await sb.from('vale_contacts').update(patch).eq('id',id).select().single();
  if(r.error){toast(r.error.message,true);return null}
  merge(S.contacts,r.data);if(!quiet)render();return r.data;
}
async function callAdmin(body){
  var s=await sb.auth.getSession();var tok=s.data.session&&s.data.session.access_token;
  try{
    var r=await fetch(SB_URL+'/functions/v1/vale-admin',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+tok,'apikey':SB_KEY},body:JSON.stringify(body)});
    var j=await r.json().catch(function(){return {error:'Risposta non valida dal server'}});
    if(!r.ok)return {error:j.error||('Errore '+r.status)};
    return j;
  }catch(e){return {error:'Server non raggiungibile'}}
}
async function loadUsers(){
  var j=await callAdmin({action:'list'});
  if(j.error){toast(j.error,true);return}
  S.users=j.users||[];S.crm=j.crm_profiles||[];S.usersLoaded=true;
}

/* ---------- auth / boot ---------- */
async function boot(){
  var s=await sb.auth.getSession();
  if(!s.data.session){renderLogin();return}
  await afterLogin();
}
async function afterLogin(){
  var w=await sb.rpc('vale_whoami');
  S.me=w.data;
  if(!S.me||!S.me.role){
    $('#app').innerHTML='<div class="login">'+logoHtml()+'<h3>Accesso non abilitato</h3><p class="muted" style="margin:6px 0 14px">L\'account '+esc(S.me&&S.me.email||'')+' non è abilitato a Vale Hub. Chiedi a Marco di creare o attivare il tuo utente.</p><button class="btn" data-act="logout">Esci</button></div>';return;
  }
  S.tab=isStaff()?'home':'mine';S.chip='send';S.pa=S.me.agent_id||'';render();
  await loadAll();render();
}
function renderLogin(msg){
  $('#app').innerHTML='<form class="login" id="lf">'+logoHtml()+'<h3>Vale Hub</h3><p class="muted" style="margin-bottom:6px">Accedi con email e password.</p>'+(msg?'<div class="warn" style="margin-top:10px">'+esc(msg)+'</div>':'')+'<label>Email</label><input type="email" id="em" autocomplete="username" required><label>Password</label><input type="password" id="pw" autocomplete="current-password" required><button class="btn p" style="width:100%;justify-content:center;margin-top:16px;padding:10px" type="submit">Accedi</button></form>';
  $('#lf').onsubmit=async function(e){
    e.preventDefault();
    var r=await sb.auth.signInWithPassword({email:$('#em').value.trim(),password:$('#pw').value});
    if(r.error){renderLogin('Email o password non corretti.');return}
    await afterLogin();
  };
}

/* ---------- shell ---------- */
function logoHtml(){return '<img class="logo" src="https://victorcorealestate.com/logo-victorco.png" alt="Victor&amp;Co Real Estate" onerror="this.onerror=null;this.src=\'/assets/logo-navy.png\'">'}
function tabsFor(){
  if(isStaff())return [['home','Oggi'],['contacts','Recensioni'],['ped','PED'],['reels','Reel'],['stats','Statistiche'],['p27','PED 2027'],['aree','Aree di lavoro'],['docs','Documenti'],['settings','Impostazioni']];
  return [['mine','Recensioni'],['ped','PED'],['reels','Reel'],['stats','Statistiche'],['p27','PED 2027'],['aree','Aree di lavoro'],['docs','Documenti']];
}
function render(){
  if(!S.me)return;
  var tabs=tabsFor();var body='';
  if(S.loading)body='<div class="card muted">Caricamento…</div>';
  else if(S.tab==='home')body=viewHome();
  else if(S.tab==='contacts')body=viewContacts();
  else if(S.tab==='mine')body=viewMine();
  else if(S.tab==='ped')body=viewPed();
  else if(S.tab==='reels')body=viewReels();
  else if(S.tab==='stats')body=viewStats();
  else if(S.tab==='docs')body=viewDocs();
  else if(S.tab==='aree')body=viewAree();
  else if(S.tab==='p27')body=viewP27();
  else if(S.tab==='settings')body=viewSettings();
  var keepId=document.activeElement&&(document.activeElement.id==='fq'||document.activeElement.id==='p27q')?document.activeElement.id:null;var keep=keepId?{id:keepId,pos:document.activeElement.selectionStart}:null;
  $('#app').innerHTML='<div class="wrap"><header class="brand">'+logoHtml()+'<span class="meta"><span>Vale Hub · '+esc(S.me.name||S.me.email||'')+'</span><button class="sbtn" data-act="logout">Esci</button></span></header><nav class="tabs">'+tabs.map(function(t){return '<button data-act="tab" data-v="'+t[0]+'" class="'+(S.tab===t[0]?'on':'')+'">'+t[1]+'</button>'}).join('')+'</nav><main>'+body+'</main></div>'+(S.modal?modalHtml():'');
  if(keep){var q=$('#'+keep.id);if(q){q.focus();q.setSelectionRange(keep.pos,keep.pos)}}
}
/* ---------- views ---------- */
function recInit(){return S.inits.find(function(i){return i.slug==='recensioni-google'})}
function kpi(l,v,s){return '<div class="kpi"><div class="l">'+l+'</div><div class="v">'+v+'</div><div class="s">'+esc(s||'')+'</div></div>'}
function filtered(){
  var f=S.f,q=norm(f.q);
  return S.contacts.filter(function(c){
    if(!isPrio(c))return false;
    if(f.agent==='none'){if(c.agent_id)return false}else if(f.agent&&c.agent_id!==f.agent)return false;
    if(f.year&&String(c.op_year)!==f.year)return false;
    if(f.status&&c.status!==f.status)return false;
    if(f.msg&&c.msg_status!==f.msg)return false;
    if(f.nophone&&c.phone_wa)return false;
    if(q&&norm(c.first_name+' '+c.last_name+' '+(c.property_name||'')).indexOf(q)<0)return false;
    return true;
  });
}
function agentOptions(sel,withAll){
  var opts=(withAll==='filter'?'<option value="">Tutti gli agenti</option><option value="none"'+(sel==='none'?' selected':'')+'>Senza agente</option>':'<option value="">— nessuno —</option>');
  var list=S.agents.slice().sort(function(a,b){var ia=PROGRAM.indexOf(a.first_name),ib=PROGRAM.indexOf(b.first_name);ia=ia<0?99:ia;ib=ib<0?99:ib;return ia-ib||a.first_name.localeCompare(b.first_name)});
  list.forEach(function(a){
    var dup=list.filter(function(x){return x.first_name===a.first_name&&x.last_name===a.last_name}).length>1;
    opts+='<option value="'+a.id+'"'+(a.id===sel?' selected':'')+'>'+esc(a.first_name+' '+a.last_name+(dup?' ('+a.role+')':''))+'</option>';
  });
  return opts;
}
function statusOptions(sel,withAll){
  return (withAll?'<option value="">Tutti gli stati</option>':'')+Object.keys(ST).map(function(k){return '<option value="'+k+'"'+(k===sel?' selected':'')+'>'+ST[k]+'</option>'}).join('');
}
function msOptions(sel,withAll){
  return (withAll?'<option value="">Ogni messaggio</option>':'')+Object.keys(MS).map(function(k){return '<option value="'+k+'"'+(k===sel?' selected':'')+'>'+MS[k]+'</option>'}).join('');
}
function viewContacts(){
  var list=filtered();var shown=list.slice(0,S.limit);
  var P=S.contacts.filter(isPrio);
  var n=function(arr,st){return arr.filter(function(c){return c.msg_status===st}).length};
  var decl=P.filter(function(c){return c.declared_at||c.verified_at}).length;
  var ini=recInit(),cur=ini?+ini.current_value:0,tgt=ini?+ini.target:100;
  var missing=S.missing.length?'<div class="warn"><b>'+S.missing.length+' case vendute nel 2025-2026 non hanno nessun nome nel CRM</b>, quindi non c\'è nessuno da contattare finché non si aggiungono. <button class="btn sm" data-act="showmissing" style="margin-left:6px">Vedi e aggiungi</button></div>':'';
  var noAg=P.filter(function(c){return !c.agent_id}).length;
  return '<div class="row between"><div><h2>Recensioni</h2><p class="sub">'+P.length+' clienti delle case vendute nel 2025 e nel 2026. Valentina scrive il messaggio, l\'agente lo manda su WhatsApp con il link personale.</p></div><div class="row"><button class="btn" data-act="sync">Sincronizza dal CRM</button><button class="btn" data-act="csv">Esporta CSV</button></div></div>'
  +'<div class="card"><div class="row between"><div class="kpi" style="border:0;padding:0"><div class="l">Recensioni Google oggi</div><div class="v">'+cur+' <span class="muted" style="font-size:20px">/ '+tgt+'</span></div></div>'
  +'<div class="row"><label style="margin:0">Aggiorna il numero reale</label><input type="number" id="curv" value="'+cur+'" style="width:90px"><button class="btn p sm" data-act="savecur">Salva</button></div></div><div class="bar"><i style="width:'+pct(cur,tgt)+'%"></i></div></div>'
  +'<div class="grid g4" style="margin-bottom:14px">'+kpi('Case vendute 2025-26',P.length,noAg?noAg+' senza agente':'tutti con agente')+kpi('Da scrivere',n(P,'da_scrivere')+n(P,'bozza'),'messaggi da preparare')+kpi('Pronti',n(P,'pronto'),'in attesa dell\'agente')+kpi('Inviati',n(P,'inviato'),'dagli agenti')+kpi('Dichiarate',decl,'dal cliente')+'</div>'
  +missing
  +'<div class="filters"><input type="text" id="fq" placeholder="Cerca nome o immobile" value="'+esc(S.f.q)+'"><select data-chg="f.agent">'+agentOptions(S.f.agent,'filter')+'</select><select data-chg="f.year"><option value="">2025 e 2026</option><option value="2026"'+(S.f.year==='2026'?' selected':'')+'>2026</option><option value="2025"'+(S.f.year==='2025'?' selected':'')+'>2025</option></select><select data-chg="f.msg">'+msOptions(S.f.msg,true)+'</select><select data-chg="f.status">'+statusOptions(S.f.status,true)+'</select><label style="margin:0;display:flex;align-items:center;gap:6px"><input type="checkbox" data-chg="f.nophone"'+(S.f.nophone?' checked':'')+' style="width:auto"> Solo senza numero</label></div>'
  +'<div class="scroll"><table><tr><th>Nome</th><th>Ruolo · immobile</th><th>Agente</th><th>Telefono</th><th>Messaggio</th><th>Recensione</th><th></th></tr>'
  +(shown.map(function(c){
    return '<tr><td><b>'+esc(fullName(c))+'</b><small>'+(c.op_year?'<span class="badge">'+esc(c.op_year)+'</span>':'')+(c.ops_count>1?c.ops_count+' operazioni':'')+(c.do_not_contact?' <span style="color:var(--red)">non contattare</span>':'')+'</small></td>'
    +'<td><div>'+esc(c.role_label||'')+'</div><small>'+esc(c.property_name||'')+'</small></td>'
    +'<td><select data-cagent="'+c.id+'" style="min-width:130px">'+agentOptions(c.agent_id,false)+'</select></td>'
    +'<td><input type="text" data-cphone="'+c.id+'" value="'+esc(c.phone||'')+'" placeholder="+39…" style="min-width:128px"></td>'
    +'<td>'+mpill(c.msg_status)+'</td><td><select data-cstatus="'+c.id+'" style="min-width:150px">'+statusOptions(c.status)+'</select></td>'
    +'<td style="white-space:nowrap"><button class="btn sm p" data-act="msg" data-id="'+c.id+'">Messaggio</button></td></tr>';
  }).join('')||'<tr><td colspan="7" class="muted" style="padding:20px">Nessun contatto con questi filtri.</td></tr>')+'</table></div>'
  +(list.length>shown.length?'<div class="row" style="justify-content:center;margin-top:12px"><button class="btn" data-act="more">Mostra altri '+Math.min(100,list.length-shown.length)+' (di '+(list.length-shown.length)+' restanti)</button></div>':'<p class="sub" style="text-align:center;margin-top:10px">'+list.length+' contatti</p>');
}
function viewMine(){
  var mine=S.contacts.filter(isPrio);
  function grp(c){
    if(c.msg_status==='pronto')return 'send';
    if(c.msg_status==='inviato')return 'sent';
    return 'prep';
  }
  var cnt={send:0,prep:0,sent:0};mine.forEach(function(c){cnt[grp(c)]++});
  var chips=[['send','Da inviare ('+cnt.send+')'],['prep','In preparazione ('+cnt.prep+')'],['sent','Inviati ('+cnt.sent+')'],['all','Tutti ('+mine.length+')']];
  var list=mine.filter(function(c){return S.chip==='all'||grp(c)===S.chip});
  var shown=list.slice(0,S.limit);
  var miss=S.missing.length?'<div class="warn">'+S.missing.length+' tue case vendute non hanno nomi nel CRM: aggiungi i clienti per poterli contattare. <button class="btn sm" data-act="showmissing" style="margin-left:6px">Vedi e aggiungi</button></div>':'';
  return '<h2>Recensioni</h2><p class="sub">Valentina prepara il messaggio per ogni cliente. Tu lo copi, lo mandi su WhatsApp e premi «Fatto, inviato».</p>'+miss
  +'<nav class="subtabs">'+chips.map(function(c){return '<button class="'+(S.chip===c[0]?'on':'')+'" data-act="chip" data-v="'+c[0]+'">'+c[1]+'</button>'}).join('')+'</nav>'
  +(shown.map(cardHtml).join('')||'<div class="card muted">Nessun contatto in questa lista.</div>')
  +(list.length>shown.length?'<div class="row" style="justify-content:center"><button class="btn" data-act="more">Mostra altri</button></div>':'');
}
function cardHtml(c){
  var fm=finalMsg(c);
  var canWa=!!c.phone_wa;
  var body='';
  if(c.msg_status==='pronto'||c.msg_status==='inviato'){
    body='<label>Messaggio con il link personale</label><div class="preview ready">'+esc(fm)+'</div>'
    +'<div class="acts"><button class="btn p" data-act="copyfinal" data-id="'+c.id+'">Copia messaggio</button>'
    +(canWa?'<a class="btn wa" target="_blank" rel="noopener" href="'+esc(waLink(c,fm))+'">Apri WhatsApp</a><a class="btn" href="tel:+'+c.phone_wa+'">Chiama</a>':'<input type="text" data-cphone="'+c.id+'" placeholder="Aggiungi numero (+39…)" style="max-width:210px">')
    +(c.msg_status==='pronto'?'<button class="btn" data-act="sent" data-id="'+c.id+'">Fatto, inviato</button>':'<span class="muted" style="font-size:12.5px">Inviato '+fdate(c.contacted_at)+'</span>')+'</div>';
  } else {
    body='<div class="muted" style="font-size:13px;margin-top:6px">In attesa del messaggio di Valentina. Dille cosa ricordi di questo cliente:</div>'
    +'<textarea data-brief="'+c.id+'" rows="2" placeholder="Es. ha venduto con noi nel 2025, molto soddisfatto, meglio dargli del lei…" style="margin-top:6px;min-height:60px">'+esc(c.agent_brief||'')+'</textarea>';
  }
  return '<div class="ccard'+(isPrio(c)?' prio':'')+'"><div class="top"><div><div class="nm">'+esc(fullName(c))+'</div><div class="meta">'+esc(c.role_label||'')+(c.property_name?' · '+esc(c.property_name):'')+(c.op_year?' · '+esc(c.op_year):'')+'</div></div><div>'+mpill(c.msg_status)+' '+pill(c.status)+'</div></div>'+body
  +'<div class="acts"><select data-cstatus="'+c.id+'" style="width:auto">'+statusOptions(c.status)+'</select></div></div>';
}
function viewUsers(){
  if(!S.usersLoaded)return '<div class="card muted">Caricamento utenti…</div>';
  var have={};S.users.forEach(function(u){have[u.user_id]=1});
  var avail=S.crm.filter(function(p){return !have[p.id]});
  var cred=S.cred?'<div class="ok"><b>Utente creato.</b> Manda queste credenziali alla persona (il messaggio qui sotto si copia in un tocco):<div class="cred">'+esc(S.cred)+'</div><button class="btn p sm" data-act="copycred">Copia credenziali</button> <button class="btn sm" data-act="hidecred">Nascondi</button></div>':'';
  return '<p class="sub">Solo tu puoi creare, disattivare o rimuovere gli utenti. Chi non è in questa lista non entra.</p>'+cred
  +'<div class="card"><h3>Utenti abilitati</h3><div class="scroll"><table><tr><th>Nome</th><th>Email</th><th>Ruolo</th><th>Agente CRM</th><th>Ultimo accesso</th><th></th></tr>'
  +S.users.map(function(u){
    return '<tr><td><b>'+esc(u.name||'')+'</b>'+(u.active?'':' <span class="pill st-non_interessato">disattivato</span>')+'</td><td>'+esc(u.email)+'</td><td>'+esc(ROLE_L[u.role]||u.role)+'</td><td>'+esc(u.agent_id?agentName(u.agent_id):'—')+'</td><td class="muted">'+(u.last_sign_in_at?fdate(u.last_sign_in_at):'mai')+'</td>'
    +'<td style="white-space:nowrap">'+(u.user_id===S.me.uid?'<span class="muted">tu</span>':'<button class="btn sm" data-act="toggleuser" data-id="'+u.user_id+'" data-v="'+(u.active?'0':'1')+'">'+(u.active?'Disattiva':'Riattiva')+'</button> '+(u.crm_account?'':'<button class="btn sm" data-act="resetpw" data-id="'+u.user_id+'">Nuova password</button> ')+'<button class="btn sm danger" data-act="rmuser" data-id="'+u.user_id+'">Rimuovi</button>')+'</td></tr>';
  }).join('')+'</table></div></div>'
  +(avail.length?'<div class="card"><h3>Account del CRM non ancora abilitati</h3><p class="sub">Gli agenti usano già la loro email e password del CRM: basta abilitarli, senza creare una nuova password.</p><div class="row">'+avail.map(function(p){return '<button class="btn sm" data-act="enablecrm" data-id="'+p.id+'">Abilita '+esc((p.first_name+' '+p.last_name).trim())+' <span class="muted">('+esc(p.role)+')</span></button>'}).join('')+'</div></div>':'')
  +'<div class="card"><h3>Nuovo utente</h3><div class="grid g2" style="gap:0 14px"><div><label>Nome e cognome</label><input type="text" id="nu_name" placeholder="Valentina …"></div><div><label>Email</label><input type="email" id="nu_email" placeholder="vale@…"></div>'
  +'<div><label>Ruolo</label><select id="nu_role" data-chg-nu="1"><option value="editor">Redazione (Valentina): vede tutti i contatti, scrive i messaggi</option><option value="agent">Agente: vede solo i suoi contatti</option><option value="admin">Amministratore</option></select></div>'
  +'<div id="nu_agent_wrap" class="hidden"><label>Agente del CRM a cui corrisponde</label><select id="nu_agent">'+agentOptions('',false)+'</select></div>'
  +'<div><label>Password iniziale (min. 8 caratteri)</label><div class="row" style="flex-wrap:nowrap"><input type="text" id="nu_pw" placeholder="vuota se ha già un account"><button class="btn sm" data-act="genpw" type="button">Genera</button></div></div></div>'
  +'<div style="display:flex;justify-content:flex-end;margin-top:14px"><button class="btn p" data-act="createuser">Crea utente</button></div></div>';
}
function todayStr(){var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function weekStart(d){var x=new Date(d+'T12:00:00');x.setDate(x.getDate()-((x.getDay()+6)%7));return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0')}
function addDays(d,n){var x=new Date(d+'T12:00:00');x.setDate(x.getDate()+n);return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0')}
function fday(d){return d?new Date(d+'T12:00:00').toLocaleDateString('it-IT',{weekday:'short',day:'2-digit',month:'short'}):'senza data'}
function pillarOf(p){return S.pillars.find(function(x){return x.agent_id&&x.agent_id===p.agent_id})}
function pillarName(p){var x=pillarOf(p);return x?x.name.split(' ')[0]:(p.agent_id?agentFirst(p.agent_id):'')}
function chanTag(p){return p.channel==='reel'?'<span class="tag r">Reel IG+TT</span>':p.channel==='articolo'?'<span class="tag a">Articolo</span>':'<span class="tag">'+esc(FORMATS[p.format]||p.format||'')+'</span>'}
function scriptHtml(p){
  var s=p.script;if(!s)return '<p class="muted">Nessuno script per questo contenuto.</p>';
  var pl=pillarOf(p);
  var h='<div class="sp">';
  if(p.channel==='articolo'){
    h+='<h5>Taglio</h5><p>'+esc(s.l||'')+'</p><h5>Struttura (H2)</h5><ol>'+(s.h||[]).map(function(x){return '<li>'+esc(x)+'</li>'}).join('')+'</ol><h5>CTA</h5><p>'+esc(s.cta||(pl&&pl.cta)||'')+'</p>';
  } else {
    h+='<h5>Apertura (0-5")</h5><p>'+esc(s.o||'')+'</p><h5>Tre punti (testo a schermo)</h5><ol>'+(s.p||[]).map(function(x){return '<li>'+esc(x)+'</li>'}).join('')+'</ol><h5>Chiusura</h5><p>'+esc(s.c||'')+'</p><h5>Caption</h5><p>'+esc(s.cap||'')+'</p><h5>CTA</h5><p>'+esc(s.cta||(pl&&pl.cta)||'')+'</p>';
  }
  if(s.n)h+='<div class="nt">Nota: '+esc(s.n)+'</div>';
  return h+'<button class="btn sm" style="margin-top:8px" data-act="pcopy" data-id="'+p.id+'">Copia '+(p.channel==='articolo'?'traccia':'script')+'</button></div>';
}
function scriptText(p){
  var s=p.script;if(!s)return p.title||'';
  var pl=pillarOf(p);
  if(p.channel==='articolo')return [p.title,'TAGLIO: '+(s.l||''),'STRUTTURA:'].concat((s.h||[]).map(function(x,n){return (n+1)+'. '+x})).concat(['CTA: '+(s.cta||(pl&&pl.cta)||'')]).join('\n');
  return [p.title,'APERTURA: '+(s.o||''),'PUNTI:'].concat((s.p||[]).map(function(x,n){return (n+1)+'. '+x})).concat(['CHIUSURA: '+(s.c||''),'CAPTION: '+(s.cap||''),'CTA: '+(s.cta||(pl&&pl.cta)||'')]).join('\n');
}
function viewHome(){
  var t=todayStr(),ws=weekStart(t),we=addDays(ws,6);
  var P=S.contacts.filter(isPrio);
  var toWrite=P.filter(function(c){return c.msg_status==='da_scrivere'||c.msg_status==='bozza'}).length;
  var ready=P.filter(function(c){return c.msg_status==='pronto'}).length;
  var sent=P.filter(function(c){return c.msg_status==='inviato'}).length;
  var ini=recInit(),cur=ini?+ini.current_value:0,tgt=ini?+ini.target:100;
  var late=S.ped.filter(function(p){return p.publish_date&&p.publish_date<ws&&p.status!=='pubblicato'});
  var week=S.ped.filter(function(p){return p.publish_date&&p.publish_date>=ws&&p.publish_date<=we}).sort(function(a,b){return a.publish_date.localeCompare(b.publish_date)});
  var next=S.ped.filter(function(p){return p.publish_date&&p.publish_date>we&&p.publish_date<=addDays(we,7)}).sort(function(a,b){return a.publish_date.localeCompare(b.publish_date)});
  var ev=S.events.filter(function(e){return e.event_date>=t}).sort(function(a,b){return a.event_date.localeCompare(b.event_date)}).slice(0,5);
  var published=S.ped.filter(function(p){return p.status==='pubblicato'}).length;
  function lst(arr){return arr.length?arr.map(function(p){return '<div class="row" style="justify-content:space-between;padding:7px 0;border-top:1px solid var(--s2);flex-wrap:nowrap"><div style="min-width:0"><span class="muted" style="font-size:12px">'+esc(fday(p.publish_date))+' · '+esc(pillarName(p))+'</span><div><b>'+esc(p.title)+'</b></div></div><div class="row" style="gap:6px;flex-wrap:nowrap">'+chanTag(p)+'<button class="btn sm" data-act="gopost" data-id="'+p.id+'">Apri</button></div></div>'}).join(''):'<p class="muted" style="font-size:13px">Niente in programma.</p>'}
  return '<h2>Ciao '+esc(S.me.first_name||'')+', ecco la settimana</h2><p class="sub">Settimana dal '+esc(fday(ws))+' al '+esc(fday(we))+'</p>'
  +'<div class="grid g4" style="margin-bottom:14px">'+kpi('Recensioni Google',cur+' / '+tgt,pct(cur,tgt)+'% dell\'obiettivo')+kpi('Messaggi da scrivere',toWrite,'clienti 2025-26')+kpi('Pronti per gli agenti',ready,sent+' già inviati')+kpi('Contenuti in ritardo',late.length,published+' pubblicati in tutto')+'</div>'
  +'<div class="grid g2"><div class="card"><div class="row" style="justify-content:space-between"><h3 style="margin:0">Da pubblicare questa settimana</h3><button class="btn sm" data-act="tab" data-v="ped">Tutto il PED</button></div>'+lst(week)+'</div>'
  +'<div class="card"><div class="row" style="justify-content:space-between"><h3 style="margin:0">Recensioni: clienti da seguire</h3><button class="btn sm" data-act="tab" data-v="contacts">Contatti</button></div><div class="bar"><i style="width:'+pct(cur,tgt)+'%"></i></div><p class="sub" style="margin:6px 0 0">'+toWrite+' messaggi da scrivere, '+ready+' in attesa dell\'agente, '+sent+' inviati.</p></div></div>'
  +(late.length?'<div class="card"><h3>In ritardo</h3>'+lst(late)+'</div>':'')
  +'<div class="grid g2"><div class="card"><h3>Settimana prossima</h3>'+lst(next)+'</div><div class="card"><h3>Prossimi appuntamenti a Novara</h3>'+(ev.length?ev.map(function(e){return '<div style="padding:7px 0;border-top:1px solid var(--s2)"><span class="muted" style="font-size:12px">'+esc(fday(e.event_date))+' · '+esc(e.kind||'')+(e.certain?'':' · da verificare')+'</span><div>'+esc(e.title)+'</div></div>'}).join(''):'<p class="muted" style="font-size:13px">Nessun appuntamento.</p>')+'</div></div>';
}
function plShort(pl){return String(pl.name||'').split(' ')[0]}
function pillarsSorted(){return S.pillars.slice().sort(function(a,b){return a.sort-b.sort})}
function pillarByKey(k){return S.pillars.find(function(x){return x.key===k})}
function byDate(a,b){return (a.publish_date||'9999').localeCompare(b.publish_date||'9999')||String(a.title).localeCompare(String(b.title))}
function pedList(){var me=!isStaff()&&S.me?S.me.agent_id:null;return S.ped.filter(function(p){return !me||p.agent_id===me})}
function pedRow(p,ro){
  var late=p.publish_date&&p.publish_date<todayStr()&&p.status!=='pubblicato';
  var st=ro?'<span class="pill ms-'+(p.status==='pubblicato'?'inviato':p.status==='pronto'?'pronto':p.status==='in_lavorazione'?'bozza':'da_scrivere')+'">'+esc(PED_ST[p.status]||p.status)+'</span>':'<select data-pstatus="'+p.id+'" style="min-width:130px">'+Object.keys(PED_ST).map(function(k){return '<option value="'+k+'"'+(k===p.status?' selected':'')+'>'+PED_ST[k]+'</option>'}).join('')+'</select>';
  var r='<tr><td class="d">'+esc(fday(p.publish_date))+(late?'<small style="color:var(--red);font-weight:600">in ritardo</small>':'')+'</td><td>'+chanTag(p)+'</td>'
  +'<td><b>'+esc(p.title)+'</b>'+(p.hook?'<small>Aggancio: '+esc(p.hook)+'</small>':(p.brief?'<small>'+esc(cut(p.brief,140))+'</small>':''))+reviewNoteHtml(p)
  +'<div class="row" style="gap:6px;margin-top:6px">'+(p.script?'<button class="sbtn" data-act="pscript" data-id="'+p.id+'">'+(S.open[p.id]?'Chiudi':(p.channel==='articolo'?'Traccia':'Script'))+'</button>':'')+(p.link?'<a class="sbtn" target="_blank" rel="noopener" href="'+esc(p.link)+'">Apri link</a>':'')+(ro?'':'<button class="sbtn" data-act="editped" data-id="'+p.id+'">Modifica</button>')+'</div></td>'
  +'<td>'+st+'</td></tr>';
  if(S.open[p.id])r+='<tr class="spanel"><td colspan="4">'+scriptHtml(p)+'</td></tr>';
  return r;
}
function pedTable(arr,ro){
  return '<div class="scroll"><table><tr><th>Data</th><th>Canale</th><th>Idea e aggancio Novara</th><th>Stato</th></tr>'+(arr.map(function(p){return pedRow(p,ro)}).join('')||'<tr><td colspan="4" class="muted" style="padding:20px">Nessun contenuto.</td></tr>')+'</table></div>';
}
function pedHome(items,pls,mine){
  var R=items.filter(function(p){return p.channel==='reel'}).length,A=items.filter(function(p){return p.channel==='articolo'}).length,pub=items.filter(function(p){return p.status==='pubblicato'}).length;
  return '<h2 class="lbl">Posizionamento</h2><p class="lead">Ogni contenuto risponde a una domanda che il proprietario novarese si fa prima di vendere. L\'agenzia non si dichiara «la migliore»: lo dimostra con numeri e persone. Prove da usare nei reel e negli articoli: giorni medi di vendita, rapporto tra prezzo chiuso e richiesto, numero di Open House, estratti dal gestionale.</p>'
  +'<div class="grid g4">'+kpi('Agenti',pls.length,'un pilastro ciascuno')+kpi('Reel',R,'in programma')+kpi('Articoli',A,'Magazine')+kpi('Pubblicati',pub,'su '+items.length)+kpi('Appuntamenti',S.events.length,'a Novara')+'</div>'
  +'<h2 class="lbl">'+(mine.length<pls.length?'Il tuo pilastro':'I cinque pilastri')+'</h2><div class="grid g2">'+mine.map(function(pl){return '<div class="card"><h3>'+esc(pl.name)+'</h3><p>'+esc(pl.role||'')+'</p><p><span class="tag r">'+esc(pl.fmt||'')+'</span></p><p>'+esc(pl.pillar||'')+'</p><button class="sbtn" data-act="pview" data-v="'+esc(pl.key)+'">Apri il PED</button></div>'}).join('')+'</div>'
  +'<h2 class="lbl">Ritmo settimanale</h2><div class="note g"><b>Lun</b> Victor · <b>Mar</b> Roberto · <b>Mer</b> Federico · <b>Gio</b> Roland · <b>Ven</b> Stefano. Ogni agente esce ogni due settimane con un reel e una volta al mese con un articolo firmato.</div>'
  +'<h2 class="lbl">Come si lavora</h2><ol class="steps"><li><b>Un tema, una voce:</b> ogni agente tiene il suo formato fisso.</li><li><b>Ogni reel ha un aggancio:</b> una data o un luogo di Novara.</li><li><b>Ogni reel rimanda a un articolo</b> del Magazine, così il social porta al sito .com.</li><li><b>CTA coerente:</b> una sola azione, la valutazione.</li></ol>';
}
function pedCal(ro){
  return '<h2 class="lbl">Calendario di Novara incrociato con il PED</h2><p class="lead">Verde = data certa. Arancio = da verificare prima di pubblicare.</p><div class="scroll"><table><tr><th>Data</th><th>Appuntamento</th><th>Tipo</th><th>Stato</th>'+(ro?'':'<th></th>')+'</tr>'
  +S.events.slice().sort(function(a,b){return a.event_date.localeCompare(b.event_date)}).map(function(e){return '<tr><td class="d">'+esc(fday(e.event_date))+'</td><td>'+esc(e.title)+'</td><td>'+esc(e.kind||'')+'</td><td><span class="tag '+(e.certain?'ok':'vf')+'">'+(e.certain?'certo':'da verificare')+'</span></td>'+(ro?'':'<td><button class="sbtn" data-act="editevent" data-id="'+e.id+'">Modifica</button></td>')+'</tr>'}).join('')+'</table></div>'+(ro?'':'<p style="margin-top:12px"><button class="btn" data-act="addevent">+ Appuntamento</button></p>');
}
function pedWeeks(items){
  var m={};items.forEach(function(p){var w=p.publish_date?weekStart(p.publish_date):'';(m[w]=m[w]||[]).push(p)});
  var keys=Object.keys(m).sort(function(a,b){return (a||'9')<(b||'9')?-1:1});
  return '<h2 class="lbl">Vista per settimana</h2>'+(keys.map(function(w){return '<div class="wk card"><h4>'+(w?'Settimana dal '+esc(fday(w)):'Senza data')+'</h4>'+m[w].sort(byDate).map(function(p){return '<div class="wr"><span class="d" style="font-weight:600;font-size:12px;color:var(--gold-dim)">'+esc(fday(p.publish_date))+'</span><span class="who">'+esc(pillarName(p)||'—')+'</span><span>'+(p.channel==='articolo'?'📝':'🎬')+' '+esc(p.title)+'</span></div>'}).join('')+'</div>'}).join('')||'<p class="muted">Nessun contenuto.</p>');
}
function pedNotes(){
  return '<h2 class="lbl">Da sistemare prima di partire</h2>'
  +'<div class="note"><b>Superlativo.</b> «La miglior agenzia» non è dimostrabile e in pubblicità richiede prove. Meglio «l\'agenzia da contattare per vendere», supportata da numeri.</div>'
  +'<div class="note"><b>Numeri.</b> I dati vanno riconciliati con il gestionale prima di citare qualsiasi cifra.</div>'
  +'<div class="note"><b>Firme.</b> La categoria «Vendere casa» del Magazine è firmata quasi solo da Victor: gli articoli nuovi vanno cofirmati dagli altri agenti.</div>'
  +'<div class="note"><b>Date da confermare.</b> Programma natalizio di Novara, calendario Borgoticino, programmi di Circolo dei Lettori e UTE, date iscrizioni scolastiche, ritorni di volley e calcio, Mezza Maratona.</div>'
  +'<div class="note"><b>Script.</b> Gli script sono bozze da rivedere con ogni agente a voce: tono, esempi personali e dati reali vanno aggiunti. Le parti tra [parentesi quadre] aspettano numeri dal gestionale.</div>'
  +'<div class="note g"><b>Fuori scopo.</b> Gli immobili in gestione restano nel piano separato.</div>';
}
function pedAgent(key,items,ro){
  var pl=pillarByKey(key);if(!pl)return '';
  var arr=items.filter(function(p){return p.agent_id===pl.agent_id}).sort(byDate);
  var r=arr.filter(function(p){return p.channel==='reel'}).length,a=arr.filter(function(p){return p.channel==='articolo'}).length,pub=arr.filter(function(p){return p.status==='pubblicato'}).length;
  return '<h2 class="lbl">'+esc(pl.name)+' · '+esc(pl.role||'')+'</h2>'
  +'<div class="brief"><div><b>Pilastro</b>'+esc(pl.pillar||'')+'</div><div><b>Formato fisso</b>'+esc(pl.fmt||'')+': '+esc(pl.fmt_desc||'')+'</div><div><b>Pubblico</b>'+esc(pl.audience||'')+'</div><div><b>CTA</b>'+esc(pl.cta||'')+'</div></div>'
  +'<div class="grid g4" style="margin-bottom:14px">'+kpi('Reel',r,'in programma')+kpi('Articoli firmati',a,'')+kpi('Pubblicati',pub,'su '+arr.length)+'</div>'
  +pedTable(arr,ro);
}
function viewPed(){
  var ro=!isStaff(),pls=pillarsSorted();
  var mine=ro&&S.me.agent_id?pls.filter(function(x){return x.agent_id===S.me.agent_id}):pls;
  var tabs=[['home','Panoramica'],['cal','Calendario Novara']].concat(mine.map(function(x){return [x.key,plShort(x)]})).concat([['wk','Settimane']]);
  if(!ro)tabs.push(['note','Note per Valentina']);
  if(!tabs.some(function(t){return t[0]===S.pv}))S.pv='home';
  var items=pedList();
  var head='<div class="row between"><div><h2>Piano editoriale</h2><p class="sub">12 ott 2026 – 29 gen 2027 · un pilastro per agente, un aggancio di Novara per ogni contenuto.</p></div>'+(ro?'':'<button class="btn p" data-act="addped">+ Contenuto</button>')+'</div>'
  +'<nav class="subtabs">'+tabs.map(function(t){return '<button data-act="pview" data-v="'+esc(t[0])+'" class="'+(S.pv===t[0]?'on':'')+'">'+esc(t[1])+'</button>'}).join('')+'</nav>';
  var v=S.pv,body='';
  if(v==='home')body=pedHome(items,pls,mine);
  else if(v==='cal')body=pedCal(ro);
  else if(v==='wk')body=pedWeeks(items);
  else if(v==='note')body=pedNotes();
  else body=pedAgent(v,items,ro);
  return head+body;
}
/* ---------- reel ---------- */
var RCAT={agenzia:'Agenzia e persone',sport:'Sport e territorio',mutui:'Mutui e banche',mercato:'Mercato e dati',valore:'Prezzo e valutazione',compravendita:'Compravendita',condominio:'Condominio',successione:'Successioni e cointestazioni',documenti:'Documenti e conformità',fiscale:'Fisco e imposte',famiglia:'Famiglia e cambio casa'};
function fnum(n){return n==null||n<0?'—':Number(n).toLocaleString('it-IT')}
function cut(s,n){s=String(s||'');return s.length>n?s.slice(0,n)+'…':s}
function catOptions(sel,all){return (all?'<option value="">Ogni tema</option>':'')+Object.keys(RCAT).map(function(k){return '<option value="'+k+'"'+(k===sel?' selected':'')+'>'+RCAT[k]+'</option>'}).join('')}
function plOptions(sel,empty){return '<option value="">'+empty+'</option>'+pillarsSorted().map(function(x){return '<option value="'+esc(x.key)+'"'+(x.key===sel?' selected':'')+'>'+esc(plShort(x))+'</option>'}).join('')}
function reelCard(r,ro){
  var ag=r.agent_key?pillarByKey(r.agent_key):null;
  var h='<div class="rcard"><div><span class="tag r">'+esc(RCAT[r.category]||r.category||'—')+'</span>'+(ag?'<span class="tag a">Voce: '+esc(plShort(ag))+'</span>':'<span class="tag vf">Voce da assegnare</span>')+'</div>'
  +'<div class="rmeta">'+esc(fdate(r.posted_at))+' · ▶ '+fnum(r.plays)+' · ♥ '+fnum(r.likes)+' · '+fnum(r.comments)+' commenti · '+(r.duration||0)+'s</div>'
  +'<p class="cap">'+esc(cut(r.caption,170))+'</p><div class="row" style="gap:6px"><button class="sbtn" data-act="reelprev" data-id="'+esc(r.shortcode)+'">Anteprima</button><a class="sbtn" target="_blank" rel="noopener" href="'+esc(r.url)+'">Instagram</a></div>';
  if(!ro)h+='<details><summary>Riclassifica</summary><select data-rre="category" data-id="'+esc(r.shortcode)+'">'+catOptions(r.category,false)+'</select><select data-rre="agent_key" data-id="'+esc(r.shortcode)+'">'+plOptions(r.agent_key,'Voce: da assegnare')+'</select><select data-rre="pillar_key" data-id="'+esc(r.shortcode)+'">'+plOptions(r.pillar_key,'Fuori pilastro')+'</select></details>';
  return h+'</div>';
}
function viewReels(){
  var ro=!isStaff(),pls=pillarsSorted();
  var mePl=ro&&S.me.agent_id?pls.find(function(x){return x.agent_id===S.me.agent_id}):null;
  var all=mePl?S.reels.filter(function(r){return r.pillar_key===mePl.key||r.agent_key===mePl.key}):S.reels;
  var list=all.filter(function(r){return !S.rc||r.category===S.rc});
  var plays=all.reduce(function(a,r){return a+(r.plays||0)},0);
  var noAg=all.filter(function(r){return !r.agent_key}).length,out=all.filter(function(r){return !r.pillar_key}).length;
  var head='<h2>Reel</h2><p class="sub">I reel pubblicati da @victorco.realestate negli ultimi 6 mesi (dal 27 apr 2026), esclusi quelli sugli immobili. Ognuno è classificato per tema e voce e messo accanto al pilastro del PED di riferimento.</p>'
  +'<div class="grid g4" style="margin-bottom:14px">'+kpi('Reel di contenuto',all.length,'senza tour immobili')+kpi('Visualizzazioni',fnum(plays),'totale')+kpi('Voce da assegnare',noAg,'agente non riconosciuto')+kpi('Fuori pilastro',out,'sport, selezione, agenzia')+'</div>'
  +'<div class="filters">'+(ro?'':'<select data-rf="rp"><option value="">Tutti i pilastri</option>'+pls.map(function(x){return '<option value="'+esc(x.key)+'"'+(S.rp===x.key?' selected':'')+'>'+esc(plShort(x))+'</option>'}).join('')+'<option value="none"'+(S.rp==='none'?' selected':'')+'>Fuori pilastro</option></select>')+'<select data-rf="rc">'+catOptions(S.rc,true)+'</select></div>';
  var groups=(mePl?[mePl]:pls).filter(function(x){return !S.rp||S.rp===x.key});
  var out_h='';
  groups.forEach(function(pl){
    var rs=list.filter(function(r){return r.pillar_key===pl.key});
    var ped=S.ped.filter(function(p){return p.agent_id===pl.agent_id&&p.channel==='reel'});
    var done=ped.filter(function(p){return p.status==='pubblicato'}).length;
    var avg=rs.length?Math.round(rs.reduce(function(a,r){return a+(r.plays||0)},0)/rs.length):0;
    out_h+='<h2 class="lbl">'+esc(pl.name)+' · '+esc(pl.fmt||'')+'</h2><div class="note g"><b>PED vs online.</b> Pilastro: '+esc(pl.pillar||'')+'. Nel PED: '+ped.length+' reel ('+done+' pubblicati). Online su questo tema: '+rs.length+' reel, '+fnum(avg)+' visualizzazioni medie.</div>'
    +(rs.length?'<div class="rgrid">'+rs.map(function(r){return reelCard(r,ro)}).join('')+'</div>':'<p class="muted">Nessun reel su questo tema negli ultimi 6 mesi.</p>');
  });
  if(!mePl&&(!S.rp||S.rp==='none')){
    var fu=list.filter(function(r){return !r.pillar_key});
    out_h+='<h2 class="lbl">Fuori pilastro · sport, selezione, agenzia</h2>'+(fu.length?'<div class="rgrid">'+fu.map(function(r){return reelCard(r,ro)}).join('')+'</div>':'<p class="muted">Nessun reel.</p>');
  }
  return head+out_h;
}
function viewSettings(){
  var st=S.settings||{};
  return '<h2>Impostazioni</h2><p class="sub">Scheda Google per le recensioni'+(isAdmin()?' e utenti di Vale Hub':'')+'.</p>'
  +'<h2 class="lbl">Scheda Google</h2><div class="card"><label style="margin-top:0">Link diretto al modulo recensione</label><input type="url" id="s_url" value="'+esc(st.review_url||'')+'"><label>Place ID</label><input type="text" id="s_pid" value="'+esc(st.place_id||'')+'"><div class="row" style="margin-top:12px"><button class="btn p" data-act="savesettings">Salva</button><a class="btn" target="_blank" rel="noopener" href="'+esc(st.review_url||'#')+'">Prova il link</a></div><p class="sub" style="margin:10px 0 0">I link personali dei clienti sono nel formato '+esc(location.origin)+'/r/…</p></div>'
  +(isAdmin()?'<h2 class="lbl">Utenti</h2>'+viewUsers():'');
}
/* ---------- modals ---------- */
function modalHtml(){
  var m=S.modal;if(!m)return '';var inner='',cls='';
  if(m.type==='msg'){
    var c=S.contacts.find(function(x){return x.id===m.id});if(!c)return '';
    cls=' wide';
    var reg=c.register||(S.voices[c.agent_id]||{}).register||'tu';
    inner='<h3>Messaggio per '+esc(fullName(c))+'</h3><p class="sub" style="margin-bottom:10px">'+(isPrio(c)?'<span class="badge">'+esc(c.op_year||'2025-26')+'</span>':'')+esc(c.role_label||'')+(c.property_name?' · '+esc(c.property_name):'')+(c.phone?' · '+esc(c.phone):' · <b style="color:var(--red)">nessun numero</b>')+'</p>'
    +'<div class="grid g2" style="gap:0 18px"><div>'
    +'<label>Agente che segue il cliente</label><select id="mg_ag">'+agentOptions(c.agent_id,false)+'</select>'
    +'<label>Registro</label><select id="mg_reg"><option value="tu"'+(reg==='tu'?' selected':'')+'>Dare del tu</option><option value="lei"'+(reg==='lei'?' selected':'')+'>Dare del lei</option></select>'
    +'<label>Cosa ti ha detto l\'agente su questo cliente</label><textarea id="mg_brief" rows="6" placeholder="Com\'è andata l\'operazione, cosa ricorda il cliente, come parlarci…">'+esc(c.agent_brief||'')+'</textarea>'
    +'<label>Non contattare</label><select id="mg_dnc"><option value="0">No</option><option value="1"'+(c.do_not_contact?' selected':'')+'>Sì, non va contattato</option></select>'
    +'</div><div>'
    +'<div class="row" style="justify-content:space-between;margin-top:10px"><label style="margin:0">Messaggio WhatsApp</label><button class="btn sm" data-act="draft" type="button">Bozza dal modello</button></div>'
    +'<textarea id="mg_text" rows="10" style="margin-top:6px" placeholder="Scrivi il messaggio come lo scriverebbe l\'agente. Il link personale si aggiunge da solo in fondo (oppure scrivi {link} dove vuoi).">'+esc(c.msg_text||'')+'</textarea>'
    +'<label>Come arriverà all\'agente (con il link)</label><div class="preview ready" id="mg_prev">'+esc(finalMsg(c))+'</div>'
    +'</div></div>'
    +'<div class="foot"><span class="muted" style="margin-right:auto;font-size:12.5px;align-self:center">Stato: '+mpill(c.msg_status)+'</span><button class="btn" data-act="closemodal">Chiudi</button><button class="btn" data-act="copyprev">Copia</button><button class="btn" data-act="savemsg" data-st="bozza">Salva bozza</button><button class="btn p" data-act="savemsg" data-st="pronto">Pronto per l\'agente</button></div>';
  } else if(m.type==='add'){
    var e=m.pre||{};
    inner='<h3>Aggiungi contatto</h3>'
    +'<div class="grid g2" style="gap:0 12px"><div><label>Nome</label><input type="text" id="m_fn"></div><div><label>Cognome</label><input type="text" id="m_ln"></div>'
    +'<div><label>Telefono</label><input type="text" id="m_ph" placeholder="+39…"></div><div><label>Email</label><input type="text" id="m_em"></div>'
    +'<div><label>Ruolo</label><select id="m_role">'+['acquirente','venditore','conduttore','locatore'].map(function(r){return '<option>'+r+'</option>'}).join('')+'</select></div>'
    +'<div><label>Agente</label><select id="m_ag"'+(isStaff()?'':' disabled')+'>'+agentOptions(e.agent_id||(S.me&&S.me.agent_id),false)+'</select></div></div>'
    +(e.property_name?'<p class="sub" style="margin-top:8px">Operazione: '+esc(e.property_name)+' · '+esc(e.op_year)+'</p>':'')
    +'<div class="foot"><button class="btn" data-act="closemodal">Annulla</button><button class="btn p" data-act="savecontact">Salva</button></div>';
  } else if(m.type==='missing'){
    inner='<h3>Operazioni senza nomi nel CRM</h3><p class="sub">Operazioni chiuse nel 2025-2026 senza nessun cliente registrato. Aggiungi chi era coinvolto per poterlo contattare.</p><div class="scroll"><table><tr><th>Immobile</th><th>Agente</th><th>Anno</th><th></th></tr>'
    +S.missing.map(function(x,i){return '<tr><td>'+esc(x.property_name||'—')+'</td><td>'+esc(agentFirst(x.agent_id)||'—')+'</td><td>'+esc(x.op_year)+'</td><td><button class="btn sm" data-act="addfrommissing" data-i="'+i+'">Aggiungi cliente</button></td></tr>'}).join('')+'</table></div><div class="foot"><button class="btn" data-act="closemodal">Chiudi</button></div>';
  } else if(m.type==='ped'){
    var p=m.id?S.ped.find(function(x){return x.id===m.id}):(m.pre||{});p=p||{};
    var sc=p.script||{};var chn=p.channel||'';
    inner='<h3>'+(m.id?'Modifica contenuto':'Nuovo contenuto')+'</h3><label>Titolo</label><input type="text" id="p_t" value="'+esc(p.title||'')+'">'
    +'<div class="grid g2" style="gap:0 12px"><div><label>Canale</label><select id="p_ch"><option value="">—</option><option value="reel"'+(chn==='reel'?' selected':'')+'>Reel IG+TT</option><option value="articolo"'+(chn==='articolo'?' selected':'')+'>Articolo</option></select></div>'
    +'<div><label>Stato</label><select id="p_s">'+Object.keys(PED_ST).map(function(k){return '<option value="'+k+'"'+((p.status||'idea')===k?' selected':'')+'>'+PED_ST[k]+'</option>'}).join('')+'</select></div>'
    +'<div><label>Agente</label><select id="p_a">'+agentOptions(p.agent_id,false)+'</select></div><div><label>Data di uscita</label><input type="date" id="p_d" value="'+esc(p.publish_date||'')+'"></div>'
    +'<div><label>Link (bozza, cartella, post)</label><input type="url" id="p_l" value="'+esc(p.link||'')+'"></div></div>'
    +'<label>Aggancio a Novara</label><input type="text" id="p_h" value="'+esc(p.hook||'')+'"><label>Brief</label><textarea id="p_b" rows="2">'+esc(p.brief||'')+'</textarea>'
    +'<div id="sg_reel" class="'+(chn==='reel'?'':'hidden')+'"><label>Apertura (0-5")</label><textarea id="s_o" rows="2">'+esc(sc.o||'')+'</textarea><label>Tre punti (uno per riga)</label><textarea id="s_p" rows="4">'+esc((sc.p||[]).join('\n'))+'</textarea><label>Chiusura</label><textarea id="s_c" rows="2">'+esc(sc.c||'')+'</textarea><label>Caption</label><textarea id="s_cap" rows="2">'+esc(sc.cap||'')+'</textarea></div>'
    +'<div id="sg_art" class="'+(chn==='articolo'?'':'hidden')+'"><label>Taglio</label><textarea id="s_l" rows="2">'+esc(sc.l||'')+'</textarea><label>Struttura H2 (uno per riga)</label><textarea id="s_h" rows="5">'+esc((sc.h||[]).join('\n'))+'</textarea><label>CTA</label><input type="text" id="s_cta" value="'+esc(sc.cta||'')+'"></div>'
    +'<div id="sg_n" class="'+(chn?'':'hidden')+'"><label>Nota per chi lo gira / scrive</label><textarea id="s_n" rows="2">'+esc(sc.n||'')+'</textarea></div>'
    +'<div class="foot">'+(m.id?'<button class="btn danger" data-act="delped" data-id="'+m.id+'" style="margin-right:auto">Elimina</button>':'')+'<button class="btn" data-act="closemodal">Annulla</button><button class="btn p" data-act="saveped">Salva</button></div>';
  } else if(m.type==='event'){
    var ev=m.id?S.events.find(function(x){return x.id===m.id}):{};ev=ev||{};
    inner='<h3>'+(m.id?'Modifica appuntamento':'Nuovo appuntamento')+'</h3><label>Data</label><input type="date" id="e_d" value="'+esc(ev.event_date||'')+'"><label>Titolo</label><input type="text" id="e_t" value="'+esc(ev.title||'')+'"><div class="grid g2" style="gap:0 12px"><div><label>Tipo</label><input type="text" id="e_k" value="'+esc(ev.kind||'')+'" placeholder="Sport, Festa, Fisco…"></div><div><label>Stato</label><select id="e_c"><option value="1"'+(ev.certain===false?'':' selected')+'>Certo</option><option value="0"'+(ev.certain===false?' selected':'')+'>Da verificare</option></select></div></div>'
    +'<div class="foot">'+(m.id?'<button class="btn danger" data-act="delevent" data-id="'+m.id+'" style="margin-right:auto">Elimina</button>':'')+'<button class="btn" data-act="closemodal">Annulla</button><button class="btn p" data-act="saveevent">Salva</button></div>';
  } else if(m.type==='reel'){
    var rr=S.reels.find(function(x){return x.shortcode===m.id});if(!rr)return '';
    cls=' wide';
    var rpl=rr.pillar_key?pillarByKey(rr.pillar_key):null;
    var nxt=rpl?S.ped.filter(function(p){return p.agent_id===rpl.agent_id&&p.channel==='reel'&&p.status!=='pubblicato'}).sort(byDate).slice(0,4):[];
    inner='<h3>'+esc(RCAT[rr.category]||'Reel')+' · '+esc(fdate(rr.posted_at))+'</h3><div class="grid g2"><div class="embed"><iframe src="https://www.instagram.com/reel/'+esc(rr.shortcode)+'/embed/" loading="lazy" allowfullscreen scrolling="no"></iframe></div><div>'
    +'<p class="rmeta" style="margin-bottom:8px">▶ '+fnum(rr.plays)+' · ♥ '+fnum(rr.likes)+' · '+fnum(rr.comments)+' commenti · '+(rr.duration||0)+'s</p><p style="font-size:14px;margin-bottom:12px">'+esc(rr.caption||'')+'</p>'
    +(rpl?'<h2 class="lbl" style="margin-top:8px">PED di '+esc(plShort(rpl))+'</h2><div class="brief"><div><b>Pilastro</b>'+esc(rpl.pillar||'')+'</div><div><b>Formato fisso</b>'+esc(rpl.fmt||'')+'</div></div><div class="sp"><h5>Prossimi reel in programma</h5>'+(nxt.length?'<ul>'+nxt.map(function(p){return '<li><b>'+esc(fday(p.publish_date))+'</b> · '+esc(p.title)+'</li>'}).join('')+'</ul>':'<p>Nessuno in programma.</p>')+'</div>':'<p class="muted">Fuori dai cinque pilastri del PED.</p>')
    +'</div></div><div class="foot"><a class="btn" target="_blank" rel="noopener" href="'+esc(rr.url)+'">Apri su Instagram</a><button class="btn p" data-act="closemodal">Chiudi</button></div>';
  } else if(m.type==='init'){
    var n=m.id?S.inits.find(function(x){return x.id===m.id}):{};n=n||{};
    inner='<h3>'+(m.id?'Modifica iniziativa':'Nuova iniziativa')+'</h3><label>Titolo</label><input type="text" id="i_t" value="'+esc(n.title||'')+'"><label>Descrizione</label><textarea id="i_d" rows="4">'+esc(n.description||'')+'</textarea>'
    +'<div class="grid g2" style="gap:0 12px"><div><label>Cosa misuri</label><input type="text" id="i_m" value="'+esc(n.metric_label||'')+'" placeholder="es. recensioni"></div><div><label>Stato</label><select id="i_s">'+['pianificata','attiva','chiusa'].map(function(k){return '<option'+((n.status||'attiva')===k?' selected':'')+'>'+k+'</option>'}).join('')+'</select></div>'
    +'<div><label>Obiettivo</label><input type="number" id="i_tg" value="'+esc(n.target==null?'':n.target)+'"></div><div><label>Valore attuale</label><input type="number" id="i_c" value="'+esc(n.current_value==null?'':n.current_value)+'"></div></div><label>Scadenza</label><input type="date" id="i_dl" value="'+esc(n.deadline||'')+'">'
    +'<div class="foot"><button class="btn" data-act="closemodal">Annulla</button><button class="btn p" data-act="saveinit">Salva</button></div>';
  }
  return '<div class="modalbg" data-act="bgclose"><div class="modal'+cls+'">'+inner+'</div></div>';
}

/* ---------- actions ---------- */
function openModal(m){S.modal=m;render()}
function closeModal(){S.modal=null;render()}
async function savePhone(id,val){
  var c=S.contacts.find(function(x){return x.id===id});if(!c)return;
  val=(val||'').trim();if((c.phone||'')===val)return;
  var r=await updContact(id,{phone:val||null});if(r)toast(r.phone_wa?'Numero salvato':'Numero salvato (non sembra un cellulare: WhatsApp non disponibile)');
}
async function setStatus(id,st){
  var patch={status:st};var now=new Date().toISOString();var c=S.contacts.find(function(x){return x.id===id})||{};
  if(st==='contattato'&&!c.contacted_at)patch.contacted_at=now;
  if(st==='promemoria'){patch.reminded_at=now;if(!c.contacted_at)patch.contacted_at=now}
  if(st==='dichiarata'&&!c.declared_at)patch.declared_at=now;
  if(st==='verificata'){patch.verified_at=now;if(!c.declared_at)patch.declared_at=now}
  var r=await updContact(id,patch);if(r)toast('Stato aggiornato');
}
function exportCsv(){
  var rows=[['Nome','Cognome','Prioritario','Ruolo','Anno','Immobile','Agente','Telefono','Messaggio','Recensione','Contattato','Dichiarata','Verificata','Link personale','Testo messaggio']];
  filtered().forEach(function(c){rows.push([cap(c.first_name),cap(c.last_name),isPrio(c)?'sì':'',c.role_label,c.op_year,c.property_name,agentName(c.agent_id),c.phone,MS[c.msg_status],ST[c.status],c.contacted_at,c.declared_at,c.verified_at,inviteUrl(c),finalMsg(c)])});
  var csv=rows.map(function(r){return r.map(function(x){return '"'+String(x==null?'':x).replace(/"/g,'""')+'"'}).join(';')}).join('\n');
  var a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['﻿'+csv],{type:'text/csv'}));a.download='contatti-recensioni.csv';a.click();
}
async function copyText(t){try{await navigator.clipboard.writeText(t);return true}catch(e){var ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();var ok=false;try{ok=document.execCommand('copy')}catch(x){}ta.remove();return ok}}
function genPw(){
  var al='abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789',o='',b=new Uint32Array(12);
  (window.crypto||{getRandomValues:function(a){for(var i=0;i<a.length;i++)a[i]=Math.floor(Math.random()*4e9)}}).getRandomValues(b);
  for(var i=0;i<12;i++)o+=al[b[i]%al.length];
  return o;
}
function credText(email,pw,name){
  return 'Ciao'+(name?' '+name.split(' ')[0]:'')+', ecco l\'accesso a Vale Hub (Victor&Co):\nLink: '+location.origin+'\nEmail: '+email+'\nPassword: '+(pw||'(la stessa che usi nel CRM)');
}
function nuToggle(){
  var r=$('#nu_role'),w=$('#nu_agent_wrap');if(r&&w)w.classList.toggle('hidden',r.value!=='agent');
}

document.addEventListener('click',async function(e){
  var t=e.target.closest('[data-act]');if(!t)return;
  var act=t.dataset.act,id=t.dataset.id;
  if(act==='bgclose'){if(e.target===t)closeModal();return}
  if(act==='tab'){S.tab=t.dataset.v;S.limit=100;render();if(S.tab==='settings'&&isAdmin()&&!S.usersLoaded){await loadUsers();render()}return}
  if(act==='logout'){await sb.auth.signOut();S.me=null;S.loading=true;S.usersLoaded=false;renderLogin();return}
  if(act==='chip'){S.chip=t.dataset.v;S.limit=100;render();return}
  if(act==='seg'){S.f.seg=t.dataset.v;S.limit=100;render();return}
  if(act==='more'){S.limit+=100;render();return}
  if(act==='closemodal'){closeModal();return}
  if(act==='msg'){openModal({type:'msg',id:id});return}
  if(act==='draft'){
    var m0=S.modal,c0=S.contacts.find(function(x){return x.id===m0.id});if(!c0)return;
    var ag=$('#mg_ag').value||c0.agent_id;var reg0=$('#mg_reg').value;
    var tmp=Object.assign({},c0,{agent_id:ag});
    var d=fmtDraft(tmp,reg0);
    if(!d||!S.voices[ag]){toast('Scegli prima l\'agente: la bozza usa il suo modello',true);return}
    if($('#mg_text').value.trim()&&!confirm('Sostituire il testo attuale con la bozza dal modello?'))return;
    $('#mg_text').value=d;$('#mg_prev').textContent=finalMsg(c0,d);return;
  }
  if(act==='copyprev'){var c1=S.contacts.find(function(x){return x.id===S.modal.id});var tx=finalMsg(c1,$('#mg_text').value);if(!tx){toast('Scrivi prima il messaggio',true);return}var okp=await copyText(tx);toast(okp?'Messaggio copiato':'Copia non riuscita',!okp);return}
  if(act==='savemsg'){
    var m1=S.modal,c2=S.contacts.find(function(x){return x.id===m1.id});if(!c2)return;
    var text=$('#mg_text').value.trim(),st=t.dataset.st,agid=$('#mg_ag').value||null;
    if(st==='pronto'){
      if(!text){toast('Scrivi il messaggio prima di passarlo all\'agente',true);return}
      if(!agid){toast('Scegli l\'agente: è lui che riceve il messaggio',true);return}
      if($('#mg_dnc').value==='1'){toast('Il contatto è segnato «non contattare»',true);return}
    }
    if(!text&&st==='bozza')st='da_scrivere';
    var patch={msg_text:text||null,msg_status:st,agent_brief:$('#mg_brief').value.trim()||null,agent_id:agid,register:$('#mg_reg').value||null,do_not_contact:$('#mg_dnc').value==='1',msg_updated_at:new Date().toISOString(),msg_by:S.me.name||S.me.email};
    var rr=await updContact(c2.id,patch,true);if(!rr)return;
    S.modal=null;render();
    toast(st==='pronto'?(rr.phone_wa?'Pronto: l\'agente lo vede in «Da inviare»':'Pronto, ma manca il numero di telefono'):'Bozza salvata');return;
  }
  if(act==='copyfinal'){var c3=S.contacts.find(function(x){return x.id===id});var ok3=await copyText(finalMsg(c3));toast(ok3?'Messaggio copiato: incollalo su WhatsApp':'Copia non riuscita',!ok3);return}
  if(act==='sent'){
    var c4=S.contacts.find(function(x){return x.id===id});var now=new Date().toISOString();
    var r4=await updContact(id,{msg_status:'inviato',status:c4.status==='da_contattare'?'contattato':c4.status,contacted_at:c4.contacted_at||now});if(r4)toast('Segnato come inviato');return;
  }
  if(act==='sync'){
    toast('Sincronizzo con il CRM…');
    var rs0=await sb.rpc('vale_sync_clients');if(rs0.error){toast(rs0.error.message,true);return}
    await loadContacts();render();toast(rs0.data+' nuovi clienti importati dal CRM');return;
  }
  if(act==='addcontact'){openModal({type:'add',pre:{}});return}
  if(act==='showmissing'){openModal({type:'missing'});return}
  if(act==='addfrommissing'){var mm=S.missing[+t.dataset.i];openModal({type:'add',pre:{agent_id:mm.agent_id,operation_id:mm.operation_id,op_type:mm.op_type,op_year:mm.op_year,sale_date:mm.sale_date,property_name:mm.property_name}});return}
  if(act==='savecontact'){
    var m2=S.modal,fn=$('#m_fn').value.trim(),ln=$('#m_ln').value.trim();
    if(!fn||!ln){toast('Servono nome e cognome',true);return}
    var pre=m2.pre||{};
    var row={first_name:fn,last_name:ln,phone:$('#m_ph').value.trim()||null,email:$('#m_em').value.trim()||null,role_label:$('#m_role').value,person_key:norm(fn)+'|'+norm(ln),source:pre.operation_id?'crm_op':'crm'};
    row.agent_id=isStaff()?($('#m_ag').value||pre.agent_id||null):(S.me&&S.me.agent_id);
    ['operation_id','op_type','op_year','sale_date','property_name'].forEach(function(k){if(pre[k]!=null)row[k]=pre[k]});
    var res=await sb.from('vale_contacts').insert(row).select().single();
    if(res.error){toast(res.error.code==='23505'?'Esiste già un contatto con questo nome':res.error.message,true);return}
    merge(S.contacts,res.data);
    if(res.data.operation_id)S.missing=S.missing.filter(function(x){return x.operation_id!==res.data.operation_id});
    S.modal=null;render();toast('Contatto salvato');return;
  }
  if(act==='csv'){exportCsv();return}
  if(act==='savecur'){
    var ini=recInit();if(!ini)return;var val=+$('#curv').value;
    var r=await sb.from('vale_initiatives').update({current_value:val}).eq('id',ini.id).select().single();
    if(r.error){toast(r.error.message,true);return}merge(S.inits,r.data);render();toast('Contatore aggiornato');return;
  }
  if(act==='voice'){S.voiceAgent=id;render();return}
  if(act==='savevoice'){
    var patch2={};document.querySelectorAll('[data-vf]').forEach(function(el){patch2[el.dataset.vf]=el.value});
    var r2=await sb.from('vale_agent_voice').update(patch2).eq('agent_id',S.voiceAgent).select().single();
    if(r2.error){toast(r2.error.message,true);return}S.voices[S.voiceAgent]=r2.data;render();toast('Modelli salvati');return;
  }
  if(act==='genpw'){var pw=genPw();$('#nu_pw').value=pw;return}
  if(act==='createuser'){
    var body={action:'create',name:$('#nu_name').value.trim(),email:$('#nu_email').value.trim(),role:$('#nu_role').value,password:$('#nu_pw').value.trim()};
    if(body.role==='agent')body.agent_id=$('#nu_agent').value||null;
    var j=await callAdmin(body);if(j.error){toast(j.error,true);return}
    S.cred=credText(body.email.toLowerCase(),body.password,body.name);
    await loadUsers();render();toast(j.existed?'Utente abilitato (account già esistente)':'Utente creato');return;
  }
  if(act==='enablecrm'){
    var p=S.crm.find(function(x){return x.id===id});if(!p)return;
    var j2=await callAdmin({action:'create',name:(p.first_name+' '+p.last_name).trim(),email:p.email,role:'agent',agent_id:p.id});
    if(j2.error){toast(j2.error,true);return}
    S.cred=credText(p.email,'',p.first_name);await loadUsers();render();toast('Agente abilitato');return;
  }
  if(act==='copycred'){var okc=await copyText(S.cred);toast(okc?'Credenziali copiate':'Copia non riuscita',!okc);return}
  if(act==='hidecred'){S.cred=null;render();return}
  if(act==='toggleuser'){var j3=await callAdmin({action:'set_active',user_id:id,active:t.dataset.v==='1'});if(j3.error){toast(j3.error,true);return}await loadUsers();render();return}
  if(act==='resetpw'){
    var np=prompt('Nuova password (almeno 8 caratteri). Lascia vuoto per generarne una:','');if(np===null)return;
    np=np.trim()||genPw();var u0=S.users.find(function(x){return x.user_id===id});
    var j4=await callAdmin({action:'reset_password',user_id:id,password:np});if(j4.error){toast(j4.error,true);return}
    S.cred=credText(u0.email,np,u0.name);render();toast('Password aggiornata');return;
  }
  if(act==='rmuser'){
    var u1=S.users.find(function(x){return x.user_id===id});
    if(!confirm('Rimuovere '+u1.name+'? Perderà l\'accesso a Vale Hub.'))return;
    var j5=await callAdmin({action:'remove',user_id:id});if(j5.error){toast(j5.error,true);return}await loadUsers();render();toast('Utente rimosso');return;
  }
  if(act==='addped'){openModal({type:'ped',pre:{month:S.pedMonth}});return}
  if(act==='editped'){openModal({type:'ped',id:id});return}
  if(act==='initped'){openModal({type:'ped',pre:{month:S.pedMonth,initiative_id:id,format:'recensioni'}});return}
  if(act==='saveped'){
    var m3=S.modal,title=$('#p_t').value.trim();if(!title){toast('Serve un titolo',true);return}
    var chv=$('#p_ch').value||null,pdate=$('#p_d').value||null;
    var lines=function(id){return $(id).value.split('\n').map(function(x){return x.trim()}).filter(Boolean)};
    var scr=null;
    if(chv==='reel')scr={o:$('#s_o').value.trim(),p:lines('#s_p'),c:$('#s_c').value.trim(),cap:$('#s_cap').value.trim()};
    if(chv==='articolo')scr={l:$('#s_l').value.trim(),h:lines('#s_h'),cta:$('#s_cta').value.trim()};
    if(scr&&$('#s_n').value.trim())scr.n=$('#s_n').value.trim();
    var old=m3.id?S.ped.find(function(x){return x.id===m3.id}):null;
    var prow={title:title,channel:chv,status:$('#p_s').value,agent_id:$('#p_a').value||null,publish_date:pdate,month:pdate?pdate.slice(0,7):((old&&old.month)||S.pedMonth),hook:$('#p_h').value.trim()||null,brief:$('#p_b').value.trim()||null,link:$('#p_l').value.trim()||null,script:scr};
    if(!old)prow.format=chv?'pilastro':((m3.pre&&m3.pre.format)||'altro');
    var rp=m3.id?await sb.from('vale_ped').update(prow).eq('id',m3.id).select().single():await sb.from('vale_ped').insert(prow).select().single();
    if(rp.error){toast(rp.error.message,true);return}merge(S.ped,rp.data);S.modal=null;render();toast('Contenuto salvato');return;
  }
  if(act==='pview'){S.pv=t.dataset.v;render();return}
  if(act==='p27m'){S.pm=+t.dataset.v;render();return}
  if(act==='p27v'){
    var it=S.p27.find(function(x){return x.n===+id});if(!it)return;
    var nv=it.verdict===t.dataset.v?'da_valutare':t.dataset.v;
    var rv=await sb.from('vale_ped_2027').update({verdict:nv,updated_by:S.me.name||S.me.email,updated_at:new Date().toISOString()}).eq('n',it.n).select().single();
    if(rv.error){toast(rv.error.message,true);return}Object.assign(it,rv.data);render();return;
  }
  if(act==='p27ped'){
    var it2=S.p27.find(function(x){return x.n===+id});if(!it2||it2.ped_id)return;
    var pl=it2.agent_id?S.pillars.find(function(x){return x.agent_id===it2.agent_id}):null;
    var scr=it2.kind==='reel'?{o:it2.hook||'',p:String(it2.development||'').split(/,\s*/).filter(Boolean).slice(0,3),c:'',cap:'',cta:(pl&&pl.cta)||'',n:'Dal piano 2027 di Victor, n. '+it2.n}:{o:'',p:String(it2.slides||'').split('|').map(function(x){return x.replace(/^\s*\d+\.\s*/,'').trim()}).filter(Boolean),c:'',cap:'',cta:(pl&&pl.cta)||'',n:'Carosello dal piano 2027 di Victor, n. '+it2.n};
    var row={title:it2.title,channel:'reel',format:it2.kind==='reel'?'pilastro':'carosello',status:'idea',agent_id:it2.agent_id||null,publish_date:null,month:'2027-'+String(it2.month).padStart(2,'0'),hook:it2.hook||null,brief:it2.why||null,script:scr};
    var rp=await sb.from('vale_ped').insert(row).select().single();
    if(rp.error){toast(rp.error.message,true);return}
    merge(S.ped,rp.data);
    var ru=await sb.from('vale_ped_2027').update({ped_id:rp.data.id,verdict:'ok',updated_by:S.me.name||S.me.email}).eq('n',it2.n).select().single();
    if(!ru.error)Object.assign(it2,ru.data);render();toast('Portato nel PED come idea');return;
  }
  if(act==='copylink'){var okl=await copyText(t.dataset.v);toast(okl?'Link copiato: incollalo su WhatsApp':'Copia non riuscita',!okl);return}
  if(act==='pscript'){S.open[id]=!S.open[id];render();return}
  if(act==='pcopy'){var pp=S.ped.find(function(x){return x.id===id});var okq=await copyText(scriptText(pp));toast(okq?'Copiato':'Copia non riuscita',!okq);return}
  if(act==='gopost'){var gp=S.ped.find(function(x){return x.id===id});var gpl=gp&&pillarOf(gp);S.tab='ped';S.pv=gpl?gpl.key:'wk';S.open[id]=true;render();var rowEl=document.querySelector('[data-pstatus="'+id+'"]');if(rowEl&&rowEl.scrollIntoView)rowEl.scrollIntoView({block:'center'});return}
  if(act==='reelprev'){openModal({type:'reel',id:id});return}
  if(act==='addevent'){openModal({type:'event'});return}
  if(act==='editevent'){openModal({type:'event',id:id});return}
  if(act==='saveevent'){
    var m5=S.modal,ed=$('#e_d').value,et=$('#e_t').value.trim();if(!ed||!et){toast('Servono data e titolo',true);return}
    var erow={event_date:ed,title:et,kind:$('#e_k').value.trim()||null,certain:$('#e_c').value==='1'};
    var re=m5.id?await sb.from('vale_events').update(erow).eq('id',m5.id).select().single():await sb.from('vale_events').insert(erow).select().single();
    if(re.error){toast(re.error.message,true);return}merge(S.events,re.data);S.modal=null;render();toast('Appuntamento salvato');return;
  }
  if(act==='delevent'){if(!confirm('Eliminare questo appuntamento?'))return;var rde=await sb.from('vale_events').delete().eq('id',id);if(rde.error){toast(rde.error.message,true);return}S.events=S.events.filter(function(x){return x.id!==id});S.modal=null;render();return}
  if(act==='delped'){if(!confirm('Eliminare questo contenuto?'))return;var rd=await sb.from('vale_ped').delete().eq('id',id);if(rd.error){toast(rd.error.message,true);return}S.ped=S.ped.filter(function(p){return p.id!==id});S.modal=null;render();return}
  if(act==='pedmove'){
    var p2=S.ped.find(function(x){return x.id===id}),keys=Object.keys(PED_ST),ni=keys.indexOf(p2.status)+(+t.dataset.d);if(ni<0||ni>3)return;
    var rm=await sb.from('vale_ped').update({status:keys[ni]}).eq('id',id).select().single();if(rm.error){toast(rm.error.message,true);return}merge(S.ped,rm.data);render();return;
  }
  if(act==='addinit'){openModal({type:'init'});return}
  if(act==='editinit'){openModal({type:'init',id:id});return}
  if(act==='saveinit'){
    var m4=S.modal,tt=$('#i_t').value.trim();if(!tt){toast('Serve un titolo',true);return}
    var num=function(v){return v===''?null:+v};
    var irow={title:tt,description:$('#i_d').value.trim()||null,metric_label:$('#i_m').value.trim()||null,status:$('#i_s').value,target:num($('#i_tg').value),current_value:num($('#i_c').value)||0,deadline:$('#i_dl').value||null};
    if(!m4.id)irow.slug=norm(tt).replace(/ /g,'-')+'-'+Math.random().toString(36).slice(2,6);
    var ri=m4.id?await sb.from('vale_initiatives').update(irow).eq('id',m4.id).select().single():await sb.from('vale_initiatives').insert(irow).select().single();
    if(ri.error){toast(ri.error.message,true);return}merge(S.inits,ri.data);S.modal=null;render();toast('Iniziativa salvata');return;
  }
  if(act==='savesettings'){
    var rs=await sb.from('vale_settings').update({review_url:$('#s_url').value.trim(),place_id:$('#s_pid').value.trim()||null}).eq('id',1).select().single();
    if(rs.error){toast(rs.error.message,true);return}S.settings=rs.data;toast('Impostazioni salvate');return;
  }
});
document.addEventListener('change',async function(e){
  var t=e.target;
  if(t.id==='nu_role'){nuToggle();return}
  if(t.dataset.chg){
    var k=t.dataset.chg.split('.')[1];S.f[k]=t.type==='checkbox'?t.checked:t.value;S.limit=100;render();return;
  }
  if(t.dataset.cphone){await savePhone(t.dataset.cphone,t.value);return}
  if(t.dataset.cstatus){await setStatus(t.dataset.cstatus,t.value);return}
  if(t.dataset.cagent){var r=await updContact(t.dataset.cagent,{agent_id:t.value||null});if(r)toast('Agente aggiornato');return}
  if(t.dataset.brief){var rb=await updContact(t.dataset.brief,{agent_brief:t.value.trim()||null},true);if(rb)toast('Appunto salvato per Valentina');return}
  if(t.dataset.pstatus){var rps=await sb.from('vale_ped').update({status:t.value}).eq('id',t.dataset.pstatus).select().single();if(rps.error){toast(rps.error.message,true);return}merge(S.ped,rps.data);render();toast('Stato aggiornato');return}
  if(t.dataset.p27a){var ia=S.p27.find(function(x){return x.n===+t.dataset.p27a});var plk=pillarByKey(t.value);var ra=await sb.from('vale_ped_2027').update({agent_id:(plk&&plk.agent_id)||null,updated_by:S.me.name||S.me.email}).eq('n',ia.n).select().single();if(ra.error){toast(ra.error.message,true);return}Object.assign(ia,ra.data);render();return}
  if(t.dataset.p27n){var inn=S.p27.find(function(x){return x.n===+t.dataset.p27n});var rn=await sb.from('vale_ped_2027').update({note:t.value.trim()||null,updated_by:S.me.name||S.me.email}).eq('n',inn.n).select().single();if(rn.error){toast(rn.error.message,true);return}Object.assign(inn,rn.data);toast('Nota salvata');return}
  if(t.dataset.p27f){S[t.dataset.p27f]=t.value;render();return}
  if(t.dataset.rf){S[t.dataset.rf]=t.value;render();return}
  if(t.dataset.rre){var rpatch={};rpatch[t.dataset.rre]=t.value||null;var rrs=await sb.from('vale_reels').update(rpatch).eq('shortcode',t.dataset.id).select().single();if(rrs.error){toast(rrs.error.message,true);return}var ri2=S.reels.findIndex(function(x){return x.shortcode===rrs.data.shortcode});if(ri2>=0)S.reels[ri2]=rrs.data;render();toast('Reel riclassificato');return}
  if(t.dataset.pf){S[t.dataset.pf]=t.value;render();return}
  if(t.id==='p_ch'){var v=t.value;$('#sg_reel').classList.toggle('hidden',v!=='reel');$('#sg_art').classList.toggle('hidden',v!=='articolo');$('#sg_n').classList.toggle('hidden',!v);return}
});
document.addEventListener('input',function(e){
  var el=e.target;
  if(el.id==='fq'){S.f.q=el.value;clearTimeout(S._qt);S._qt=setTimeout(render,180);return}
  if(el.id==='p27q'){S.pq=el.value;clearTimeout(S._qt);S._qt=setTimeout(render,180);return}
  if(el.id==='mg_text'&&S.modal&&S.modal.type==='msg'){
    var c=S.contacts.find(function(x){return x.id===S.modal.id});var pv=$('#mg_prev');if(c&&pv)pv.textContent=finalMsg(c,el.value);
  }
});

/* ---------- Note di revisione (doppioni) ---------- */
function reviewNoteHtml(p){
  if(!p.review_note)return '';
  var dup=/^DOPPIONE/.test(p.review_note);
  var parts=String(p.review_note).split(/\nPROPOSTA:\s*/);
  var why=parts[0].replace(/^(DOPPIONE|SOVRAPPOSIZIONE)\s*[—-]\s*/,'');
  return '<div class="rnote '+(dup?'dup':'ovl')+'"><span class="tag '+(dup?'vf':'r')+'">'+(dup?'Doppione':'Sovrapposizione')+'</span><span>'+esc(why)+'</span>'+(parts[1]?'<div class="prop"><b>Proposta:</b> '+esc(parts[1])+'</div>':'')+'</div>';
}
/* ---------- Documenti ---------- */
var DOCS=[
  {t:'Vendere con Victor&Co: il metodo',k:'Per il cliente',d:'Il PDF da mandare o stampare prima dell\'appuntamento di mandato: risultati in percentuale, le sei fasi (conformità, valutazione, foto e video, promozione, visite e offerte, rogito), team e contatti.',u:'https://crm-ten-sooty-60.vercel.app/docs/vendere-il-metodo-v1.pdf',v:'v1 · novembre 2026 · 8 pagine'},
  {t:'Il patrimonio digitale che lavora per te',k:'Interno agenti',d:'Cosa il cliente vede di noi prima dell\'incontro: sito, Magazine, strumenti, reel, recensioni, presidio locale. E i cinque gesti a settimana che moltiplicano tutto questo.',u:'https://crm-ten-sooty-60.vercel.app/docs/patrimonio-digitale-agenti-v1.pdf',v:'v1 · novembre 2026 · 7 pagine'},
  {t:'Vademecum reel e open house',k:'Interno agenti',d:'Come comunicare nei reel e negli open house da mediatori: imparzialità, Codice del Consumo, APE, privacy, esempi pratici e cosa non dire mai.',u:'https://crm-ten-sooty-60.vercel.app/docs/vademecum-reels-v1.pdf',v:'v1 · ottobre 2026'}
];
function viewDocs(){
  return '<h2>Documenti</h2><p class="sub">I PDF ufficiali dell\'agenzia, in identity Victor&Co. Si aprono e si scaricano dal telefono: il documento per il cliente si manda su WhatsApp prima dell\'appuntamento.</p>'
  +'<div class="grid g2">'+DOCS.map(function(d){return '<div class="card"><span class="tag '+(d.k==='Per il cliente'?'r':'a')+'">'+esc(d.k)+'</span><h3>'+esc(d.t)+'</h3><p>'+esc(d.d)+'</p><p class="muted" style="font-size:12px">'+esc(d.v)+'</p><div class="row" style="gap:8px;margin-top:8px"><a class="btn p" target="_blank" rel="noopener" href="'+esc(d.u)+'">Apri PDF</a><button class="sbtn" data-act="copylink" data-v="'+esc(d.u)+'">Copia link</button></div></div>'}).join('')+'</div>';
}
/* ---------- Aree di lavoro (dal benchmark reti immobiliari, nov 2026) ---------- */
var AREE=[
  {k:'prepara',t:'Victor Prepara',tag:'Mandati',st:'Da avviare · pilota su 5 immobili',
   cosa:'L\'agenzia anticipa pulizie, pittura, home staging e piccole riparazioni (fino a 3.000 €) sugli immobili in esclusiva; il proprietario rimborsa al rogito, o al massimo dopo 12 mesi. Accordo con due o tre artigiani di Novara.',
   perche:'È l\'argomento più forte in sede di incarico: nessuna agenzia della zona lo offre. Ispirato a Compass Concierge (USA): le case preparate vendono prima e a un prezzo più alto.',
   vale:['Documentare ogni immobile prima e dopo: foto e un reel "trasformazione" per ciascuno (senza cifre di vendita, solo "venduto a un prezzo più alto della richiesta")','Preparare una pagina del sito e un carosello "Come funziona Victor Prepara"','Raccogliere la recensione del proprietario a vendita conclusa'],
   team:['Victor: scegliere gli artigiani e il tetto di spesa, scrivere la clausola di rimborso nel mandato','Agenti: proporlo a ogni nuovo incarico in esclusiva, segnare nel CRM gli immobili candidati'],
   kpi:'5 immobili preparati entro 90 giorni · giorni sul mercato più bassi della media di zona'},
  {k:'seconda',t:'Seconda chance',tag:'Mandati',st:'Da avviare · lead già nel monitor',
   cosa:'Proposta dedicata ai proprietari con l\'immobile in vendita da più di un anno: nuovo prezzo basato sui comparabili, foto e video nuovi, lancio in tre fasi (anteprima ai clienti in CRM, coming soon su Instagram e Magazine, poi portali).',
   perche:'Il monitor annunci del CRM mostra oltre 40 immobili fermi da più di un anno tra Oleggio, San Martino e San Paolo. Un annuncio bruciato da ribassi pubblici vale meno: il rilancio in tre fasi lo rimette sul mercato come nuovo (Compass: +4,6% sul prezzo di chiusura).',
   vale:['Una serie di contenuti "perché una casa non si vende" (prezzo, foto, descrizione, tempi) senza citare immobili altrui','Format "coming soon": story e reel di anteprima per ogni rilancio, prima che vada sui portali','Case study anonimi a vendita avvenuta'],
   team:['Agenti: dal monitor, contattare i proprietari degli immobili fermi da più di 12 mesi, 10 contatti al mese per zona','Victor: definire la lettera e lo script della proposta'],
   kpi:'10 contatti al mese · 3 incarichi "seconda chance" nel primo trimestre'},
  {k:'backoffice',t:'Zero back office',tag:'Agenti',st:'In costruzione · già attivi CRM e monitor',
   cosa:'Foto, video, planimetria, testi, pubblicazione sui portali e primo filtro dei contatti li fa l\'agenzia; l\'agente fa solo incarichi, visite e trattative. Report settimanale al venditore (visualizzazioni, contatti, visite, feedback, confronto con gli annunci della zona).',
   perche:'Gli studi 2026 sulle agenzie USA dicono che gli agenti restano dove qualcuno gli toglie lavoro, non per i benefit. Redfin e Purplebricks hanno uno staff che qualifica i contatti e segue la vendita; Tecnocasa ha il coordinatore interno.',
   vale:['Per ogni nuovo incarico: servizio foto e video entro 5 giorni dalla firma, testo annuncio e carosello pronti','Un formato standard di report settimanale per il venditore (prima su WhatsApp, poi nel CRM)'],
   team:['Victor: decidere chi fa il primo filtro dei contatti dai portali','Agenti: passare tutte le richieste di foto, testi e pubblicazione attraverso il PED, non in autonomia'],
   kpi:'Annuncio online entro 7 giorni dall\'incarico · report settimanale a tutti i venditori attivi'},
  {k:'brand',t:'Personal branding degli agenti',tag:'Agenti',st:'Da avviare · Vale Hub già pronto',
   cosa:'Ogni agente ha un reel e due contenuti al mese prodotti da Valentina, una pagina personale sul sito con recensioni e immobili venduti, e i propri contenuti tracciati nel PED.',
   perche:'Le reti che attirano i migliori agenti li valorizzano come persone (Engel & Völkers li chiama advisor, Sotheby\'s spinge i loro social). Un agente con un brand personale forte porta incarichi e colleghi; nessuna rete locale offre questo servizio.',
   vale:['Nel PED, una riga fissa per agente: 1 reel "volto" + 2 contenuti (zona, caso risolto, consiglio) al mese','Format ricorrenti per agente: "la mia zona", "una domanda che mi fanno sempre", "venduto"','Misurare nelle Statistiche i reel per agente e condividere i numeri in agenzia ogni mese'],
   team:['Agenti: 30 minuti al mese con Valentina per girare, più una recensione Google al mese da chiedere','Victor: pagina agente sul sito con foto, recensioni e immobili venduti'],
   kpi:'3 contenuti per agente al mese · pagina agente online per tutti · recensioni Google per agente in crescita'}
];
function viewAree(){
  return '<h2>Aree di lavoro</h2><p class="sub">Quattro aree scelte dal benchmark di novembre 2026 sulle grandi reti immobiliari (USA, UK, Francia, Germania, Italia): due per acquisire mandati, due per attirare e trattenere agenti. Per ognuna: cosa è, perché la facciamo, cosa fa Valentina, cosa fa il resto dell\'agenzia.</p>'
  +AREE.map(function(a){
    var li=function(arr){return '<ul class="steps">'+arr.map(function(x){return '<li>'+esc(x)+'</li>'}).join('')+'</ul>'};
    return '<div class="card" style="border-left:3px solid var(--gold)"><span class="tag '+(a.tag==='Mandati'?'r':'a')+'">'+esc(a.tag)+'</span><span class="tag">'+esc(a.st)+'</span><h3>'+esc(a.t)+'</h3>'
    +'<div class="brief"><div><b>Cosa è</b>'+esc(a.cosa)+'</div><div><b>Perché</b>'+esc(a.perche)+'</div></div>'
    +'<div class="grid g2"><div><h5 class="who" style="margin-bottom:6px">Cosa fa Valentina</h5>'+li(a.vale)+'</div><div><h5 class="who" style="margin-bottom:6px">Cosa fa l\'agenzia</h5>'+li(a.team)+'</div></div>'
    +'<p class="muted" style="font-size:12.5px;margin-top:10px"><b>Obiettivo:</b> '+esc(a.kpi)+'</p></div>'}).join('')
  +'<p class="muted" style="font-size:12px">Fonte: benchmark Victor&amp;Co "Cosa fanno le grandi reti per attirare agenti e mandati", novembre 2026.</p>';
}
/* ---------- PED 2027 (piano di Victor) ---------- */
var VERD={da_valutare:'Da valutare',ok:'Ok',da_rivedere:'Da rivedere',scarta:'Scarta'};
var MN27=['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];
function p27AgentName(id){var pl=S.pillars.find(function(x){return x.agent_id===id});return pl?plShort(pl):(id?agentFirst(id):'')}
function p27Overlap(it){
  var ov=it.overlap||[];if(!ov.length)return '';
  return '<div class="rnote ovl"><span class="tag r">Forse gi\u00e0 coperto</span>'+ov.map(function(o){
    var lab=o.kind==='reel'?'reel pubblicato':o.kind==='topic'?'tema gi\u00e0 pubblicato':'nel PED attuale';
    var link=o.kind==='reel'?'<a target="_blank" rel="noopener" href="https://www.instagram.com/reel/'+esc(o.ref)+'/">'+esc(o.title)+'</a>':esc(o.title);
    return '<div style="margin-top:4px">'+link+' <small class="muted">\u00b7 '+lab+(o.date?' \u00b7 '+esc(fdate(o.date)):'')+(o.plays?' \u00b7 '+fnum(o.plays)+' visual.':'')+' \u00b7 somiglianza '+Math.round((+o.score||0)*100)+'%</small></div>'}).join('')+'</div>';
}
function p27Card(it,ro){
  var v=it.verdict||'da_valutare';
  var btn=function(k,l){return '<button class="sbtn'+(v===k?' on':'')+'" data-act="p27v" data-id="'+it.n+'" data-v="'+k+'" style="'+(v===k?'background:var(--navy);color:#fff':'')+'">'+l+'</button>'};
  var body=it.kind==='reel'?'<p><b>Gancio:</b> '+esc(it.hook||'')+'</p><p><b>Sviluppo:</b> '+esc(it.development||'')+'</p>':'<p><b>Slide:</b> '+esc(it.slides||'')+'</p>';
  return '<div class="card" style="border-left:3px solid '+(v==='ok'?'var(--ok)':v==='scarta'?'var(--red)':v==='da_rivedere'?'var(--amber)':'var(--border)')+'">'
  +'<div class="row between" style="align-items:flex-start"><div><span class="tag '+(it.kind==='reel'?'r':'a')+'">'+(it.kind==='reel'?'Reel':'Carosello')+' '+it.idx+'</span><span class="muted" style="font-size:12px">n. '+it.n+' \u00b7 '+MN27[it.month-1]+' 2027'+(it.agent_id?' \u00b7 '+esc(p27AgentName(it.agent_id)):'')+(it.ped_id?' \u00b7 <b style="color:var(--ok)">nel PED</b>':'')+'</span><h3 style="margin-top:4px">'+esc(it.title)+'</h3></div><span class="pill '+(v==='ok'?'ms-pronto':v==='scarta'?'st-non_interessato':v==='da_rivedere'?'ms-bozza':'ms-da_scrivere')+'">'+VERD[v]+'</span></div>'
  +body+'<p class="muted" style="font-size:12.5px"><b>Perch\u00e9 secondo Victor:</b> '+esc(it.why||'')+'</p>'
  +p27Overlap(it)
  +(ro?'':'<div class="row" style="gap:8px;margin-top:10px;align-items:center">'+btn('ok','Ok')+btn('da_rivedere','Da rivedere')+btn('scarta','Scarta')
  +'<select data-p27a="'+it.n+'" style="width:auto;padding:5px 8px;font-size:12px">'+plOptions((S.pillars.find(function(x){return x.agent_id===it.agent_id})||{}).key||'','Voce: da assegnare')+'</select>'
  +(it.ped_id?'<button class="sbtn" data-act="gopost" data-id="'+it.ped_id+'">Apri nel PED</button>':'<button class="sbtn" data-act="p27ped" data-id="'+it.n+'">Porta nel PED</button>')+'</div>'
  +'<textarea data-p27n="'+it.n+'" rows="2" placeholder="Nota di Valentina: come lo faremmo, chi, quando, perch\u00e9 s\u00ec o no" style="margin-top:8px;min-height:50px">'+esc(it.note||'')+'</textarea>')
  +(ro&&it.note?'<div class="note g" style="margin-top:8px"><b>Nota:</b> '+esc(it.note)+'</div>':'')
  +'</div>';
}
function viewP27(){
  var ro=!isStaff();
  var all=S.p27;if(!all.length)return '<h2>PED 2027</h2><p class="sub">Nessun contenuto caricato.</p>';
  var cnt={ok:0,da_rivedere:0,scarta:0,da_valutare:0,ovl:0,ped:0};all.forEach(function(x){cnt[x.verdict||'da_valutare']++;if((x.overlap||[]).length)cnt.ovl++;if(x.ped_id)cnt.ped++});
  var q=norm(S.pq);
  var list=all.filter(function(x){return (!S.pm||x.month===S.pm)&&(!S.pk||x.kind===S.pk)&&(S.pv7===''||(S.pv7==='ovl'?(x.overlap||[]).length>0:(x.verdict||'da_valutare')===S.pv7))&&(!q||norm(x.title+' '+(x.hook||'')+' '+(x.slides||'')+' '+(x.development||'')).indexOf(q)>=0)});
  var mo=S.pm?S.p27m.find(function(m){return m.month===S.pm}):null;
  var tabs='<nav class="subtabs"><button data-act="p27m" data-v="0" class="'+(S.pm===0?'on':'')+'">Tutto l\'anno</button>'+MN27.map(function(m,i){return '<button data-act="p27m" data-v="'+(i+1)+'" class="'+(S.pm===i+1?'on':'')+'">'+m+'</button>'}).join('')+'</nav>';
  return '<h2>Piano editoriale 2027 di Victor</h2><p class="sub">240 contenuti (10 reel + 10 caroselli al mese) proposti da Victor per @victorco.realestate. Per ciascuno: Ok, Da rivedere o Scarta, una nota, la voce (agente) e, quando \u00e8 pronto, \u00abPorta nel PED\u00bb che lo crea come idea nel piano operativo. \u00abForse gi\u00e0 coperto\u00bb segnala i titoli simili a reel gi\u00e0 pubblicati o a contenuti gi\u00e0 nel PED: decidi tu se \u00e8 un doppione o un approfondimento.</p>'
  +'<div class="note g"><b>Regola ferrea del piano:</b> per le vendite chiuse sopra il prezzo richiesto non si divulga mai cifra o percentuale, solo \u00abVENDUTO AD UN PREZZO PI\u00d9 ALTO DELLA RICHIESTA\u00bb. Ritmo proposto: 5 uscite a settimana (lun reel, mar carosello, mer reel, gio carosello, ven reel), 10 reel girati in una sessione video da 90 minuti nella settimana 1 e 10 caroselli impaginati nella settimana 2.</div>'
  +'<div class="grid g4" style="margin:12px 0">'+kpi('Ok',cnt.ok,'approvati')+kpi('Da rivedere',cnt.da_rivedere,'')+kpi('Scartati',cnt.scarta,'')+kpi('Da valutare',cnt.da_valutare,'su '+all.length)+kpi('Forse gi\u00e0 coperti',cnt.ovl,'da controllare')+kpi('Nel PED',cnt.ped,'portati come idee')+'</div>'
  +tabs
  +(mo?'<div class="brief" style="grid-template-columns:1fr"><div><b>'+esc(MN27[mo.month-1])+' 2027 \u00b7 '+esc(mo.title)+'</b>'+esc(mo.focus||'')+'</div></div>':'')
  +'<div class="filters"><input type="text" id="p27q" placeholder="Cerca nei titoli" value="'+esc(S.pq)+'"><select data-p27f="pk"><option value="">Reel e caroselli</option><option value="reel"'+(S.pk==='reel'?' selected':'')+'>Solo reel</option><option value="carosello"'+(S.pk==='carosello'?' selected':'')+'>Solo caroselli</option></select><select data-p27f="pv7"><option value="">Ogni stato</option>'+Object.keys(VERD).map(function(k){return '<option value="'+k+'"'+(S.pv7===k?' selected':'')+'>'+VERD[k]+'</option>'}).join('')+'<option value="ovl"'+(S.pv7==='ovl'?' selected':'')+'>Forse gi\u00e0 coperti</option></select><span class="muted" style="font-size:12px">'+list.length+' contenuti</span></div>'
  +(list.map(function(it){return p27Card(it,ro)}).join('')||'<p class="muted">Nessun contenuto con questi filtri.</p>');
}
/* ---------- Statistiche ---------- */
function median(a){if(!a.length)return 0;var s=a.slice().sort(function(x,y){return x-y}),m=s.length>>1;return s.length%2?s[m]:Math.round((s[m-1]+s[m])/2)}
function groupPlays(arr,fn){var o={};arr.forEach(function(r){var k=fn(r);if(k==null)return;(o[k]=o[k]||[]).push(r.plays||0)});return o}
function barsHtml(obj,labelFn,order){
  var keys=order||Object.keys(obj).sort(function(a,b){return median(obj[b])-median(obj[a])});
  var mx=Math.max.apply(null,keys.map(function(k){return median(obj[k])}))||1;
  return '<div class="bars">'+keys.map(function(k){var v=median(obj[k]);return '<div class="brow"><span class="bl">'+esc(labelFn?labelFn(k):k)+' <small>· '+obj[k].length+'</small></span><span class="bt"><i style="width:'+Math.round(v/mx*100)+'%"'+(v===mx?' class="top"':'')+'></i></span><span class="bv">'+fnum(v)+'</span></div>'}).join('')+'</div>';
}
function viewStats(){
  var all=S.reels.filter(function(r){return (r.plays||0)>0});
  var edu=all.filter(function(r){return r.category!=='agenzia'&&r.category!=='sport'});
  if(!all.length)return '<h2>Statistiche</h2><p class="sub">Nessun reel con visualizzazioni disponibili.</p>';
  var months={};edu.forEach(function(r){var k=String(r.posted_at||'').slice(0,7);if(k)(months[k]=months[k]||[]).push(r.plays||0)});
  var mk=Object.keys(months).sort();
  var early=median(edu.filter(function(r){return r.posted_at<'2026-07'}).map(function(r){return r.plays}));
  var late=median(edu.filter(function(r){return r.posted_at>='2026-09'}).map(function(r){return r.plays}));
  var trend=early&&late?Math.round((late/early-1)*100):null;
  var best=edu.slice().sort(function(a,b){return b.plays-a.plays})[0];
  var likes=edu.length?Math.round(edu.reduce(function(a,r){return a+Math.max(0,r.likes||0)},0)/edu.length):0;
  var MN=['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic'];
  var dur=groupPlays(edu,function(r){var d=r.duration||0;return d<45?'a':d<=60?'b':d<=90?'c':'d'});
  var DL={a:'meno di 45"',b:'45–60"',c:'61–90"',d:'oltre 90"'};
  var cat=groupPlays(edu,function(r){return r.category||'altro'});
  var ag=groupPlays(edu,function(r){return r.agent_key||null});
  var top=edu.slice().sort(function(a,b){return b.plays-a.plays}).slice(0,10);
  var h='<h2>Statistiche</h2><p class="sub">Reel di contenuto pubblicati su @victorco.realestate dal 27 aprile 2026, esclusi i tour immobiliari (spinti da campagne). Il confronto per tema, voce e durata è sui '+edu.length+' reel educativi; sono esclusi agenzia e sport. Mediana, non media: i due picchi istituzionali altererebbero il quadro.</p>'
  +'<div class="grid g4" style="margin-bottom:14px">'+kpi('Reel di contenuto',all.length,'con visualizzazioni')+kpi('Visualizzazioni mediane',fnum(median(edu.map(function(r){return r.plays}))),'reel educativi')+kpi('Miglior educativo',fnum(best?best.plays:0),best?cut(best.caption,40):'')+kpi('Like medi',likes,'reel educativi')+'</div>'
  +(trend!=null?'<div class="note g"><b>Trend.</b> Visualizzazioni mediane da '+fnum(early)+' (maggio–giugno) a '+fnum(late)+' (settembre–ottobre): '+(trend>=0?'+':'')+trend+'%. Il formato agente in camera con domanda in apertura sta costruendo pubblico.</div>':'')
  +'<div class="grid g2"><div class="card"><h3>Per mese</h3>'+barsHtml(months,function(k){return MN[+k.slice(5)-1]+' '+k.slice(2,4)},mk)+'</div>'
  +'<div class="card"><h3>Per durata</h3>'+barsHtml(dur,function(k){return DL[k]},['a','b','c','d'].filter(function(k){return dur[k]}))+'<p style="margin-top:10px">Il contenuto educativo regge il minuto: i reel sotto i 45" sono i più deboli.</p></div></div>'
  +'<div class="grid g2"><div class="card"><h3>Per tema</h3>'+barsHtml(cat,function(k){return RCAT[k]||k})+'<p style="margin-top:10px">Tirano i temi con un numero dentro (quanto costa, chi paga, quanto vale). Compravendita e fisco vanno riformulati con un caso concreto.</p></div>'
  +'<div class="card"><h3>Per voce</h3>'+barsHtml(ag,function(k){var pl=pillarByKey(k);return pl?plShort(pl):k})+'<p style="margin-top:10px">Roland ha il miglior rapporto like/visualizzazioni (famiglia e animali): da usare per le chiamate all\'azione.</p></div></div>'
  +'<h2 class="lbl">I 10 educativi più visti</h2><div class="scroll"><table><tr><th>Data</th><th>Reel</th><th>Voce</th><th>Tema</th><th style="text-align:right">Visual.</th><th style="text-align:right">Like</th><th style="text-align:right">Sec</th></tr>'
  +top.map(function(r){var pl=r.agent_key?pillarByKey(r.agent_key):null;return '<tr><td class="d">'+esc(fdate(r.posted_at))+'</td><td><a target="_blank" rel="noopener" href="'+esc(r.url)+'">'+esc(cut(r.caption,90))+'</a></td><td>'+(pl?esc(plShort(pl)):'—')+'</td><td><span class="tag r">'+esc(RCAT[r.category]||r.category||'—')+'</span></td><td style="text-align:right">'+fnum(r.plays)+'</td><td style="text-align:right">'+fnum(r.likes)+'</td><td style="text-align:right">'+(r.duration||'—')+'</td></tr>'}).join('')+'</table></div>'
  +'<h2 class="lbl">Doppioni e sovrapposizioni sul PED</h2><p class="sub" style="margin-top:0">Confronto tra i reel già pubblicati e i contenuti pianificati: per ciascuno la proposta alternativa, scelta sui temi e sui formati che hanno funzionato. Le stesse note compaiono nel PED accanto al contenuto.</p>'
  +(function(){var dups=S.ped.filter(function(p){return p.review_note}).sort(byDate);if(!dups.length)return '<p class="muted">Nessun doppione segnalato.</p>';return dups.map(function(p){var pl=S.pillars.find(function(x){return x.agent_id===p.agent_id});return '<div class="card"><div class="rmeta">'+esc(fday(p.publish_date))+(pl?' · '+esc(plShort(pl)):'')+'</div><b style="text-decoration:line-through;color:var(--mut)">'+esc(p.title)+'</b>'+reviewNoteHtml(p)+'</div>'}).join('')})();
  return h;
}


window.__valeHub={S:S,render:render,boot:boot,finalMsg:finalMsg,cap:cap,norm:norm,isPrio:isPrio};
boot();
})();
