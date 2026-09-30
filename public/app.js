/* ===== Игровая логика (отделена от отображения) ===== */
const FLEET=[4,3,3,2,2,2,1,1,1,1],COUNT={4:1,3:2,2:3,1:4},LET="АБВГДЕЖЗИК",$=id=>document.getElementById(id);
const nm=i=>LET[i%10]+(Math.floor(i/10)+1),rnd=a=>a[Math.floor(Math.random()*a.length)];
const cellsOf=(i,n,h)=>{const r=Math.floor(i/10),c=i%10;return Array.from({length:n},(_,k)=>h?[r,c+k]:[r+k,c])};
const B=()=>({ships:[],shots:Array(100).fill(0)});
const G={
 nb(i){const r=Math.floor(i/10),c=i%10,o=[];for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++){if(!a&&!b)continue;const x=r+a,y=c+b;if(x>=0&&y>=0&&x<10&&y<10)o.push(x*10+y)}return o},
 n4(i){const r=Math.floor(i/10),c=i%10,o=[];if(r>0)o.push(i-10);if(r<9)o.push(i+10);if(c>0)o.push(i-1);if(c<9)o.push(i+1);return o},
 fits(b,cs){if(cs.some(([r,c])=>r>9||c>9))return false;const o=new Set(b.ships.flat());return cs.every(([r,c])=>[r*10+c,...G.nb(r*10+c)].every(j=>!o.has(j)))},
 auto(){const b=B();for(const n of FLEET){let cs;do cs=cellsOf(Math.floor(Math.random()*100),n,Math.random()<.5);while(!G.fits(b,cs));b.ships.push(cs.map(([r,c])=>r*10+c))}return b},
 sunk:(b,s)=>s.every(i=>b.shots[i]==2),
 halo(b,s){s.forEach(j=>G.nb(j).forEach(k=>{if(!b.shots[k])b.shots[k]=3}))},
 shoot(b,i){if(b.shots[i])return null;const s=b.ships.find(s=>s.includes(i));if(!s){b.shots[i]=1;return{r:"miss"}}b.shots[i]=2;if(G.sunk(b,s)){G.halo(b,s);return{r:"sunk",ship:s}}return{r:"hit"}},
 apply(b,i,x){if(x.r=="miss")b.shots[i]=1;else{b.shots[i]=2;if(x.r=="sunk"){b.ships.push(x.ship);G.halo(b,x.ship)}}},
 over:b=>b.ships.length==10&&b.ships.every(s=>G.sunk(b,s)),
 rem(b){const r=FLEET.slice();b.ships.forEach(s=>{if(G.sunk(b,s))r.splice(r.indexOf(s.length),1)});return r},
 weights(b){const w=Array(100).fill(0),dead=new Set();b.ships.forEach(s=>{if(G.sunk(b,s))s.forEach(i=>dead.add(i))});
  for(const n of G.rem(b))for(let i=0;i<100;i++)for(const h of n==1?[true]:[true,false]){
   const cs=cellsOf(i,n,h);if(cs.some(([r,c])=>r>9||c>9))continue;const ids=cs.map(([r,c])=>r*10+c);
   if(ids.some(j=>b.shots[j]==1||b.shots[j]==3||dead.has(j)))continue;
   const k=ids.filter(j=>b.shots[j]==2).length;ids.forEach(j=>{if(!b.shots[j])w[j]+=1+k*25})}
  return w},
 ai(b,d){const free=[];b.shots.forEach((v,i)=>{if(!v)free.push(i)});if(d=="easy")return rnd(free);
  if(d=="medium"){const live=[];b.shots.forEach((v,i)=>{if(v==2&&!b.ships.some(s=>s.includes(i)&&G.sunk(b,s)))live.push(i)});
   if(live.length){let c=[];if(live.length>1){const h=Math.floor(live[0]/10)==Math.floor(live[1]/10),st=h?1:10;
    live.forEach(i=>[i-st,i+st].forEach(j=>{if(j>=0&&j<100&&!b.shots[j]&&(!h||Math.floor(j/10)==Math.floor(i/10)))c.push(j)}))}
    if(!c.length)live.forEach(i=>G.n4(i).forEach(j=>{if(!b.shots[j])c.push(j)}));if(c.length)return rnd(c)}
   return rnd(free)}
  const w=G.weights(b),mx=Math.max(...free.map(i=>w[i]));return rnd(free.filter(i=>w[i]==mx))}
};
const left=b=>{const r={...COUNT};b.ships.forEach(s=>r[s.length]--);return r};

