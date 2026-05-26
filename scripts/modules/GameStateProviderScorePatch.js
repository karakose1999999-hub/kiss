// GameStateProviderScorePatch.js
// Completes table-player kiss scores from visible .player-graphics blocks.
(function installGameStateProviderScorePatch() {
    if (window.__KISS_SCORE_PROVIDER_PATCH_INSTALLED__) return;
    window.__KISS_SCORE_PROVIDER_PATCH_INSTALLED__ = true;

    function numeric(value) {
        const text = String(value || "").trim();
        return /^\d+$/.test(text) && text !== "0" ? text : "";
    }

    function selectorEscape(value) {
        try {
            if (window.CSS && typeof window.CSS.escape === "function") return window.CSS.escape(String(value || ""));
        } catch (_) {}
        return String(value || "").replace(/"/g, "");
    }

    function isVisible(node) {
        try {
            if (!node) return false;
            const rect = node.getBoundingClientRect && node.getBoundingClientRect();
            if (!rect || rect.width <= 0 || rect.height <= 0) return false;
            const style = window.getComputedStyle ? window.getComputedStyle(node) : null;
            return !style || (style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) !== 0);
        } catch (_) {
            return false;
        }
    }

    function parseCompactNumber(value) {
        const raw = String(value || "")
            .replace(/\s+/g, "")
            .replace(",", ".")
            .toLowerCase();
        const match = raw.match(/^(\d+(?:\.\d+)?)(k|m|b)?$/) || raw.match(/(\d+(?:\.\d+)?)(k|m|b)?/);
        if (!match) return null;
        const base = Number(match[1]);
        if (!Number.isFinite(base)) return null;
        const suffix = match[2] || "";
        const multiplier = suffix === "b" ? 1000000000 : suffix === "m" ? 1000000 : suffix === "k" ? 1000 : 1;
        return Math.round(base * multiplier);
    }

    function readScoreFromNode(node) {
        try {
            if (!node) return null;
            const selectors = [
                ".player__counter--kiss",
                ".player__counter.player__counter--kiss",
                ".js-player-kiss-count",
                ".player-kisses",
                "[class*='counter--kiss']",
                "[class*='kiss-count']",
                "[class*='kiss_count']",
                "[class*='kisses']"
            ];
            for (const selector of selectors) {
                const el = node.querySelector && node.querySelector(selector);
                const value = parseCompactNumber(
                    el && (
                        el.getAttribute("data-count") ||
                        el.getAttribute("data-value") ||
                        el.textContent
                    )
                );
                if (value !== null) return value;
            }

            // player-graphics often exposes counters as plain text like "141k 1967k".
            const text = String(node.textContent || "").replace(/\s+/g, " ").trim();
            const parts = text.match(/(\d+(?:[.,]\d+)?[kmb]?)(?:\s+\d+(?:[.,]\d+)?[kmb]?)/i);
            if (parts) return parseCompactNumber(parts[1]);
        } catch (_) {}
        return null;
    }

    function readGraphicsScore(uid) {
        const id = numeric(uid);
        if (!id) return null;
        try {
            const escaped = selectorEscape(id);
            const nodes = Array.from(document.querySelectorAll(
                '.player-graphics[data-uid="' + escaped + '"], .player[data-uid="' + escaped + '"].player-graphics'
            ));
            for (const node of nodes) {
                if (!isVisible(node)) continue;
                const score = readScoreFromNode(node);
                if (score !== null) return score;
            }
        } catch (_) {}
        return null;
    }

    function augmentSnapshot(snapshot) {
        try {
            if (!snapshot || !Array.isArray(snapshot.tablePlayers)) return snapshot;
            snapshot.tablePlayers.forEach(player => {
                const uid = numeric(player && (player.uid || player.userId || player.id));
                if (!uid) return;
                const current = Number(player.kissScore);
                if (player.kissScoreKnown === true && Number.isFinite(current) && current > 0) return;
                const score = readGraphicsScore(uid);
                if (score !== null) {
                    player.kissScore = score;
                    player.kissScoreKnown = true;
                }
            });
            try { window.__KISS_GAME_STATE__ = snapshot; } catch (_) {}
        } catch (_) {}
        return snapshot;
    }

    function patchProvider() {
        const provider = window.__KISS_GAME_STATE_PROVIDER__;
        if (!provider || provider.__scorePatchApplied) return !!provider;
        provider.__scorePatchApplied = true;

        const originalRefresh = provider.refresh;
        if (typeof originalRefresh === "function") {
            provider.refresh = function patchedRefresh() {
                return augmentSnapshot(originalRefresh.apply(this, arguments));
            };
            provider.getState = provider.refresh;
        }

        provider.augmentKissScores = augmentSnapshot;
        provider.readGraphicsKissScore = readGraphicsScore;
        try { augmentSnapshot(provider.refresh && provider.refresh("score-patch-init", { silent: true, force: true })); } catch (_) {}
        return true;
    }

    if (!patchProvider()) {
        const timer = setInterval(() => {
            if (patchProvider()) clearInterval(timer);
        }, 500);
        setTimeout(() => clearInterval(timer), 10000);
    }
})();
