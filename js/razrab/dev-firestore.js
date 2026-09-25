// js/razrab/dev-firestore.js
// Блок 2: Firestore Inspector + редактор + импорт/экспорт + редактор структуры.

import { db } from "../firebase-init.js";
import {
  collection, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc, writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { toast, openModal, closeModal } from "../core/utils.js";
import { requireDeveloper } from "./admin-developer.js";

const COLLECTIONS = [
  "users", "roles", "divisions",
  "contracts", "albums", "album_photos",
  "music", "music_albums",
  "allies", "rules", "captas", "accolades", "premiums",
  "registration_requests", "applications", "applications_nicks",
  "admin_logs", "dash_events"
];

let currentCollection = null;
let currentDocs = [];

export async function renderFirestoreTab(container) {
  if (!requireDeveloper()) return;

  container.innerHTML =
    '<div class="dev-warning">⚠️ Редактирование Firestore напрямую. Только для опытных.</div>' +
    '<div class="users-toolbar-row" style="margin-bottom:12px;">' +
      '<button class="btn small" id="devExportCol">📥 Экспорт коллекции</button>' +
      '<button class="btn small secondary" id="devImportCol">📤 Импорт в коллекцию</button>' +
      '<button class="btn small secondary" id="devRenameField">✏️ Переименовать поле</button>' +
      '<button class="btn small danger" id="devDeleteField">🗑 Удалить поле</button>' +
    '</div>' +
    '<div class="dev-card"><h4>📁 Коллекции</h4><div id="devCollectionsList"><div style="text-align:center;color:var(--muted);padding:20px;">Загрузка...</div></div></div>' +
    '<div id="devDocsList"></div>';

  await loadCollections();
  bindActions();
}

function bindActions() {
  const on = (id, fn) => {
    const el = document.getElementById(id);
    if (el && !el.__bound) {
      el.__bound = true;
      el.addEventListener("click", fn);
    }
  };

  on("devExportCol", () => window.__devExportCollection());
  on("devImportCol", () => window.__devImportCollection());
  on("devRenameField", () => window.__devRenameField());
  on("devDeleteField", () => window.__devDeleteField());
}

async function loadCollections() {
  const container = document.getElementById("devCollectionsList");
  if (!container) return;

  try {
    const counts = await Promise.all(
      COLLECTIONS.map(async (col) => {
        try {
          const snap = await getDocs(collection(db, col));
          return { name: col, count: snap.size };
        } catch (e) {
          return { name: col, count: -1 };
        }
      })
    );

    container.innerHTML = counts.map(c =>
      '<div class="dev-collection" onclick="window.__devOpenCollection(\'' + c.name + '\')">' +
        '<span class="name">' + c.name + '</span>' +
        '<span class="count">' + (c.count === -1 ? 'ERROR' : c.count + ' док.') + '</span>' +
      '</div>'
    ).join("");
  } catch (e) {
    container.innerHTML = '<div style="color:var(--red);padding:20px;">Ошибка: ' + e.message + '</div>';
  }
}

window.__devOpenCollection = async function(colName) {
  if (!requireDeveloper()) return;

  currentCollection = colName;
  const docsContainer = document.getElementById("devDocsList");
  if (!docsContainer) return;

  docsContainer.innerHTML = '<div class="dev-card"><h4>📄 ' + colName + '</h4><div style="text-align:center;color:var(--muted);padding:20px;">Загрузка...</div></div>';

  try {
    const snap = await getDocs(collection(db, colName));
    currentDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (currentDocs.length === 0) {
      docsContainer.innerHTML = '<div class="dev-card"><h4>📄 ' + colName + '</h4><div style="color:var(--muted);padding:20px;">Коллекция пуста</div></div>';
      return;
    }

    docsContainer.innerHTML =
      '<div class="dev-card">' +
        '<h4>📄 ' + colName + ' <span class="dev-badge ok">' + currentDocs.length + '</span></h4>' +
        '<div style="max-height:500px;overflow-y:auto;">' +
          currentDocs.map(d => {
            const preview = JSON.stringify(d).substring(0, 80);
            return '<div class="dev-item" style="cursor:pointer;" onclick="window.__devOpenDoc(\'' + colName + '\',\'' + d.id + '\')">' +
              '<span class="value" style="min-width:200px;color:#00ff41;">' + escapeHtml(d.id) + '</span>' +
              '<span style="color:var(--muted);font-size:11.5px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHtml(preview) + '…</span>' +
            '</div>';
          }).join("") +
        '</div>' +
      '</div>';
  } catch (e) {
    docsContainer.innerHTML = '<div class="dev-card"><h4>Ошибка</h4><div style="color:var(--red);">' + e.message + '</div></div>';
  }
};

window.__devOpenDoc = async function(colName, docId) {
  if (!requireDeveloper()) return;

  try {
    const snap = await getDoc(doc(db, colName, docId));
    if (!snap.exists()) {
      toast("Документ не найден", "warn");
      return;
    }

    const data = snap.data();
    const json = JSON.stringify(data, null, 2);

    openModal({
      title: "📄 " + colName + "/" + docId.substring(0, 12) + "...",
      html:
        '<div style="margin-bottom:8px;display:flex;gap:8px;">' +
          '<button class="btn small secondary" onclick="window.__devEditDoc(\'' + colName + '\',\'' + docId + '\')">✏️ Редактировать JSON</button>' +
          '<button class="btn small danger" onclick="window.__devDeleteDoc(\'' + colName + '\',\'' + docId + '\')">🗑 Удалить</button>' +
        '</div>' +
        '<div class="dev-code" style="max-height:500px;">' + escapeHtml(json) + '</div>',
      confirmText: "ЗАКРЫТЬ",
      onConfirm: () => closeModal()
    });
  } catch (e) {
    toast("Ошибка: " + e.message, "warn");
  }
};

window.__devEditDoc = async function(colName, docId) {
  if (!requireDeveloper()) return;

  const snap = await getDoc(doc(db, colName, docId));
  if (!snap.exists()) return;

  const json = JSON.stringify(snap.data(), null, 2);
  closeModal();

  openModal({
    title: "✏️ Редактировать " + docId.substring(0, 12),
    html:
      '<div class="form-field" style="margin-bottom:8px;">' +
        '<label>JSON документа</label>' +
        '<textarea id="devEditJson" style="min-height:300px;font-family:Courier New,monospace;font-size:12px;">' + escapeHtml(json) + '</textarea>' +
      '</div>' +
      '<div id="devEditError" style="color:var(--red);font-size:12px;display:none;"></div>',
    confirmText: "СОХРАНИТЬ",
    onConfirm: async () => {
      const text = document.getElementById("devEditJson").value;
      const err = document.getElementById("devEditError");
      err.style.display = "none";

      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch (e) {
        err.textContent = "Невалидный JSON: " + e.message;
        err.style.display = "block";
        return;
      }

      try {
        await setDoc(doc(db, colName, docId), parsed);
        toast("Документ сохранён", "ok");
        closeModal();
        window.__devOpenCollection(colName);
      } catch (e) {
        err.textContent = "Ошибка: " + e.message;
        err.style.display = "block";
      }
    }
  });
};

window.__devDeleteDoc = async function(colName, docId) {
  if (!requireDeveloper()) return;
  if (!confirm("Удалить документ " + colName + "/" + docId + "?\n\nНеобратимо!")) return;

  try {
    await deleteDoc(doc(db, colName, docId));
    toast("Документ удалён", "ok");
    closeModal();
    window.__devOpenCollection(colName);
  } catch (e) {
    toast("Ошибка: " + e.message, "warn");
  }
};

// ==================== #8. ЭКСПОРТ/ИМПОРТ КОЛЛЕКЦИЙ ====================
window.__devExportCollection = async function() {
  if (!requireDeveloper()) return;
  const colName = prompt("Название коллекции для экспорта:", currentCollection || "users");
  if (!colName) return;

  try {
    const snap = await getDocs(collection(db, colName));
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = colName + "-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast("Экспортировано " + data.length + " документов", "ok");
  } catch (e) {
    toast("Ошибка: " + e.message, "warn");
  }
};

window.__devImportCollection = function() {
  if (!requireDeveloper()) return;

  const colName = prompt("В какую коллекцию импортировать?", currentCollection || "users");
  if (!colName) return;

  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json";
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!Array.isArray(data)) {
        toast("JSON должен быть массивом", "warn");
        return;
      }

      if (!confirm("Импортировать " + data.length + " документов в " + colName + "?")) return;

      let imported = 0;
      for (const item of data) {
        if (!item.id) continue;
        const { id, ...rest } = item;
        try {
          await setDoc(doc(db, colName, id), rest, { merge: true });
          imported++;
        } catch (err) {}
      }

      toast("Импортировано: " + imported, "ok");
      window.__devOpenCollection(colName);
    } catch (err) {
      toast("Ошибка: " + err.message, "warn");
    }
  };
  input.click();
};

