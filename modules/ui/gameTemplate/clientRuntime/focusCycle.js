const source = String.raw`let activeFocusManualOverride = null;

function toggleFocus(index) {
  const slot = getSlot(index);
  if (!slot) return;

  if (focusedSlotIndex === index) {
    slot.classList.remove("focus");
    document.body.classList.remove("has-focus");
    focusedSlotIndex = null;
    setTimeout(autoFitAllWebviews, 250);
    slotLog(index, "focus off");
    updateFocusButtons();
    return;
  }

  if (focusedSlotIndex !== null) {
    const oldSlot = getSlot(focusedSlotIndex);
    if (oldSlot) oldSlot.classList.remove("focus");
  }

  focusedSlotIndex = index;
  slot.classList.add("focus");
  document.body.classList.add("has-focus");
  setTimeout(() => autoFitWebview(index), 250);
  slotLog(index, "focus on");
  updateFocusButtons();
}

function updateFocusButtons() {
  entries.forEach((_entry, index) => {
    const button = document.getElementById("slotFocusBtn" + index);
    if (!button) return;
    button.textContent = focusedSlotIndex === index ? "Geri Al" : "\u00d6ne Al";
  });
}

function clearFocusMode() {
  if (focusedSlotIndex !== null) {
    const slot = getSlot(focusedSlotIndex);
    if (slot) slot.classList.remove("focus");
  }
  focusedSlotIndex = null;
  document.body.classList.remove("has-focus");
  setTimeout(autoFitAllWebviews, 250);
  updateFocusButtons();
}

function pulseActiveGuard(index) {
  const webview = getGameWebview(index);
  if (!webview) return;

  try {
    webview.executeJavaScript(
      "(function(){try{if(typeof window.__KISS_ACTIVE_GUARD_PULSE==='function'){return !!window.__KISS_ACTIVE_GUARD_PULSE();}return false;}catch(_){return false;}})();",
      false
    );
  } catch (error) {
    slotLog(index, "active guard pulse failed", error && error.message ? error.message : error);
  }
}

function runActiveFocusStep() {
  if (!activeFocusCycle || !entries.length) return;

  activeFocusIndex = (activeFocusIndex + 1) % entries.length;
  if (focusedSlotIndex !== activeFocusIndex) {
    toggleFocus(activeFocusIndex);
  }
  setTimeout(() => pulseActiveGuard(activeFocusIndex), 350);
}

function areAllToolkitScriptsReady() {
  if (!entries.length) return false;
  return entries.every((_entry, index) => {
    const state = slotState.get(index);
    return !!(state && state.didInjectScripts);
  });
}

function startActiveFocusCycle(force) {
  if (!force && !areAllToolkitScriptsReady()) {
    activeFocusCycle = false;
    updateUI();
    return false;
  }
  if (activeFocusCycle) return;
  activeFocusCycle = true;
  activeFocusIndex = focusedSlotIndex !== null ? focusedSlotIndex - 1 : -1;
  runActiveFocusStep();
  if (activeFocusTimer) clearInterval(activeFocusTimer);
  activeFocusTimer = setInterval(runActiveFocusStep, ACTIVE_FOCUS_INTERVAL);
  updateUI();
  return true;
}

function stopActiveFocusCycle() {
  activeFocusCycle = false;
  if (activeFocusTimer) clearInterval(activeFocusTimer);
  activeFocusTimer = null;
  activeFocusIndex = -1;
  clearFocusMode();
  updateUI();
}

function maybeStartActiveFocusAfterScripts() {
  if (activeFocusManualOverride === false) return;
  if (activeFocusCycle || !areAllToolkitScriptsReady()) return;
  startActiveFocusCycle(true);
}

function pauseAutoActiveFocusUntilScriptsReady() {
  if (activeFocusManualOverride !== null || !activeFocusCycle) return;
  stopActiveFocusCycle();
}
`;

module.exports = {
  source
};
