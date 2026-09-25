// js/razrab/dev-session.js
// Блок 3: сессия, права, проверки, кэш.

import { getCurrentUser } from "../core/state.js";
import { PERMISSIONS, can, DEFAULT_ROLE_PERMS } from "../core/permissions.js";
import { getRolePermissionsCache, getDivisionPermissionsCache } from "../core/permissions-cache.js";
import { requireDeveloper } from "./admin-developer.js";
import { db } from "../firebase-init.js";
import { collection, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { listUsers } from "../core/auth.js";
import { toast } from "../core/utils.js";

export async function renderSessionTab(container) {
  if (!requireDeveloper()) return;

  const me = getCurrentUser();
  if (!me) {
    container.innerHTML = '<div style="color:var(--red);">Не залогинен</div>';
    return;
  }

  const sessionRaw = localStorage.getItem("re_panel_session") || "—";
  let sessionSize = "—";
  try {
    sessionSize = (new Blob([sessionRaw]).size) + " байт";
  } catch (e) {}

  const localStorageKeys = Object.keys(localStorage).length;
  let localStorageSize = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    const v = localStorage.getItem(k) || "";
    localStorageSize += k.length + v.length;
  }

  const rolePerms = getRolePermissionsCache(me.role);
  const divPerms = me.division ? getDivisionPermissionsCache(me.division) : null;

  const totalPerms = Object.keys(PERMISSIONS).length;
  const enabledPerms = Object.keys(PERMISSIONS).filter(k => can(k)).length;

  container.innerHTML =
    '<div class="dev-card"><h4>👤 Текущий юзер</h4>' +
      '<div class="dev-item"><span class="label">UID</span><span class="value">' + escapeHtml(me.uid) + '</span></div>' +
      '<div class="dev-item"><span class="label">Логин</span><span class="value green">' + escapeHtml(me.login) + '</span></div>' +
      '<div class="dev-item"><span class="label">Роль</span><span class="value green">' + escapeHtml(me.role) + '</span></div>' +
      '<div class="dev-item"><span class="label">Отряд</span><span class="value">' + (me.division ? escapeHtml(me.division) : '<span style="color:#666;">—</span>') + '</span></div>' +
      '<div class="dev-item"><span class="label">Аватар</span><span class="value">' + (me.avatar ? '<img src="' + me.avatar + '" style="width:40px;height:40px;border-radius:50%;object-fit:cover;">' : '<span style="color:#666;">нет</span>') + '</span></div>' +
    '</div>' +

    '<div class="dev-card"><h4>🔐 Права</h4>' +
      '<div class="dev-item"><span class="label">Всего прав</span><span class="value">' + totalPerms + '</span></div>' +
      '<div class="dev-item"><span class="label">Активных</span><span class="value green">' + enabledPerms + '</span></div>' +
      '<div class="dev-item"><span class="label">Роль permissions</span><span class="value">' + formatPerms(rolePerms) + '</span></div>' +
      '<div class="dev-item"><span class="label">Отряд permissions</span><span class="value">' + formatPerms(divPerms) + '</span></div>' +
      '<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);">' +
        '<div style="color:var(--muted);font-size:11px;margin-bottom:6px;">АКТИВНЫЕ ПРАВА:</div>' +
        '<div class="dev-code" style="font-size:11.5px;">' + Object.keys(PERMISSIONS).filter(k => can(k)).map(k => '✓ ' + k).join('\n') + '</div>' +
      '</div>' +
    '</div>' +

    '<div class="dev-card"><h4>🔍 Проверка прав другого юзера</h4>' +
      '<div class="dev-item"><span class="label">Выбрать юзера</span><select id="devCheckUser" style="background:var(--bg);border:1px solid var(--border);color:#fff;padding:6px 10px;border-radius:4px;flex:1;"><option value="">— загрузка —</option></select><button class="btn small" onclick="window.__devCheckUserPerms()">Проверить</button></div>' +
      '<div id="devCheckResult" style="margin-top:8px;"></div>' +
    '</div>' +

    '<div class="dev-card"><h4>💾 Хранилище</h4>' +
      '<div class="dev-item"><span class="label">localStorage ключей</span><span class="value">' + localStorageKeys + '</span></div>' +
      '<div class="dev-item"><span class="label">localStorage размер</span><span class="value">' + formatBytes(localStorageSize) + '</span></div>' +
      '<div class="dev-item"><span class="label">Размер сессии</span><span class="value">' + sessionSize + '</span></div>' +
      '<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);">' +
        '<div style="color:var(--muted);font-size:11px;margin-bottom:6px;">ВСЕ КЛЮЧИ:</div>' +
        '<div class="dev-code" style="font-size:11.5px;max-height:200px;">' + Array.from({ length: localStorage.length }).map((_, i) => '• ' + localStorage.key(i)).join('\n') + '</div>' +
        '<button class="btn small danger" onclick="window.__devClearLocalStorage()" style="margin-top:8px;">🗑 Очистить всё (кроме сессии)</button>' +
      '</div>' +
    '</div>' +

    '<div class="dev-card"><h4>🧪 Проверки функций</h4>' +
      '<div class="dev-item"><span class="label">Service Worker</span><span class="value">' + (navigator.serviceWorker?.controller ? '<span class="dev-badge ok">АКТИВЕН</span>' : '<span class="dev-badge warn">НЕ АКТИВЕН</span>') + '</span></div>' +
      '<div class="dev-item"><span class="label">Online</span><span class="value">' + (navigator.onLine ? '<span class="dev-badge ok">ONLINE</span>' : '<span class="dev-badge error">OFFLINE</span>') + '</span></div>' +
      '<div class="dev-item"><span class="label">PWA</span><span class="value">' + (window.matchMedia("(display-mode: standalone)").matches ? '<span class="dev-badge ok">PWA</span>' : '<span class="dev-badge warn">БРАУЗЕР</span>') + '</span></div>' +
      '<div class="dev-item"><span class="label">Экран</span><span class="value">' + window.screen.width + '×' + window.screen.height + '</span></div>' +
      '<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);">' +
        '<button class="btn small" onclick="window.__devPingAll()">🔬 Проверить всё</button>' +
      '</div>' +
      '<div id="devPingAllResult" style="margin-top:8px;"></div>' +
    '</div>' +

    '<div class="dev-card"><h4>📋 Действия</h4>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
        '<button class="btn small secondary" onclick="window.__devReloadPage()">🔄 Перезагрузить</button>' +
        '<button class="btn small secondary" onclick="window.__devClearCache()">🧹 Очистить кэш SW</button>' +
        '<button class="btn small secondary" onclick="window.__devClearMemoryCache()">🧠 Очистить кэш в памяти</button>' +
        '<button class="btn small danger" onclick="window.__devLogout()">🚪 Выйти</button>' +
      '</div>' +
    '</div>';

  // Заполняем список юзеров
  loadUserList();
}

