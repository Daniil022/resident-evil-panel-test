// js/razrab/admin-developer.js
// Панель разработчика — только для роли "dev".

import { toast } from "../core/utils.js";
import { getCurrentUser } from "../core/state.js";

let currentTab = "analytics";
let initialized = false;

const TABS = [
  { id: "analytics",    icon: "📊", label: "Аналитика" },
  { id: "firestore",    icon: "📁", label: "Firestore" },
  { id: "mass-ops",     icon: "⚡", label: "Массовые" },
  { id: "test-data",    icon: "🧪", label: "Тестовые" },
  { id: "chat-debug",   icon: "💬", label: "Отладка чата" },
  { id: "session",      icon: "👤", label: "Сессия" },
  { id: "flags",        icon: "🚩", label: "Флаги" },
  { id: "tools",        icon: "🔧", label: "Инструменты" }
];

// ==================== ДОСТУП ====================
export function canAccessDeveloper() {
  const me = getCurrentUser();
  return me && me.role === "dev";
}

export function requireDeveloper() {
  if (!canAccessDeveloper()) {
    toast("Доступ только для разработчика", "warn");
    return false;
  }
  return true;
}

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
export async function initDeveloperPanel() {
  if (!requireDeveloper()) return;

  const container = document.getElementById("devContent");
  if (!container) return;

  renderTabs();

  document.querySelectorAll(".dev-tab").forEach(btn => {
    if (btn.__bound) return;
    btn.__bound = true;
    btn.addEventListener("click", () => {
      switchTab(btn.dataset.devTab);
    });
  });

  if (!initialized) {
    initialized = true;
    console.log("[DEV] Панель разработчика открыта");
  }

  await switchTab(currentTab);
}

function renderTabs() {
  const toolbar = document.querySelector('#developer-tabs');
  if (!toolbar) return;

  toolbar.innerHTML = TABS.map((t, i) =>
    '<button class="btn ' + (t.id === currentTab ? 'dev-tab active' : 'secondary dev-tab') + '" ' +
      'data-dev-tab="' + t.id + '" style="' + (i > 0 ? "margin-left:6px;" : "") + '">' +
      t.icon + ' ' + t.label +
    '</button>'
  ).join("");
}

async function switchTab(tabId) {
  currentTab = tabId;

  document.querySelectorAll(".dev-tab").forEach(btn => {
    if (btn.dataset.devTab === tabId) btn.classList.add("active");
    else btn.classList.remove("active");
  });

  const container = document.getElementById("devContent");
  if (!container) return;

  container.innerHTML = '<div style="text-align:center;color:var(--muted);padding:40px;">Загрузка...</div>';

  try {
    if (tabId === "analytics") {
      const m = await import("./dev-analytics.js");
      await m.renderAnalyticsTab(container);
    } else if (tabId === "firestore") {
      const m = await import("./dev-firestore.js");
      await m.renderFirestoreTab(container);
    } else if (tabId === "mass-ops") {
      const m = await import("./dev-mass-ops.js");
      await m.renderMassOpsTab(container);
    } else if (tabId === "test-data") {
      const m = await import("./dev-test-data.js");
      await m.renderTestDataTab(container);
    } else if (tabId === "chat-debug") {
      const m = await import("./dev-chat-debug.js");
      await m.renderChatDebugTab(container);
    } else if (tabId === "session") {
      const m = await import("./dev-session.js");
      await m.renderSessionTab(container);
    } else if (tabId === "flags") {
      const m = await import("./dev-flags.js");
      await m.renderFlagsTab(container);
    } else if (tabId === "tools") {
      const m = await import("./dev-tools.js");
      await m.renderToolsTab(container);
    } else {
      container.innerHTML = '<div style="color:var(--muted);padding:20px;">Вкладка не найдена</div>';
    }
  } catch (e) {
    console.error("[DEV] Tab error:", e);
    container.innerHTML = '<div style="color:var(--red);padding:20px;">Ошибка: ' + e.message + '</div>';
  }
}

window.__devSwitchTab = switchTab;
