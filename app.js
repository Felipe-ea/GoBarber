// API Base URL
// Permite sobrescrever a URL da API quando o frontend está hospedado separado do backend (ex.: Vercel + Render)
// No Vercel, adicione antes do app.js no index.html:
// <script>window.API_BASE_URL = 'https://SEU-BACKEND.onrender.com';</script>
const API = (typeof window !== 'undefined' && window.API_BASE_URL) || window.location.origin;

// Utility functions
const qs = (sel) => document.querySelector(sel);
const qsa = (sel) => document.querySelectorAll(sel);

// Format date for display
function formatDate(dateStr) {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  return date.toLocaleDateString("pt-BR");
}

// Format phone number
function formatPhone(phone) {
  if (!phone) return "-";
  return phone.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
}

// API calls
async function fetchClients() {
  const res = await fetch(`${API}/api/clients`);
  if (!res.ok) throw new Error("Falha ao carregar clientes");
  return res.json();
}

async function fetchPreferences() {
  const res = await fetch(`${API}/api/preferences`);
  if (!res.ok) throw new Error("Falha ao carregar preferências");
  return res.json();
}

async function savePreferences(prefs) {
  const res = await fetch(`${API}/api/preferences`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(prefs),
  });
  if (!res.ok) throw new Error("Falha ao salvar preferências");
  return res.json();
}

async function saveClient(data) {
  const method = data.id ? "PUT" : "POST";
  const url = data.id ? `${API}/api/clients/${data.id}` : `${API}/api/clients`;
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Falha ao salvar cliente");
  return res.json();
}

