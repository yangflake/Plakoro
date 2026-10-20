(function(){
'use strict';
var $=function(id){return document.getElementById(id)};
var CFG='plakoro-pvp-supabase-config-v1',KEEP_LOGIN='plakoro-keep-login-v1',PVP_SESSION_KEY='plakoro-pvp-session-v1',client=null,channel=null,quickChannel=null,quickTimer=null,quickAnimTimer=null,quickAnimFrame=0,quickActive=false,quickCreating=false,roomCode='',role='',playerId=(function(){try{var saved=localStorage.getItem('plakoro-pvp-player-id-v1');if(saved)return saved;var id=(window.crypto&&crypto.randomUUID)?crypto.randomUUID():String(Date.now())+Math.random();localStorage.setItem('plakoro-pvp-player-id-v1',id);return id}catch(e){return (window.crypto&&crypto.randomUUID)?crypto.randomUUID():String(Date.now())+Math.random()}})(),roomState=null,connected=false,pendingReveals={},revealSent=false,resultShown=false;
function say(t){var roomStatus=$('pvpRoomStatus');if(roomStatus)roomStatus.textContent=t}
function readSavedSession(){try{return JSON.parse(localStorage.getItem(PVP_SESSION_KEY)||'null')}catch(e){return null}}
function saveSession(){try{if(!roomCode||!role){return}localStorage.setItem(PVP_SESSION_KEY,JSON.stringify({code:roomCode,role:role,playerId:playerId,roomState:roomState,updatedAt:Date.now()}))}catch(e){}}
function clearSavedSession(){try{localStorage.removeItem(PVP_SESSION_KEY)}catch(e){}}
function conf(){return {url:$('pvpSupabaseUrl').value.trim(),key:$('pvpSupabaseKey').value.trim()}}
try{var saved=JSON.parse(localStorage.getItem(CFG)||'{}');saved.url=saved.url||'https://madsebygaqqnecmwwadb.supabase.co';saved.key=saved.key||'sb_publishable_OPaNvSWDGGx2GpE6K5TLpw_ZGNestGT';$('pvpSupabaseUrl').value=saved.url;$('pvpSupabaseKey').value=saved.key;localStorage.setItem(CFG,JSON.stringify(saved))}catch(e){$('pvpSupabaseUrl').value='https://madsebygaqqnecmwwadb.supabase.co';$('pvpSupabaseKey').value='sb_publishable_OPaNvSWDGGx2GpE6K5TLpw_ZGNestGT'}
$('pvpName').value='';
function keepLoginEnabled(){try{return localStorage.getItem(KEEP_LOGIN)==='1'}catch(e){var el=$('keepLogin');return !!(el&&el.checked)}}
try{var keepSaved=localStorage.getItem(KEEP_LOGIN);if(keepSaved===null){localStorage.setItem(KEEP_LOGIN,'1');keepSaved='1'}$('keepLogin').checked=keepSaved==='1'}catch(e){$('keepLogin').checked=true}
$('keepLogin').addEventListener('change',function(){try{localStorage.setItem(KEEP_LOGIN,this.checked?'1':'0')}catch(e){}});
function initClient(){var c=conf();if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(c.url)||!c.key){say('Supabase Project URL과 공개용 key를 입력해.');return false}if(!window.supabase||!window.supabase.createClient){say('Supabase 라이브러리를 불러오지 못했어. CDN 연결을 확인해.');return false}try{if(client)return true;localStorage.setItem(CFG,JSON.stringify(c));client=window.supabase.createClient(c.url,c.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});$('pvpConnectionStatus').textContent='설정 저장됨';return true}catch(e){say('설정 오류: '+e.message);return false}}
$('pvpSaveConfig').onclick=function(){if(initClient())say('설정을 저장했어. 방을 만들거나 코드를 입력해.')};