async function loadUserList() {
  const select = document.getElementById("devCheckUser");
  if (!select) return;

  try {
    const users = await listUsers(true);
    select.innerHTML = '<option value="">— выбери —</option>' +
      users.map(u => '<option value="' + u.uid + '">' + escapeHtml(u.login) + ' (' + u.role + ')</option>').join("");
  } catch (e) {}
}

// ==================== #13. ПРОВЕРКА ПРАВ ЮЗЕРА ====================
window.__devCheckUserPerms = async function() {
  if (!requireDeveloper()) return;

  const uid = document.getElementById("devCheckUser").value;
  const result = document.getElementById("devCheckResult");
  if (!uid || !result) return;

  try {
    const users = await listUsers(true);
    const user = users.find(u => u.uid === uid);
    if (!user) {
      result.innerHTML = '<div style="color:var(--red);">Юзер не найден</div>';
      return;
    }

    const rolePerms = DEFAULT_ROLE_PERMS[user.role] || [];
    const isAll = rolePerms === "*";

    let html = '<div style="background:var(--bg-2);padding:12px;border-radius:6px;">';
    html += '<div style="color:var(--muted);font-size:11px;margin-bottom:8px;">ЮЗЕР: ' + escapeHtml(user.login) + ' (' + user.role + ')</div>';

    if (isAll) {
      html += '<div class="dev-badge ok">ДОСТУП КО ВСЕМУ</div>';
    } else {
      html += '<div style="font-size:12px;color:#ccc;margin-bottom:8px;">Прав: ' + rolePerms.length + ' из ' + Object.keys(PERMISSIONS).length + '</div>';
      html += '<div class="dev-code" style="font-size:11px;max-height:300px;color:#00ff41;">';
      Object.keys(PERMISSIONS).forEach(k => {
        const has = rolePerms.includes(k);
        html += (has ? '✓ ' : '✗ ') + k + '\n';
      });
      html += '</div>';
    }
    html += '</div>';
    result.innerHTML = html;
  } catch (e) {
    result.innerHTML = '<div style="color:var(--red);">Ошибка: ' + e.message + '</div>';
  }
};

