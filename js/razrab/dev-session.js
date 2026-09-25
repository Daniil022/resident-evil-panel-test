// js/razrab/dev-session.js
// Текущая сессия + проверка прав + диагностика.

import { getCurrentUser } from "../core/state.js";
import { PERMISSIONS, can } from "../core/permissions.js";
import { getRolePermissionsCache, getDivisionPermissionsCache } from "../core/permissions-cache.js";
import { requireDeveloper } from "./admin-developer.js";

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
    '<div class="dev-card">' +
      '<h4>👤 Текущий юзер</h4>' +
      '<div class="dev-item"><span class="label">UID</span><span class="value">' + escapeHtml(me.uid) + '</span></div>' +
      '<div class="dev-item"><span class="label">Логин</span><span class="value green">' + escapeHtml(me.login) + '</span></div>' +
      '<div class="dev-item"><span class="label">Роль</span><span class="value green">' + escapeHtml(me.role) + '</span></div>' +
      '<div class="dev-item"><span class="label">Отряд</span><span class="value">' + (me.division ? escapeHtml(me.division) : '<span style="color:#666;">—</span>') + '</span></div>' +
      '<div class="dev-item"><span class="label">Аватар</span><span class="value">' + (me.avatar ? '<img src="' + me.avatar + '" style="width:40px;height:40px;border-radius:50%;object-fit:cover;">' : '<span style="color:#666;">нет</span>') + '</span></div>' +
    '</div>' +

    '<div class="dev-card">' +
      '<h4>🔐 Права</h4>' +
      '<div class="dev-item"><span class="label">Всего прав</span><span class="value">' + totalPerms + '</span></div>' +
      '<div class="dev-item"><span class="label">Активных</span><span class="value green">' + enabledPerms + '</span></div>' +
      '<div class="dev-item"><span class="label">Роль permissions</span><span class="value">' + formatPerms(rolePerms) + '</span></div>' +
      '<div class="dev-item"><span class="label">Отряд permissions</span><span class="value">' + formatPerms(divPerms) + '</span></div>' +
      '<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);">' +
        '<div style="color:var(--muted);font-size:11px;margin-bottom:6px;">АКТИВНЫЕ ПРАВА:</div>' +
        '<div class="dev-code" style="font-size:11.5px;">' +
          Object.keys(PERMISSIONS).filter(k => can(k)).map(k => '✓ ' + k).join('\n') +
        '</div>' +
      '</div>' +
    '</div>' +

    '<div class="dev-card">' +
      '<h4>💾 Хранилище браузера</h4>' +
      '<div class="dev-item"><span class="label">localStorage ключей</span><span class="value">' + localStorageKeys + '</span></div>' +
      '<div class="dev-item"><span class="label">localStorage размер</span><span class="value">' + formatBytes(localStorageSize) + '</span></div>' +
      '<div class="dev-item"><span class="label">Размер сессии</span><span class="value">' + sessionSize + '</span></div>' +
      '<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);">' +
        '<div style="color:var(--muted);font-size:11px;margin-bottom:6px;">ВСЕ КЛЮЧИ:</div>' +
        '<div class="dev-code" style="font-size:11.5px;max-height:200px;">' +
          Array.from({ length: localStorage.length }).map((_, i) => {
            const k = localStorage.key(i);
            return '• ' + k;
          }).join('\n') +
        '</div>' +
        '<button class="btn small danger" onclick="window.__devClearLocalStorage()" style="margin-top:8px;">🗑 Очистить всё (кроме сессии)</button>' +
      '</div>' +
    '</div>' +

    '<div class="dev-card">' +
      '<h4>🧪 Проверки</h4>' +
      '<div class="dev-item"><span class="label">Service Worker</span><span class="value">' + (navigator.serviceWorker?.controller ? '<span class="dev-badge ok">АКТИВЕН</span>' : '<span class="dev-badge warn">НЕ АКТИВЕН</span>') + '</span></div>' +
      '<div class="dev-item"><span class="label">Online</span><span class="value">' + (navigator.onLine ? '<span class="dev-badge ok">ONLINE</span>' : '<span class="dev-badge error">OFFLINE</span>') + '</span></div>' +
      '<div class="dev-item"><span class="label">LocalStorage</span><span class="value">' + (localStorage ? '<span class="dev-badge ok">OK</span>' : '<span class="dev-badge error">ERROR</span>') + '</span></div>' +
      '<div class="dev-item"><span class="label">PWA</span><span class="value">' + (window.matchMedia("(display-mode: standalone)").matches ? '<span class="dev-badge ok">PWA</span>' : '<span class="dev-badge warn">БРАУЗЕР</span>') + '</span></div>' +
      '<div class="dev-item"><span class="label">Экран</span><span class="value">' + window.screen.width + '×' + window.screen.height + '</span></div>' +
      '<div class="dev-item"><span class="label">Viewport</span><span class="value">' + window.innerWidth + '×' + window.innerHeight + '</span></div>' +
      '<div class="dev-item"><span class="label">User Agent</span><span class="value" style="font-size:10.5px;">' + escapeHtml(navigator.userAgent.substring(0, 80)) + '…</span></div>' +
    '</div>' +

    '<div class="dev-card">' +
      '<h4>📋 Действия</h4>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
        '<button class="btn small secondary" onclick="window.__devReloadPage()">🔄 Перезагрузить</button>' +
        '<button class="btn small secondary" onclick="window.__devClearCache()">🧹 Очистить кэш SW</button>' +
        '<button class="btn small danger" onclick="window.__devLogout()">🚪 Выйти</button>' +
      '</div>' +
    '</div>';
}

// ==================== ДЕЙСТВИЯ ====================
window.__devClearLocalStorage = function() {
  if (!confirm("Очистить всё localStorage, кроме сессии и настроек звука?")) return;

  const keep = ["re_panel_session", "re_panel_sound_settings"];
  const toRemove = [];

  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!keep.includes(k)) toRemove.push(k);
  }

  toRemove.forEach(k => localStorage.removeItem(k));
  toast("Удалено ключей: " + toRemove.length, "ok");
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
  return String(s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