var authUser=null,authReady=false,recordedResults={};
function authEmail(username){return String(username||'').trim().toLowerCase()+'@accounts.plakoro.invalid'}
function authMessage(t){var el=$('pvpAuthMessage');if(el)el.textContent=t}
function safeUsername(){return String($('pvpAuthUsername').value||'').trim().toLowerCase()}
function validUsername(u){return /^[a-z0-9_]{3,20}$/.test(u)}
function setAuthUI(user,username){
 authUser=user||null;authReady=true;var headerLogout=$('headerLogout');if(headerLogout)headerLogout.hidden=!user;$('pvpAuthStatus').textContent=user?(username||safeUsername()||'로그인됨'):'비로그인';
 $('pvpSignUp').disabled=!!user;$('pvpSignIn').disabled=!!user;$('pvpSignOut').disabled=!user;$('pvpAuthUsername').disabled=!!user;$('pvpAuthPassword').disabled=!!user;
 var nickname=$('pvpName');
 if(nickname){var loginId=user&&user.email?String(user.email).split('@')[0]:'';nickname.value=user?String(loginId||username||safeUsername()||'').slice(0,20):'';nickname.readOnly=true;}
 var credentials=$('pvpAuthUsername').closest('.grid'),signUp=$('pvpSignUp'),signIn=$('pvpSignIn');
 if(credentials)credentials.classList.toggle('hidden',!!user);
 signUp.classList.toggle('hidden',!!user);signIn.classList.toggle('hidden',!!user);
 setMyRecordText(user?'전적 불러오는 중…':'로그인하면 내 전적을 볼 수 있어.');
 if(user){loadMyRecord();loadLeaderboard()}else{setMyRecordText('로그인하면 내 전적을 확인할 수 있습니다.');loadLeaderboard()}
}
function setMyRecordText(text){['pvpMyRecord','rankingMyRecord'].forEach(function(id){var el=$(id);if(el)el.textContent=text})}
async function loadMyRecord(){
 if(!client||!authUser)return;
 var q=await client.from('plakoro_match_records').select('result').eq('user_id',authUser.id);
 if(q.error){setMyRecordText('전적을 불러오지 못했습니다. 연결 설정을 확인해 주세요.');return}
 var wins=q.data.filter(function(x){return x.result==='win'}).length,losses=q.data.filter(function(x){return x.result==='loss'}).length,total=wins+losses;
 setMyRecordText('내 전적 '+wins+'승 '+losses+'패 · 승률 '+(total?(100*wins/total).toFixed(1):'0.0')+'% · 총 '+total+'전');
}
async function loadLeaderboard(){
 var targets=[$('pvpLeaderboard'),$('homeLeaderboard')].filter(Boolean);
 function renderEmpty(message){targets.forEach(function(el){el.innerHTML='<p class="sub">'+esc(message)+'</p>'})}
 if(!client){renderEmpty('온라인 랭킹 연결을 확인해 주세요.');return}
 targets.forEach(function(el){el.innerHTML='<p class="sub">랭킹을 불러오는 중입니다.</p>'});
 var q=await client.from('plakoro_leaderboard').select('username,wins,losses,total_matches,win_rate').gt('total_matches',0).order('wins',{ascending:false}).order('win_rate',{ascending:false}).limit(50);
 if(q.error){renderEmpty('랭킹을 불러오지 못했습니다. 연결 설정을 확인해 주세요.');return}
 if(!q.data.length){renderEmpty('아직 등록된 PVP 전적이 없습니다. 첫 대전을 진행해 보세요!');return}
 var pokemonByUser={};
 try{
  var profiles=await client.from('plakoro_profiles').select('user_id,username');
  if(!profiles.error&&profiles.data&&profiles.data.length){
   var idsByName={};profiles.data.forEach(function(p){idsByName[String(p.username||'').toLowerCase()]=p.user_id});
   var records=await client.from('plakoro_match_records').select('user_id,pokemon');
   if(!records.error&&records.data)records.data.forEach(function(row){var key=row.user_id;var mon=String(row.pokemon||'').trim();if(!key||!mon)return;if(!pokemonByUser[key])pokemonByUser[key]={};pokemonByUser[key][mon]=(pokemonByUser[key][mon]||0)+1});
   q.data.forEach(function(row){row._userId=idsByName[String(row.username||'').toLowerCase()]||null});
  }
 }catch(e){}
 var rows=q.data.slice().sort(function(a,b){return Number(b.wins||0)-Number(a.wins||0)||Number(b.win_rate||0)-Number(a.win_rate||0)||Number(b.total_matches||0)-Number(a.total_matches||0)});
 var html='<div class="pvp-ranking-head"><span>순위 · 아이디</span><span>승 · 패 · 승률</span></div>'+rows.map(function(x,i){
  var stats=Number(x.wins||0)+'승 '+Number(x.losses||0)+'패',rate=Number(x.win_rate||0).toFixed(1)+'%',mon='기록 없음';
  if(x._userId&&pokemonByUser[x._userId]){
   var popular=Object.keys(pokemonByUser[x._userId]).sort(function(a,b){return pokemonByUser[x._userId][b]-pokemonByUser[x._userId][a]||a.localeCompare(b)})[0];
   if(popular)mon=popular+' ('+pokemonByUser[x._userId][popular]+'회)';
  }
  return '<div class="pvp-ranking-row"><b>'+(i+1)+'. '+esc(x.username)+'</b><span class="ranking-stats"><span>'+stats+'</span><span>승률 '+rate+'</span></span><span class="ranking-pokemon">자주 사용: '+esc(mon)+'</span></div>'
 }).join('');
 targets.forEach(function(el){el.innerHTML=html});
}
window.plakoroLoadLeaderboard=loadLeaderboard;
window.plakoroSaveTowerRecord=async function(bestFloor,pokemonName,towerType){if(!client||!authUser)return false;var table=towerType==='bell'?'plakoro_bell_tower_records':'plakoro_tower_records';try{var profile=await client.from('plakoro_profiles').select('username').eq('user_id',authUser.id).maybeSingle();var prior=await client.from(table).select('best_floor').eq('user_id',authUser.id).maybeSingle();if(prior.error&&prior.error.code!=='PGRST116'){console.warn('탑 기록 조회 실패:',prior.error.message);return false}if(prior.data&&Number(prior.data.best_floor||0)>=Number(bestFloor||0))return true;var row={user_id:authUser.id,username:String(profile.data&&profile.data.username||authUser.email&&authUser.email.split('@')[0]||'player').slice(0,20),best_floor:Number(bestFloor)||0,pokemon:String(pokemonName||'').slice(0,80),updated_at:new Date().toISOString()};var res=await client.from(table).upsert(row,{onConflict:'user_id'});if(res.error){console.warn('탑 기록 서버 저장 실패:',res.error.message);return false}return true}catch(e){console.warn('탑 기록 서버 저장 실패:',e);return false}};
window.plakoroLoadTowerLeaderboard=async function(towerType){var type=towerType==='bell'?'bell':'burnt',root=$(type==='bell'?'bellTowerLeaderboard':'towerLeaderboard');if(!root)return;if(!client&&!initClient())return;var note=root.querySelector('.tower-online-note');if(note)note.remove();var table=type==='bell'?'plakoro_bell_tower_records':'plakoro_tower_records';var towerName=type==='bell'?'방울탑':'불탄탑';var q=await client.from(table).select('username,best_floor,pokemon,updated_at').order('best_floor',{ascending:false}).order('updated_at',{ascending:true}).limit(50);if(q.error){if(type!=='bell'&&!root.querySelector('.tower-online-note'))root.insertAdjacentHTML('beforeend','<p class="sub tower-online-note">온라인 랭킹 연결을 확인할 수 없습니다. 아래는 이 기기에 저장된 기록입니다.</p>');return}if(!q.data||!q.data.length){if(type!=='bell'&&!root.querySelector('.tower-online-note'))root.insertAdjacentHTML('beforeend','<p class="sub tower-online-note">아직 온라인 '+towerName+' 기록이 없습니다.</p>');return}root.innerHTML='<div class="pvp-ranking-head"><span>순위 · 아이디</span><span>최고 층수</span></div>'+q.data.map(function(x,i){return '<div class="pvp-ranking-row"><b>'+(i+1)+'. '+esc(x.username||'플레이어')+'</b><span class="ranking-stats"><span>'+Number(x.best_floor||0)+'층</span></span><span class="ranking-pokemon">도전 포켓몬: '+esc(x.pokemon||'기록 없음')+'</span></div>'}).join('')};
async function saveFinishedMatch(winnerId,players){
 if(!client||!authUser||!winnerId||!players||!players[playerId]||recordedResults[roomCode])return;
 var me=players[playerId],otherId=Object.keys(players).find(function(id){return id!==playerId}),other=otherId&&players[otherId];
 if(!other||!me.pokemon)return;
 recordedResults[roomCode]=true;
 var row={user_id:authUser.id,room_code:roomCode,result:winnerId===playerId?'win':'loss',opponent_username:String(other.name||'상대').slice(0,20),pokemon:String(me.pokemon||''),opponent_pokemon:String(other.pokemon||''),moves:Array.isArray(me.moves)?me.moves:[],played_at:new Date().toISOString()};
 var res=await client.from('plakoro_match_records').insert(row);
 if(res.error){delete recordedResults[roomCode];authMessage('대전은 끝났지만 전적 저장에 실패했어: '+res.error.message);return}
 authMessage('대전 전적을 서버에 저장했어.');loadMyRecord();loadLeaderboard();
}
async function refreshAuth(){
 if(!client)return;
 var s=await client.auth.getSession();if(s.error){authMessage('로그인 상태를 확인하지 못했어: '+s.error.message);return}
 var user=s.data.session&&s.data.session.user,username='';
 if(user){var p=await client.from('plakoro_profiles').select('username').eq('user_id',user.id).maybeSingle();if(p.data)username=p.data.username||''}
 setAuthUI(user,username);
 if(user)window.dispatchEvent(new CustomEvent('plakoro:auth-success'));
}
async function signup(){
 if(!initClient())return;var u=safeUsername(),pw=$('pvpAuthPassword').value;
 if(!validUsername(u)){authMessage('아이디는 영문 소문자, 숫자, 밑줄로 3~20자 입력해.');return}
 if(pw.length<8){authMessage('비밀번호는 8자 이상 입력해.');return}
 var res=await client.auth.signUp({email:authEmail(u),password:pw,options:{data:{username:u}}});
 if(res.error){authMessage('회원가입 실패: '+res.error.message);return}
 if(!res.data.session){authMessage('계정 생성 요청은 완료됐지만 즉시 로그인되지 않았어. Supabase에서 이메일 확인을 꺼야 이메일 없이 가입할 수 있어.');return}
 authUser=res.data.user;var p=await client.from('plakoro_profiles').upsert({user_id:authUser.id,username:u},{onConflict:'user_id'});
 if(p.error){authMessage('계정은 만들어졌지만 프로필 저장에 실패했어: '+p.error.message);return}
 setAuthUI(authUser,u);authMessage('회원가입 및 로그인 완료! 이후 대전 전적이 서버에 저장돼.');window.dispatchEvent(new CustomEvent('plakoro:auth-success'));window.dispatchEvent(new CustomEvent('plakoro:first-signup'));
}
async function signin(){
 try{
  authMessage('로그인 처리 중…');
  if(!initClient())return;
  var u=safeUsername(),pw=$('pvpAuthPassword').value;
  if(!validUsername(u)||!pw){authMessage('아이디와 비밀번호를 확인해.');return}
  var res=await client.auth.signInWithPassword({email:authEmail(u),password:pw});
  if(res.error){authMessage('로그인 실패: '+(res.error.message||'아이디 또는 비밀번호를 확인해.'));return}
  if(!res.data||!res.data.user){authMessage('인증 응답에 사용자 정보가 없어. 잠시 후 다시 시도해 줘.');return}
  authUser=res.data.user;
  // 인증 성공을 먼저 반영하고, 프로필 조회가 실패해도 로그인 화면을 막지 않는다.
  setAuthUI(authUser,u);
  authMessage('로그인 성공! 계정 정보를 불러오는 중…');
  window.dispatchEvent(new CustomEvent('plakoro:auth-success'));
  try{
   var p=await client.from('plakoro_profiles').select('username').eq('user_id',authUser.id).maybeSingle();
   if(!p.error&&p.data&&p.data.username)setAuthUI(authUser,p.data.username);
   authMessage(p.error?'로그인은 완료됐지만 프로필 조회에 실패했어.':'로그인 완료.');
  }catch(e){console.warn('프로필 조회 실패:',e);authMessage('로그인은 완료됐지만 프로필 조회에 실패했어.');}
 }catch(e){console.error('로그인 요청 실패:',e);authMessage('로그인 처리 중 오류: '+(e&&e.message||'네트워크 또는 인증 설정을 확인해 줘.'));}
}
window.plakoroSignUp=signup;window.plakoroSignIn=signin;$('pvpSignUp').onclick=signup;$('pvpSignIn').onclick=signin;
async function logoutCurrentUser(){try{if(client){var result=await client.auth.signOut({scope:'local'});if(result&&result.error)throw result.error;}authUser=null;setAuthUI(null,'');authMessage('로그아웃했어.');window.dispatchEvent(new CustomEvent('plakoro:auth-logout'));}catch(e){authMessage('로그아웃 실패: '+(e&&e.message||'인증 상태를 정리하지 못했어.'));}}
$('pvpSignOut').onclick=logoutCurrentUser;
$('headerLogout').onclick=logoutCurrentUser;
$('pvpRefreshLeaderboard').onclick=function(){if(!initClient())return;loadLeaderboard()};