/* ===== Состояние ===== */
const T={miss:"мимо",hit:"попадание!",sunk:"потоплен!"},DN={easy:"лёгкий",medium:"средний",hard:"сложный"};
const SK={base:"Классика",sand:"Песок",neon:"Неон"},SKP=300;
const lj=k=>{try{return JSON.parse(localStorage.getItem(k))}catch(e){return null}};
const sj=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
let CFG=Object.assign({diff:"hard",skin:"base"},lj("sb2-cfg")||{});
let ST=Object.assign({coins:200,pro:false,own:["base"],g:[],fr:[],tab:"ai"},lj("sb2-st")||{});
let S=lj("sb2-game");if(S&&!S.pl)S=null;
let horiz=true,busy=false,socket=null,cur="menu",sel=0,drag=null;
const save=()=>{sj("sb2-cfg",CFG);sj("sb2-st",ST);sj("sb2-game",S)};
const fresh=mode=>({mode,phase:"setup",pl:B(),en:B(),turn:"p",log:"",last:-1,win:null,mv:[],pend:-1,code:"",role:"",salt:"",hash:"",oppHash:"",oppShips:null,ready:false,oppReady:false,ver:-1,conf:false});
const toast=m=>{const t=document.createElement("div");t.className="t";t.textContent=m;$("toast").appendChild(t);setTimeout(()=>t.remove(),2800)};
const commit=()=>{save();if(cur=="play")renderPlay()};
const avail=k=>k=="base"||(k=="sand"&&ST.own.includes("sand"))||(k=="neon"&&ST.pro);
const wins=()=>ST.g.filter(x=>x.win).length;
const hd=t=>`<header class="hd"><a class="bk" href="#/menu">←</a><h1>${t}</h1><span class="coin">🪙 ${ST.coins}${ST.pro?" · PRO":""}</span></header>`;

