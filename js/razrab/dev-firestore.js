// js/razrab/dev-firestore.js
// Firestore Inspector — просмотр всех коллекций и документов.

import { db } from "../firebase-init.js";
import {
  collection, getDocs, doc, getDoc, updateDoc, deleteDoc
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
    '<div class="dev-warning">⚠️ Редактирование Firestore напрямую может сломать данные. Используй осторожно.</div>' +
    '<div class="dev-card">' +
      '<h4>📁 Коллекции</h4>' +
      '<div id="devCollectionsList">' +
        '<div style="text-align:center;color:var(--muted);padding:20px;">Загрузка...</div>' +
      '</div>' +
    '</div>' +
    '<div id="devDocsList"></div>';

  await loadCollections();
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
        '<div style="max-height:400px;overflow-y:auto;">' +
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
        '<div class="dev-code" style="max-height:500px;">' + escapeHtml(json) + '</div>' +
        '<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">' +
          '<button class="btn danger" onclick="window.__devDeleteDoc(\'' + colName + '\',\'' + docId + '\')">🗑 Удалить документ</button>' +
        '</div>',
      confirmText: "ЗАКРЫТЬ",
      onConfirm: () => closeModal()
    });
  } catch (e) {
    toast("Ошибка: " + e.message, "warn");
  }
};

window.__devDeleteDoc = async function(colName, docId) {
  if (!requireDeveloper()) return;
  if (!confirm("Удалить документ " + colName + "/" + docId + "?\n\nЭто необратимо!")) return;

  try {
    await deleteDoc(doc(db, colName, docId));
    toast("Документ удалён", "ok");
    closeModal();
    await window.__devOpenCollection(colName);
  } catch (e) {
    toast("Ошибка: " + e.message, "warn");
  }
};

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
