function moduleSettingsFromEnabled(enabled = {}) {
  return {
    activeGuard: !!enabled.activeGuard,
    generalAuto: !!(
      enabled.autoSpinTab1 ||
      enabled.autoKiss ||
      enabled.autoClose ||
      enabled.activeGuard
    ),
    autoSpinTab1: !!enabled.autoSpinTab1,
    autoKiss: !!enabled.autoKiss,
    autoClose: !!enabled.autoClose,
    autoCombo: !!enabled.autoCombo,
    idRoomFollower: !!enabled.idRoomFollower,
    diagnosticLog: !!enabled.diagnosticLog,
    maintenanceHost: !!enabled.maintenanceHost,
    visualCleanerUltimateFixedV9: !!(
      enabled.visualCleanerUltimateFixedV9 || enabled.visualCleaner
    ),
    messageCleaner: !!enabled.messageCleaner
  };
}

module.exports = {
  moduleSettingsFromEnabled
};
