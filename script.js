// Draggable Google Search
(function(){
  const el = document.getElementById('gSearch');
  if(!el) return;
  let isDragging=false, offsetX=0, offsetY=0;
  el.addEventListener('mousedown', start);
  el.addEventListener('touchstart', start, {passive:false});
  function start(e){
    const tg = e.target;
    if(tg.tagName === 'INPUT' || tg.tagName === 'BUTTON' || tg.closest('form')) return;
    e.preventDefault();
    isDragging = true;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const rect = el.getBoundingClientRect();
    offsetX = clientX - rect.left;
    offsetY = clientY - rect.top;
    el.style.transition = 'none';
    el.style.cursor = 'grabbing';
  }
  function move(e){
    if(!isDragging) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    let x = clientX - offsetX;
    let y = clientY - offsetY;
    const margin = 8;
    const maxX = window.innerWidth - el.offsetWidth - margin;
    const maxY = window.innerHeight - el.offsetHeight - margin;
    x = Math.max(margin, Math.min(maxX, x));
    y = Math.max(margin, Math.min(maxY, y));
    el.style.left = x + 'px';
    el.style.top  = y + 'px';
  }
  function end(){
    if(!isDragging) return;
    isDragging = false;
    el.style.cursor = 'grab';
    el.style.transition = 'left 120ms ease, top 120ms ease';
  }
  window.addEventListener('mousemove', move);
  window.addEventListener('touchmove', move, {passive:false});
  window.addEventListener('mouseup', end);
  window.addEventListener('touchend', end);
  window.addEventListener('touchcancel', end);
})();

