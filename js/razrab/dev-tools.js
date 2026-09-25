// js/razrab/dev-tools.js
// Блок 5: Dev Console + API Tester + Webhooks.

import { db } from "../firebase-init.js";
import {
  doc, getDoc, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { requireDeveloper } from "./admin-developer.js";
import { toast } from "../core/utils.js";
import { getCurrentUser } from "../core/state.js";

export async function renderToolsTab(container) {
  if (!requireDeveloper()) return;

  container.innerHTML =
    '<div class="dev-warning">⚠️ Инструменты разработчика. Используй ответственно.</div>' +
    renderDevConsole() +
    renderApiTester() +
    renderWebhook();

  bindActions();
}

// ==================== #21. DEV CONSOLE ====================
function renderDevConsole() {
  return '<div class="dev-card"><h4>💻 Dev Console</h4>' +
    '<div style="color:var(--muted);font-size:11.5px;margin-bottom:8px;">Выполняет JS-код в контексте панели. Например: <code>window.__devGetUsers()</code></div>' +
    '<textarea id="devConsoleInput" placeholder="// Твой JS-код&#10;console.log(1+1)" style="width:100%;min-height:120px;background:#0a0a0a;border:1px solid #1a2a1a;color:#00ff41;padding:10px;border-radius:6px;font-family:Courier New,monospace;font-size:12.5px;"></textarea>' +
    '<div style="margin-top:8px;display:flex;gap:8px;">' +
      '<button class="btn small" id="devConsoleRun">▶ Выполнить</button>' +
      '<button class="btn small secondary" id="devConsoleClear">🗑 Очистить</button>' +
    '</div>' +
    '<div style="color:var(--muted);font-size:11px;margin-top:12px;margin-bottom:6px;">ВЫВОД:</div>' +
    '<div class="dev-code" id="devConsoleOutput" style="min-height:100px;max-height:300px;">// ожидание...</div>' +
  '</div>';
}

function bindActions() {
  const on = (id, fn) => {
    const el = document.getElementById(id);
    if (el && !el.__bound) {
      el.__bound = true;
      el.addEventListener("click", fn);
    }
  };

  on("devConsoleRun", () => window.__devRunConsole());
  on("devConsoleClear", () => {
    const out = document.getElementById("devConsoleOutput");
    if (out) out.textContent = "// очищено";
  });
  on("apiTesterSend", () => window.__devApiTest());
  on("webhookSave", () => window.__devSaveWebhook());
  on("webhookTest", () => window.__devTestWebhook());
}

window.__devRunConsole = function() {
  if (!requireDeveloper()) return;

  const input = document.getElementById("devConsoleInput");
  const output = document.getElementById("devConsoleOutput");
  if (!input || !output) return;

  const code = input.value.trim();
  if (!code) return;

  const logs = [];
  const origLog = console.log;
  const origError = console.error;
  const origWarn = console.warn;

  console.log = (...args) => {
    logs.push("[LOG] " + args.map(a => formatArg(a)).join(" "));
    origLog(...args);
  };
  console.error = (...args) => {
    logs.push("[ERROR] " + args.map(a => formatArg(a)).join(" "));
    origError(...args);
  };
  console.warn = (...args) => {
    logs.push("[WARN] " + args.map(a => formatArg(a)).join(" "));
    origWarn(...args);
  };

  try {
    const result = eval(code);
    if (result !== undefined) {
      logs.push("[RESULT] " + formatArg(result));
    }
  } catch (e) {
    logs.push("[EXCEPTION] " + e.message);
  } finally {
    console.log = origLog;
    console.error = origError;
    console.warn = origWarn;
  }

  output.textContent = logs.length > 0 ? logs.join("\n") : "// нет вывода";
};

function formatArg(a) {
  if (a === null) return "null";
  if (a === undefined) return "undefined";
  if (typeof a === "string") return a;
  if (typeof a === "object") {
    try {
      return JSON.stringify(a, null, 2).substring(0, 500);
    } catch (e) {
      return String(a);
    }
  }
  return String(a);
}

// ==================== #22. API TESTER ====================
function renderApiTester() {
  return '<div class="dev-card"><h4>🌐 API Tester</h4>' +
    '<div class="dev-item"><span class="label">Метод</span>' +
      '<select id="apiTesterMethod" style="background:var(--bg);border:1px solid var(--border);color:#fff;padding:6px 10px;border-radius:4px;width:100px;">' +
        '<option>GET</option><option>POST</option><option>PUT</option><option>DELETE</option>' +
      '</select>' +
    '</div>' +
    '<div class="dev-item"><span class="label">URL</span>' +
      '<input type="text" id="apiTesterUrl" placeholder="/api/upload" value="/api/upload" style="background:var(--bg);border:1px solid var(--border);color:#fff;padding:6px 10px;border-radius:4px;flex:1;">' +
    '</div>' +
    '<div class="dev-item" style="flex-direction:column;align-items:flex-start;gap:4px;">' +
      '<span class="label">Body (JSON, опционально)</span>' +
      '<textarea id="apiTesterBody" placeholder="{}" style="width:100%;min-height:60px;background:#0a0a0a;border:1px solid #1a2a1a;color:#00ff41;padding:8px;border-radius:4px;font-family:Courier New,monospace;font-size:12px;"></textarea>' +
    '</div>' +
    '<div style="margin-top:8px;">' +
      '<button class="btn small" id="apiTesterSend">▶ Отправить</button>' +
    '</div>' +
    '<div style="color:var(--muted);font-size:11px;margin-top:12px;margin-bottom:6px;">ОТВЕТ:</div>' +
    '<div class="dev-code" id="apiTesterOutput" style="min-height:80px;max-height:300px;">// ожидание...</div>' +
  '</div>';
}

window.__devApiTest = async function() {
  if (!requireDeveloper()) return;

  const method = document.getElementById("apiTesterMethod").value;
  const url = document.getElementById("apiTesterUrl").value.trim();
  const bodyText = document.getElementById("apiTesterBody").value.trim();
  const output = document.getElementById("apiTesterOutput");

  if (!url || !output) return;

  output.textContent = "⏱ Отправка...";

  const opts = { method, headers: {} };

  if (bodyText) {
    try {
      JSON.parse(bodyText);
      opts.headers["Content-Type"] = "application/json";
      opts.body = bodyText;
    } catch (e) {
      output.textContent = "❌ Невалидный JSON в body: " + e.message;
      return;
    }
  }

  const start = Date.now();

  try {
    const res = await fetch(url, opts);
    const time = Date.now() - start;
    const text = await res.text();

    let formatted = "Status: " + res.status + " " + res.statusText + "\n";
    formatted += "Time: " + time + " мс\n";
    formatted += "Content-Type: " + (res.headers.get("content-type") || "—") + "\n";
    formatted += "─".repeat(50) + "\n";

    try {
      const json = JSON.parse(text);
      formatted += JSON.stringify(json, null, 2);
    } catch (e) {
      formatted += text;
    }

    output.textContent = formatted;
  } catch (e) {
    output.textContent = "❌ Ошибка за " + (Date.now() - start) + " мс:\n" + e.message;
  }
};

// ==================== #23. WEBHOOK ====================
function renderWebhook() {
  return '<div class="dev-card"><h4>🔗 Webhook / Интеграции</h4>' +
    '<div style="color:var(--muted);font-size:11.5px;margin-bottom:8px;">URL вебхука (Discord/Telegram/Slack). Логи отправляются туда.</div>' +
    '<div class="dev-item"><span class="label">Webhook URL</span>' +
      '<input type="text" id="webhookUrl" placeholder="https://discord.com/api/webhooks/..." style="background:var(--bg);border:1px solid var(--border);color:#fff;padding:6px 10px;border-radius:4px;flex:1;">' +
    '</div>' +
    '<div class="dev-flag"><div class="flag-info"><div class="flag-name">Включить вебхук</div><div class="flag-desc">Отправлять события</div></div>' +
      '<input type="checkbox" id="webhookEnabled"></div>' +
    '<div class="dev-flag"><div class="flag-info"><div class="flag-name">Только критичные</div><div class="flag-desc">Отправлять только ban/delete/warn</div></div>' +
      '<input type="checkbox" id="webhookCritical"></div>' +
    '<div style="margin-top:8px;display:flex;gap:8px;">' +
      '<button class="btn small" id="webhookSave">💾 Сохранить</button>' +
      '<button class="btn small secondary" id="webhookTest">🧪 Тест</button>' +
    '</div>' +
    '<div id="webhookResult" style="margin-top:8px;"></div>' +
  '</div>';
}

window.__devSaveWebhook = async function() {
  if (!requireDeveloper()) return;

  const url = document.getElementById("webhookUrl").value.trim();
  const enabled = document.getElementById("webhookEnabled").checked;
  const critical = document.getElementById("webhookCritical").checked;

  if (enabled && url && !/^https:\/\//.test(url)) {
    toast("URL должен начинаться с https://", "warn");
    return;
  }

  try {
    await setDoc(doc(db, "config", "webhook"), {
      url,
      enabled,
      criticalOnly: critical,
      updatedAt: Date.now()
    }, { merge: true });

    toast("Webhook сохранён", "ok");
  } catch (e) {
    toast("Ошибка: " + e.message, "warn");
  }
};

window.__devTestWebhook = async function() {
  if (!requireDeveloper()) return;

  const url = document.getElementById("webhookUrl").value.trim();
  const result = document.getElementById("webhookResult");

  if (!url) {
    toast("Введи URL вебхука", "warn");
    return;
  }

  result.innerHTML = '<div style="color:var(--muted);">⏱ Отправка теста...</div>';

  const me = getCurrentUser();

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: "🧪 **DEV TEST** — Webhook работает!\n\nОтправитель: " + (me?.login || "—") + "\nВремя: " + new Date().toLocaleString("ru-RU")
      })
    });

    if (res.ok) {
      result.innerHTML = '<div class="dev-badge ok">✅ Webhook работает (' + res.status + ')</div>';
    } else {
      result.innerHTML = '<div class="dev-badge error">❌ Ошибка ' + res.status + ': ' + res.statusText + '</div>';
    }
  } catch (e) {
    result.innerHTML = '<div class="dev-badge error">❌ Ошибка: ' + e.message + '</div>';
  }
};

// ==================== ЗАГРУЗКА URL ПРИ СТАРТЕ ====================
setTimeout(async () => {
  try {
    const snap = await getDoc(doc(db, "config", "webhook"));
    if (snap.exists()) {
      const data = snap.data();
      const urlInput = document.getElementById("webhookUrl");
      const enabledInput = document.getElementById("webhookEnabled");
      const criticalInput = document.getElementById("webhookCritical");
      if (urlInput) urlInput.value = data.url || "";
      if (enabledInput) enabledInput.checked = !!data.enabled;
      if (criticalInput) criticalInput.checked = !!data.criticalOnly;
    }
  } catch (e) {}
}, 300);

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
