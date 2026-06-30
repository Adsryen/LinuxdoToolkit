// ==UserScript==
// @name         LINUX DO Credit 积分
// @namespace    http://tampermonkey.net/
// @version      1.1.7
// @description  LINUX DO Credit 实时收入
// @author       @Chenyme
// @license      MIT
// @match        https://linux.do/*
// @match        https://credit.linux.do/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      credit.linux.do
// @connect      linux.do
// @run-at       document-idle
// @downloadURL https://update.greasyfork.org/scripts/560312/LINUX%20DO%20Credit%20%E7%A7%AF%E5%88%86.user.js
// @updateURL https://update.greasyfork.org/scripts/560312/LINUX%20DO%20Credit%20%E7%A7%AF%E5%88%86.meta.js
// ==/UserScript==

(function () {
'use strict';

/* ================= 样式 ================= */

GM_addStyle(`
#ldc-mini{
position:fixed;
background:#fff;
border:1px solid #e5e7eb;
border-radius:8px;
box-shadow:0 2px 4px rgb(0 0 0 / .04);
z-index:10000;
font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
padding:10px 14px;
font-size:13px;
font-weight:600;
cursor:move;
user-select:none;
transition:.3s;
}
.dark #ldc-mini{background:#1f2937;border-color:rgba(255,255,255,.1)}
#ldc-mini.loading{color:#6b7280}
#ldc-mini.positive{color:#10b981}
#ldc-mini.negative{color:#ef4444}
#ldc-mini.neutral{color:#6b7280}

#ldc-tooltip{
position:fixed;
background:rgba(0,0,0,.8);
color:#fff;
padding:8px 12px;
border-radius:6px;
font-size:12px;
white-space:pre;
z-index:10001;
opacity:0;
transition:.15s;
}

.dark #ldc-tooltip{
background:rgba(255,255,255,.9);
color:#000;
}
`);

/* ================= 状态 ================= */

let communityBalance = null;
let gamificationScore = null;
let username = null;
let isDragging = false;
let tooltipContent = '加载中...';

/* ================= 小组件 ================= */

function createWidget(){
const w = document.createElement('div');
w.id='ldc-mini';
w.className='loading';
w.textContent='···';

const t = document.createElement('div');
t.id='ldc-tooltip';

const pos = GM_getValue('ldc_pos',{right:'20px',bottom:'20px'});
Object.assign(w.style,pos);

document.body.appendChild(w);
document.body.appendChild(t);

/* hover */

w.onmouseenter=()=>{
t.textContent=tooltipContent;
const r=w.getBoundingClientRect();
t.style.right=(window.innerWidth-r.right)+'px';
t.style.top=(r.bottom+6)+'px';
t.style.opacity=1;
};

w.onmouseleave=()=>t.style.opacity=0;

/* drag */

let sx,sy,sr,sb;

w.onmousedown=e=>{
sx=e.clientX;
sy=e.clientY;
const r=w.getBoundingClientRect();
sr=window.innerWidth-r.right;
sb=window.innerHeight-r.bottom;

const move=ev=>{
isDragging=true;
w.style.right=(sr+(sx-ev.clientX))+'px';
w.style.bottom=(sb+(sy-ev.clientY))+'px';
};

const up=()=>{
document.removeEventListener('mousemove',move);
document.removeEventListener('mouseup',up);
GM_setValue('ldc_pos',{right:w.style.right,bottom:w.style.bottom});
setTimeout(()=>isDragging=false,50);
};

document.addEventListener('mousemove',move);
document.addEventListener('mouseup',up);
};

/* click refresh */

w.onclick=()=>{
if(isDragging) return;
w.className='loading';
w.textContent='···';
tooltipContent='刷新中...';
fetchData();
};
}

/* ================= 带 CSRF 的请求 ================= */

async function request(url){

const csrfToken=document.querySelector('meta[name="csrf-token"]')?.content;

const headers={
Accept:'application/json',
...(csrfToken?{'x-csrf-token':csrfToken}:{})
};

const sameOrigin=url.startsWith(location.origin);

if(sameOrigin){
try{
const r=await fetch(url,{
credentials:'include',
headers
});
if(!r.ok) throw '';
return await r.json();
}catch{}
}

return new Promise((resolve,reject)=>{
GM_xmlhttpRequest({
method:'GET',
url,
withCredentials:true,
headers:{
...headers,
Referer:'https://credit.linux.do/home'
},
timeout:10000,
onload:r=>{
if(r.status===200){
try{resolve(JSON.parse(r.responseText))}
catch(e){reject(e)}
}else reject(r.status)
},
onerror:reject,
ontimeout:()=>reject('timeout')
});
});
}

/* ================= 显示 ================= */

function updateDisplay(){

const w=document.getElementById('ldc-mini');
if(!w) return;

if(communityBalance!==null && gamificationScore!==null){

const diff=gamificationScore-communityBalance;

w.textContent=(diff>0?'+':'')+diff.toFixed(2);

w.className=diff>0?'positive':diff<0?'negative':'neutral';

tooltipContent=
`仅供参考，可能有误差！
当前分: ${gamificationScore.toFixed(2)}
基准值: ${communityBalance.toFixed(2)}`;

}
}

/* ================= 数据 ================= */

async function fetchData(){
try{

const credit=await request('https://credit.linux.do/api/v1/oauth/user-info');

if(credit?.data){
communityBalance=parseFloat(
credit.data['community-balance']||
credit.data.community_balance||0
);

username=credit.data.username||credit.data.nickname;

updateDisplay();

if(username) await fetchGamification();

}

}catch(e){
console.error(e);
errorShow();
}
}

async function fetchGamification(){
try{
const d=await request(`https://linux.do/u/${username}.json`);
if(d?.user?.gamification_score!==undefined){
gamificationScore=parseFloat(d.user.gamification_score);
updateDisplay();
}
}catch(e){
console.error(e);
}
}

function errorShow(){
const w=document.getElementById('ldc-mini');
if(!w) return;
w.textContent='!';
w.className='negative';
tooltipContent='请求失败，请确认已登录';
}

/* ================= 启动 ================= */

function init(){
createWidget();
fetchData();
setInterval(fetchData,300000);
}

document.readyState==='loading'
?document.addEventListener('DOMContentLoaded',init)
:init();

})();
