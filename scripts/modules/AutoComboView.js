function createAutoComboView(ctx) {
    const {
        utils,
        container,
        settings: S,
        shorten,
        sameUid,
        ensureLists,
        saveNow,
        getPlayers,
        kickIntervals,
        saveIntervals,
        hiddenSaveIntervals,
        startKick,
        stopKick,
        startSave,
        stopSave,
        startHiddenSave,
        stopHiddenSave,
        clearSelections
    } = ctx;

    let listRoot = null;

    function addRow(opt, title, v1, cb1, v2, cb2) {
        const row = utils.el("div", {
            css: {
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "6px",
                marginBottom: "6px"
            }
        });

        const input1 = utils.el("input", {
            attrs: { type: "number", min: "1", value: v1 },
            css: { width: "46px", textAlign: "center" }
        });

        input1.addEventListener("input", e => cb1(+e.target.value || 1));

        const input2 = utils.el("input", {
            attrs: { type: "number", min: "1", value: v2 },
            css: { width: "46px", textAlign: "center" }
        });

        input2.addEventListener("input", e => cb2(+e.target.value || 1));

        row.append(
            utils.el("label", {
                text: title,
                css: { width: "48px", opacity: 0.85 }
            }),

            utils.el("label", {
                text: "adet",
                css: { fontSize: "11px", opacity: 0.7 }
            }),

            input1,

            utils.el("label", {
                text: "sn",
                css: { fontSize: "11px", opacity: 0.7 }
            }),

            input2,
        );

        opt.append(row);
    }

    function refreshList() {
        ensureLists();
        if (!listRoot) return;

        const players = getPlayers();
        listRoot.innerHTML = "";

        if (!players.length) {
            listRoot.append(
                utils.el("div", {
                    text: "Oda boş…",
                    css: { opacity: 0.5, textAlign: "center", padding: "10px" }
                })
            );
            return;
        }

        players.forEach(p => {
            const uid = String(p.userId);

            const row = utils.el("div", {
                css: {
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "4px",
                    gap: "6px",
                }
            });

            row.append(
                utils.el("span", {
                    text: shorten(p.name),
                    css: { flex: "1" }
                })
            );

            const isKickSaved = !!S.kickList[uid];
            const isKickRunning = !!kickIntervals[uid];

            if (isKickSaved && !isKickRunning) {
                startKick(uid);
            }

            const btnKick = utils.el("button", {
                text: kickIntervals[uid] ? "K.DUR" : "KICK",
                css: { minWidth: "60px", fontSize: "11px" }
            });

            btnKick.style.backgroundColor = kickIntervals[uid] ? "#d32f2f" : "#388e3c";

            btnKick.onclick = () => {
                kickIntervals[uid] ? stopKick(uid) : startKick(uid);
                refreshList();
            };

            row.append(btnKick);

            const isSaveSaved = S.saveList.some(x => sameUid(x, uid));
            const isSaveRunning = !!saveIntervals[uid];

            if (isSaveSaved && !isSaveRunning) {
                startSave(uid);
            }

            const btnSave = utils.el("button", {
                text: saveIntervals[uid] ? "S.DUR" : "SAVE",
                css: { minWidth: "60px", fontSize: "11px" }
            });

            btnSave.style.backgroundColor = saveIntervals[uid] ? "#d32f2f" : "#1976d2";

            btnSave.onclick = () => {
                saveIntervals[uid] ? stopSave(uid) : startSave(uid);
                refreshList();
            };

            row.append(btnSave);

            const isHiddenSaved = S.hiddenSaveList.some(x => sameUid(x, uid));
            const isHiddenRunning = !!hiddenSaveIntervals[uid];

            if (isHiddenSaved && !isHiddenRunning) {
                startHiddenSave(uid);
            }

            const btnHiddenSave = utils.el("button", {
                text: hiddenSaveIntervals[uid] ? "G.DUR" : "GİZLİ",
                css: { minWidth: "60px", fontSize: "11px" }
            });

            btnHiddenSave.style.backgroundColor = hiddenSaveIntervals[uid] ? "#d32f2f" : "#6a1b9a";

            btnHiddenSave.onclick = () => {
                hiddenSaveIntervals[uid] ? stopHiddenSave(uid) : startHiddenSave(uid);
                refreshList();
            };

            row.append(btnHiddenSave);

            listRoot.append(row);
        });
    }

    function mount() {
        const opt = utils.el("div", {
            css: {
                marginBottom: "12px",
                padding: "6px",
                border: "1px solid #444",
                borderRadius: "6px",
                background: "#1115"
            }
        });
        container.append(opt);

        addRow(
            opt,
            "Kick",
            S.kicksPerCycle,
            v => { S.kicksPerCycle = v; saveNow(); },
            S.kickCycleSeconds,
            v => { S.kickCycleSeconds = v; saveNow(); },
        );

        addRow(
            opt,
            "Save",
            S.savesPerCycle,
            v => { S.savesPerCycle = v; saveNow(); },
            S.saveCycleSeconds,
            v => { S.saveCycleSeconds = v; saveNow(); },
        );

        listRoot = utils.el("div", {
            css: {
                maxHeight: "540px",
                overflowY: "auto",
                border: "1px solid #333",
                borderRadius: "6px",
                padding: "4px"
            }
        });
        container.append(listRoot);

        const clearBtn = utils.el("button", {
            text: "Seçimleri temizle",
            css: {
                background: "#b11",
                color: "#fff",
                width: "100%",
                marginTop: "6px",
                padding: "6px",
                borderRadius: "4px",
            }
        });

        clearBtn.onclick = () => {
            clearSelections();
            refreshList();
        };

        container.append(clearBtn);
        refreshList();
    }

    return {
        mount,
        refreshList
    };
}
