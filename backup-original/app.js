const API = window.location.origin;

const qs = sel => document.querySelector(sel);

async function fetchClients(){
  const res = await fetch(`${API}/api/clients`);
  return res.json();
}

function formatDate(d){ if(!d) return '-'; const dt = new Date(d); return dt.toLocaleDateString(); }

function renderClients(list){
  const el = qs('#clients-list'); el.innerHTML = '';
  list.forEach(c => {
    const div = document.createElement('div'); div.className='client';
    div.innerHTML = `<div>
      <div><strong>${c.name}</strong></div>
      <div class="meta">Tel: ${c.phone || '-'} • Aniversário: ${formatDate(c.birthday)} • Último corte: ${formatDate(c.lastCut)}</div>
    </div>
    <div>
      <button data-id="${c.id}" class="btn edit">Editar</button>
      <button data-id="${c.id}" class="btn del">Apagar</button>
    </div>`;
    el.appendChild(div);
  });
}

function showClientDetail(client){
  qs('#detail-name').textContent = client.name;
  qs('#detail-body').innerHTML = `<p><strong>Telefone:</strong> ${client.phone || '-'}</p>
    <p><strong>Aniversário:</strong> ${formatDate(client.birthday)}</p>
    <p><strong>Último corte:</strong> ${formatDate(client.lastCut)}</p>`;
  qs('#client-detail-modal').classList.remove('hidden');
}

qs('#detail-close').addEventListener('click', ()=> qs('#client-detail-modal').classList.add('hidden'));

async function refreshAll(){
  const clients = await fetchClients();
  renderClients(clients);
  updateDashboard(clients);
}

function updateDashboard(clients){
  const now = new Date();
  qs('#total-count').textContent = clients.length;
  const noCut15 = clients.filter(c => {
    if(!c.lastCut) return true;
    const d = new Date(c.lastCut); return (now - d)/(1000*60*60*24) > 15 && (now - d)/(1000*60*60*24) <= 30;
  });
  const noCut30 = clients.filter(c => {
    if(!c.lastCut) return true;
    const d = new Date(c.lastCut); return (now - d)/(1000*60*60*24) > 30;
  });
  const bday14 = clients.filter(c => { const b = new Date(c.birthday); const thisYear = new Date(now.getFullYear(), b.getMonth(), b.getDate()); const diff = (thisYear - now)/(1000*60*60*24); return diff >=0 && diff <=14; });
  qs('#count-15').textContent = noCut15.length;
  qs('#count-30').textContent = noCut30.length;
  qs('#count-bday-14').textContent = bday14.length;
}

// Form handling
qs('#btn-toggle-form').addEventListener('click', ()=> qs('#form-section').classList.toggle('hidden'));
qs('#btn-cancel').addEventListener('click', ()=> qs('#form-section').classList.add('hidden'));

qs('#client-form').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const fd = new FormData(e.target);
  const body = { name: fd.get('name'), phone: fd.get('phone'), birthday: fd.get('birthday'), lastCut: fd.get('lastCut') };
  await fetch(`${API}/api/clients`, { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(body) });
  e.target.reset(); qs('#form-section').classList.add('hidden');
  await refreshAll();
});

qs('#clients-list').addEventListener('click', async (e)=>{
  if(e.target.matches('.del')){
    const id = e.target.dataset.id; await fetch(`${API}/api/clients/${id}`, {method:'DELETE'}); await refreshAll();
  }
  if (e.target.matches('.edit')){
    const id = e.target.dataset.id; const clients = await fetchClients(); const c = clients.find(x => String(x.id) === String(id)); if(c) showClientDetail(c);
  }
});

// Filters (simple client-side filters)
qs('#filter-name').addEventListener('input', async (e)=>{
  const val = e.target.value.toLowerCase(); const clients = await fetchClients(); renderClients(clients.filter(c=>c.name.toLowerCase().includes(val)));
});

qs('#filter-bday-month').addEventListener('change', async (e)=>{
  const m = Number(e.target.value); const clients = await fetchClients(); if(!m) return renderClients(clients);
  renderClients(clients.filter(c=> new Date(c.birthday).getMonth()+1 === m));
});

qs('#filter-bday-from').addEventListener('change', async ()=>{ applyRangeFilter(); });
qs('#filter-bday-to').addEventListener('change', async ()=>{ applyRangeFilter(); });

async function applyRangeFilter(){
  const from = qs('#filter-bday-from').value; const to = qs('#filter-bday-to').value; const clients = await fetchClients();
  if(!from && !to) return renderClients(clients);
  const f = from ? new Date(from) : null; const t = to ? new Date(to) : null;
  renderClients(clients.filter(c=>{
    const b = new Date(c.birthday); b.setFullYear(f?f.getFullYear():t? t.getFullYear(): new Date().getFullYear());
    if(f && b < f) return false; if(t && b > t) return false; return true;
  }));
}

// Notifications and service worker
async function registerSW(){
  if('serviceWorker' in navigator){
    try{ await navigator.serviceWorker.register('/sw.js'); console.log('SW registered'); }catch(e){console.warn('SW fail', e); }
  }
}

async function askNotif(){
  const perm = await Notification.requestPermission(); return perm === 'granted';
}

qs('#btn-start-notif').addEventListener('click', async ()=>{
  const ok = await askNotif(); if(!ok) return alert('Permissão negada para notificações');
  if('serviceWorker' in navigator && 'PushManager' in window){
    const reg = await navigator.serviceWorker.ready;
    // fetch VAPID public key
    const r = await fetch(`${API}/api/vapidPublic`); const { publicKey } = await r.json();
    const key = publicKey ? urlBase64ToUint8Array(publicKey) : undefined;
    const subscribeOptions = key ? { userVisibleOnly:true, applicationServerKey: key } : { userVisibleOnly:true };
    let sub;
    try { sub = await reg.pushManager.subscribe(subscribeOptions); } catch (err) { return alert('Falha ao criar inscrição de push: ' + err.message); }
    // send subscription to server
    try {
      const res = await fetch(`${API}/api/subscribe`, { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(sub) });
      if (!res.ok) throw new Error('Status ' + res.status);
      alert('Inscrição registrada para notificações');
    } catch (e) { alert('Inscrição criada localmente, mas falha ao enviar ao servidor: ' + e.message); }
  } else {
    alert('Push não suportado neste navegador');
  }
});

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// On load
registerSW(); refreshAll();

// open client from URL param if present
function getParam(name){ const u = new URL(window.location.href); return u.searchParams.get(name); }
async function openClientFromUrl(){ const id = getParam('client'); if(!id) return; const clients = await fetchClients(); const c = clients.find(x=>String(x.id)===String(id)); if(c) showClientDetail(c); }
openClientFromUrl();
