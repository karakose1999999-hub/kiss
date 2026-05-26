function createIdRoomFollowerView(ctx) {
    const {
        utils,
        container,
        settings,
        getLoadedUsers,
        setLoadedUsers,
        uniqueUsers,
        sameId,
        getActiveFollowId,
        getRoomUsers,
        addSavedUser,
        removeSavedUser,
        startFollow,
        stopFollow,
        startRoomLock,
        stopRoomLock,
        saveNow
    } = ctx;

    let statusLine = null;
    let loadedList = null;
    let savedList = null;
    let roomLockBox = null;
    let roomLockLine = null;

    function button(text, onClick, extraCss = {}) {
        const btn = utils.el("button", {
            text,
            css: Object.assign({
                cursor: "pointer",
                padding: "5px 7px",
                border: "1px solid #444",
                borderRadius: "4px",
                background: "#333",
                color: "#e6ffb3",
                fontSize: "11px",
                whiteSpace: "nowrap"
            }, extraCss)
        });
        btn.addEventListener("click", onClick);
        return btn;
    }

    function setStatus(text) {
        if (statusLine) statusLine.textContent = String(text || "");
    }

    function setRoomLockLine(text) {
        if (roomLockLine) roomLockLine.textContent = String(text || "");
    }

    function userRow(user, mode) {
        const row = utils.el("div", {
            css: {
                display: "grid",
                gridTemplateColumns: "1fr auto",
                alignItems: "center",
                gap: "6px",
                padding: "6px",
                marginBottom: "4px",
                border: "1px solid #333",
                borderRadius: "6px",
                background: "#161616"
            }
        });

        const info = utils.el("div", { css: { minWidth: "0" } });
        info.append(
            utils.el("div", {
                text: user.name,
                css: {
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    color: "#fff"
                }
            })
        );

        const actions = utils.el("div", {
            css: { display: "flex", gap: "4px", alignItems: "center" }
        });

        if (mode === "loaded") {
            actions.append(button("Kaydet", () => {
                addSavedUser(user);
                renderSavedUsers();
                setStatus("Kaydedildi: " + user.name);
            }, { background: "#28502d" }));
        } else {
            const isActive = sameId(getActiveFollowId(), user.id);
            actions.append(
                button(isActive ? "Dur" : "Takip", () => {
                    if (isActive) stopFollow();
                    else startFollow(user.id);
                }, { background: isActive ? "#8a2020" : "#244d82" }),
                button("Sil", () => removeSavedUser(user.id), { background: "#5a2222" })
            );
        }

        row.append(info, actions);
        return row;
    }

    function renderLoadedUsers() {
        if (!loadedList) return;
        const loadedUsers = getLoadedUsers();
        loadedList.innerHTML = "";
        if (!loadedUsers.length) {
            loadedList.appendChild(utils.el("div", {
                text: "Henuz oyuncu yuklenmedi.",
                css: { opacity: "0.65", textAlign: "center", padding: "8px" }
            }));
            return;
        }

        loadedUsers.forEach(user => loadedList.appendChild(userRow(user, "loaded")));
    }

    function renderSavedUsers() {
        if (!savedList) return;
        savedList.innerHTML = "";
        const saved = uniqueUsers(settings.savedUsers);
        settings.savedUsers = saved;

        if (!saved.length) {
            savedList.appendChild(utils.el("div", {
                text: "Kaydedilen oyuncu yok.",
                css: { opacity: "0.65", textAlign: "center", padding: "8px" }
            }));
            return;
        }

        saved.forEach(user => savedList.appendChild(userRow(user, "saved")));
    }

    function renderRoomLock() {
        if (!roomLockBox || !roomLockLine) return;
        roomLockBox.innerHTML = "";
        const lock = settings.roomLock || {};
        const active = !!lock.active;
        const anchors = Array.isArray(lock.anchors) ? lock.anchors : [];

        roomLockBox.append(
            utils.el("div", {
                text: active
                    ? "Kilitli oda: " + (lock.roomId || "-") + " / anchor: " + anchors.length
                    : "Oda kilidi kapali.",
                css: { fontSize: "12px", opacity: "0.85" }
            }),
            button(active ? "Oda Kilidini Kapat" : "Odayi Kilitle", () => {
                if (active) stopRoomLock("manual");
                else startRoomLock();
            }, {
                width: "100%",
                marginTop: "5px",
                background: active ? "#7a2a2a" : "#2c4e77"
            })
        );

        roomLockLine.textContent = active
            ? (lock.missingSince ? "Odaya donus deneniyor." : "Odadaysa sure islemez; dusunce 10 dk denenir.")
            : "Bulundugun oda ve guvenilir dis oyuncular saklanir.";
    }

    function renderAll() {
        renderLoadedUsers();
        renderSavedUsers();
        renderRoomLock();
    }

    function mount() {
        container.innerHTML = "";

        const root = utils.el("div", {
            css: {
                display: "grid",
                gap: "8px",
                color: "#e6ffb3",
                fontFamily: "monospace"
            }
        });

        const loadBtn = button("Oyunculari Yukle", () => {
            const users = getRoomUsers();
            setLoadedUsers(users);
            renderLoadedUsers();
            setStatus(users.length ? users.length + " oyuncu yuklendi." : "Masada oyuncu bulunamadi.");
        }, { width: "100%", background: "#333" });

        statusLine = utils.el("div", {
            text: "Hazir.",
            css: {
                minHeight: "18px",
                fontSize: "12px",
                opacity: "0.85"
            }
        });

        const loadedTitle = utils.el("div", { text: "Masadaki oyuncular", css: { fontWeight: "bold" } });
        loadedList = utils.el("div", {
            css: {
                maxHeight: "210px",
                overflowY: "auto",
                border: "1px solid #333",
                borderRadius: "6px",
                padding: "4px",
                background: "#111"
            }
        });

        const savedHeader = utils.el("div", {
            css: {
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "6px"
            }
        });
        savedHeader.append(
            utils.el("div", { text: "Kaydedilenler", css: { fontWeight: "bold" } }),
            button("Tumu Sil", () => {
                stopFollow();
                settings.savedUsers = [];
                saveNow();
                renderSavedUsers();
                setStatus("Kaydedilenler temizlendi.");
            }, { background: "#5a2222" })
        );

        savedList = utils.el("div", {
            css: {
                maxHeight: "260px",
                overflowY: "auto",
                border: "1px solid #333",
                borderRadius: "6px",
                padding: "4px",
                background: "#111"
            }
        });

        const roomLockTitle = utils.el("div", {
            text: "Oda Kilidi",
            css: { fontWeight: "bold" }
        });
        roomLockBox = utils.el("div", {
            css: {
                border: "1px solid #333",
                borderRadius: "6px",
                padding: "6px",
                background: "#111",
                display: "grid",
                gap: "4px"
            }
        });
        roomLockLine = utils.el("div", {
            css: {
                minHeight: "16px",
                fontSize: "11px",
                opacity: "0.75"
            }
        });

        root.append(statusLine, loadedTitle, loadedList, loadBtn, savedHeader, savedList, roomLockTitle, roomLockBox, roomLockLine);
        container.appendChild(root);

        renderAll();
    }

    return {
        mount,
        setStatus,
        setRoomLockLine,
        renderLoadedUsers,
        renderSavedUsers,
        renderRoomLock,
        renderAll
    };
}
