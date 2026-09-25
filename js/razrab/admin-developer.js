// js/razrab/admin-developer.js
// Панель разработчика — только для роли "dev".

import { toast } from "../core/utils.js";
import { getCurrentUser } from "../core/state.js";

let currentTab = "firestore";
let initialized = false;

// ==================== ПРОВЕРКА ДОСТУПА ====================
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
    if (tabId === "firestore") {
      const { renderFirestoreTab } = await import("./dev-firestore.js");
      await renderFirestoreTab(container);
    } else if (tabId === "mass-ops") {
      const { renderMassOpsTab } = await import("./dev-mass-ops.js");
      await renderMassOpsTab(container);
    } else if (tabId === "test-data") {
      const { renderTestDataTab } = await import("./dev-test-data.js");
      await renderTestDataTab(container);
    } else if (tabId === "flags") {
      const { renderFlagsTab } = await import("./dev-flags.js");
      await renderFlagsTab(container);
    } else if (tabId === "session") {
      const { renderSessionTab } = await import("./dev-session.js");
      await renderSessionTab(container);
    } else {
      container.innerHTML = '<div style="color:var(--muted);padding:20px;">Вкладка не найдена</div>';
    }
  } catch (e) {
    console.error("[DEV] Tab error:", e);
    container.innerHTML = '<div style="color:var(--red);padding:20px;">Ошибка: ' + e.message + '</div>';
  }
}

window.__devSwitchTab = switchTab;
