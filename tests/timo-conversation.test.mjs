import assert from "node:assert/strict";
import test from "node:test";
import { conversationHistory, conversationScope, timoNavigationPath } from "../src/pages/TimoAssistant/conversation.js";

test("histórico acompanha a sessão e o escopo dos filtros", () => {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) ?? null };
  const first = conversationScope(storage, "session-a");
  const messages = [{ id: "1", scope: first, role: "user", text: "Oi" }];
  assert.equal(conversationHistory(messages, first).length, 1);
  assert.deepEqual(conversationHistory(messages, conversationScope(storage, "session-b")), []);
  values.set("selected_company_ids", "[7]");
  assert.deepEqual(conversationHistory(messages, conversationScope(storage, "session-a")), []);
});

test("envia apenas seis mensagens válidas, sem metadados ou falhas", () => {
  const messages = Array.from({ length: 10 }, (_, i) => ({
    id: String(i), scope: "scope", role: i % 2 ? "timo" : "user",
    text: "x".repeat(600), action: { type: "navigate" },
  }));
  messages.push({ scope: "scope", role: "timo", text: "Falha", error: true });
  messages.push({ scope: "scope", role: "timo", text: "Ocupado", understood: false });
  const history = conversationHistory(messages, "scope");
  assert.equal(history.length, 6);
  assert.equal(history.at(-1).role, "assistant");
  for (const message of history) {
    assert.equal(message.content.length, 500);
    assert.deepEqual(Object.keys(message), ["role", "content"]);
  }
});

test("abre a rota autorizada sem depender de clique", () => {
  assert.equal(timoNavigationPath({ success: true, action: { type: "navigate", path: "/tickets" } }, "a", "a"), "/tickets");
});

test("não navega em falha, mudança de sessão/escopo ou URL externa", () => {
  const response = { success: true, action: { type: "navigate", path: "/tickets" } };
  assert.equal(timoNavigationPath(response, "a", "b"), null);
  assert.equal(timoNavigationPath({ ...response, success: false }, "a", "a"), null);
  for (const path of ["https://example.com", "//example.com", "/\\example.com", "javascript:alert(1)"]) {
    assert.equal(timoNavigationPath({ ...response, action: { type: "navigate", path } }, "a", "a"), null);
  }
  assert.equal(timoNavigationPath({ success: true, action: null }, "a", "a"), null);
});
