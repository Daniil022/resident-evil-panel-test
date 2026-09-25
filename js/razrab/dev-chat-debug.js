// js/razrab/dev-chat-debug.js
// Блок 3: отладка чата + симулятор ролей.

import { db } from "../firebase-init.js";
import {
  collection, getDocs, query, orderBy, limit, doc, getDoc, setDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { requireDeveloper } from "./admin-developer.js";
import { toast, openModal, closeModal } from "../core/utils.js";
import { getCurrentUser } from "../core/state.js";

export async function renderChatDebugTab(container) {
  if (!requireDeveloper()) return;

  container.innerHTML =
    '<div class="dev-warning">⚠️ Отладка чата. Работает с реальными данными Firestore.</div>' +
    '<div class="dev-card"><h4>💬 Отладка чата</h4>' +
      '<div class="dev-item"><span class="label">Чат</span>' +
        '<select id="devChatSelect" style="background:var(--bg);border:1px solid var(--border);color:#fff;padding:6px 10px;border-radius:4px;">' +
          '<option value="residents">Резиденты</option>' +
          '<option value="allies">Союзники</option>' +
        '</select>' +
        '<button class="btn small" onclick="window.__devLoadChatDebug()">Загрузить</button>' +
      '</div>' +
    '</div>' +
    '<div id="devChatDebugContent"></div>';

  window.__devLoadChatDebug();
}

window.__devLoadChatDebug = async function() {
  if (!requireDeveloper()) return;

  const chat = document.getElementById("devChatSelect").value;
  const container = document.getElementById("devChatDebugContent");
  if (!container) return;

  container.innerHTML = '<div style="text-align:center;color:var(--muted);padding:20px;">Загрузка...</div>';

  try {
    const q = query(collection(db, "chats", chat, "messages"), orderBy("createdAt", "desc"), limit(300));
    const snap = await getDocs(q);
    const messages = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Статистика
    const total = messages.length;
    const authors = {};
    const types = { text: 0, voice: 0, attachments: 0, poll: 0 };
    let deleted = 0;

    messages.forEach(m => {
      authors[m.authorLogin] = (authors[m.authorLogin] || 0) + 1;
      const t = m.type || "text";
      types[t] = (types[t] || 0) + 1;
    });

    // Пин
    let pin = null;
    try {
      const pinSnap = await getDoc(doc(db, "chats", chat, "meta", "pin"));
      if (pinSnap.exists()) pin = pinSnap.data();
    } catch (e) {}

    let html = '<div class="dev-card"><h4>📊 Статистика чата «' + chat + '»</h4>';
    html += '<div class="dev-item"><span class="label">Всего сообщений (последние 300)</span><span class="value green">' + total + '</span></div>';
    html += '<div class="dev-item"><span class="label">Текстовых</span><span class="value">' + (types.text || 0) + '</span></div>';
    html += '<div class="dev-item"><span class="label">Голосовых</span><span class="value">' + (types.voice || 0) + '</span></div>';
    html += '<div class="dev-item"><span class="label">С файлами</span><span class="value">' + (types.attachments || 0) + '</span></div>';
    html += '<div class="dev-item"><span class="label">Опросов</span><span class="value">' + (types.poll || 0) + '</span></div>';
    html += '</div>';

    // Топ авторов
    const top = Object.entries(authors).sort((a, b) => b[1] - a[1]).slice(0, 10);
    html += '<div class="dev-card"><h4>👥 Топ авторов</h4>';
    top.forEach(([login, count], i) => {
      html += '<div class="dev-item"><span class="label" style="min-width:30px;">' + (i + 1) + '.</span><span class="value green" style="flex:1;">' + escapeHtml(login) + '</span><span class="value" style="flex:0;min-width:60px;text-align:right;">' + count + '</span></div>';
    });
    html += '</div>';

    // Пин
    html += '<div class="dev-card"><h4>📌 Закреплённое сообщение</h4>';
    if (pin) {
      html += '<div class="dev-item"><span class="label">Автор</span><span class="value">' + escapeHtml(pin.author) + '</span></div>';
      html += '<div class="dev-item"><span class="label">Закрепил</span><span class="value">' + escapeHtml(pin.pinnedBy || "—") + '</span></div>';
      html += '<div class="dev-item" style="flex-direction:column;align-items:flex-start;"><span class="label">Текст</span><div style="color:#ccc;font-size:12px;margin-top:4px;">' + escapeHtml(pin.fullText || pin.text || "—") + '</div></div>';
      html += '<div style="margin-top:8px;"><button class="btn small danger" onclick="window.__devUnpinChat(\'' + chat + '\')">🗑 Открепить</button></div>';
    } else {
      html += '<div style="color:var(--muted);padding:12px;">Нет закреплённого сообщения</div>';
    }
    html += '</div>';

    // Последние сообщения
    html += '<div class="dev-card"><h4>📄 Последние 50 сообщений</h4>';
    html += '<div style="max-height:400px;overflow-y:auto;">';
    messages.slice(0, 50).forEach(m => {
      const time = m.createdAt && m.createdAt.toDate ? m.createdAt.toDate().toLocaleString("ru-RU") : "—";
      const typeBadge = m.type === "voice" ? '<span class="dev-badge warn">VOICE</span>'
                      : m.type === "attachments" ? '<span class="dev-badge warn">FILE</span>'
                      : m.type === "poll" ? '<span class="dev-badge warn">POLL</span>'
                      : '';
      html += '<div class="dev-item" style="flex-direction:column;align-items:flex-start;gap:2px;padding:6px 10px;">' +
        '<div style="display:flex;gap:8px;align-items:center;width:100%;">' +
          '<span style="color:#00ff41;font-size:11px;font-weight:700;">' + escapeHtml(m.authorLogin || "—") + '</span>' +
          typeBadge +
          '<span style="color:var(--muted);font-size:10.5px;margin-left:auto;">' + time + '</span>' +
        '</div>' +
        '<div style="color:#ccc;font-size:11.5px;">' + escapeHtml((m.text || "").substring(0, 100)) + '</div>' +
      '</div>';
    });
    html += '</div></div>';

    // Симулятор ролей
    html += '<div class="dev-card"><h4>🎭 Симулятор ролей</h4>';
    html += '<div style="color:var(--muted);font-size:11.5px;margin-bottom:8px;">Посмотреть, что видит другая роль. Только просмотр.</div>';
    html += '<div class="dev-item"><span class="label">Роль</span>' +
      '<select id="devSimRole" style="background:var(--bg);border:1px solid var(--border);color:#fff;padding:6px 10px;border-radius:4px;flex:1;">' +
        '<option value="emperor">Император</option>' +
        '<option value="lord">Лорд Тьмы</option>' +
        '<option value="dev">Разработчик</option>' +
        '<option value="knight">Рыцарь Смерти</option>' +
        '<option value="skeleton">Скелет Ужаса</option>' +
        '<option value="soul">Тёмная душа</option>' +
        '<option value="ally">Союзник</option>' +
      '</select>' +
      '<button class="btn small" onclick="window.__devSimulateRole()">Показать</button>' +
    '</div>';
    html += '<div id="devSimResult" style="margin-top:8px;"></div>';
    html += '</div>';

    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = '<div style="color:var(--red);padding:20px;">Ошибка: ' + e.message + '</div>';
  }
};

window.__devUnpinChat = async function(chat) {
  if (!requireDeveloper()) return;
  if (!confirm("Открепить сообщение в чате " + chat + "?")) return;

  try {
    await deleteDoc(doc(db, "chats", chat, "meta", "pin"));
    toast("Откреплено", "ok");
    window.__devLoadChatDebug();
  } catch (e) {
    toast("Ошибка: " + e.message, "warn");
  }
};

// ==================== #25. СИМУЛЯТОР РОЛЕЙ ====================
window.__devSimulateRole = async function() {
  if (!requireDeveloper()) return;

  const role = document.getElementById("devSimRole").value;
  const result = document.getElementById("devSimResult");
  if (!result) return;

  try {
    const { PERMISSIONS, DEFAULT_ROLE_PERMS } = await import("../core/permissions.js");

    const perms = DEFAULT_ROLE_PERMS[role] || [];
    const isAll = perms === "*";

    let html = '<div style="background:var(--bg-2);padding:12px;border-radius:6px;">';
    html += '<div style="color:var(--muted);font-size:11px;margin-bottom:8px;">РОЛЬ: ' + role.toUpperCase() + '</div>';

    if (isAll) {
      html += '<div class="dev-badge ok">ДОСТУП КО ВСЕМУ</div>';
      html += '<div style="margin-top:8px;font-size:12px;color:#ccc;">Все ' + Object.keys(PERMISSIONS).length + ' прав доступны</div>';
    } else {
      html += '<div style="font-size:12px;color:#ccc;margin-bottom:8px;">Доступно прав: ' + perms.length + ' из ' + Object.keys(PERMISSIONS).length + '</div>';
      html += '<div class="dev-code" style="font-size:11px;max-height:300px;color:#00ff41;">';
      Object.keys(PERMISSIONS).forEach(k => {
        const has = perms.includes(k);
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

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