async function deleteClient(id) {
  const res = await fetch(`${API}/api/clients/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Falha ao excluir cliente");
  return res.json();
}

// Render functions
function renderClients(clients) {
  const container = qs("#clients-list");
  const emptyState = qs("#empty-state");

  container.innerHTML = "";

  if (clients.length === 0) {
    emptyState.classList.remove("hidden");
    return;
  }

  emptyState.classList.add("hidden");

  clients.forEach((client) => {
    const div = document.createElement("div");
    div.className = "client-item";
    div.innerHTML = `
      <div class="client-info">
        <div class="client-name">${client.name}</div>
        <div class="client-meta">
          <span>📞 ${formatPhone(client.phone)}</span>
          <span>🎂 ${formatDate(client.birthday)}</span>
          <span>✂️ ${formatDate(client.lastCut)}</span>
        </div>
      </div>
      <div class="client-actions">
        <button class="btn ghost btn-icon" data-action="view" data-id="${
          client.id
        }" title="Ver detalhes">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </button>
        <button class="btn ghost btn-icon" data-action="edit" data-id="${
          client.id
        }" title="Editar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button class="btn ghost btn-icon" data-action="delete" data-id="${
          client.id
        }" title="Excluir">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </div>
    `;
    container.appendChild(div);
  });
}

function updateDashboard(clients) {
  const now = new Date();
  qs("#total-count").textContent = clients.length;

  const noCut15 = clients.filter((c) => {
    if (!c.lastCut) return true;
    const d = new Date(c.lastCut);
    const diff = (now - d) / (1000 * 60 * 60 * 24);
    return diff > 15 && diff <= 30;
  });

  const noCut30 = clients.filter((c) => {
    if (!c.lastCut) return true;
    const d = new Date(c.lastCut);
    const diff = (now - d) / (1000 * 60 * 60 * 24);
    return diff > 30;
  });

  const bday14 = clients.filter((c) => {
    const b = new Date(c.birthday);
    const thisYear = new Date(now.getFullYear(), b.getMonth(), b.getDate());
    const diff = (thisYear - now) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 14;
  });

  qs("#count-15").textContent = noCut15.length;
  qs("#count-30").textContent = noCut30.length;
  qs("#count-bday-14").textContent = bday14.length;
}

// Modal management
function showModal(modalId) {
  qs(modalId).classList.remove("hidden");
}

function hideModal(modalId) {
  qs(modalId).classList.add("hidden");
}

// Client operations
let allClients = [];
let currentClientId = null;

async function refreshAll() {
  try {
    allClients = await fetchClients();
    renderClients(allClients);
    updateDashboard(allClients);
    applyFilters();
  } catch (error) {
    console.error("Error refreshing data:", error);
    alert("Erro ao carregar dados. Tente novamente.");
  }
}

function openClientForm(client = null) {
  currentClientId = client ? client.id : null;
  qs("#modal-client-title").textContent = client
    ? "Editar Cliente"
    : "Novo Cliente";
  qs("#client-id").value = client ? client.id : "";
  qs("#client-name").value = client ? client.name : "";
  qs("#client-phone").value = client ? client.phone : "";
  qs("#client-birthday").value = client ? client.birthday : "";
  qs("#client-lastcut").value = client ? client.lastCut || "" : "";
  showModal("#modal-client");
}

function showClientDetail(client) {
  qs("#detail-name").textContent = client.name;
  qs("#detail-body").innerHTML = `
    <div class="form-group">
      <strong>Telefone:</strong> ${formatPhone(client.phone)}
    </div>
    <div class="form-group">
      <strong>Data de Aniversário:</strong> ${formatDate(client.birthday)}
    </div>
    <div class="form-group">
      <strong>Último Corte:</strong> ${formatDate(client.lastCut)}
    </div>
  `;
  qs("#btn-edit-from-detail").onclick = () => {
    hideModal("#modal-detail");
    openClientForm(client);
  };
  showModal("#modal-detail");
}

// Filters
function applyFilters() {
  const nameFilter = qs("#filter-name").value.toLowerCase();
  const monthFilter = parseInt(qs("#filter-bday-month").value);
  const lastCutFilter = qs("#filter-lastcut").value;

  let filtered = [...allClients];

  // Name filter
  if (nameFilter) {
    filtered = filtered.filter((c) =>
      c.name.toLowerCase().includes(nameFilter)
    );
  }

  // Birthday month filter
  if (monthFilter) {
    filtered = filtered.filter(
      (c) => new Date(c.birthday).getMonth() + 1 === monthFilter
    );
  }

  // Last cut filter
  if (lastCutFilter) {
    const now = new Date();
    filtered = filtered.filter((c) => {
      if (!c.lastCut) return lastCutFilter === ">15" || lastCutFilter === ">30";
      const d = new Date(c.lastCut);
      const diff = (now - d) / (1000 * 60 * 60 * 24);
      if (lastCutFilter === ">15") return diff > 15;
      if (lastCutFilter === ">30") return diff > 30;
      return true;
    });
  }

  renderClients(filtered);
}

// Settings management
async function loadSettings() {
  try {
    const prefs = await fetchPreferences();
    qs("#notify-frequency").value = prefs.notify_frequency || "daily";
    qs("#notify-time").value = prefs.notify_time || "09:00";
    qs("#notify-birthdays").checked = prefs.notify_birthdays === 1;
    qs("#notify-no-cut-15").checked = prefs.notify_no_cut_15 === 1;
    qs("#notify-no-cut-30").checked = prefs.notify_no_cut_30 === 1;
  } catch (error) {
    console.error("Error loading settings:", error);
  }
}

// Service Worker and Push Notifications
async function registerSW() {
  if ("serviceWorker" in navigator) {
    try {
      await navigator.serviceWorker.register("/sw.js");
      console.log("✅ Service Worker registered");
    } catch (e) {
      console.warn("❌ SW registration failed:", e);
    }
  }
}

async function enableNotifications() {
  const perm = await Notification.requestPermission();
  if (perm !== "granted") {
    alert("❌ Permissão negada para notificações");
    return;
  }

  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    alert("❌ Push notifications não suportadas neste navegador");
    return;
  }

  try {
    const reg = await navigator.serviceWorker.ready;
    const vapidRes = await fetch(`${API}/api/vapidPublic`);
    const { publicKey } = await vapidRes.json();

    const subscribeOptions = publicKey
      ? {
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        }
      : { userVisibleOnly: true };

    const subscription = await reg.pushManager.subscribe(subscribeOptions);

    const res = await fetch(`${API}/api/notifications/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscription),
    });

    if (!res.ok) throw new Error("Falha ao registrar subscription");

    alert("✅ Notificações ativadas com sucesso!");
  } catch (error) {
    console.error("Error enabling notifications:", error);
    alert("❌ Erro ao ativar notificações: " + error.message);
  }
}