// ==================== #9. РЕДАКТОР СТРУКТУРЫ ====================
window.__devRenameField = async function() {
  if (!requireDeveloper()) return;

  const colName = prompt("Коллекция:", currentCollection || "users");
  if (!colName) return;
  const oldField = prompt("Старое имя поля:");
  if (!oldField) return;
  const newField = prompt("Новое имя поля:");
  if (!newField) return;

  if (!confirm("Переименовать поле «" + oldField + "» → «" + newField + "» во всех документах " + colName + "?")) return;

  try {
    const snap = await getDocs(collection(db, colName));
    const batch = writeBatch(db);
    let count = 0;

    snap.forEach(d => {
      const data = d.data();
      if (oldField in data) {
        const patch = {};
        patch[newField] = data[oldField];
        batch.update(d.ref, patch);
        // Удаляем старое поле
        const delPatch = {};
        delPatch[oldField] = null;
        batch.update(d.ref, delPatch);
        count++;
      }
    });

    if (count > 0) await batch.commit();
    toast("Обновлено: " + count + " документов", "ok");
  } catch (e) {
    toast("Ошибка: " + e.message, "warn");
  }
};

window.__devDeleteField = async function() {
  if (!requireDeveloper()) return;

  const colName = prompt("Коллекция:", currentCollection || "users");
  if (!colName) return;
  const fieldName = prompt("Имя поля для удаления:");
  if (!fieldName) return;

  if (!confirm("Удалить поле «" + fieldName + "» во всех документах " + colName + "?\n\nНеобратимо!")) return;

  try {
    const snap = await getDocs(collection(db, colName));
    const batch = writeBatch(db);
    let count = 0;

    snap.forEach(d => {
      const data = d.data();
      if (fieldName in data) {
        const patch = {};
        patch[fieldName] = null;
        batch.update(d.ref, patch);
        count++;
      }
    });

    if (count > 0) await batch.commit();
    toast("Удалено поле в " + count + " документах", "ok");
  } catch (e) {
    toast("Ошибка: " + e.message, "warn");
  }
};

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