function roster(){return (db&&Array.isArray(db.pokemon)&&db.pokemon.length?db.pokemon:starterData)}
function findMon(name){return roster().find(function(p){return p.name===name})||roster()[0]}
var spriteNameToId=null,spriteIndexPromise=null;
function normalizeSpriteName(name){return String(name||'').trim().replace(/^메가\s*/,'').replace(/\s*\([^)]*\)/g,'').replace(/의 모습$/,'').replace(/\s+/g,'').toLowerCase()}
function loadSpriteIndex(){if(spriteIndexPromise)return spriteIndexPromise;spriteIndexPromise=fetch('https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_species_names.csv').then(function(r){if(!r.ok)throw new Error('sprite index HTTP '+r.status);return r.text()}).then(function(csv){var map={};csv.split(/\r?\n/).slice(1).forEach(function(line){var parts=line.split(',');if(parts.length>=3&&parts[1]==='3'&&parts[2])map[normalizeSpriteName(parts[2])]=Number(parts[0])});spriteNameToId=map;refreshBattleSprites();return map}).catch(function(){spriteIndexPromise=Promise.resolve(null);return null});return spriteIndexPromise}
function setBattleSprite(imgId,player,isBack){var img=$(imgId);if(!img)return;var name=roomState&&roomState.revealed&&player?player.pokemon:'';if(!name){img.hidden=true;img.removeAttribute('src');img.onerror=null;return}img.alt=name+' 도트 이미지';if(!spriteNameToId){img.hidden=true;loadSpriteIndex();return}var normalized=normalizeSpriteName(name),id=spriteNameToId[normalized];if(!id){var base=normalized.replace(/^(알로라|가라르|히스이|팔데아)/,'');id=spriteNameToId[base]||spriteNameToId[base.replace(/[xy]$/,'')]}if(!id){img.hidden=true;return}var front='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/'+id+'.png',back='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/'+id+'.png',desired=isBack?back:front;if(img.dataset.spriteId===String(id)&&img.dataset.spriteBack===String(!!isBack)&&!img.hidden)return;img.dataset.spriteId=String(id);img.dataset.spriteBack=String(!!isBack);img.dataset.fallbackSrc=front;img.onerror=function(){if(img.src!==img.dataset.fallbackSrc){img.src=img.dataset.fallbackSrc}else{img.hidden=true}};img.onload=function(){img.hidden=false};img.src=desired}
function refreshBattleSprites(){var ps=roomState&&roomState.players||{},ids=Object.keys(ps),me=ps[playerId]||null,otherId=ids.find(function(id){return id!==playerId}),other=otherId?ps[otherId]:null;setBattleSprite('pvpOpponentSprite',other,false);setBattleSprite('pvpSelfSprite',me,false)}
function mid(m){return m.id||m.name}
function costText(cost){return Object.entries(cost||{}).map(function(x){return x[0]+'×'+x[1]}).join(' + ')||'에너지 없음'}
var chosenMoves=[];
$('pvpPokemon').innerHTML=roster().map(function(p){return '<option value="'+esc(p.name)+'">'+esc(p.name)+'</option>'}).join('');
function updateMoves(){var p=findMon($('pvpPokemon').value);chosenMoves=chosenMoves.filter(function(id){return (p.moves||[]).some(function(m){return mid(m)===id})});var root=$('pvpMoveChoices');if(window.PlakoroMoveUI)window.PlakoroMoveUI.renderCards(root,p.moves||[],chosenMoves,{keyAttribute:'data-pvp-move',getId:mid,costText:costText,getDetail:function(m){return '기본 피해 '+Number(m.damage||0)+' · '+costText(m.cost)}});else root.innerHTML='';$('pvpMoveSlotInfo').textContent='기술 '+chosenMoves.length+'/4 선택'+(chosenMoves.length===4?' · 준비 가능':' · 서로 다른 기술 4개를 선택해');$('pvpReady').disabled=!connected||chosenMoves.length!==4||!roomState||!roomState.players[playerId]||!!roomState.players[playerId].ready;$('pvpMove').innerHTML=chosenMoves.map(function(id){var m=(p.moves||[]).find(function(x){return mid(x)===id});return m?'<option value="'+esc(id)+'">'+esc(m.name)+' · '+Number(m.damage||0)+' 피해 · '+esc(costText(m.cost))+'</option>':''}).join('');root.querySelectorAll('[data-pvp-move]').forEach(function(btn){btn.onclick=function(){var id=btn.getAttribute('data-pvp-move'),at=chosenMoves.indexOf(id);if(at>=0)chosenMoves.splice(at,1);else if(chosenMoves.length<4)chosenMoves.push(id);else{say('기술은 7개 중 4개까지만 선택할 수 있어. 먼저 하나를 해제해.');return}updateMoves()}})}
$('pvpPokemon').onchange=function(){chosenMoves=[];updateMoves()};updateMoves();
function rollCounts(roll){return PlakoroBattleCore.rollCounts(roll)}
function canPay(cost,roll){return PlakoroBattleCore.canPay(cost,roll)}
function randomPose(){return PlakoroBattleCore.pose()}
function rollEnergy(count,faceSet){var faces=Array.isArray(faceSet)&&faceSet.length===3?faceSet.map(function(d){return Array.isArray(d)?d:[];}):getDiceFaces('1');return Array.from({length:Math.max(0,count)},function(_,i){var d=faces[i%3]||defaultFaces[i%3];if(!d.length)d=defaultFaces[i%3];return (d[Math.floor(Math.random()*d.length)]||defaultFaces[i%3][0]).types||['무색']})}
function effectSummary(e){var a=[];if(e.reduce)a.push('피해 감소 '+e.reduce);if(e.nextDice)a.push('다음 에네코로 '+(e.nextDice>0?'+':'')+e.nextDice);if(e.blocked)a.push('기술 봉쇄');if(e.immuneNext)a.push('다음 공격 무효');if(e.skipRoll)a.push('에네코로 생략');if(e.poisoned)a.push('독 성공');if(e.noPostureNext)a.push('캐릭코로 금지');return a.join(' · ')||'없음'}
function log(t){roomState.log=(roomState.log||[]).concat([t]).slice(-50)}
function render(){if(!roomState)return;var ps=roomState.players||{},ids=Object.keys(ps),both=ids.length===2&&ids.every(function(id){return ps[id].ready}),live=both&&!!roomState.revealed;var me=ps[playerId]||null,otherId=ids.find(function(id){return id!==playerId}),other=otherId?ps[otherId]:null;function setText(id,value){var el=$(id);if(el)el.textContent=value}function setHp(prefix,player){var bar=$(prefix+'HpBar'),label=$(prefix+'Hp');if(!player||player.hp==null||!player.maxHp){if(bar)bar.style.width='0%';if(label)label.textContent='HP — / —';return}if(bar)bar.style.width=Math.max(0,Math.min(100,100*player.hp/player.maxHp))+'%';if(label)label.textContent='HP '+player.hp+' / '+player.maxHp}setText('pvpOpponentPreview',other?(roomState.revealed?(other.pokemon||'포켓몬')+' · '+other.name:(other.ready?'대전 준비 완료!':'상대 선택 대기 중')):(roomCode?'상대 참가를 기다리는 중':'방에 참가하면 표시돼.'));setText('pvpSelfPreview',me?(roomState.revealed?(me.pokemon||'포켓몬')+' · '+me.name:(me.ready?'대전 준비 완료!':'포켓몬 선택 대기')):'포켓몬을 선택하고 확정해.');setHp('pvpOpponent',other);setHp('pvpSelf',me);refreshBattleSprites();function showRoll(id,roll,pose){var root=$(id);var symbols={'풀':'🌿','불꽃':'🔥','물':'💧','번개':'⚡','에스퍼':'🔮','초능력':'🔮','격투':'👊','악':'🌑','강철':'⚙️','드래곤':'🐉','비행':'🪽','무색':'⭐'};var classes={'풀':'grass','불꽃':'fire','물':'water','번개':'lightning','에스퍼':'psychic','초능력':'psychic','격투':'fighting','악':'darkness','강철':'metal','드래곤':'dragon','비행':'flying','무색':'colorless'};if(root)root.innerHTML=(roll&&roll.length?roll.map(function(face,i){var faceHtml=(face||[]).map(function(t){return '<span class="energy-face energy-'+(classes[t]||'colorless')+'"><strong class="energy-symbol">'+(symbols[t]||'⭐')+'</strong><em>'+esc(t)+'</em></span>'}).join('');return '<div class="die-roll"><small>에네코로 '+(i+1)+'</small><div class="die-faces">'+faceHtml+'</div></div>'}).join(''):'<span class="sub">대기 중</span>');var postureId=id==='pvpSelfRoll'?'pvpSelfPose':'pvpOpponentPose',board=$(postureId),label=pose||'방향 대기',info=pose?PlakoroBattleCore.poseInfo(pose):['🎲','방향 대기'];if(board){board.className='charikoro-board '+(!pose?'waiting':pose==='캐릭코로 금지'?'':'success');board.innerHTML='<div class="charikoro-direction">'+info[0]+'</div><div class="charikoro-label">'+esc(info[1])+'</div>'}}showRoll('pvpSelfRoll',roomState.lastRollByPlayer&&roomState.lastRollByPlayer[playerId],roomState.lastPoseByPlayer&&roomState.lastPoseByPlayer[playerId]);showRoll('pvpOpponentRoll',otherId&&roomState.lastRollByPlayer&&roomState.lastRollByPlayer[otherId],otherId&&roomState.lastPoseByPlayer&&roomState.lastPoseByPlayer[otherId]);setText('pvpTurnPill',roomState.over?'대전 종료':live?(roomState.turn===playerId?'내 차례':'상대 차례'):me&&me.ready?'대전 준비 완료!':'준비 대기');setText('pvpBattleStatus',roomState.over?'대전 종료 · 결과를 확인해.':live?(roomState.turn===playerId?'내 차례 · 기술을 선택하고 에네코로를 굴려.':'상대 차례 · 상대의 행동을 기다려.'):me&&me.ready?(other&&other.ready?'양쪽 준비 완료! 선택 정보를 공개하고 있어.':'대전 준비 완료! 상대 선택을 기다리는 중이야.'):'포켓몬과 기술 4개를 선택한 뒤 준비를 완료해.');var lastResult=roomState.lastAttackResult,lastResultRoot=$('pvpLastAttack');if(lastResultRoot){lastResultRoot.innerHTML=lastResult?'<div class="attack-result-title">'+esc(lastResult.attacker)+' · 「'+esc(lastResult.moveName)+'」'+(lastResult.failed?' 공격 실패':' 공격')+'</div><div class="attack-damage">'+(lastResult.failed?'피해 0':Number(lastResult.damage||0)+' 피해')+(lastResult.heal?' · HP '+Number(lastResult.heal)+' 회복':'')+(lastResult.selfDamage&&!lastResult.failed?' · 자해 '+Number(lastResult.selfDamage):'')+'</div>'+(lastResult.notes&&lastResult.notes.length?'<div class="attack-effects"><b>추가 효과</b><br>'+lastResult.notes.map(esc).join('<br>')+'</div>':''):'<span class="sub">첫 공격 결과가 여기에 표시돼.</span>'}
 $('pvpPlayers').innerHTML=ids.map(function(id){return '<span class="tag">'+esc(ps[id].name)+(ps[id].ready?' · 준비 완료':' · 대기 중')+'</span>'}).join('');$('pvpMoveSetupField').classList.toggle('hidden',!!(me&&me.ready));$('pvpPokemon').disabled=!!(me&&me.ready);$('pvpReady').textContent=me&&me.ready?'대전 준비 완료!':'선택 완료 · 준비 확정';$('pvpSetupOpen').disabled=!connected||!me||!!me.ready;$('pvpSetupStatus').textContent=me&&me.ready?'대전 준비 완료!':connected?'포켓몬과 기술 4개를 선택해.':'방에 연결한 뒤 포켓몬과 기술을 선택해.';$('pvpBattleState').innerHTML='<div class="item"><div><b>'+(roomState.over?'대전 종료':live?(roomState.turn===playerId?'내 차례':esc((ps[roomState.turn]||{}).name||'상대')+' 차례'):me&&me.ready?'대전 준비 완료!':'준비 대기')+'</b><small>방 코드 '+roomCode+'</small></div></div>'+ids.map(function(id){var p=ps[id];return '<div class="item"><div><b>'+esc(p.name)+(id===playerId?' (나)':'')+'</b><small>'+(roomState.revealed?esc(p.pokemon||'포켓몬 미선택')+' · HP '+(p.hp==null?'—':p.hp)+'/'+(p.maxHp||'—'):(p.ready?'대전 준비 완료!':'포켓몬 선택 대기'))+'</small>'+(roomState.revealed?'<small>상태: '+esc(effectSummary(p.effects||{}))+'</small>':'')+'</div><span class="pill">'+(p.ready?'대전 준비 완료!':'준비 중')+'</span></div>'}).join('');$('pvpLog').innerHTML=(roomState.log||[]).map(function(x){return '<p>'+esc(x)+'</p>'}).join('');$('pvpReady').disabled=!connected||!ps[playerId]||ps[playerId].ready||ids.length!==2||chosenMoves.length!==4;$('pvpAttack').disabled=!connected||!live||roomState.over||roomState.turn!==playerId;if(both&&!roomState.revealed&&me&&me.ready&&!revealSent){revealSent=true;var selectedMon=findMon($('pvpPokemon').value);var revealAction={kind:'reveal',by:playerId,pokemon:selectedMon.name,moveIds:chosenMoves.slice(),diceFaces:(typeof getDiceFaces==='function'?getDiceFaces('1'):null)};if(role==='host')hostAction(revealAction);else if(channel)channel.send({type:'broadcast',event:'room_action',payload:revealAction})}if(roomState.over&&!resultShown){resultShown=true;var winLog=(roomState.log||[]).slice().reverse().find(function(x){return x.indexOf('승리!')>=0}),winnerName=winLog?winLog.split(' 승리!')[0]:'대전 종료',winner=ids.find(function(id){return ps[id].name===winnerName});if(winner)saveFinishedMatch(winner,ps);$('pvpResultTitle').textContent=winnerName==='대전 종료'?'대전 종료':winnerName+' 승리!';$('pvpResultSummary').textContent='최종 체력을 확인해.';$('pvpResultPlayers').innerHTML=ids.map(function(id){var q=ps[id];return '<div class="item"><div><b>'+esc(q.name)+(id===playerId?' (나)':'')+'</b><small>'+esc(q.pokemon||'포켓몬')+' · 최종 HP '+Number(q.hp||0)+' / '+Number(q.maxHp||0)+'</small></div><span class="pill">'+(id===winner?'승리':'대전 종료')+'</span></div>'}).join('');$('pvpResultModal').classList.remove('hidden')}}
