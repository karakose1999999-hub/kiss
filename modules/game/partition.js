function accountId(account) {
  return String(
    (account && account.id) ||
    (account && account.username) ||
    Date.now()
  );
}

function accountLabel(account) {
  return String(
    (account && account.label) ||
    (account && account.username) ||
    (account && account.id) ||
    "Hesap"
  );
}

function partitionForAccount(account) {
  const id = accountId(account).replace(/[^a-zA-Z0-9_-]/g, "_");
  return `persist:account-${id}`;
}

module.exports = {
  accountId,
  accountLabel,
  partitionForAccount
};
