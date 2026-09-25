// js/razrab/dev-flags.js
// Feature Flags — вкл/выкл фичи без деплоя.

import { db } from "../firebase-init.js";
import {
  doc, getDoc, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { toast } from "../core/utils.js";
import { requireDeveloper } from "./admin-developer.js";

const FLAGS_DOC = "config/features";

const DEFAULT_FLAGS = [
  { key: "chat.voice",       desc: "Голосовые сообщения в чате",          enabled: false },
  { key: "chat.polls",       desc: "Опросы в чате",                       enabled: true },
  { key: "chat.files",       desc: "Файлы в чате",                        enabled: true },
  { key: "chat.mentions",    desc: "Упоминания @ник в чате",              enabled: true },
  { key: "chat.reactions",   desc: "Реакции на сообщения",                enabled: true },
  { key: "chat.pin",         desc: "Закреплённые сообщения",              enabled: true },
  { key: "album.upload",     desc: "Загрузка фото в альбом",              enabled: true },
  { key: "album.bulk",       desc: "Массовая загрузка фото",              enabled: true },
  { key: "contracts.media",  desc: "Прикрепление медиа к контрактам",     enabled: true },
  { key: "premiums.give",    desc: "Выдача премий",                       enabled: true },
  { key: "admin.permissions", desc: "Редактор прав ролей/отрядов",        enabled: true },
  { key: "admin.developer",  desc: "Панель разработчика",                 enabled: true }
];

let currentFlags = {};

export async function renderFlagsTab(container) {
  if (!requireDeveloper()) return;

  await loadFlags();

  container.innerHTML =
    '<div class="dev-warning">⚠️ Feature Flags — вкл/выкл фичи в реальном времени. Действуют для всех.</div>' +
    '<div class="dev-card">' +
      '<h4>🚩 Флаги фич</h4>' +
      '<div id="devFlagsList"></div>' +
      '<div style="margin-top:12px;">' +
        '<button class="btn small" onclick="window.__devSaveFlags()">💾 Сохранить</button>' +
        '<button class="btn small secondary" onclick="window.__devResetFlags()" style="margin-left:8px;">↻ Сбросить</button>' +
      '</div>' +
    '</div>';

  renderFlags();
}

async function loadFlags() {
  try {
    const snap = await getDoc(doc(db, "config", "features"));
    if (snap.exists()) {
      currentFlags = snap.data() || {};
    } else {
      currentFlags = {};
    }
  } catch (e) {
    currentFlags = {};
  }

  DEFAULT_FLAGS.forEach(f => {
    if (!(f.key in currentFlags)) currentFlags[f.key] = f.enabled;
  });
}

function renderFlags() {
  const container = document.getElementById("devFlagsList");
  if (!container) return;

  container.innerHTML = DEFAULT_FLAGS.map(f =>
    '<div class="dev-flag">' +
      '<div class="flag-info">' +
        '<div class="flag-name">' + escapeHtml(f.key) + '</div>' +
        '<div class="flag-desc">' + escapeHtml(f.desc) + '</div>' +
      '</div>' +
      '<input type="checkbox" data-flag="' + f.key + '" ' + (currentFlags[f.key] ? "checked" : "") + '>' +
    '</div>'
  ).join("");
}

window.__devSaveFlags = async function() {
  if (!requireDeveloper()) return;

  const newFlags = {};
  document.querySelectorAll("[data-flag]").forEach(cb => {
    newFlags[cb.dataset.flag] = cb.checked;
  });

  try {
    await setDoc(doc(db, "config", "features"), newFlags);
    currentFlags = newFlags;
    toast("Флаги сохранены", "ok");
  } catch (e) {
    toast("Ошибка: " + e.message, "warn");
  }
};

window.__devResetFlags = async function() {
  if (!requireDeveloper()) return;
  if (!confirm("Сбросить все флаги к дефолтным?")) return;

  const defaults = {};
  DEFAULT_FLAGS.forEach(f => { defaults[f.key] = f.enabled; });

  try {
    await setDoc(doc(db, "config", "features"), defaults);
    currentFlags = defaults;
    renderFlags();
    toast("Флаги сброшены", "ok");
  } catch (e) {
    toast("Ошибка: " + e.message, "warn");
  }
};

// ==================== API ====================
let flagCache = null;

export async function isFeatureEnabled(key) {
  if (!flagCache) {
    try {
      const snap = await getDoc(doc(db, "config", "features"));
      flagCache = snap.exists() ? snap.data() : {};
    } catch (e) {
      flagCache = {};
    }
    setTimeout(() => { flagCache = null; }, 5 * 60 * 1000);
  }

  if (key in flagCache) return !!flagCache[key];

  const def = DEFAULT_FLAGS.find(f => f.key === key);
  return def ? def.enabled : true;
}

export function clearFlagsCache() {
  flagCache = null;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
