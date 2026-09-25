// js/razrab/dev-analytics.js
// Блок 1: аналитика и мониторинг.

import { db } from "../firebase-init.js";
import {
  collection, getDocs, query, orderBy, limit
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { requireDeveloper } from "./admin-developer.js";
import { toast } from "../core/utils.js";

const COLLECTIONS = [
  "users", "roles", "divisions",
  "contracts", "albums", "album_photos",
  "music", "music_albums",
  "allies", "rules", "captas", "accolades", "premiums",
  "registration_requests", "applications", "applications_nicks",
  "admin_logs", "dash_events"
];

export async function renderAnalyticsTab(container) {
  if (!requireDeveloper()) return;

  container.innerHTML =
    '<div class="dev-warning">⚠️ Данные из Firestore. Займёт несколько секунд.</div>' +
    '<div id="analyticsContent"><div style="text-align:center;color:var(--muted);padding:40px;">Загрузка...</div></div>';

  await loadAnalytics();
}

async function loadAnalytics() {
  const container = document.getElementById("analyticsContent");
  if (!container) return;

  try {
    const data = await gatherData();
    container.innerHTML =
      renderActivityStats(data) +
      renderOnlineStats(data) +
      renderDatabaseSize(data) +
      renderErrors(data);
  } catch (e) {
    container.innerHTML = '<div style="color:var(--red);padding:20px;">Ошибка: ' + e.message + '</div>';
  }
}

async function gatherData() {
  const result = {
    users: [],
    chats: { residents: [], allies: [] },
    collections: {},
    contracts: [],
    messagesCount: 0,
    onlineNow: 0,
    presence: [],
    adminLogs: [],
    totalDocs: 0
  };

  try {
    const snap = await getDocs(collection(db, "users"));
    result.users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {}

  try {
    const snap = await getDocs(collection(db, "contracts"));
    result.contracts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {}

  try {
    const snap = await getDocs(collection(db, "presence"));
    result.presence = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    result.onlineNow = result.presence.filter(p => p.online).length;
  } catch (e) {}

  for (const chatId of ["residents", "allies"]) {
    try {
      const q = query(collection(db, "chats", chatId, "messages"), orderBy("createdAt", "desc"), limit(500));
      const snap = await getDocs(q);
      result.chats[chatId] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      result.messagesCount += snap.size;
    } catch (e) {}
  }

  try {
    const q = query(collection(db, "admin_logs"), orderBy("at", "desc"), limit(200));
    const snap = await getDocs(q);
    result.adminLogs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {}

  for (const col of COLLECTIONS) {
    try {
      const snap = await getDocs(collection(db, col));
      result.collections[col] = snap.size;
      result.totalDocs += snap.size;
    } catch (e) {
      result.collections[col] = -1;
    }
  }

  return result;
}

function renderActivityStats(data) {
  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;
  const allMessages = [...data.chats.residents, ...data.chats.allies];

  const hours = Array(24).fill(0);
  allMessages.forEach(m => {
    const t = m.createdAt && m.createdAt.toDate ? m.createdAt.toDate().getTime() : 0;
    if (t >= dayAgo) {
      const hour = new Date(t).getHours();
      hours[hour]++;
    }
  });

  const maxHour = Math.max(...hours, 1);

  const authorCount = {};
  allMessages.forEach(m => {
    const login = m.authorLogin || "—";
    authorCount[login] = (authorCount[login] || 0) + 1;
  });
  const topAuthors = Object.entries(authorCount).sort((a, b) => b[1] - a[1]).slice(0, 10);

  const topContracts = [...data.users].sort((a, b) => (b.contracts || 0) - (a.contracts || 0)).slice(0, 10);

  let html = '<div class="dev-card"><h4>📊 Статистика активности</h4>';

  html += '<div style="margin-bottom:16px;">';
  html += '<div style="color:var(--muted);font-size:11.5px;margin-bottom:8px;">СООБЩЕНИЯ ПО ЧАСАМ (24ч):</div>';
  html += '<div style="display:flex;align-items:flex-end;gap:2px;height:80px;background:var(--bg-2);padding:8px;border-radius:6px;">';
  hours.forEach((count, h) => {
    const height = count > 0 ? Math.max(2, (count / maxHour) * 100) : 1;
    const isCurrentHour = new Date().getHours() === h;
    html += '<div style="flex:1;display:flex;flex-direction:column;align-items:center;" title="' + h + ':00 — ' + count + '">' +
      '<div style="width:100%;height:' + height + '%;background:' + (isCurrentHour ? '#00ff41' : 'rgba(0,255,65,0.4)') + ';border-radius:2px 2px 0 0;min-height:2px;"></div>' +
    '</div>';
  });
  html += '</div>';
  html += '<div style="display:flex;justify-content:space-between;font-size:10px;color:var(--muted);margin-top:4px;padding:0 8px;"><span>00</span><span>06</span><span>12</span><span>18</span><span>23</span></div>';
  html += '</div>';

  const last24h = allMessages.filter(m => {
    const t = m.createdAt && m.createdAt.toDate ? m.createdAt.toDate().getTime() : 0;
    return t >= dayAgo;
  }).length;

  html += '<div class="dev-item"><span class="label">Сообщений за 24ч</span><span class="value green">' + last24h + '</span></div>';
  html += '<div class="dev-item"><span class="label">Всего сообщений</span><span class="value">' + data.messagesCount + '</span></div>';
  html += '</div>';

  html += '<div class="dev-card"><h4>💬 Топ-10 по сообщениям</h4>';
  if (topAuthors.length === 0) html += '<div style="color:var(--muted);padding:12px;">Нет данных</div>';
  else topAuthors.forEach(([login, count], i) => {
    const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : (i + 1) + ".";
    html += '<div class="dev-item"><span class="label" style="min-width:30px;">' + medal + '</span><span class="value green" style="flex:1;">' + escapeHtml(login) + '</span><span class="value" style="flex:0;min-width:60px;text-align:right;">' + count + '</span></div>';
  });
  html += '</div>';

  html += '<div class="dev-card"><h4>📜 Топ-10 по контрактам</h4>';
  if (topContracts.length === 0) html += '<div style="color:var(--muted);padding:12px;">Нет данных</div>';
  else topContracts.forEach((u, i) => {
    const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : (i + 1) + ".";
    html += '<div class="dev-item"><span class="label" style="min-width:30px;">' + medal + '</span><span class="value green" style="flex:1;">' + escapeHtml(u.login) + '</span><span class="value" style="flex:0;min-width:60px;text-align:right;">' + (u.contracts || 0) + '</span></div>';
  });
  html += '</div>';

  return html;
}

function renderOnlineStats(data) {
  const onlineUsers = data.presence.filter(p => p.online);

  let html = '<div class="dev-card"><h4>🟢 Онлайн <span class="dev-badge ok">' + data.onlineNow + '</span></h4>';
  html += '<div class="dev-item"><span class="label">Всего онлайн</span><span class="value green">' + data.onlineNow + '</span></div>';
  html += '<div class="dev-item"><span class="label">Всего в presence</span><span class="value">' + data.presence.length + '</span></div>';

  const percent = data.users.length > 0 ? Math.round((data.onlineNow / data.users.length) * 100) : 0;
  html += '<div class="dev-item"><span class="label">% от юзеров</span><span class="value">' + percent + '%</span></div>';

  if (onlineUsers.length > 0) {
    html += '<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);">';
    html += '<div style="color:var(--muted);font-size:11px;margin-bottom:8px;">СЕЙЧАС В СЕТИ:</div>';
    onlineUsers.forEach(u => {
      const lastSeen = u.lastSeen ? new Date(u.lastSeen).toLocaleTimeString("ru-RU") : "—";
      html += '<div class="dev-item" style="padding:4px 10px;"><span class="value green" style="flex:1;">' + escapeHtml(u.login || "—") + '</span><span style="color:var(--muted);font-size:11px;">' + lastSeen + '</span></div>';
    });
    html += '</div>';
  }

  html += '</div>';
  return html;
}

function renderDatabaseSize(data) {
  const sorted = Object.entries(data.collections).filter(([_, c]) => c >= 0).sort((a, b) => b[1] - a[1]);

  let html = '<div class="dev-card"><h4>💾 Размер БД</h4>';
  html += '<div class="dev-item"><span class="label">Всего документов</span><span class="value green">' + data.totalDocs + '</span></div>';
  html += '<div class="dev-item"><span class="label">Всего коллекций</span><span class="value">' + sorted.length + '</span></div>';

  const maxCount = Math.max(...sorted.map(([_, c]) => c), 1);
  html += '<div style="margin-top:12px;">';
  sorted.forEach(([col, count]) => {
    const percent = Math.round((count / maxCount) * 100);
    html += '<div style="margin-bottom:8px;">' +
      '<div style="display:flex;justify-content:space-between;font-size:11.5px;margin-bottom:3px;">' +
        '<span style="color:#fff;font-family:Courier New,monospace;">' + col + '</span>' +
        '<span style="color:#00ff41;font-weight:700;">' + count + '</span>' +
      '</div>' +
      '<div style="height:6px;background:var(--bg-2);border-radius:3px;overflow:hidden;">' +
        '<div style="height:100%;width:' + percent + '%;background:linear-gradient(90deg,#00ff41,#00c8d4);border-radius:3px;"></div>' +
      '</div>' +
    '</div>';
  });
  html += '</div></div>';

  return html;
}

function renderErrors(data) {
  const errors = data.adminLogs.filter(l => l.type === "delete" || l.type === "warn" || l.type === "ban").slice(0, 20);

  let html = '<div class="dev-card"><h4>⚠️ Последние критичные действия</h4>';
  if (errors.length === 0) {
    html += '<div style="color:var(--muted);padding:12px;">Нет данных</div>';
  } else {
    errors.forEach(l => {
      const time = l.at ? new Date(l.at).toLocaleString("ru-RU") : "—";
      html += '<div class="dev-item" style="flex-direction:column;align-items:flex-start;gap:4px;">' +
        '<div style="display:flex;gap:8px;align-items:center;width:100%;">' +
          '<span class="dev-badge ' + (l.type === "ban" || l.type === "delete" ? "error" : "warn") + '">' + (l.type || "—") + '</span>' +
          '<span style="color:var(--muted);font-size:11px;margin-left:auto;">' + time + '</span>' +
        '</div>' +
        '<div style="color:#ccc;font-size:12px;">' + escapeHtml(l.message || "—") + '</div>' +
        '<div style="color:var(--muted);font-size:11px;">Автор: ' + escapeHtml(l.by || "—") + '</div>' +
      '</div>';
    });
  }
  html += '</div>';

  html += '<div class="dev-card"><h4>🔧 Проверки</h4>';
  html += '<div class="dev-item"><span class="label">Проверка соединения</span><button class="btn small" onclick="window.__devPingFirestore()">🌐 Ping Firestore</button></div>';
  html += '<div id="devPingResult" style="margin-top:8px;"></div>';
  html += '</div>';

  return html;
}

window.__devPingFirestore = async function() {
  const result = document.getElementById("devPingResult");
  if (!result) return;

  result.innerHTML = '<div style="color:var(--muted);">⏱ Проверка...</div>';

  const start = Date.now();
  try {
    await getDocs(collection(db, "users"));
    const time = Date.now() - start;
    result.innerHTML = '<div class="dev-badge ok">✅ Firestore отвечает за ' + time + ' мс</div>';
  } catch (e) {
    const time = Date.now() - start;
    result.innerHTML = '<div class="dev-badge error">❌ Ошибка за ' + time + ' мс: ' + e.message + '</div>';
  }
};

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
