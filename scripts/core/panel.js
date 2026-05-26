// panel.js
class ToolkitPanel {
    constructor(utils) {
        this.utils = utils;
        const { panel, header, tabStrip, body } = this.#buildLayout();
        this.panel = panel;
        this.header = header;
        this.tabStrip = tabStrip;
        this.body = body;
        this.tabMap = new Map();
        this.#enableDragging();
    }

    attachModule(module) {
        const tab = this.utils.el('button', {
            text: module.title,
            css: {
                padding: '6px 8px', cursor: 'pointer', border: '1px solid transparent',
                background: 'transparent', color: '#e6ffb3', opacity: '0.6'
            }
        });
        const content = this.utils.el('div', { css: { display: 'none' } });
        const settingsContainer = this.utils.el('div', { css: { marginTop: '12px' } });
        content.appendChild(settingsContainer);

        if (typeof module.renderSettings === 'function') {
            try { module.renderSettings.call(module, settingsContainer, { utils: this.utils }); }
            catch (error) { console.error('Modül yüklenemedi:', module.name, error); }
        }

        tab.addEventListener('click', () => this.showModule(module.name));

        this.tabStrip.appendChild(tab);
        this.body.appendChild(content);
        this.tabMap.set(module.name, { tab, content });
    }

    showModule(name) {
        this.tabMap.forEach(({ tab, content }, moduleName) => {
            const isActive = moduleName === name;
            tab.style.opacity = isActive ? '1' : '0.6';
            content.style.display = isActive ? 'block' : 'none';
        });
    }

    showFirstModule() {
        const first = this.tabMap.keys().next();
        if (!first.done) this.showModule(first.value);
    }

    #buildLayout() {
        const panel = this.utils.el('div', {
            attrs: { id: 'kiss-toolkit-panel' },
            css: {
                position: 'fixed', right: '10px', bottom: '10px', width: '400px', maxHeight: '720px',
                background: '#111', color: '#e6ffb3', border: '2px solid #bada55', borderRadius: '8px',
                zIndex: 999999, fontFamily: 'system-ui, monospace', boxShadow: '0 6px 20px rgba(0,0,0,.6)',
                display: 'flex', flexDirection: 'column'
            }
        });
        const header = this.utils.el('div', { css: { padding: '8px', fontWeight: 'bold', cursor: 'move' }, text: 'KissKiss Toolkit — Modular' });
        panel.appendChild(header);

        const tabContainer = this.utils.el('div', { css: { display: 'flex', alignItems: 'center', gap: '4px', padding: '8px' } });
        const btnLeft = this.utils.el('button', { text: '◀', css: { cursor: 'pointer', padding: '2px 6px' } });
        const btnRight = this.utils.el('button', { text: '▶', css: { cursor: 'pointer', padding: '2px 6px' } });
        const tabStrip = this.utils.el('div', { css: { display: 'flex', gap: '6px', overflowX: 'auto', flexGrow: 1, borderBottom: '1px solid rgba(186,218,85,0.15)' } });
        btnLeft.addEventListener('click', () => { tabStrip.scrollBy({ left: -100, behavior: 'smooth' }); });
        btnRight.addEventListener('click', () => { tabStrip.scrollBy({ left: 100, behavior: 'smooth' }); });
        tabContainer.appendChild(btnLeft);
        tabContainer.appendChild(tabStrip);
        tabContainer.appendChild(btnRight);
        panel.appendChild(tabContainer);

        const body = this.utils.el('div', { css: { padding: '10px', height: '620px', overflowY: 'auto', background: '#222' } });
        panel.appendChild(body);

        document.body.appendChild(panel);

        return { panel, header, tabStrip, body };
    }

    #enableDragging() {
        let isDragging = false;
        let offsetX = 0;
        let offsetY = 0;
        this.header.addEventListener('mousedown', event => {
            isDragging = true;
            offsetX = event.clientX - this.panel.offsetLeft;
            offsetY = event.clientY - this.panel.offsetTop;
        });
        document.addEventListener('mousemove', event => {
            if (!isDragging) return;
            this.panel.style.left = `${event.clientX - offsetX}px`;
            this.panel.style.top = `${event.clientY - offsetY}px`;
        });
        document.addEventListener('mouseup', () => { isDragging = false; });
    }
}