// Clock and Rings
const images = {
  sunrise: "sunrise.png",
  morning: "morning.png",
  afternoon: "afternoon.png",
  evening: "evening.png",
  night: "night.png"
};
let is24Hour = true;
let customDate = null;
let lastValues = { h: null, m: null, s: null };
const rings = [
  { id: 'daysRing', items: ["SUN","MON","TUE","WED","THU","FRI","SAT"], speed: 0.02, dir: 1 },
  { id: 'dateRing', items: Array.from({length:31}, (_,i)=>String(i+1)), speed: 0.012, dir: -1 },
  { id: 'monthsRing', items: ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"], speed: 0.007, dir: 1 }
];
const ringState = {};
const hoursText = document.getElementById('hoursText');
const minutesText = document.getElementById('minutesText');
const secondsText = document.getElementById('secondsText');
const ampmEl = document.getElementById('ampm');
const dateRow = document.getElementById('dateRow');
const settingsBtn = document.getElementById('settingsBtn');
const settingsPanel = document.getElementById('settingsPanel');
const customDT = document.getElementById('customDT');
const applyBtn = document.getElementById('applyBtn');
const clearBtn = document.getElementById('clearBtn');
const formatToggle = document.getElementById('formatToggle');
const ringToggle = document.getElementById('ringToggle');
const tickToggle = document.getElementById('tickToggle');
const openAlarm = document.getElementById('openAlarm');
const overlay = document.getElementById('overlay');
const alarmModal = document.getElementById('alarmModal');
const cancelAlarm = document.getElementById('cancelAlarm');
const saveAlarm = document.getElementById('saveAlarm');
const alarmTime = document.getElementById('alarmTime');
const dismissRow = document.getElementById('dismissRow');
const dismissAlarmBtn = document.getElementById('dismissAlarm');
let spinEnabled = true;
let tickEnabled = false;
let alarmSet = null;
let alarmRinging = false;
const tickSound = new Audio("tick tick.mp3");
tickSound.loop = true;
tickSound.volume = 0.06;
const alarmSound = new Audio("alarm.mp3");
alarmSound.loop = true;
alarmSound.volume = 0.9;

function setRingSizes(){
  const vw = Math.min(window.innerWidth, window.innerHeight);
  const centerSize = 320;
  const outerMax = Math.min(vw * 0.92, 980);
  const monthsSize = Math.max(centerSize + 320, outerMax * 0.9);
  const dateSize   = Math.max(centerSize + 200, monthsSize * 0.75);
  const daysSize   = Math.max(centerSize + 80, dateSize * 0.6);
  setRingSize('monthsRing', monthsSize);
  setRingSize('dateRing', dateSize);
  setRingSize('daysRing', daysSize);
  rings.forEach(r=>{
    const el = document.getElementById(r.id);
    ringState[r.id].size = el.clientWidth;
    ringState[r.id].center = { x: el.clientWidth/2, y: el.clientHeight/2 };
    ringState[r.id].radius = (el.clientWidth/2) - 22;
  });
}
function setRingSize(id, px){
  const el = document.getElementById(id);
  el.style.width = px + 'px';
  el.style.height = px + 'px';
}
function buildRings(){
  rings.forEach(r=>{
    const el = document.getElementById(r.id);
    el.innerHTML = '<div class="ring-border"></div>';
    el.style.zIndex = 20;
    ringState[r.id] = {
      el,
      baseAngles: [],
      elements: [],
      rotation: 0,
      speed: r.speed,
      origSpeed: r.speed,
      dir: r.dir
    };
    const itemCount = r.items.length;
    for(let i=0;i<itemCount;i++){
      const span = document.createElement('div');
      span.className = 'item';
      span.textContent = r.items[i];
      el.appendChild(span);
      const base = (i / itemCount) * Math.PI * 2;
      ringState[r.id].baseAngles.push(base);
      ringState[r.id].elements.push(span);
    }
  });
}
let lastTs = null;
function ringsAnimFrame(ts){
  if(!lastTs) lastTs = ts;
  const dt = (ts - lastTs)/1000;
  lastTs = ts;
  for(const r of rings){
    const id = r.id;
    const state = ringState[id];
    state.rotation += (state.speed || 0) * state.dir * dt * Math.PI * 2;
    if(state.rotation > Math.PI*2) state.rotation -= Math.PI*2;
    if(state.rotation < -Math.PI*2) state.rotation += Math.PI*2;
    const centerX = state.center.x;
    const centerY = state.center.y;
    const radius = state.radius;
    for(let i=0;i<state.elements.length;i++){
      const itemEl = state.elements[i];
      const angle = state.baseAngles[i] + state.rotation;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      itemEl.style.left = `${x}px`;
      itemEl.style.top  = `${y}px`;
      itemEl.style.transform = 'translate(-50%,-50%)';
      const scale = 1.0 + 0.08 * Math.cos(angle);
      itemEl.style.fontSize = `${12 * scale}px`;
      itemEl.style.opacity = `${0.7 + 0.2 * Math.cos(angle)}`;
    }
  }
  requestAnimationFrame(ringsAnimFrame);
}
function pad(n){ return String(n).padStart(2,'0'); }
function updateClock(){
  const now = customDate ? new Date(customDate) : new Date();
  let h = now.getHours();
  let m = now.getMinutes();
  let s = now.getSeconds();
  let displayH = h;
  let ampm = '';
  if(!is24Hour){
    ampm = h >= 12 ? 'PM' : 'AM';
    displayH = h % 12 || 12;
  }
  if(lastValues.h !== displayH){
    animateChange(hoursText, pad(displayH));
    lastValues.h = displayH;
  }
  if(lastValues.m !== m){
    animateChange(minutesText, pad(m));
    lastValues.m = m;
  }
  if(lastValues.s !== s){
    animateChange(secondsText, pad(s));
    lastValues.s = s;
  }
  ampmEl.textContent = is24Hour ? '' : ampm;
  dateRow.textContent = now.toDateString();
  setBackgroundAndTextColor(h);
  checkAlarm(now);
  if(customDate) customDate = new Date(customDate.getTime() + 1000);
}
function animateChange(el, newText){
  const parent = el.parentElement;
  parent.classList.remove('flip');
  void parent.offsetWidth;
  el.textContent = newText;
  parent.classList.add('flip');
}
function setBackgroundAndTextColor(hour){
  let bg = images.morning;
  let darkText = false;
  if(hour >= 5 && hour < 9){ bg = images.sunrise; darkText = true; }
  else if(hour >= 9 && hour < 12){ bg = images.morning; darkText = true; }
  else if(hour >= 12 && hour < 17){ bg = images.afternoon; darkText = true; }
  else if(hour >= 17 && hour < 20){ bg = images.evening; darkText = false; }
  else { bg = images.night; darkText = false; }
  document.documentElement.style.setProperty('--darkText', darkText ? '#111' : '#fff');
  document.documentElement.style.setProperty('--brightText', darkText ? '#111' : '#fff');
  document.body.style.backgroundImage = `url('${bg}')`;
}
settingsBtn.addEventListener('click', ()=>{
  settingsPanel.classList.toggle('open');
});
document.addEventListener('click', function(e) {
  if (settingsPanel.classList.contains('open') && 
      !settingsPanel.contains(e.target) && 
      !settingsBtn.contains(e.target)) {
    settingsPanel.classList.remove('open');
  }
});
applyBtn.addEventListener('click', ()=>{
  const v = customDT.value;
  if(v){
    customDate = new Date(v);
    if(isNaN(customDate)) customDate = null;
  }
  settingsPanel.classList.remove('open');
});
clearBtn.addEventListener('click', ()=>{
  customDate = null;
  customDT.value = '';
});
formatToggle.addEventListener('click', ()=>{
  is24Hour = !is24Hour;
  formatToggle.classList.toggle('active', !is24Hour);
});
ringToggle.addEventListener('click', ()=>{
  spinEnabled = !spinEnabled;
  ringToggle.classList.toggle('active', spinEnabled);
  document.body.classList.toggle('rings-hidden', !spinEnabled);
  rings.forEach(r=>{
    const s = ringState[r.id];
    if(!s) return;
    if(!spinEnabled) s.speed = 0;
    else s.speed = s.origSpeed ?? r.speed;
  });
});
tickToggle.addEventListener('click', ()=>{
  tickEnabled = !tickEnabled;
  tickToggle.classList.toggle('active', tickEnabled);
  try {
    if(tickEnabled){
      tickSound.play().catch(()=>{});
    } else {
      tickSound.pause();
      tickSound.currentTime = 0;
    }
  } catch(e){}
});
openAlarm.addEventListener('click', ()=>{
  settingsPanel.classList.remove('open');
  overlay.classList.add('show');
  alarmModal.classList.add('open');
});
cancelAlarm.addEventListener('click', ()=>{
  alarmModal.classList.remove('open');
  overlay.classList.remove('show');
});
saveAlarm.addEventListener('click', ()=>{
  const v = alarmTime.value;
  if(v){
    const [hh, mm] = v.split(':');
    alarmSet = { h: parseInt(hh,10), m: parseInt(mm,10) };
    alert(`Alarm set for ${pad(alarmSet.h)}:${pad(alarmSet.m)}`);
  } else {
    alert('Please choose a time or use a preset.');
    return;
  }
  alarmModal.classList.remove('open');
  overlay.classList.remove('show');
});
document.querySelectorAll('.preset-buttons button').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const mins = parseInt(btn.dataset.min, 10);
    const t = new Date(Date.now() + mins * 60000);
    alarmSet = { h: t.getHours(), m: t.getMinutes() };
    alert(`Alarm set for ${pad(alarmSet.h)}:${pad(alarmSet.m)}`);
    alarmModal.classList.remove('open');
    overlay.classList.remove('show');
  });
});
function checkAlarm(now){
  if(alarmRinging) return;
  if(!alarmSet) return;
  if(now.getHours() === alarmSet.h && now.getMinutes() === alarmSet.m && now.getSeconds() === 0){
    triggerAlarm();
  }
}
function triggerAlarm(){
  alarmRinging = true;
  overlay.classList.add('show');
  dismissRow.classList.add('show');
  alarmModal.classList.add('open');
  alarmSound.play().catch(()=>{});
}
dismissAlarmBtn.addEventListener('click', ()=>{
  stopAlarm();
});
function stopAlarm(){
  alarmSound.pause();
  alarmSound.currentTime = 0;
  alarmRinging = false;
  alarmSet = null;
  dismissRow.classList.remove('show');
  alarmModal.classList.remove('open');
  overlay.classList.remove('show');
}
function init(){
  buildRings();
  setRingSizes();
  window.addEventListener('resize', ()=>{ setRingSizes(); });
  rings.forEach(r=>{
    ringState[r.id].rotation = Math.random() * Math.PI*2 * 0.5;
  });
  if(spinEnabled) ringToggle.classList.add('active'); else ringToggle.classList.remove('active');
  if(tickEnabled) tickToggle.classList.add('active'); else tickToggle.classList.remove('active');
  requestAnimationFrame(ringsAnimFrame);
  updateClock();
  setInterval(updateClock, 1000);
}
document.addEventListener('DOMContentLoaded', init);

// Draggable dismiss alarm button
(function(){
  const btn = dismissAlarmBtn;
  let isDragging = false, offsetX=0, offsetY=0;
  btn.style.position = 'absolute';
  btn.style.cursor = 'grab';
  btn.addEventListener('mousedown', (e)=>{
    isDragging = true;
    offsetX = e.clientX - btn.offsetLeft;
    offsetY = e.clientY - btn.offsetTop;
    btn.style.cursor = 'grabbing';
  });
  window.addEventListener('mousemove', (e)=>{
    if(!isDragging) return;
    let x = e.clientX - offsetX;
    let y = e.clientY - offsetY;
    x = Math.max(0, Math.min(window.innerWidth - btn.offsetWidth, x));
    y = Math.max(0, Math.min(window.innerHeight - btn.offsetHeight, y));
    btn.style.left = x + 'px';
    btn.style.top  = y + 'px';
  });
  window.addEventListener('mouseup', ()=>{
    if(isDragging){
      isDragging = false;
      btn.style.cursor = 'grab';
    }
  });
})();