/* ===== Страницы ===== */
const VIEWS={
 menu(){$("view").innerHTML=`<div class="menu"><h1>Морской бой</h1><a href="#/battle">В бой</a><a href="#/shop">Магазин</a><a href="#/settings">Настройки</a><a href="#/stats">Статистика</a><a href="#/community">Комьюнити</a></div>`},
 battle(){const cont=S&&S.phase!="over"?`<div class="card"><h2>Текущая партия</h2><a href="#/play"><button class="p">Продолжить</button></a></div>`:"";
  $("view").innerHTML=`<div class="wrap">${hd("В бой")}${cont}<div class="cols">
  <div class="card"><h2>Против ИИ</h2><p class="mut">Сложность: <b>${DN[CFG.diff]}</b> (меняется в настройках)</p><button class="p" data-a="vsai">Играть</button></div>
  <div class="card"><h2>Онлайн</h2><p class="mut">Создайте комнату и отправьте код другу.</p><button class="p" data-a="mk">Создать комнату</button>
  <div class="row"><input id="cd" placeholder="код" maxlength="12"><button data-a="jn">Войти</button></div></div></div></div>`},
 play(){if(!S){location.hash="#/battle";return}
  if(S.mode=="online"&&S.phase!="over")connect(S.code);
  if(S.mode=="ai"&&S.phase=="play"&&S.turn=="a")aiTurn();
  renderPlay()},
 shop(){const pro=ST.pro;$("view").innerHTML=`<div class="wrap">${hd("Магазин")}
  <div class="card"><h2>Обычный и Pro</h2><div class="cols"><div><h3>Обычный</h3><ul><li>Игра против ИИ (3 уровня)</li><li>Онлайн с другом</li><li>Статистика и график</li><li>Скины «Классика» и «Песок» (за монеты)</li><li>Базовый разбор: точность</li></ul></div>
  <div><h3>Pro</h3><ul><li>Всё из обычного</li><li>Полный ИИ-Тренер: тактический индекс, ошибки, советы</li><li>Скин «Неон»</li></ul></div></div>
  <button class="${pro?"on":"p"}" data-a="pro">${pro?"Pro включён (тест) — выключить":"Включить Pro (тестовый режим)"}</button><p class="mut">Тестовый режим: оплата не взимается.</p></div>
  <div class="card"><h2>Скины</h2><div class="cols3">${Object.keys(SK).map(k=>`<div class="card"><h3>${SK[k]}</h3><p class="mut">${k=="base"?"Базовый":k=="sand"?SKP+" 🪙":"Нужен Pro"}</p>
  ${avail(k)?`<button class="${CFG.skin==k?"on":""}" data-a="skin:${k}">${CFG.skin==k?"Выбран":"Выбрать"}</button>`:k=="sand"?`<button data-a="buy:sand" ${ST.coins<SKP?"disabled":""}>Купить</button>`:`<button disabled>Pro</button>`}</div>`).join("")}</div></div>
  <div class="card"><h2>Монеты</h2><div class="cols3">${[100,500,1000].map(n=>`<div class="card"><h3>${n} 🪙</h3><p class="mut">Скоро…</p><button disabled>Купить</button></div>`).join("")}</div>
  <p class="mut">Монеты зарабатываются в игре: победа +100, поражение +20.</p></div></div>`},
 settings(){$("view").innerHTML=`<div class="wrap">${hd("Настройки")}
  <div class="card"><h2>Сложность</h2><div class="row">${Object.keys(DN).map(k=>`<button class="${CFG.diff==k?"on":""}" data-a="diff:${k}">${DN[k]}</button>`).join("")}</div></div>
  <div class="card"><h2>Скин</h2><div class="row">${Object.keys(SK).map(k=>`<button class="${CFG.skin==k?"on":""}" data-a="skin:${k}">${SK[k]}${avail(k)?"":" 🔒"}</button>`).join("")}</div><p class="mut">«Песок» покупается за монеты, «Неон» открывается с Pro — в магазине.</p></div>
  <div class="card"><h2>Данные</h2><button data-a="reset">Сбросить данные</button></div></div>`},
 stats(){const a=ST.g.filter(x=>x.m==ST.tab),w=a.filter(x=>x.win).length;
  $("view").innerHTML=`<div class="wrap">${hd("Статистика")}<div class="row"><button class="${ST.tab=="ai"?"on":""}" data-a="tab:ai">ИИ</button><button class="${ST.tab=="on"?"on":""}" data-a="tab:on">Человек (онлайн)</button></div>
  <div class="card"><div class="kps"><div class="kp"><b>${a.length}</b>партий</div><div class="kp"><b>${w}</b>побед</div><div class="kp"><b>${a.length-w}</b>поражений</div><div class="kp"><b>${a.length?Math.round(w/a.length*100):0}%</b>винрейт</div></div></div>
  <div class="card"><h2>Процент побед по ходу игр</h2>${chart(a)}</div></div>`},
 community(){const W=wins(),L=[["Бронза",0],["Серебро",5],["Золото",15],["Платина",30]];let li=0;L.forEach((x,i)=>{if(W>=x[1])li=i});const nx=L[li+1];
  const rows=[["Aidar",24],["Dana",17],["Timur",9],["Aruzhan",4],["Вы",W]].sort((x,y)=>y[1]-x[1]);
  $("view").innerHTML=`<div class="wrap">${hd("Комьюнити")}<div class="cols">
  <div class="card"><h2>Лиги</h2><p>Ваша лига: <b>${L[li][0]}</b> · побед: ${W}</p>${nx?`<div class="bar"><i style="width:${Math.round((W-L[li][1])/(nx[1]-L[li][1])*100)}%"></i></div><p class="mut">До «${nx[0]}»: ${nx[1]-W}</p>`:'<p class="mut">Максимальная лига</p>'}
  <table><tr><th>#</th><th>Игрок</th><th>Побед</th></tr>${rows.map((r,i)=>`<tr class="${r[0]=="Вы"?"me":""}"><td>${i+1}</td><td>${r[0]}</td><td>${r[1]}</td></tr>`).join("")}</table><p class="mut">Остальные игроки — демо-данные.</p></div>
  <div class="card"><h2>Друзья</h2><div class="row"><input id="fn" placeholder="имя друга" maxlength="16"><button data-a="addf">Добавить</button></div>
  ${ST.fr.length?ST.fr.map((f,i)=>`<div class="row"><span style="flex:1">${f.replace(/[<>&]/g,"")}</span><button data-a="inv:${i}">Вызвать</button><button data-a="delf:${i}">✕</button></div>`).join(""):'<p class="mut">Пока пусто.</p>'}
  <p class="mut">«Вызвать» создаёт комнату и копирует ссылку для друга.</p></div></div></div>`}
};
function chart(a){if(a.length<2)return'<p class="mut">Нужно минимум 2 партии.</p>';let w=0;
 const p=a.map((x,i)=>{w+=x.win?1:0;return[(10+i/(a.length-1)*300).toFixed(1),(120-w/(i+1)*110).toFixed(1)]});
 return`<svg viewBox="0 0 320 135"><line x1="10" y1="10" x2="310" y2="10"/><line x1="10" y1="65" x2="310" y2="65"/><line x1="10" y1="120" x2="310" y2="120"/><text x="0" y="132">0%</text><text x="0" y="8">100%</text><polyline points="${p.map(x=>x.join(",")).join(" ")}"/></svg>`}