// ==================== #14. ПРОВЕРКИ ФУНКЦИЙ ====================
window.__devPingAll = async function() {
  if (!requireDeveloper()) return;

  const result = document.getElementById("devPingAllResult");
  if (!result) return;

  result.innerHTML = '<div style="color:var(--muted);">⏱ Проверка...</div>';

  const checks = [];

  // Firestore
  let t0 = Date.now();
  try {
    await getDocs(collection(db, "users"));
    checks.push({ name: "Firestore", ok: true, time: Date.now() - t0 });
  } catch (e) {
    checks.push({ name: "Firestore", ok: false, time: Date.now() - t0, error: e.message });
  }

  // VK API (проверим через api/upload)
  t0 = Date.now();
  try {
    const res = await fetch("/api/upload", { method: "OPTIONS" });
    checks.push({ name: "VK API", ok: res.ok, time: Date.now() - t0, status: res.status });
  } catch (e) {
    checks.push({ name: "VK API", ok: false, time: Date.now() - t0, error: e.message });
  }

  // Service Worker
  const sw = navigator.serviceWorker?.controller;
  checks.push({ name: "Service Worker", ok: !!sw, info: sw ? "активен" : "не активен" });

  // Online
  checks.push({ name: "Internet", ok: navigator.onLine, info: navigator.onLine ? "online" : "offline" });

  // LocalStorage
  try {
    localStorage.setItem("__dev_test", "1");
    localStorage.removeItem("__dev_test");
    checks.push({ name: "LocalStorage", ok: true });
  } catch (e) {
    checks.push({ name: "LocalStorage", ok: false, error: e.message });
  }

  let html = '';
  checks.forEach(c => {
    const icon = c.ok ? '✅' : '❌';
    const time = c.time ? ' (' + c.time + ' мс)' : '';
    const info = c.info ? ' — ' + c.info : '';
    const error = c.error ? ' — ' + c.error : '';
    html += '<div class="dev-item">' +
      '<span style="min-width:20px;">' + icon + '</span>' +
      '<span class="value" style="flex:1;">' + c.name + time + info + error + '</span>' +
    '</div>';
  });

  result.innerHTML = html;
};

// ==================== #15. КЭШ ====================
window.__devClearLocalStorage = function() {
  if (!confirm("Очистить всё localStorage, кроме сессии и звука?")) return;

  const keep = ["re_panel_session", "re_panel_sound_settings"];
  const toRemove = [];

  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!keep.includes(k)) toRemove.push(k);
  }

  toRemove.forEach(k => localStorage.removeItem(k));
  toast("Удалено ключей: " + toRemove.length, "ok");
};

window.__devClearMemoryCache = async function() {
  if (!confirm("Очистить кэш в памяти (роли, отделы, юзеры)?")) return;

  try {
    const { cacheInvalidate } = await import("../core/cache.js");
    cacheInvalidate();
    toast("Кэш в памяти очищен", "ok");
  } catch (e) {
    toast("Ошибка: " + e.message, "warn");
  }
};

window.__devReloadPage = function() {
  window.location.reload();
};

window.__devClearCache = async function() {
  if (!confirm("Очистить весь кэш Service Worker?")) return;

  try {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
    toast("Кэш SW очищен (" + keys.length + "). Перезагрузи страницу.", "ok");
  } catch (e) {
    toast("Ошибка: " + e.message, "warn");
  }
};

window.__devLogout = function() {
  if (!confirm("Выйти?")) return;
  window.logout();
};

// ==================== ХЕЛПЕРЫ ====================
function formatPerms(perms) {
  if (perms === "*") return '<span class="dev-badge ok">ВСЕ</span>';
  if (Array.isArray(perms)) return '<span class="dev-badge warn">' + perms.length + ' шт.</span>';
  if (perms === null || perms === undefined) return '<span class="dev-badge warn">дефолт</span>';
  return '<span style="color:var(--muted);">—</span>';
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + " Б";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " КБ";
  return (bytes / (1024 * 1024)).toFixed(2) + " МБ";
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
