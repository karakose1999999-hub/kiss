// storageUtils.js
const StorageUtils = {
    prefix: 'kiss_toolkit_',
    getKey(moduleName) { return this.prefix + moduleName; },
    saveSettings(moduleName, obj) {
        try {
            const key = this.getKey(moduleName);
            const value = JSON.stringify(obj);
            localStorage.setItem(key, value);
            if (typeof window.__KISS_ACCOUNT_SAVE_SETTING === 'function') {
                window.__KISS_ACCOUNT_SAVE_SETTING(key, value);
            }
        }
        catch (error) { console.error(error); }
    },
    loadSettings(moduleName, defaults = {}) {
        try {
            const value = localStorage.getItem(this.getKey(moduleName));
            return value ? JSON.parse(value) : defaults;
        } catch (error) {
            console.error(error);
            return defaults;
        }
    },
    exportAllSettings() {
        const output = {};
        for (let i = 0; i < localStorage.length; i += 1) {
            const key = localStorage.key(i);
            if (!key || !key.startsWith(this.prefix)) continue;
            try { output[key] = JSON.parse(localStorage.getItem(key)); }
            catch { output[key] = localStorage.getItem(key); }
        }
        return output;
    },
    importAllSettings(obj) {
        if (!obj || typeof obj !== 'object') return;
        Object.keys(obj).forEach(key => {
            if (!key.startsWith(this.prefix)) return;
            try {
                const value = JSON.stringify(obj[key]);
                localStorage.setItem(key, value);
                if (typeof window.__KISS_ACCOUNT_SAVE_SETTING === 'function') window.__KISS_ACCOUNT_SAVE_SETTING(key, value);
            }
            catch {
                localStorage.setItem(key, obj[key]);
                if (typeof window.__KISS_ACCOUNT_SAVE_SETTING === 'function') window.__KISS_ACCOUNT_SAVE_SETTING(key, obj[key]);
            }
        });
    },
    el(tag, opts = {}, ...children) {
        const element = document.createElement(tag);
        if (opts.css) Object.assign(element.style, opts.css);
        if (opts.html) element.innerHTML = opts.html;
        if (opts.text) element.textContent = opts.text;
        if (opts.attrs) Object.entries(opts.attrs).forEach(([key, value]) => element.setAttribute(key, value));
        children.flat().forEach(child => {
            if (child == null) return;
            element.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
        });
        return element;
    }
};