function publish(){saveSession();if(channel&&roomState)channel.send({type:'broadcast',event:'room_state',payload:{by:playerId,state:roomState}});if(quickActive&&quickChannel&&roomState&&roomState.players&&Object.keys(roomState.players).length>=2)stopQuickQueue();render()}
function showLobby(){var modal=$('pvpLobbyModal');if(modal)modal.classList.remove('hidden')}function hideLobby(){var modal=$('pvpLobbyModal');if(modal)modal.classList.add('hidden')}function leave(keepQuick){if(!keepQuick){if(quickActive)stopQuickQueue();clearSavedSession()}if(channel&&client)client.removeChannel(channel);channel=null;roomCode='';role='';roomState=null;connected=false;pendingReveals={};revealSent=false;resultShown=false;if($('pvpSetupModal'))$('pvpSetupModal').classList.add('hidden');if($('pvpResultModal'))$('pvpResultModal').classList.add('hidden');$('pvpLeave').disabled=true;$('pvpCreateRoom').disabled=false;$('pvpJoinRoom').disabled=false;$('pvpReady').disabled=true;$('pvpAttack').disabled=true;$('pvpMovePickerModal').classList.remove('open');$('pvpMoveSetupField').classList.remove('hidden');$('pvpPokemon').disabled=false;$('pvpPlayers').innerHTML='';showLobby();say('방에서 나왔어.')}
function hostAction(a){
 if(role!=='host'||!roomState)return;var ps=roomState.players;
 if(a.kind==='join'){if(Object.keys(ps).length>=2&&!ps[a.by]){say('이 방은 이미 가득 찼어.');return}if(!ps[a.by])ps[a.by]={name:String(a.name||'상대').slice(0,20),ready:false,pokemon:'',hp:0,maxHp:0,effects:{},lastMove:null,lastFailed:false};log(ps[a.by].name+'가 참가했어.');publish();return}
 if(a.kind==='ready'&&ps[a.by]&&!ps[a.by].ready){ps[a.by].ready=true;log(ps[a.by].name+'가 대전 준비를 완료했어.');if(Object.keys(ps).length===2&&Object.keys(ps).every(function(id){return ps[id].ready}))log('양쪽 준비 완료! 선택 정보를 동시에 공개할게.');publish();return}
 if(a.kind==='reveal'&&ps[a.by]&&ps[a.by].ready&&!roomState.revealed){var mon=findMon(a.pokemon);if(!mon)return;var picked=(a.moveIds||[]).filter(function(id,i,arr){return arr.indexOf(id)===i&&(mon.moves||[]).some(function(m){return mid(m)===id})});if(picked.length!==4)return;pendingReveals[a.by]={pokemon:mon.name,moves:picked,diceFaces:Array.isArray(a.diceFaces)&&a.diceFaces.length===3?a.diceFaces:getDiceFaces('1')};var revealIds=Object.keys(ps);if(revealIds.length===2&&revealIds.every(function(id){return !!pendingReveals[id]})){revealIds.forEach(function(id){var sel=pendingReveals[id],chosen=findMon(sel.pokemon);ps[id]=Object.assign(ps[id],{pokemon:chosen.name,weakness:chosen.weakness||null,moves:sel.moves,diceFaces:sel.diceFaces,hp:chosen.hp,maxHp:chosen.hp,effects:{},lastMove:null,lastFailed:false})});roomState.revealed=true;roomState.turn=revealIds[Math.floor(Math.random()*2)];roomState.firstMovePending=true;log('양쪽 포켓몬과 기술 공개 완료. '+ps[roomState.turn].name+'부터 시작해. 선공의 첫 에네코로는 2개야.')}publish();return}
 if(a.kind!=='attack'||!ps[a.by]||roomState.turn!==a.by||roomState.over)return;
 var ids=Object.keys(ps);if(ids.length!==2||!ids.every(function(id){return ps[id].ready})||!roomState.revealed)return;
 var att=ps[a.by],targetId=ids.find(function(id){return id!==a.by}),tar=ps[targetId];
 if(att.effects.startDamage){var delayed=att.effects.startDamage;att.effects.startDamage=0;att.hp=Math.max(0,att.hp-delayed);log(att.name+'는 예약 효과로 '+delayed+' 피해를 받았어.');if(att.hp<=0){roomState.over=true;log(tar.name+' 승리!');publish();return}}if(att.effects.skipRoll){att.effects.skipRoll=false;att.lastFailed=true;log(att.name+'는 효과로 이번 턴 에네코로를 굴릴 수 없어.');roomState.turn=targetId;publish();return}var mon2=findMon(att.pokemon),move=(mon2.moves||[]).find(function(m){return mid(m)===a.moveId})||(mon2.moves||[])[Number(a.moveIndex)];if(!move||!(att.moves||[]).includes(mid(move))){log('선택한 4개 기술 중에서 골라 줘.');publish();return}
 var moveCheck=PlakoroBattleCore.validateMove(mid(move),att.lastMove,att.effects.blocked);if(!moveCheck.ok){log(moveCheck.reason==='repeat'?'직전 턴에 사용한 기술은 연속해서 사용할 수 없어.':'이 기술은 봉쇄되어 있어.');publish();return}var baseDice=roomState.firstMovePending?2:3;var n=PlakoroBattleCore.diceCount(baseDice,att.effects.nextDice||0);roomState.firstMovePending=false;att.effects.nextDice=0;var roll=rollEnergy(n,att.diceFaces),posture=att.effects.noPostureNext?(att.effects.noPostureNext=false,'캐릭코로 금지'):randomPose(),success=canPay(move.cost,roll),counts=rollCounts(roll),notes=[],damage=Number(move.damage)||0,heal=0,selfDamage=Number(move.baseSelfDamage)||0,failed=!success,own=att.effects||(att.effects={}),te=tar.effects||(tar.effects={});
 roomState.lastRollByPlayer=roomState.lastRollByPlayer||{};roomState.lastPoseByPlayer=roomState.lastPoseByPlayer||{};roomState.lastRollByPlayer[a.by]=roll;roomState.lastPoseByPlayer[a.by]=success?posture:'캐릭코로 금지';if(!success)notes.push('에너지 조건 미충족: 공격 실패');
 if(success){
  var effectResult=PlakoroBattleCore.applyMoveEffects({move:move,own:own,targetEffects:te,notes:notes,damage:damage,damageParts:[Number(move.damage)||0],heal:heal,selfDamage:selfDamage,failed:failed,roll:roll,counts:counts,posture:posture,ownerHp:att.hp,ownerFailed:att.lastFailed,targetFailed:tar.lastFailed,randomPose:randomPose,chooseBlockedMove:function(){var tm=findMon(tar.pokemon),choices=(tar.moves||[]).map(function(id){return (tm.moves||[]).find(function(mm){return mid(mm)===id})}).filter(Boolean);return choices.length?choices[Math.floor(Math.random()*choices.length)]:null},rollOpponent:function(){return rollEnergy(3,tar.diceFaces)},rollExtra:function(){return rollEnergy(1,att.diceFaces)},getTargetLastMove:function(){var targetMon=findMon(tar.pokemon);return (targetMon.moves||[]).find(function(mm){return mid(mm)===tar.lastMove})||null}});damage=effectResult.damage;heal=effectResult.heal;selfDamage=effectResult.selfDamage;failed=effectResult.failed;roll=effectResult.roll;counts=effectResult.counts;notes=effectResult.notes;roomState.lastRollByPlayer[a.by]=roll;roomState.lastPoseByPlayer[a.by]=posture;
  if(own.nextAttackBonus){damage+=own.nextAttackBonus;notes.push('저장된 추가 피해 +'+own.nextAttackBonus);own.nextAttackBonus=0}
 }
 var damageResult=PlakoroBattleCore.applyDamageRules({damage:damage,failed:failed,targetEffects:te,move:move,weakness:tar.weakness,ignoreWeakness:move.name==='일렉러쉬'});damage=damageResult.damage;notes=notes.concat(damageResult.notes);
 tar.hp=Math.max(0,tar.hp-damage);att.hp=Math.min(att.maxHp,att.hp+heal);if(selfDamage&&!failed)att.hp=Math.max(0,att.hp-selfDamage);att.lastFailed=failed;att.lastMove=mid(move);roomState.lastAttackResult={attacker:att.name,moveName:move.name,damage:damage,failed:failed,heal:heal,selfDamage:selfDamage,notes:notes.slice(),posture:posture};
 log(att.name+' · '+move.name+' · 에네코로 '+(roll.length?roll.map(function(x){return x.join('+')}).join(' / '):'없음')+' · 캐릭코로 '+posture+' · '+(success?'에너지 성공':'에너지 실패')+' · '+damage+' 피해'+(heal?' · 회복 '+heal:'')+(selfDamage&&!failed?' · 자해 '+selfDamage:'')+(notes.length?' · '+notes.join(' / '):''));
 if(tar.hp<=0||att.hp<=0){roomState.over=true;log((tar.hp<=0?att.name:tar.name)+' 승리!')}else roomState.turn=targetId;publish();
}
async function connectRoom(code,asRole){if(!client&&!initClient())return;code=String(code||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);if(code.length!==6){say('방 코드는 영문/숫자 6자리야.');return}leave(true);roomCode=code;role=asRole;var savedSession=readSavedSession();if(savedSession&&savedSession.code===code&&savedSession.role===asRole&&savedSession.playerId===playerId&&savedSession.roomState)roomState=savedSession.roomState;saveSession();channel=client.channel('plakoro-pvp-'+code,{config:{broadcast:{self:false},presence:{key:playerId}}});channel.on('broadcast',{event:'room_state'},function(msg){if(msg.payload&&msg.payload.state){roomState=msg.payload.state;saveSession();render();if(role==='guest'&&roomState.players[playerId])say('방 '+roomCode+'에 연결됐어.')}}).on('broadcast',{event:'room_action'},function(msg){if(msg.payload&&role==='host')hostAction(msg.payload)});channel.on('presence',{event:'sync'},function(){say('방 '+roomCode+' · 접속 '+Object.keys(channel.presenceState()).length+'/2명')});channel.subscribe(async function(state){if(state==='SUBSCRIBED'){connected=true;await channel.track({id:playerId,name:$('pvpName').value.trim()||'플레이어'});hideLobby();$('pvpLeave').disabled=false;$('pvpCreateRoom').disabled=true;$('pvpJoinRoom').disabled=true;$('pvpRoomCode').value=roomCode;if(role==='host'){if(quickActive&&quickChannel)quickChannel.track({id:playerId,name:$('pvpName').value.trim()||'플레이어',quickMatch:true,roomCode:roomCode,waiting:true});var restored=readSavedSession();if(!(restored&&restored.code===roomCode&&restored.role==='host'&&restored.playerId===playerId&&restored.roomState&&restored.roomState.players&&restored.roomState.players[playerId])){roomState={players:{},turn:playerId,over:false,log:['방이 생성됐어. 상대가 참가하기를 기다리는 중이야.']};roomState.players[playerId]={name:$('pvpName').value.trim()||'플레이어',ready:false,pokemon:'',hp:0,maxHp:0,effects:{},lastMove:null,lastFailed:false}}publish();say(restored&&restored.code===roomCode?'기존 대전 상태를 복구했어. 방 코드 '+roomCode:'방 생성 완료. 코드 '+roomCode+'를 상대에게 알려 줘.')}else{channel.send({type:'broadcast',event:'room_action',payload:{kind:'join',by:playerId,name:$('pvpName').value.trim()||'상대'}});say('방 참가 요청을 보냈어. 호스트 응답을 기다리는 중이야.')}render()}else if(state==='CHANNEL_ERROR'||state==='TIMED_OUT'||state==='CLOSED'){connected=false;say('실시간 연결 실패 ('+state+'). Supabase URL/key와 Realtime 연결을 확인해.')}})}

