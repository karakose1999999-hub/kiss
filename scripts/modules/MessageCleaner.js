    function createMessageCleanerModule() {
        return {
            name: 'messageCleaner',
            title: 'Mesaj Temizleme',
            defaultSettings: {},
            renderSettings(container) {
                const defaults = {
                    hideGifts: false,
                    hideWheel: false,
                    hideKissBoost: false,
                    hideGiftInline: false
            };
            let settings = JSON.parse(localStorage.getItem('msgCleanSettings') || JSON.stringify(defaults));

            try {
                if (window.__KISS_MESSAGE_CLEANER_TIMER) clearTimeout(window.__KISS_MESSAGE_CLEANER_TIMER);
                window.__KISS_MESSAGE_CLEANER_TIMER = null;
                if (window.__KISS_MESSAGE_CLEANER_OBSERVER) window.__KISS_MESSAGE_CLEANER_OBSERVER.disconnect();
                window.__KISS_MESSAGE_CLEANER_OBSERVER = null;
            } catch (_) {}

            function saveSettings() {
                const value = JSON.stringify(settings);
                    localStorage.setItem('msgCleanSettings', value);
                    if (typeof window.__KISS_ACCOUNT_SAVE_SETTING === "function") {
                        window.__KISS_ACCOUNT_SAVE_SETTING('msgCleanSettings', value);
                    }
                }

                function hideGiftMessages() {
                    if (!hasActiveFilters()) return;
                    const messages = document.querySelectorAll('.chat__message');
                    messages.forEach(message => {
                        const text = message.querySelector('.message__text')?.textContent?.trim() || '';
                        if (settings.hideGiftInline && message.querySelector('.gift__inline')) {
                            message.style.display = 'none';
                            return;
                        }
                        if (settings.hideWheel && text.includes("Çarkıfelek'te inanılmaz bir hediye kazandı")) {
                            message.style.display = 'none';
                            return;
                        }
                        if (settings.hideKissBoost && text.includes('ile öpüşme şansını artırdı')) {
                            message.style.display = 'none';
                            return;
                        }
                        if (settings.hideGifts && message.querySelector('.gift__inline')) {
                            message.style.display = 'none';
                        }
                    });
                }

                function hasActiveFilters() {
                    return !!(settings.hideGifts || settings.hideWheel || settings.hideKissBoost || settings.hideGiftInline);
                }

                container.innerHTML = `
                    <div style="padding:8px">
                        <label><input type="checkbox" id="hideGiftInline" ${settings.hideGiftInline ? 'checked' : ''}> 🎁 Hediye mesajlarını gizle</label><br>
                        <label><input type="checkbox" id="hideWheel" ${settings.hideWheel ? 'checked' : ''}> 🎰 Çarkıfelek mesajlarını gizle</label><br>
                        <label><input type="checkbox" id="hideKissBoost" ${settings.hideKissBoost ? 'checked' : ''}> 💋 Şans mesajlarını gizle</label><br>
                        <label><input type="checkbox" id="hideGifts" ${settings.hideGifts ? 'checked' : ''}> 🎀 Diğer hediye içeriklerini gizle</label>
                    </div>
                `;

                container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                    cb.addEventListener('change', event => {
                        settings[event.target.id] = event.target.checked;
                        saveSettings();
                        hideGiftMessages();
                        syncObserver();
                    });
                });

                hideGiftMessages();
                let cleanTimer = null;
                let observer = null;
                function scheduleHideGiftMessages() {
                    if (cleanTimer) return;
                    cleanTimer = setTimeout(() => {
                        cleanTimer = null;
                        try { window.__KISS_MESSAGE_CLEANER_TIMER = null; } catch (_) {}
                        hideGiftMessages();
                    }, 500);
                    try { window.__KISS_MESSAGE_CLEANER_TIMER = cleanTimer; } catch (_) {}
                }

                function syncObserver() {
                    if (!hasActiveFilters()) {
                        if (observer) observer.disconnect();
                        observer = null;
                        return;
                    }

                    if (observer) return;
                    observer = new MutationObserver(() => scheduleHideGiftMessages());
                    const chatContainer = document.querySelector('.chat__messages') || document.body;
                    observer.observe(chatContainer, { childList: true, subtree: true });
                    try { window.__KISS_MESSAGE_CLEANER_OBSERVER = observer; } catch (_) {}
                }

                syncObserver();
            }
        };
    }
