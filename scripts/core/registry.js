// registry.js
class ToolkitModuleRegistry {
    constructor(utils) {
        this.utils = utils;
        this.modules = new Map();
    }

    register(config) {
        const { name, title, renderSettings, defaultSettings = {} } = config;
        if (!name) throw new Error('Module must have name');
        if (this.modules.has(name)) return this.modules.get(name);

        const settings = this.utils.loadSettings(name, defaultSettings);
        const module = { name, title: title || name, renderSettings, defaultSettings, settings };
        this.modules.set(name, module);
        return module;
    }

    allModules() {
        return Array.from(this.modules.values());
    }
}
