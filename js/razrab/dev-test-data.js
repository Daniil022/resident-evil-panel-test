// js/razrab/dev-test-data.js
// Тестовые данные — создать/очистить фейки для отладки.

import { db } from "../firebase-init.js";
import {
  collection, doc, setDoc, getDocs, deleteDoc, writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { toast } from "../core/utils.js";
import { requireDeveloper } from "./admin-developer.js";

const TEST_PREFIX = "test_";

export async function renderTestDataTab(container) {
  if (!requireDeveloper()) return;

  container.innerHTML =
    '<div class="dev-warning">⚠️ Тестовые данные создаются с префиксом test_ и легко удаляются.</div>' +

    '<div class="dev-card">' +
      '<h4>👥 Создать тестовых юзеров</h4>' +
      '<div class="dev-item">' +
        '<span class="label">Количество</span>' +
        '<input type="number" id="devTestUsersCount" value="10" min="1" max="100" style="background:var(--bg);border:1px solid var(--border);color:#fff;padding:6px 10px;border-radius:4px;width:80px;">' +
        '<button class="btn small" onclick="window.__devCreateTestUsers()">Создать</button>' +
      '</div>' +
    '</div>' +

    '<div class="dev-card">' +
      '<h4>📜 Создать тестовые контракты</h4>' +
      '<div class="dev-item">' +
        '<span class="label">Количество</span>' +
        '<input type="number" id="devTestContractsCount" value="10" min="1" max="100" style="background:var(--bg);border:1px solid var(--border);color:#fff;padding:6px 10px;border-radius:4px;width:80px;">' +
        '<button class="btn small" onclick="window.__devCreateTestContracts()">Создать</button>' +
      '</div>' +
    '</div>' +

    '<div class="dev-card">' +
      '<h4>💬 Заполнить чат тестовыми сообщениями</h4>' +
      '<div class="dev-item">' +
        '<span class="label">Количество</span>' +
        '<input type="number" id="devTestMessagesCount" value="20" min="1" max="200" style="background:var(--bg);border:1px solid var(--border);color:#fff;padding:6px 10px;border-radius:4px;width:80px;">' +
        '<select id="devTestChatSelect" style="background:var(--bg);border:1px solid var(--border);color:#fff;padding:6px 10px;border-radius:4px;">' +
          '<option value="residents">Резиденты</option>' +
          '<option value="allies">Союзники</option>' +
        '</select>' +
        '<button class="btn small" onclick="window.__devCreateTestMessages()">Создать</button>' +
      '</div>' +
    '</div>' +

    '<div class="dev-card">' +
      '<h4>🗑 Очистить всё тестовое</h4>' +
      '<div class="dev-item">' +
        '<span class="label">Удалить всех test_*</span>' +
        '<button class="btn danger small" onclick="window.__devClearTestData()">Очистить</button>' +
      '</div>' +
    '</div>';
}

window.__devCreateTestUsers = async function() {
  if (!requireDeveloper()) return;
  const count = parseInt(document.getElementById("devTestUsersCount").value) || 10;
  if (!confirm("Создать " + count + " тестовых юзеров?")) return;

  try {
    const roles = ["soul", "knight", "skeleton"];
    const divisions = ["guard", "shooter", "fuller", "mechanic"];
    let created = 0;

    for (let i = 0; i < count; i++) {
      const id = TEST_PREFIX + "user_" + Date.now() + "_" + i;
      const data = {
        login: TEST_PREFIX + "User" + i,
        pin: "1234",
        role: roles[i % roles.length],
        division: divisions[i % divisions.length],
        warn: 0,
        banned: false,
        muted: false,
        contracts: Math.floor(Math.random() * 20),
        createdAt: Date.now(),
        isTest: true
      };
      await setDoc(doc(db, "users", id), data);
      created++;
    }

    toast("Создано юзеров: " + created, "ok");
  } catch (e) {
    toast("Ошибка: " + e.message, "warn");
  }
};

window.__devCreateTestContracts = async function() {
  if (!requireDeveloper()) return;
  const count = parseInt(document.getElementById("devTestContractsCount").value) || 10;
  if (!confirm("Создать " + count + " тестовых контрактов?")) return;

  try {
    let created = 0;
    for (let i = 0; i < count; i++) {
      const id = TEST_PREFIX + "contract_" + Date.now() + "_" + i;
      const data = {
        title: "Тестовый контракт #" + i,
        description: "Автоматически создан для теста",
        reward: Math.floor(Math.random() * 50000) + 1000,
        status: "open",
        authorId: "test",
        authorLogin: "DEV",
        createdAt: Date.now(),
        isTest: true
      };
      await setDoc(doc(db, "contracts", id), data);
      created++;
    }

    toast("Создано контрактов: " + created, "ok");
  } catch (e) {
    toast("Ошибка: " + e.message, "warn");
  }
};

window.__devCreateTestMessages = async function() {
  if (!requireDeveloper()) return;
  const count = parseInt(document.getElementById("devTestMessagesCount").value) || 20;
  const chat = document.getElementById("devTestChatSelect").value;
  if (!confirm("Создать " + count + " тестовых сообщений в «" + chat + "»?")) return;

  try {
    const texts = [
      "Тестовое сообщение",
      "Проверка чата",
      "Lorem ipsum dolor sit amet",
      "Ещё одно сообщение для теста",
      "1", "2", "3",
      "Проверка реплая",
      "Проверка реакций",
      "Длинное тестовое сообщение для проверки переноса строк и отображения"
    ];

    let created = 0;
    for (let i = 0; i < count; i++) {
      const id = TEST_PREFIX + "msg_" + Date.now() + "_" + i;
      const data = {
        text: texts[i % texts.length],
        authorId: "test",
        authorLogin: "TestUser",
        authorRole: "soul",
        authorAvatar: null,
        reactions: {},
        createdAt: new Date(Date.now() - (count - i) * 60000),
        isTest: true
      };
      await setDoc(doc(db, "chats", chat, "messages", id), data);
      created++;
    }

    toast("Создано сообщений: " + created, "ok");
  } catch (e) {
    toast("Ошибка: " + e.message, "warn");
  }
};

window.__devClearTestData = async function() {
  if (!requireDeveloper()) return;
  if (!confirm("Удалить ВСЕ тестовые данные (test_*)?")) return;

  try {
    let total = 0;

    const usersSnap = await getDocs(collection(db, "users"));
    const batch1 = writeBatch(db);
    usersSnap.forEach(d => {
      if (d.id.startsWith(TEST_PREFIX) || d.data().isTest) {
        batch1.delete(d.ref);
        total++;
      }
    });
    await batch1.commit();

    const contractsSnap = await getDocs(collection(db, "contracts"));
    const batch2 = writeBatch(db);
    contractsSnap.forEach(d => {
      if (d.id.startsWith(TEST_PREFIX) || d.data().isTest) {
        batch2.delete(d.ref);
        total++;
      }
    });
    await batch2.commit();

    for (const chat of ["residents", "allies"]) {
      const msgsSnap = await getDocs(collection(db, "chats", chat, "messages"));
      const batch3 = writeBatch(db);
      msgsSnap.forEach(d => {
        if (d.id.startsWith(TEST_PREFIX) || d.data().isTest) {
          batch3.delete(d.ref);
          total++;
        }
      });
      await batch3.commit();
    }

    toast("Удалено всего: " + total, "ok");
  } catch (e) {
    toast("Ошибка: " + e.message, "warn");
  }
};