function route(){const m=location.hash.match(/^#\/join\/([a-z0-9]{3,12})$/i);
 if(m){leave();S=fresh("online");S.role="g";S.code=m[1].toLowerCase();save();location.hash="#/play";return}
 cur=location.hash.replace("#/","")||"menu";if(!VIEWS[cur])cur="menu";
 if(!avail(CFG.skin))CFG.skin="base";document.documentElement.dataset.skin=CFG.skin;VIEWS[cur]()}
addEventListener("hashchange",route);

/* ===== Партия ===== */
function cls(b,i,own){const v=b.shots[i],s=b.ships.find(s=>s.includes(i));let c="c";
 if(s&&own)c+=v==2?(G.sunk(b,s)?" k":" h"):" s";
 else if(s&&v==2&&G.sunk(b,s))c+=" k";else if(v==2)c+=" h";else if(v==1)c+=" m";else if(v==3)c+=" a";
 else if(s&&S.phase=="over"&&S.mode=="ai")c+=" r";
 if(!own&&S.last==i)c+=" l";return c}
const cells=(b,own)=>Array.from({length:100},(_,i)=>`<button class="${cls(b,i,own)}" data-i="${i}" aria-label="${nm(i)}"></button>`).join("");
const grid=(id,inner)=>`<div><div class="lt">${[...LET].map(x=>`<i>${x}</i>`).join("")}</div><div class="bm"><div class="nt">${Array.from({length:10},(_,k)=>`<i>${k+1}</i>`).join("")}</div><div class="g" id="${id}">${inner}</div></div></div>`;
const selN=()=>{const r=left(S.pl);return sel&&r[sel]>0?sel:[4,3,2,1].find(n=>r[n]>0)||0};
const dock=()=>{const r=left(S.pl),s=selN();return`<div class="dock"><p class="mut">Перетащите корабль на поле или выберите и нажмите на клетку</p>`+[4,3,2,1].map(n=>`<div class="dk${s==n?" sel":""}${r[n]?"":" done"}" data-n="${n}"><span class="sh">${"<i></i>".repeat(n)}</span><b>×${r[n]}</b></div>`).join("")+`</div>`};
function status(){const n=S.pl.ships.length;
 if(S.phase=="setup")return S.ready?"Флот готов. Ждём соперника…":n<10?`Расставьте флот (осталось ${10-n})`:S.mode=="online"?"Флот готов. Нажмите «Готов»":"Флот готов. Нажмите «В бой!»";
 if(S.phase=="over")return S.win?"Победа! Флот соперника потоплен":"Поражение. Ваш флот потоплен";
 return S.turn=="p"?"Ваш ход — стреляйте справа":S.mode=="online"?"Ход соперника…":"Компьютер целится…"}
function renderPlay(){const on=S.mode=="online",setup=S.phase=="setup",over=S.phase=="over",n=S.pl.ships.length;let ctl="";
 if(setup)ctl=`<button data-a="rot">${horiz?"↔ Горизонтально":"↕ Вертикально"}</button><button data-a="undo" ${n&&!S.ready?"":"disabled"}>Отмена</button><button data-a="clear" ${n&&!S.ready?"":"disabled"}>Очистить</button><button data-a="auto" ${S.ready?"disabled":""}>Авто</button>`+(on?`<button class="p" data-a="ready" ${n<10||S.ready?"disabled":""}>Готов</button>`:`<button class="p" data-a="go" ${n<10?"disabled":""}>В бой!</button>`);
 else if(over)ctl=`<button class="p" data-a="again">${on?"В меню":"Ещё партию"}</button>`;
 else ctl=`<button data-a="giveup">${S.conf?"Точно сдаться?":"Сдаться"}</button>`;
 $("view").innerHTML=`<div class="wrap"><div class="top"><button data-a="exit">← Меню</button>${on?`<span>Комната <b>${S.code}</b> <button data-a="copy">Копировать ссылку</button></span>`:`<span class="mut">Сложность: ${DN[CFG.diff]}</span>`}</div>
 <div class="top"><h2>${status()}</h2><div class="row">${ctl}</div></div>
 ${setup?`<div class="setup">${S.ready?"<div></div>":dock()}<section>${grid("pl",cells(S.pl,true))}</section></div>`:`<div class="bs"><section><h3>Ваш флот</h3>${grid("pl",cells(S.pl,true))}</section><section><h3>Флот соперника</h3>${grid("en",cells(S.en,false))}</section></div>`}
 <p class="lg">${S.log}</p>${over?`<div class="card"><h2>Разбор партии</h2>${coach()}</div>`:""}</div>`}

function coach(){const mv=S.mv,ships=S.mode=="ai"?S.en.ships:S.oppShips,hits=mv.filter(m=>m.r!="miss").length,acc=mv.length?Math.round(hits/mv.length*100):0;
 const kp=(a,b)=>`<div class="kp"><b>${a}</b>${b}</div>`;let h=`<div class="kps">${kp(acc+"%","точность")}${kp(mv.length,"выстрелов")}${kp(hits,"попаданий")}`;
 if(!ST.pro)return h+`</div><p class="lock">Тактический индекс, ошибки и советы — в Pro. <button data-a="pro">Включить Pro (тест)</button></p>`;
 if(!ships)return h+`</div><p class="mut">Ждём раскрытия флота соперника…</p>`;
 const b={ships,shots:Array(100).fill(0)},rows=[];
 mv.forEach((m,k)=>{const w=G.weights(b);let mx=0,bi=-1;w.forEach((v,i)=>{if(!b.shots[i]&&v>mx){mx=v;bi=i}});rows.push({k:k+1,i:m.i,q:mx?w[m.i]/mx:1,bi});G.shoot(b,m.i)});
 const idx=rows.length?Math.round(100*rows.filter(r=>r.q>=.6).length/rows.length):0;
 const bad=rows.filter(r=>r.q<.5).sort((a,b)=>a.q-b.q).slice(0,3).map(r=>`<li>Ход ${r.k}, ${nm(r.i)}: шанс ${Math.round(r.q*100)}% от лучшей клетки. Лучше было ${nm(r.bi)}.</li>`).join("");
 const by={};rows.forEach(r=>by[r.i]=r);
 const map=`<div class="hm">${Array.from({length:100},(_,i)=>{const r=by[i];return r?`<i class="${r.q>=.6?"q1":r.q>=.3?"q2":"q3"}" title="${nm(i)}">${r.k}</i>`:"<i></i>"}).join("")}</div>`;
 const tip=mv.length<8?"Партия слишком короткая для оценки — сыграйте до конца.":idx>=70?"Отличная игра: вы стреляли по самым вероятным клеткам.":idx>=45?"Неплохо. После попадания добивайте корабль по линии, а не вокруг.":"Ищите корабли «через клетку» (шахматной сеткой): так вы быстрее найдёте даже 2-палубные.";
 return h+kp(mv.length<8?"—":idx+"%","тактический индекс")+`</div><p class="mut" style="margin-top:12px">Карта ваших выстрелов: зелёный — сильный ход, жёлтый — средний, красный — слабый. Числа — порядок ходов.</p>`+map+(bad?`<h3 style="margin-top:12px">Главные ошибки</h3><ul>${bad}</ul>`:"")+`<p>${tip}</p>`+(S.mode=="online"?`<p class="mut">${S.ver==1?"Флот соперника проверен по хешу ✓":"Не удалось подтвердить хеш расстановки соперника."}</p>`:"")}

function finish(win){if(S.phase=="over")return;S.phase="over";S.win=win;
 const hits=S.mv.filter(m=>m.r!="miss").length;
 ST.g.push({m:S.mode=="ai"?"ai":"on",win,acc:S.mv.length?Math.round(hits/S.mv.length*100):0});ST.g=ST.g.slice(-200);
 const r=win?100:20;ST.coins+=r;toast(`${win?"Победа":"Поражение"}: +${r} 🪙`);
 if(S.mode=="online")sendEnd();commit()}
function shotMe(i){if(busy||S.phase!="play"||S.turn!="p"||S.en.shots[i]||S.pend>=0)return;
 if(S.mode=="online"){S.pend=i;S.last=i;socket.emit("sb_shot",{i});return commit()}
 const x=G.shoot(S.en,i);S.mv.push({i,r:x.r});S.last=i;S.log="Вы: "+nm(i)+" — "+T[x.r];
 if(G.over(S.en))return finish(true);if(x.r=="miss")S.turn="a";commit();if(S.turn=="a")aiTurn()}
function aiTurn(){busy=true;commit();setTimeout(()=>{const i=G.ai(S.pl,CFG.diff),x=G.shoot(S.pl,i);S.last=-1;S.log="Компьютер: "+nm(i)+" — "+T[x.r];busy=false;
 if(G.over(S.pl))return finish(false);if(x.r=="miss")S.turn="p";commit();if(S.turn=="a")aiTurn()},650)}
function place(i,n){if(S.phase!="setup"||S.ready||!n)return;const cs=cellsOf(i,n,horiz);
 if(left(S.pl)[n]<1||!G.fits(S.pl,cs)){toast("Сюда нельзя: корабли не должны касаться друг друга");return}
 S.pl.ships.push(cs.map(([r,c])=>r*10+c));S.log="";commit()}

/* ===== Перетаскивание кораблей (Pointer Events: мышь и палец) ===== */
function preview(el,n){document.querySelectorAll("#pl .pv,#pl .bad").forEach(x=>x.classList.remove("pv","bad"));
 const c=el&&el.closest&&el.closest("#pl .c");if(!c||!n)return;const cs=cellsOf(+c.dataset.i,n,horiz),ok=G.fits(S.pl,cs)&&left(S.pl)[n]>0;
 cs.forEach(([r,c2])=>{if(r<10&&c2<10){const e=document.querySelector(`#pl [data-i="${r*10+c2}"]`);if(e)e.classList.add(ok?"pv":"bad")}})}
const gpos=e=>{if(!drag)return;drag.g.style.left=(e.clientX-drag.cw/2)+"px";drag.g.style.top=(e.clientY-drag.cw/2)+"px"};
$("view").addEventListener("pointerdown",e=>{const d=e.target.closest(".dk");if(!d||d.classList.contains("done")||!S||S.phase!="setup"||S.ready)return;
 const n=+d.dataset.n,c=document.querySelector("#pl .c"),cw=c?c.offsetWidth:28,g=document.createElement("div");
 g.className="ghost"+(horiz?"":" v");g.innerHTML=`<i style="width:${cw}px;height:${cw}px"></i>`.repeat(n);document.body.appendChild(g);
 drag={n,g,cw,x:e.clientX,y:e.clientY,moved:false};sel=n;gpos(e);e.preventDefault()});
document.addEventListener("pointermove",e=>{if(!drag)return;if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>6)drag.moved=true;gpos(e);preview(document.elementFromPoint(e.clientX,e.clientY),drag.n)});
document.addEventListener("pointerup",e=>{if(!drag)return;const d=drag;drag=null;d.g.remove();
 if(d.moved){const c=document.elementFromPoint(e.clientX,e.clientY),cc=c&&c.closest("#pl .c");if(cc)return place(+cc.dataset.i,d.n)}
 renderPlay()});