// Garante que há uma subscription válida (solicita permissão e registra se necessário)
async function ensureSubscribed() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    throw new Error("Push notifications não suportadas neste navegador");
  }

  if (Notification.permission !== "granted") {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") throw new Error("Permissão de notificação negada");
  }

  const reg = await navigator.serviceWorker.ready;
  let subscription = await reg.pushManager.getSubscription();
  if (!subscription) {
    const vapidRes = await fetch(`${API}/api/vapidPublic`);
    const { publicKey } = await vapidRes.json();
    const options = publicKey
      ? {
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        }
      : { userVisibleOnly: true };
    subscription = await reg.pushManager.subscribe(options);
  }

  const res = await fetch(`${API}/api/notifications/subscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription),
  });
  if (!res.ok) throw new Error("Falha ao registrar subscription no servidor");
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Event Listeners
document.addEventListener("DOMContentLoaded", () => {
  // Initialize
  registerSW();
  refreshAll();
  loadSettings();

  // New client button
  qs("#btn-new-client").addEventListener("click", () => openClientForm());

  // Settings button
  qs("#btn-settings").addEventListener("click", () => {
    loadSettings();
    showModal("#modal-settings");
  });

  // Enable notifications button
  qs("#btn-enable-notif").addEventListener("click", enableNotifications);

  // Test notification button
  qs("#btn-test-notification").addEventListener("click", async () => {
    try {
      console.log('🧪 Test notification button clicked');
      await ensureSubscribed();
      console.log('✅ Subscription ensured, sending notification...');
      
      const response = await fetch(`${API}/api/notifications/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "🧪 Teste de Notificação",
          body: "Se você recebeu esta mensagem, as notificações estão funcionando perfeitamente! ✅",
          url: "/",
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Falha ao enviar: ${errorText}`);
      }
      
      const result = await response.json();
      console.log('📊 Send result:', result);
      
      if (result.sent === 0) {
        alert("❌ Notificação enviada mas nenhum dispositivo recebeu.\n\n" +
              "Verifique:\n" +
              "1. Se deu permissão de notificação no navegador\n" +
              "2. O console do navegador (F12) para ver logs\n" +
              "3. O terminal do servidor para ver erros");
      } else if (result.sent < result.total) {
        alert(`⚠️ Notificação enviada para ${result.sent}/${result.total} dispositivos.\n\n` +
              `Alguns dispositivos podem ter subscriptions expiradas.\n` +
              `Verifique o console do servidor para detalhes.`);
      } else {
        alert(`✅ Notificação enviada para ${result.sent} dispositivo(s)!\n\n` +
              `Se não apareceu, verifique:\n` +
              `1. Permissões de notificação do navegador\n` +
              `2. Console do navegador (F12) para logs do Service Worker`);
      }
    } catch (error) {
      console.error("❌ Error sending test notification:", error);
      alert("❌ Erro ao enviar notificação de teste:\n\n" + error.message);
    }
  });

  // Client form submit
  qs("#client-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
      name: formData.get("name"),
      phone: formData.get("phone"),
      birthday: formData.get("birthday"),
      lastCut: formData.get("lastCut") || null,
    };

    if (currentClientId) {
      data.id = currentClientId;
    }

    try {
      await saveClient(data);
      hideModal("#modal-client");
      await refreshAll();
      e.target.reset();
      currentClientId = null;
    } catch (error) {
      alert("Erro ao salvar cliente: " + error.message);
    }
  });

  // Settings form submit
  qs("#settings-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const prefs = {
      notify_frequency: formData.get("notify_frequency"),
      notify_time: formData.get("notify_time"),
      notify_birthdays: formData.get("notify_birthdays") ? 1 : 0,
      notify_no_cut_15: formData.get("notify_no_cut_15") ? 1 : 0,
      notify_no_cut_30: formData.get("notify_no_cut_30") ? 1 : 0,
    };

    try {
      await savePreferences(prefs);
      hideModal("#modal-settings");
      alert("✅ Configurações salvas com sucesso!");
    } catch (error) {
      alert("Erro ao salvar configurações: " + error.message);
    }
  });

  // Client list actions
  qs("#clients-list").addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;

    const action = btn.dataset.action;
    const id = btn.dataset.id;
    const client = allClients.find((c) => String(c.id) === String(id));

    if (!client) return;

    if (action === "view") {
      showClientDetail(client);
    } else if (action === "edit") {
      openClientForm(client);
    } else if (action === "delete") {
      if (confirm(`Confirma exclusão de ${client.name}?`)) {
        try {
          await deleteClient(id);
          await refreshAll();
        } catch (error) {
          alert("Erro ao excluir cliente: " + error.message);
        }
      }
    }
  });

  // Filters
  qs("#filter-name").addEventListener("input", applyFilters);
  qs("#filter-bday-month").addEventListener("change", applyFilters);
  qs("#filter-lastcut").addEventListener("change", applyFilters);

  // Close modal buttons
  qsa(".close-modal").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const modal = e.target.closest(".modal");
      if (modal) hideModal(`#${modal.id}`);
    });
  });

  // Close modal on backdrop click
  qsa(".modal").forEach((modal) => {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        hideModal(`#${modal.id}`);
      }
    });
  });

  // Open client from URL param (for notifications)
  const urlParams = new URLSearchParams(window.location.search);
  const clientId = urlParams.get("client");
  if (clientId) {
    setTimeout(async () => {
      const client = allClients.find((c) => String(c.id) === String(clientId));
      if (client) showClientDetail(client);
    }, 500);
  }
});
