// js/razrab/dev-flags.js
// Блок 4: feature flags + уведомления + лимиты + расписание + maintenance.

import { db } from "../firebase-init.js";
import {
  doc, getDoc, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { toast } from "../core/utils.js";
import { requireDeveloper } from "./admin-developer.js";

const CONFIG_DOC = "config/system";

// ==================== ДЕФОЛТНЫЕ ЗНАЧЕНИЯ ====================
const DEFAULT_FLAGS = [
  { key: "chat.voice",       desc: "Голосовые в чате",       enabled: false },
  { key: "chat.polls",       desc: "Опросы в чате",          enabled: true },
  { key: "chat.files",       desc: "Файлы в чате",           enabled: true },
  { key: "chat.reactions",   desc: "Реакции",                enabled: true },
  { key: "chat.pin",         desc: "Закреплённые",           enabled: true },
  { key: "album.upload",     desc: "Загрузка фото",          enabled: true },
  { key: "album.bulk",       desc: "Массовая загрузка",      enabled: true },
  { key: "contracts.media",  desc: "Медиа в контрактах",     enabled: true },
  { key: "premiums.give",    desc: "Выдача премий",          enabled: true },
  { key: "admin.permissions", desc: "Редактор прав",         enabled: true },
  { key: "admin.developer",  desc: "Панель разработчика",    enabled: true }
];

const DEFAULT_NOTIF = {
  errors: true,
  consoleLog: true,
  level: "info"
};

const DEFAULT_LIMITS = {
  maxUploadMB: 50,
  maxMessageLength: 2000,
  maxFilesPerMessage: 5
};

const DEFAULT_SCHEDULE = {
  contractsResetHour: 0,
  contractsResetMinute: 0,
  backupIntervalHours: 6,
  autoCleanupDays: 30
};

const DEFAULT_MAINTENANCE = {
  enabled: false,
  message: "Панель обновляется. Вернитесь через 5 минут."
};

// ==================== СОСТОЯНИЕ ====================
let config = {
  flags: {},
  notif: { ...DEFAULT_NOTIF },
  limits: { ...DEFAULT_LIMITS },
  schedule: { ...DEFAULT_SCHEDULE },
  maintenance: { ...DEFAULT_MAINTENANCE }
};

// ==================== РЕНДЕР ====================
export async function renderFlagsTab(container) {
  if (!requireDeveloper()) return;

  await loadConfig();

  container.innerHTML =
    '<div class="dev-warning">⚠️ Настройки системы. Применяются ко всем пользователям.</div>' +
    renderFlagsSection() +
    renderNotifSection() +
    renderLimitsSection() +
    renderScheduleSection() +
    renderMaintenanceSection();
}

async function loadConfig() {
  try {
    const snap = await getDoc(doc(db, "config", "system"));
    if (snap.exists()) {
      const data = snap.data();
      config.flags = data.flags || {};
      config.notif = { ...DEFAULT_NOTIF, ...(data.notif || {}) };
      config.limits = { ...DEFAULT_LIMITS, ...(data.limits || {}) };
      config.schedule = { ...DEFAULT_SCHEDULE, ...(data.schedule || {}) };
      config.maintenance = { ...DEFAULT_MAINTENANCE, ...(data.maintenance || {}) };
    }
  } catch (e) {
    console.warn("Config load failed:", e);
  }

  // Заполняем дефолтами отсутствующие
  DEFAULT_FLAGS.forEach(f => {
    if (!(f.key in config.flags)) config.flags[f.key] = f.enabled;
  });
}

// ==================== #16. FEATURE FLAGS ====================
function renderFlagsSection() {
  let html = '<div class="dev-card"><h4>🚩 Feature Flags</h4>';
  DEFAULT_FLAGS.forEach(f => {
    html += '<div class="dev-flag">' +
      '<div class="flag-info"><div class="flag-name">' + f.key + '</div><div class="flag-desc">' + f.desc + '</div></div>' +
      '<input type="checkbox" data-flag="' + f.key + '" ' + (config.flags[f.key] ? "checked" : "") + '>' +
    '</div>';
  });
  html += '<div style="margin-top:12px;"><button class="btn small" onclick="window.__devSaveConfig()">💾 Сохранить всё</button></div>';
  html += '</div>';
  return html;
}

// ==================== #17. УВЕДОМЛЕНИЯ ====================
function renderNotifSection() {
  return '<div class="dev-card"><h4>🔔 Технические уведомления</h4>' +
    '<div class="dev-flag"><div class="flag-info"><div class="flag-name">errors</div><div class="flag-desc">Показывать тосты об ошибках</div></div>' +
      '<input type="checkbox" data-notif="errors" ' + (config.notif.errors ? "checked" : "") + '></div>' +
    '<div class="dev-flag"><div class="flag-info"><div class="flag-name">consoleLog</div><div class="flag-desc">Логировать в консоль</div></div>' +
      '<input type="checkbox" data-notif="consoleLog" ' + (config.notif.consoleLog ? "checked" : "") + '></div>' +
    '<div class="dev-item"><span class="label">Уровень логирования</span>' +
      '<select id="notifLevel" style="background:var(--bg);border:1px solid var(--border);color:#fff;padding:6px 10px;border-radius:4px;flex:1;">' +
        ['debug','info','warn','error'].map(l => '<option value="' + l + '" ' + (config.notif.level === l ? "selected" : "") + '>' + l + '</option>').join("") +
      '</select>' +
    '</div>' +
    '<div style="margin-top:12px;"><button class="btn small" onclick="window.__devSaveConfig()">💾 Сохранить</button></div>' +
  '</div>';
}

// ==================== #18. ЛИМИТЫ ====================
function renderLimitsSection() {
  return '<div class="dev-card"><h4>📏 Лимиты и квоты</h4>' +
    '<div class="dev-item"><span class="label">Макс. размер загрузки (МБ)</span><input type="number" id="limMaxUpload" value="' + config.limits.maxUploadMB + '" min="1" max="100" style="background:var(--bg);border:1px solid var(--border);color:#fff;padding:6px 10px;border-radius:4px;flex:1;"></div>' +
    '<div class="dev-item"><span class="label">Макс. длина сообщения</span><input type="number" id="limMaxMsg" value="' + config.limits.maxMessageLength + '" min="100" max="10000" style="background:var(--bg);border:1px solid var(--border);color:#fff;padding:6px 10px;border-radius:4px;flex:1;"></div>' +
    '<div class="dev-item"><span class="label">Макс. файлов за раз</span><input type="number" id="limMaxFiles" value="' + config.limits.maxFilesPerMessage + '" min="1" max="20" style="background:var(--bg);border:1px solid var(--border);color:#fff;padding:6px 10px;border-radius:4px;flex:1;"></div>' +
    '<div style="margin-top:12px;"><button class="btn small" onclick="window.__devSaveConfig()">💾 Сохранить</button></div>' +
  '</div>';
}

// ==================== #19. РАСПИСАНИЕ ====================
function renderScheduleSection() {
  return '<div class="dev-card"><h4>⏰ Расписание</h4>' +
    '<div class="dev-item"><span class="label">Сброс контрактов (час:мин)</span>' +
      '<input type="number" id="schResetHour" value="' + config.schedule.contractsResetHour + '" min="0" max="23" style="background:var(--bg);border:1px solid var(--border);color:#fff;padding:6px 10px;border-radius:4px;width:70px;">' +
      '<span style="color:var(--muted);">:</span>' +
      '<input type="number" id="schResetMin" value="' + config.schedule.contractsResetMinute + '" min="0" max="59" style="background:var(--bg);border:1px solid var(--border);color:#fff;padding:6px 10px;border-radius:4px;width:70px;">' +
    '</div>' +
    '<div class="dev-item"><span class="label">Интервал бэкапов (ч)</span><input type="number" id="schBackup" value="' + config.schedule.backupIntervalHours + '" min="1" max="48" style="background:var(--bg);border:1px solid var(--border);color:#fff;padding:6px 10px;border-radius:4px;flex:1;"></div>' +
    '<div class="dev-item"><span class="label">Автоочистка (дней)</span><input type="number" id="schCleanup" value="' + config.schedule.autoCleanupDays + '" min="1" max="365" style="background:var(--bg);border:1px solid var(--border);color:#fff;padding:6px 10px;border-radius:4px;flex:1;"></div>' +
    '<div style="margin-top:12px;"><button class="btn small" onclick="window.__devSaveConfig()">💾 Сохранить</button></div>' +
  '</div>';
}

// ==================== #20. MAINTENANCE MODE ====================
function renderMaintenanceSection() {
  return '<div class="dev-card" style="border-left-color:' + (config.maintenance.enabled ? '#ef4444' : '#00ff41') + ';">' +
    '<h4>🚧 Maintenance Mode</h4>' +
    '<div class="dev-flag"><div class="flag-info"><div class="flag-name">Включить режим</div><div class="flag-desc">Все, кроме emperor, увидят сообщение</div></div>' +
      '<input type="checkbox" data-maintenance="enabled" ' + (config.maintenance.enabled ? "checked" : "") + '></div>' +
    '<div class="dev-item" style="flex-direction:column;align-items:flex-start;gap:4px;">' +
      '<span class="label">Сообщение</span>' +
      '<textarea id="maintenanceMsg" style="width:100%;min-height:60px;background:var(--bg);border:1px solid var(--border);color:#fff;padding:8px;border-radius:4px;font-size:12px;">' + escapeHtml(config.maintenance.message) + '</textarea>' +
    '</div>' +
    '<div style="margin-top:12px;"><button class="btn small" onclick="window.__devSaveConfig()">💾 Сохранить</button></div>' +
  '</div>';
}

// ==================== СОХРАНЕНИЕ ====================
window.__devSaveConfig = async function() {
  if (!requireDeveloper()) return;

  // Флаги
  const newFlags = {};
  document.querySelectorAll("[data-flag]").forEach(cb => {
    newFlags[cb.dataset.flag] = cb.checked;
  });

  // Уведомления
  const newNotif = {
    errors: document.querySelector('[data-notif="errors"]')?.checked ?? true,
    consoleLog: document.querySelector('[data-notif="consoleLog"]')?.checked ?? true,
    level: document.getElementById("notifLevel")?.value || "info"
  };

  // Лимиты
  const newLimits = {
    maxUploadMB: parseInt(document.getElementById("limMaxUpload")?.value) || 50,
    maxMessageLength: parseInt(document.getElementById("limMaxMsg")?.value) || 2000,
    maxFilesPerMessage: parseInt(document.getElementById("limMaxFiles")?.value) || 5
  };

  // Расписание
  const newSchedule = {
    contractsResetHour: parseInt(document.getElementById("schResetHour")?.value) || 0,
    contractsResetMinute: parseInt(document.getElementById("schResetMin")?.value) || 0,
    backupIntervalHours: parseInt(document.getElementById("schBackup")?.value) || 6,
    autoCleanupDays: parseInt(document.getElementById("schCleanup")?.value) || 30
  };

  // Maintenance
  const newMaintenance = {
    enabled: document.querySelector('[data-maintenance="enabled"]')?.checked ?? false,
    message: document.getElementById("maintenanceMsg")?.value || DEFAULT_MAINTENANCE.message
  };

  try {
    await setDoc(doc(db, "config", "system"), {
      flags: newFlags,
      notif: newNotif,
      limits: newLimits,
      schedule: newSchedule,
      maintenance: newMaintenance,
      updatedAt: Date.now()
    });

    config = {
      flags: newFlags,
      notif: newNotif,
      limits: newLimits,
      schedule: newSchedule,
      maintenance: newMaintenance
    };

    toast("Настройки сохранены", "ok");
  } catch (e) {
    toast("Ошибка: " + e.message, "warn");
  }
};

// ==================== API ДЛЯ ДРУГИХ МОДУЛЕЙ ====================
let configCache = null;

export async function getSystemConfig() {
  if (configCache) return configCache;

  try {
    const snap = await getDoc(doc(db, "config", "system"));
    configCache = snap.exists() ? snap.data() : {};
  } catch (e) {
    configCache = {};
  }

  setTimeout(() => { configCache = null; }, 5 * 60 * 1000);
  return configCache;
}

export async function isFeatureEnabled(key) {
  const cfg = await getSystemConfig();
  const flags = cfg.flags || {};
  if (key in flags) return !!flags[key];
  const def = DEFAULT_FLAGS.find(f => f.key === key);
  return def ? def.enabled : true;
}

export function clearConfigCache() {
  configCache = null;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
