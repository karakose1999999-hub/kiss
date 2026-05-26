function createGeneralAutoKissView(ctx, requestRender) {
    function renderExtra() {
        const wrap = ctx.utils.el("div", {
            css: {
                display: "grid",
                gap: "6px",
                padding: "8px",
                border: "1px solid rgba(186,218,85,0.18)",
                borderRadius: "6px",
                background: "rgba(0,0,0,0.14)"
            }
        });
        wrap.appendChild(ctx.utils.el("div", { text: "Kişiye Özel RET", css: { fontWeight: "800" } }));

        const lowScoreRow = ctx.utils.el("div", {
            css: {
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "8px",
                padding: "4px 0 8px",
                borderBottom: "1px solid rgba(186,218,85,0.12)"
            }
        });
        const lowScoreLabel = ctx.utils.el("span", {
            text: "5K altı otomatik RET",
            css: { flex: "1", fontSize: "12px" }
        });
        const lowScoreButton = ctx.utils.el("button", {
            text: ctx.settings.lowScoreRetEnabled ? "Aktif" : "Pasif",
            css: {
                minWidth: "78px",
                cursor: "pointer",
                padding: "4px 7px",
                background: ctx.settings.lowScoreRetEnabled ? "#8c2430" : "#303030",
                color: "#fff"
            }
        });
        lowScoreButton.addEventListener("click", () => {
            ctx.settings.lowScoreRetEnabled = ctx.settings.lowScoreRetEnabled !== true;
            ctx.settings.lowScoreRetThreshold = 5000;
            ctx.saveSettings();
            requestRender();
        });
        lowScoreRow.append(lowScoreLabel, lowScoreButton);
        wrap.appendChild(lowScoreRow);

        const players = ctx.getRoomPlayers();
        if (!players.length) {
            wrap.appendChild(ctx.utils.el("div", { text: "Odada oyuncu görünmüyor.", css: { opacity: "0.7", fontSize: "12px" } }));
            return wrap;
        }

        players.forEach(player => {
            const isRet = !!ctx.settings.retList[player.userId];
            const row = ctx.utils.el("div", {
                css: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }
            });
            const name = player.name.length > 18 ? player.name.slice(0, 18) + "..." : player.name;
            const label = ctx.utils.el("span", { text: name, css: { flex: "1" } });
            const button = ctx.utils.el("button", {
                text: isRet ? "RET: Açık" : "RET",
                css: {
                    minWidth: "78px",
                    cursor: "pointer",
                    padding: "4px 7px",
                    background: isRet ? "#8c2430" : "#303030",
                    color: "#fff"
                }
            });
            button.addEventListener("click", () => {
                if (ctx.settings.retList[player.userId]) delete ctx.settings.retList[player.userId];
                else ctx.settings.retList[player.userId] = true;
                ctx.saveSettings();
                requestRender();
            });
            row.append(label, button);
            wrap.appendChild(row);
        });

        const clearButton = ctx.utils.el("button", {
            text: "RET listesini temizle",
            css: {
                marginTop: "4px",
                padding: "6px 10px",
                width: "100%",
                background: "#552222",
                color: "#fff",
                border: "1px solid #aa4444",
                cursor: "pointer",
                borderRadius: "6px",
                fontSize: "13px"
            }
        });
        clearButton.addEventListener("click", () => {
            Object.keys(ctx.settings.retList).forEach(key => delete ctx.settings.retList[key]);
            ctx.saveSettings();
            requestRender();
        });
        wrap.appendChild(clearButton);
        return wrap;
    }

    return { renderExtra };
}