$("view").addEventListener("mouseover",e=>{if(S&&cur=="play"&&S.phase=="setup"&&!S.ready&&!drag)preview(e.target,selN())});
addEventListener("keydown",e=>{if(cur=="play"&&S&&S.phase=="setup"&&"rк".includes(e.key.toLowerCase())&&e.key.length==1&&document.activeElement.tagName!="INPUT"){horiz=!horiz;renderPlay()}});

/* ===== Онлайн (Socket.io + SHA-256) ===== */
const sha=async t=>{try{const d=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(t));return[...new Uint8Array(d)].map(x=>x.toString(16).padStart(2,"0")).join("")}catch(e){return""}};
const okShip=s=>Array.isArray(s)&&s.length>0&&s.length<5&&s.every(n=>Number.isInteger(n)&&n>=0&&n<100);
const okShips=a=>Array.isArray(a)&&a.length==10&&a.every(okShip);
const emitReady=()=>socket&&socket.emit("sb_ready",{h:S.hash});
const sendEnd=gu=>socket&&socket.emit("sb_end",{ships:S.pl.ships,salt:S.salt,gu:gu?1:0});
function tryStart(){if(S.phase=="setup"&&S.ready&&S.oppReady){S.phase="play";S.turn=S.role=="h"?"p":"o";S.log=S.turn=="p"?"Ваш ход!":"Ход соперника."}}
function connect(code){
 if(!socket){socket=io();
  socket.on("connect",()=>{if(S&&S.mode=="online"&&S.code)socket.emit("join_room",S.code)});
  socket.on("init_role",m=>{S.role=m.role;commit()});
  socket.on("peer_count",c=>{S.log=c>1?"Соперник в комнате.":"Ждём второго игрока…";if(c>1&&S.ready)emitReady();commit()});
  socket.on("sb_ready_hash",m=>{S.oppHash=m.h||"";S.oppReady=true;tryStart();commit()});
  socket.on("sb_shot",m=>{const i=m.i;if(S.phase!="play"||S.turn!="o"||!Number.isInteger(i)||i<0||i>99)return;
   const x=G.shoot(S.pl,i);if(!x)return;S.log="Соперник: "+nm(i)+" — "+T[x.r];socket.emit("sb_res",{i,r:x.r,ship:x.ship});
   if(G.over(S.pl))return finish(false);if(x.r=="miss")S.turn="p";commit()});
  socket.on("sb_res",m=>{if(S.phase!="play"||S.pend<0||m.i!==S.pend||!T[m.r]||(m.r=="sunk"&&!okShip(m.ship)))return;
   G.apply(S.en,m.i,m);S.mv.push({i:m.i,r:m.r});S.log="Вы: "+nm(m.i)+" — "+T[m.r];S.pend=-1;
   if(G.over(S.en))return finish(true);if(m.r=="miss")S.turn="o";commit()});
  socket.on("sb_end",async m=>{if(!okShips(m.ships))return;S.oppShips=m.ships;
   S.ver=S.oppHash&&(await sha(JSON.stringify(m.ships)+m.salt))==S.oppHash?1:0;if(S.phase=="play"&&m.gu)finish(true);commit()});
  socket.on("peer_left",()=>{S.log="Соперник отключился. Ждём 60 секунд…";commit()});
  socket.on("peer_abandoned",()=>{if(S.phase=="play")finish(true);toast("Соперник покинул игру")});
  socket.on("error_msg",m=>{toast(m);S=null;save();location.hash="#/battle"})}
 if(socket.connected)socket.emit("join_room",code);else socket.connect()}
