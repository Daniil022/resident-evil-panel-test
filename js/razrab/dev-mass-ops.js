// js/razrab/dev-mass-ops.js
// Массовые операции — удалить ботов, сбросить warn, перевести в отряд.

import { db } from "../firebase-init.js";
import {
  collection, getDocs, doc, updateDoc, deleteDoc, writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { toast, openModal, closeModal } from "../core/utils.js";
import { requireDeveloper } from "./admin-developer.js";

export async function renderMassOpsTab(container) {
  if (!requireDeveloper()) return;

  container.innerHTML =
    '<div class="dev-warning">⚠️ Массовые операции. Действуют сразу. Только для опытных.</div>' +

    '<div class="dev-card">' +
      '<h4>🗑 Удалить неактивных</h4>' +
      '<div class="dev-item">' +
        '<span class="label">Не заходили больше</span>' +
        '<input type="number" id="devInactiveDays" value="30" min="1" max="365" style="background:var(--bg);border:1px solid var(--border);color:#fff;padding:6px 10px;border-radius:4px;width:80px;">' +
        '<span style="color:var(--muted);">дней</span>' +
        '<button class="btn danger small" onclick="window.__devDeleteInactive()">Удалить</button>' +
      '</div>' +
    '</div>' +

    '<div class="dev-card">' +
      '<h4>↻ Сбросить Warn всем</h4>' +
      '<div class="dev-item">' +
        '<span class="label">У всех юзеров warn → 0</span>' +
        '<button class="btn danger small" onclick="window.__devResetAllWarns()">Сбросить</button>' +
      '</div>' +
    '</div>' +

    '<div class="dev-card">' +
      '<h4>🎯 Перевести всех в отряд</h4>' +
      '<div class="dev-item">' +
        '<span class="label">Всем установить отряд</span>' +
        '<input type="text" id="devBulkDivision" placeholder="div_id (например guard)" style="background:var(--bg);border:1px solid var(--border);color:#fff;padding:6px 10px;border-radius:4px;flex:1;">' +
        '<button class="btn small" onclick="window.__devBulkDivision()">Применить</button>' +
      '</div>' +
    '</div>' +

    '<div class="dev-card">' +
      '<h4>🎖 Перевести всех в роль</h4>' +
      '<div class="dev-item">' +
        '<span class="label">Всем установить роль</span>' +
        '<input type="text" id="devBulkRole" placeholder="role_id (например soul)" style="background:var(--bg);border:1px solid var(--border);color:#fff;padding:6px 10px;border-radius:4px;flex:1;">' +
        '<button class="btn small" onclick="window.__devBulkRole()">Применить</button>' +
      '</div>' +
    '</div>' +

    '<div class="dev-card">' +
      '<h4>💬 Очистить чат</h4>' +
      '<div class="dev-item">' +
        '<span class="label">Удалить сообщения из чата</span>' +
        '<select id="devChatSelect" style="background:var(--bg);border:1px solid var(--border);color:#fff;padding:6px 10px;border-radius:4px;">' +
          '<option value="residents">Резиденты</option>' +
          '<option value="allies">Союзники</option>' +
        '</select>' +
        '<button class="btn danger small" onclick="window.__devClearChat()">Очистить всё</button>' +
      '</div>' +
    '</div>' +

    '<div class="dev-card">' +
      '<h4>📁 Очистить коллекцию</h4>' +
      '<div class="dev-item">' +
        '<span class="label">Название коллекции</span>' +
        '<input type="text" id="devClearCollection" placeholder="например captas" style="background:var(--bg);border:1px solid var(--border);color:#fff;padding:6px 10px;border-radius:4px;flex:1;">' +
        '<button class="btn danger small" onclick="window.__devClearCollection()">Удалить всё</button>' +
      '</div>' +
    '</div>';
}

window.__devDeleteInactive = async function() {
  if (!requireDeveloper()) return;
  const days = parseInt(document.getElementById("devInactiveDays").value) || 30;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

  if (!confirm("Удалить всех, кто не заходил больше " + days + " дней?")) return;

  try {
    const snap = await getDocs(collection(db, "users"));
    let deleted = 0;

    for (const d of snap.docs) {
      const data = d.data();
      const lastSeen = data.lastSeen || data.createdAt || 0;
      if (lastSeen < cutoff && data.role !== "emperor" && data.role !== "dev") {
        try {
          await deleteDoc(doc(db, "users", d.id));
          deleted++;
        } catch (e) {}
      }
    }

    toast("Удалено: " + deleted, "ok");
  } catch (e) {
    toast("Ошибка: " + e.message, "warn");
  }
};

window.__devResetAllWarns = async function() {
  if (!requireDeveloper()) return;
  if (!confirm("Сбросить warn ВСЕМ пользователям?")) return;

  try {
    const snap = await getDocs(collection(db, "users"));
    const batch = writeBatch(db);
    let count = 0;

    snap.forEach(d => {
      const data = d.data();
      if ((data.warn || 0) > 0 || data.banned) {
        batch.update(d.ref, { warn: 0, banned: false, banReason: "" });
        count++;
      }
    });

    if (count > 0) await batch.commit();
    toast("Сброшено: " + count, "ok");
  } catch (e) {
    toast("Ошибка: " + e.message, "warn");
  }
};

window.__devBulkDivision = async function() {
  if (!requireDeveloper()) return;
  const div = document.getElementById("devBulkDivision").value.trim();
  if (!div) { toast("Введи div_id", "warn"); return; }
  if (!confirm("Перевести всех в отряд «" + div + "»?")) return;

  try {
    const snap = await getDocs(collection(db, "users"));
    const batch = writeBatch(db);
    snap.forEach(d => batch.update(d.ref, { division: div }));
    await batch.commit();
    toast("Обновлено: " + snap.size, "ok");
  } catch (e) {
    toast("Ошибка: " + e.message, "warn");
  }
};

window.__devBulkRole = async function() {
  if (!requireDeveloper()) return;
  const role = document.getElementById("devBulkRole").value.trim();
  if (!role) { toast("Введи role_id", "warn"); return; }
  if (!confirm("Перевести всех в роль «" + role + "»?")) return;

  try {
    const snap = await getDocs(collection(db, "users"));
    const batch = writeBatch(db);
    snap.forEach(d => {
      if (d.data().role !== "emperor" && d.data().role !== "dev") {
        batch.update(d.ref, { role });
      }
    });
    await batch.commit();
    toast("Обновлено", "ok");
  } catch (e) {
    toast("Ошибка: " + e.message, "warn");
  }
};

window.__devClearChat = async function() {
  if (!requireDeveloper()) return;
  const chat = document.getElementById("devChatSelect").value;
  if (!confirm("Удалить ВСЕ сообщения из чата «" + chat + "»?")) return;

  try {
    const snap = await getDocs(collection(db, "chats", chat, "messages"));
    const batch = writeBatch(db);
    snap.forEach(d => batch.delete(d.ref));
    await batch.commit();
    toast("Удалено сообщений: " + snap.size, "ok");
  } catch (e) {
    toast("Ошибка: " + e.message, "warn");
  }
};

window.__devClearCollection = async function() {
  if (!requireDeveloper()) return;
  const col = document.getElementById("devClearCollection").value.trim();
  if (!col) { toast("Введи название", "warn"); return; }
  if (!confirm("УДАЛИТЬ ВСЮ КОЛЛЕКЦИЮ «" + col + "»?\n\nЭто необратимо!")) return;
  if (!confirm("Точно? Второй раз спрашиваю.")) return;

  try {
    const snap = await getDocs(collection(db, col));
    const batch = writeBatch(db);
    snap.forEach(d => batch.delete(d.ref));
    await batch.commit();
    toast("Удалено документов: " + snap.size, "ok");
  } catch (e) {
    toast("Ошибка: " + e.message, "warn");
  }
};
