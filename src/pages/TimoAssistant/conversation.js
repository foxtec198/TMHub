// O histórico é transitório e acompanha o usuário e o escopo atual dos filtros.
export function conversationScope(storage, accessToken) {
  return JSON.stringify([
    accessToken,
    ...[
      "selected_filial_ids", "selected_company_ids", "selected_department_ids",
      "selected_cost_center_ids", "standard_filter_date",
    ].map((key) => storage.getItem(key)),
  ]);
}

export function conversationHistory(messages, scope) {
  return messages
    .filter((message) => message.scope === scope && !message.error
      && message.understood !== false && message.id !== "welcome")
    .slice(-6)
    .map((message) => ({
      role: message.role === "user" ? "user" : "assistant",
      content: message.text.slice(0, 500),
    }));
}