function leave(){if(socket){socket.disconnect();socket=null}}
function startOnline(code,role){leave();S=fresh("online");S.role=role;S.code=code;save();location.hash="#/play"}
const link=()=>location.origin+"/#/join/"+S.code;

/* ===== Действия ===== */
async function act(a){
 const [k,v]=a.split(":");
 switch(k){
  case"about":$("about").hidden=false;return;
  case"closeabout":$("about").hidden=true;return;
  case"diff":CFG.diff=v;save();return route();
  case"skin":if(!avail(v))return toast(v=="neon"?"Скин открывается с Pro":"Сначала купите скин в магазине");CFG.skin=v;save();return route();
  case"buy":if(ST.coins<SKP)return toast("Не хватает монет");ST.coins-=SKP;ST.own.push("sand");CFG.skin="sand";save();toast("Скин куплен");return route();
  case"pro":ST.pro=!ST.pro;save();toast(ST.pro?"Pro включён (тестовый режим)":"Pro выключен");if(cur=="play")return renderPlay();return route();
  case"tab":ST.tab=v;save();return route();
  case"reset":ST={coins:200,pro:false,own:["base"],g:[],fr:[],tab:"ai"};CFG={diff:"hard",skin:"base"};S=null;leave();save();toast("Данные сброшены");return route();
  case"addf":{const n=$("fn").value.trim();if(n&&!ST.fr.includes(n))ST.fr.push(n);save();return route()}
  case"delf":ST.fr.splice(+v,1);save();return route();
  case"inv":{const code=Math.random().toString(36).slice(2,7);startOnline(code,"h");try{await navigator.clipboard.writeText(link());toast("Ссылка для друга скопирована")}catch(e){toast("Код комнаты: "+code)}return}
  case"vsai":leave();S=fresh("ai");save();location.hash="#/play";return;
  case"mk":startOnline(Math.random().toString(36).slice(2,7),"h");return;
  case"jn":{const c=$("cd").value.trim().toLowerCase().replace(/[^a-z0-9]/g,"");if(c.length<3)return toast("Введите код комнаты");startOnline(c,"g");return}
  case"exit":if(S&&S.phase=="over"){S=null;leave()}save();location.hash="#/menu";return;
  case"rot":horiz=!horiz;break;
  case"undo":S.pl.ships.pop();break;
  case"clear":S.pl.ships=[];break;
  case"auto":S.pl=G.auto();break;
  case"go":S.en=G.auto();S.phase="play";S.turn="p";S.log="Бой начался!";break;
  case"ready":S.salt=Math.random().toString(36).slice(2);S.hash=await sha(JSON.stringify(S.pl.ships)+S.salt);S.ready=true;emitReady();tryStart();break;
  case"giveup":if(!S.conf){S.conf=true;break}if(S.mode=="online")sendEnd(true);return finish(false);
  case"copy":try{await navigator.clipboard.writeText(link());toast("Ссылка скопирована")}catch(e){toast("Код: "+S.code)}return;
  case"again":{const m=S.mode;leave();if(m=="ai"){S=fresh("ai")}else{S=null;save();location.hash="#/battle";return}break}
 }
 commit()}
document.addEventListener("click",e=>{const t=e.target.closest("[data-a],.c");if(!t)return;
 if(t.dataset.a){if(t.id=="about"&&e.target!==t)return;return act(t.dataset.a)}
 if(!S||cur!="play")return;
 if(t.closest("#pl"))place(+t.dataset.i,selN());else if(t.closest("#en"))shotMe(+t.dataset.i)});
route();
