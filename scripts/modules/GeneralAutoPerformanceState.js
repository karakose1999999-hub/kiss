function createGeneralAutoPerformanceDefaults() {
    return {
        enabled: false,
        mode: "aggressive",
        chatMaxMessages: 80,
        cleanupIntervalMs: 10000,
        lastCleanupSummary: null
    };
}

function createGeneralAutoPerformanceState() {
    return {
        running: false,
        timer: null,
        observer: null,
        queuedNodes: [],
        cleanupInFlight: false,
        lastSummaryLogAt: 0,
        lastFullSweepAt: 0,
        lastChatCleanupAt: 0,
        lastStorageCleanupAt: 0,
        lastError: "",
        totals: {
            chatRemoved: 0,
            visualRemoved: 0,
            modalRemoved: 0,
            storageRemoved: 0,
            sweeps: 0
        }
    };
}

function createGeneralAutoPerformanceConfig() {
    const CHEAP_VISUAL_SELECTORS = [
        ".gift",
        ".gift--small",
        ".gift-animation",
        ".gift-animation-container",
        ".gift__container",
        ".animation_gift",
        ".flying-gift",
        ".fly-gift",
        ".animation-frame",
        ".hat-animation-frame",
        ".frame-glow",
        ".frame-glow-wrap",
        ".player__frame",
        ".player__border",
        ".player__collection[data-link=\"collection\"]",
        "[data-gift]",
        "[data-type=\"gift\"]",
        "canvas[data-type=\"gift\"]",
        "canvas[data-type=\"hat\"]",
        "canvas[data-type=\"frame\"]",
        "canvas[data-type=\"frame-glow\"]"
    ];

    return {
        STYLE_ID: "kiss-performance-aggressive-css",
        MAX_QUEUE: 120,
        FULL_SWEEP_INTERVAL_MS: 60000,
        CHAT_CLEANUP_INTERVAL_MS: 15000,
        STORAGE_CLEANUP_INTERVAL_MS: 120000,
        SAFE_STORAGE_PREFIXES: [
            "kiss_toolkit_",
            "kiss_auth_user_id",
            "kiss_hidden_last_room_id",
            "kiss_hidden_last_room_id_at",
            "topface_stprev_room_id"
        ],
        REMOVABLE_STORAGE_PATTERNS: [
            /^kiss_debug_/,
            /^kiss_diag_/,
            /^kiss_performance_temp_/,
            /^__kiss_debug_/,
            /^__kiss_diag_/,
            /diagnostic/i,
            /debug/i
        ],
        CHEAP_VISUAL_SELECTORS,
        QUEUED_VISUAL_SELECTORS: CHEAP_VISUAL_SELECTORS.concat([
            "[class*=\"gift\"]",
            "[class*=\"confetti\"]",
            "[class*=\"sparkle\"]",
            "[class*=\"firework\"]"
        ]),
        MODAL_SELECTORS: [
            ".toast",
            ".toast-message",
            ".notification",
            ".notifications__item",
            ".popup:not(.is-open):not(.active)",
            ".modal:not(.is-open):not(.active)",
            ".modal-backdrop:not(.show)",
            ".overlay:not(.is-open):not(.active)",
            ".tooltip",
            ".tippy-box"
        ]
    };
}