function quickPresenceEntries(){if(!quickChannel)return [];var state=quickChannel.presenceState(),out=[];Object.keys(state).forEach(function(k){(state[k]||[]).forEach(function(meta){if(meta&&meta.id&&meta.id!==playerId&&meta.quickMatch)out.push(meta)})});return out}
function stopQuickQueue(){quickActive=false;quickCreating=false;if(quickTimer){clearTimeout(quickTimer);quickTimer=null}if(quickAnimTimer){clearInterval(quickAnimTimer);quickAnimTimer=null}if(quickChannel&&client)client.removeChannel(quickChannel);quickChannel=null;var quickButton=$('pvpQuickMatch');quickButton.disabled=false;quickButton.textContent='⚡ 빠른 대전'}
function startQuickMatch(){
 if(quickActive){say('빠른 대전 상대를 찾고 있어. 잠시만 기다려 줘.');return}
 if(!client&&!initClient())return;
 quickActive=true;quickCreating=false;var quickButton=$('pvpQuickMatch');quickButton.disabled=true;quickAnimFrame=0;var quickFrames=['매칭중.','매칭중..','매칭중...','매칭중.','매칭중..'];quickButton.textContent=quickFrames[0];if(quickAnimTimer)clearInterval(quickAnimTimer);quickAnimTimer=setInterval(function(){if(!quickActive)return;quickAnimFrame=(quickAnimFrame+1)%quickFrames.length;quickButton.textContent=quickFrames[quickAnimFrame]},450);say('빠른 대전 매칭 중…');
 quickChannel=client.channel('plakoro-pvp-quickmatch-v1',{config:{presence:{key:playerId}}});
 function checkQueue(){
  if(!quickActive||!quickChannel||quickCreating)return;
  var peers=quickPresenceEntries();
  var paired=peers.filter(function(meta){return meta.waiting||meta.roomCode});
  paired.sort(function(a,b){return String(a.id).localeCompare(String(b.id))});
  var me={id:playerId};
  var all=paired.concat([me]).sort(function(a,b){return String(a.id).localeCompare(String(b.id))});
  if(paired.some(function(meta){return meta.roomCode})){
   var target=paired.filter(function(meta){return meta.roomCode}).sort(function(a,b){return String(a.roomCode).localeCompare(String(b.roomCode))})[0];
   stopQuickQueue();$('pvpRoomCode').value=target.roomCode;say('상대를 찾았어! 대전 방에 연결 중…');connectRoom(target.roomCode,'guest');return;
  }
  if(paired.length>0&&all[0].id===playerId){
   quickCreating=true;
   var alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',code='';
   for(var i=0;i<6;i++)code+=alphabet[Math.floor(Math.random()*alphabet.length)];
   quickChannel.track({id:playerId,name:$('pvpName').value.trim()||'플레이어',quickMatch:true,roomCode:code,waiting:false});
   $('pvpRoomCode').value=code;
   connectRoom(code,'host');
   return;
  }
  say('빠른 대전 매칭 중…');
  quickTimer=setTimeout(checkQueue,1000);
 }
 quickChannel.on('presence',{event:'sync'},function(){checkQueue()});
 quickChannel.subscribe(async function(state){
  if(state!=='SUBSCRIBED'){if(state==='CHANNEL_ERROR'||state==='TIMED_OUT'||state==='CLOSED'){stopQuickQueue();say('빠른 대전 연결에 실패했어. 연결 설정을 확인하고 다시 시도해.')}return}
  try{await quickChannel.track({id:playerId,name:$('pvpName').value.trim()||'플레이어',quickMatch:true,roomCode:'',waiting:true})}
  catch(e){stopQuickQueue();say('빠른 대전 대기열에 들어가지 못했어: '+e.message);return}
  say('빠른 대전 매칭 중…');
  quickTimer=setTimeout(checkQueue,1000);
 });
}
$('pvpQuickMatch').onclick=startQuickMatch;
$('pvpCreateRoom').onclick=function(){var alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',code='';for(var i=0;i<6;i++)code+=alphabet[Math.floor(Math.random()*alphabet.length)];$('pvpRoomCode').value=code;if(!client&&!initClient()){say('방 코드 '+code+'를 만들었어. 다만 온라인 방을 열려면 먼저 「연결 설정」에서 Supabase URL과 공개용 key를 입력하고 저장해야 해.');return}connectRoom(code,'host')};
var autoJoinTimer=null;
function joinFromCode(){var code=$('pvpRoomCode').value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);if(code!==$('pvpRoomCode').value)$('pvpRoomCode').value=code;if(code.length!==6)return;clearTimeout(autoJoinTimer);try{var saved=JSON.parse(localStorage.getItem(CFG)||'{}');if(saved.url&&saved.key){$('pvpSupabaseUrl').value=saved.url;$('pvpSupabaseKey').value=saved.key;connectRoom(code,'guest')}else{say('처음 한 번은 연결 설정이 필요해. Supabase URL과 공개용 key를 저장하면 이후에는 방 코드 6자리를 입력하는 것만으로 참가할 수 있어.')}}catch(e){say('연결 설정을 확인해 줘: '+e.message)}}
$('pvpJoinRoom').onclick=function(){joinFromCode()};
$('pvpRoomCode').addEventListener('input',function(){clearTimeout(autoJoinTimer);var code=$('pvpRoomCode').value.replace(/[^a-z0-9]/gi,'');if(code.length===6)autoJoinTimer=setTimeout(joinFromCode,350)});
$('pvpRoomCode').addEventListener('keydown',function(e){if(e.key==='Enter'){clearTimeout(autoJoinTimer);joinFromCode()}});
setTimeout(function(){if(initClient()){refreshAuth().catch(function(e){authMessage('로그인 상태 확인 실패: '+(e&&e.message||e))});loadLeaderboard();var savedRoom=readSavedSession();if(savedRoom&&savedRoom.code&&savedRoom.role){$('pvpRoomCode').value=savedRoom.code;connectRoom(savedRoom.code,savedRoom.role)}client.auth.onAuthStateChange(function(event,session){if(event==='SIGNED_IN'||event==='SIGNED_OUT'||event==='TOKEN_REFRESHED'){var user=session&&session.user;if(user){client.from('plakoro_profiles').select('username').eq('user_id',user.id).maybeSingle().then(function(p){setAuthUI(user,p.data&&p.data.username||'');window.dispatchEvent(new CustomEvent('plakoro:auth-success'))}).catch(function(e){authMessage('로그인 정보 확인 실패: '+(e&&e.message||e))})}else{setAuthUI(null,'');if(event==='SIGNED_OUT')window.dispatchEvent(new CustomEvent('plakoro:auth-logout'))}}})}},0);
$('pvpLeave').onclick=leave;$('pvpSetupOpen').onclick=function(){if(connected&&roomState&&roomState.players[playerId]&&!roomState.players[playerId].ready)$('pvpSetupModal').classList.remove('hidden')};$('pvpSetupClose').onclick=function(){$('pvpSetupModal').classList.add('hidden')};$('pvpSetupCancel').onclick=function(){$('pvpSetupModal').classList.add('hidden')};$('pvpSetupModal').addEventListener('click',function(e){if(e.target===$('pvpSetupModal'))$('pvpSetupModal').classList.add('hidden')});$('pvpResultClose').onclick=function(){$('pvpResultModal').classList.add('hidden')};$('pvpResultLeave').onclick=function(){$('pvpResultModal').classList.add('hidden');leave()};
$('pvpReady').onclick=function(){if(!channel||!roomState||!roomState.players[playerId])return;if(chosenMoves.length!==4){say('기술 7개 중 서로 다른 4개를 선택해.');return}$('pvpSetupModal').classList.add('hidden');var a={kind:'ready',by:playerId};if(role==='host')hostAction(a);else channel.send({type:'broadcast',event:'room_action',payload:a});};
function closePvpMovePicker(){$('pvpMovePickerModal').classList.remove('open')}
function openPvpMovePicker(){if(!channel||!roomState||roomState.turn!==playerId||roomState.over)return;var p=findMon($('pvpPokemon').value),ps=roomState.players||{},me=ps[playerId]||{},root=$('pvpMovePickerChoices'),ids=me.moves||chosenMoves,choices=ids.map(function(id){return (p.moves||[]).find(function(m){return mid(m)===id})}).filter(Boolean);$('pvpMovePickerTitle').textContent='이번 턴 사용할 기술 선택';$('pvpMovePickerHint').textContent='선택한 기술 4개 중 하나를 골라. 터치하거나 커서를 올리면 추가 효과와 필요한 자세를 확인할 수 있어.';if(window.PlakoroMoveUI)window.PlakoroMoveUI.renderCards(root,choices,[],{keyAttribute:'data-pvp-turn-move',getId:mid,costText:costText,getDisabledReason:function(m){return me.effects&&me.effects.blocked===mid(m)?'봉쇄됨':me.lastMove===mid(m)?'직전 턴 사용':''},getDetail:function(m,reason){return '기본 피해 '+Number(m.damage||0)+' · '+costText(m.cost)+(reason?' · '+reason:'')}});else root.innerHTML='';root.querySelectorAll('[data-pvp-turn-move]').forEach(function(btn){btn.onclick=function(){var a={kind:'attack',by:playerId,moveId:btn.getAttribute('data-pvp-turn-move')};closePvpMovePicker();if(role==='host')hostAction(a);else channel.send({type:'broadcast',event:'room_action',payload:a})}});if(!root.innerHTML)root.innerHTML='<p class="sub">지금 사용할 수 있는 기술이 없어.</p>'; $('pvpMovePickerModal').classList.add('open')}
$('pvpAttack').onclick=openPvpMovePicker;
$('pvpMovePickerClose').onclick=closePvpMovePicker;
$('pvpMovePickerModal').addEventListener('click',function(e){if(e.target===$('pvpMovePickerModal'))closePvpMovePicker()});
$('pvpLeave').disabled=true;
$('pvpAccountOpen').onclick=function(){showLobby();setTimeout(function(){var card=$('pvpAccountCard'),input=$('pvpAuthUsername');if(card)card.scrollIntoView({behavior:'smooth',block:'start'});if(input&&!input.disabled)input.focus({preventScroll:true})},80)};$('pvpLobbyOpen').onclick=showLobby;
$('pvpLobbyModal').addEventListener('click',function(e){if(e.target===$('pvpLobbyModal')&&connected)hideLobby()});
})();