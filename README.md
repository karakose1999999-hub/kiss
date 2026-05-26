# Kiss Auto V.1 - New

Controlled Electron refactor for the GetKiss account launcher and in-game script injector.

## Current Flow

- `npm start` runs `scripts/builder.js` first through `prestart`.
- The builder produces `scripts/main.user.js` from `scripts/core`, `scripts/modules`, and `scripts/bootstrap.js`.
- The app opens the account management screen.
- Single account login opens the game in the same window.
- Multi account login opens selected accounts in one window as a grid.
- Each slot uses its own `webview` and persistent partition.
- Login is performed in two stages:
  - main-process preflight login warms the account partition;
  - webview login keeps the required in-page `/api/session/auth` fetch flow.
- After webview login succeeds, the webview reloads and `scripts/main.user.js` is injected.
- Double-clicking a slot focuses it. Double-clicking again or pressing `ESC` returns to grid view.
- `Hesaplara Don` returns to the account screen.
- `Gecmisi Temizle` clears active game partitions and returns to the account screen.

## Account Screen

The account screen supports:

- add account;
- edit account;
- delete account;
- show/hide password;
- single login;
- multi-select login;
- launcher script toggles;
- runtime status per account.

Runtime states are:

- `idle`
- `loading`
- `active`
- `error`
- `stopped`

## Script Settings

Launcher toggles are stored in `scriptSettingsStore`.

Before injection, the game template writes the selected module state to:

```js
window.__KISS_MODULE_SETTINGS
```

`ModuleManager` reads that value first and then keeps its existing local storage behavior for the in-game panel.

## Module Layout

- `main.js`: app lifecycle, IPC registration, window creation, runtime routing.
- `modules/runtime/gameRuntime.js`: single/bulk opening, game HTML build, active partitions, runtime statuses.
- `modules/game/fetchLogin.js`: main-process preflight login.
- `modules/game/partition.js`: account id, label, partition helpers.
- `modules/game/sessionTools.js`: session settle, partition clearing, cookie names.
- `modules/ui/htmlTemplate.js`: game grid, webview login, refresh, inject, focus controls.
- `modules/ui/accountsRenderer.js`: account screen renderer and runtime status UI.
- `modules/windows/accountsWindow.js`: shared Electron window creation and rendering.
- `modules/ipc/accountsIpc.js`: account and script setting IPC handlers.
- `modules/store`: account and script setting stores.

## Commands

```bash
npm run build
npm start
```

## TODO

- Move from data URL + `nodeIntegration` flow to preload scripts with `contextIsolation: true`.
- Store account passwords with Electron `safeStorage`.
- Implement true per-slot close/stop inside the shared grid without disturbing other slots.
