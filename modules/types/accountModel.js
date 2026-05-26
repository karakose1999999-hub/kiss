const { randomUUID } = require("crypto");

function nowIso() {
  return new Date().toISOString();
}

function toText(value) {
  return String(value == null ? "" : value).trim();
}

function normalizeAccount(input, existing) {
  const source = input || {};
  const base = existing || {};

  const username = toText(source.username || base.username);
  const password = toText(source.password || base.password);
  const label = toText(source.label || base.label);

  if (!username) throw new Error("E-posta veya telefon zorunludur.");
  if (!password) throw new Error("Şifre zorunludur.");

  return {
    id: base.id || randomUUID(),
    label,
    username,
    password,
    createdAt: base.createdAt || nowIso(),
    updatedAt: nowIso()
  };
}

module.exports = {
  normalizeAccount
};
