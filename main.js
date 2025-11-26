// main.js
// Obsidian plugin: Play BGM when opening a note
// Supports property "BGM": url | local path | wikilink

const { Plugin, TFile, normalizePath } = require('obsidian');

module.exports = class BGMOnOpenPlugin extends Plugin {
    constructor(app, manifest) {
        super(app, manifest);

        this.audio = null; // Single audio instance
        this.currentSrc = ""; // Track currently playing audio
    }

    async onload() {
        console.log("BGM-on-open plugin loaded.");

        // Event: note opened
        this.registerEvent(
            this.app.workspace.on("file-open", async (file) => {
                if (!file || !(file instanceof TFile)) return;
                await this.tryPlayForFile(file);
            })
        );
    }

    onunload() {
        console.log("BGM-on-open plugin unloaded.");
        if (this.audio) {
            this.audio.pause();
            this.audio = null;
        }
    }

    /**
     * Try playing audio for a note based on its frontmatter property "BGM"
     */
    async tryPlayForFile(file) {
        const metadata = this.app.metadataCache.getFileCache(file);
        if (!metadata || !metadata.frontmatter) {
            this.stopAudio();
            return;
        }

        let bgm = metadata.frontmatter["BGM"];
        if (!bgm) {
            this.stopAudio();
            return;
        }

        let audioSrc = await this.resolvePath(bgm, file);
        if (!audioSrc) {
            console.warn("Cannot resolve BGM:", bgm);
            this.stopAudio();
            return;
        }

        this.playAudio(audioSrc);
    }

    /**
     * Resolve Path / URL / Wikilink to actual playable source
     */
    async resolvePath(raw, currentFile) {
        raw = raw.trim();

        // 1. If is URL
        if (raw.startsWith("http://") || raw.startsWith("https://")) {
            return raw;
        }

        // 2. Wikilink: [[xxx.mp3]]
        const wikilink = raw.match(/^\[\[(.+?)\]\]$/);
        if (wikilink) {
            let target = wikilink[1];
            let linked = this.app.metadataCache.getFirstLinkpathDest(target, currentFile.path);
            if (linked) return this.getResourceUrl(linked);
            return null;
        }

        // 3. Local relative path
        const baseFolder = currentFile.parent.path;
        const fullPath = normalizePath(baseFolder + "/" + raw);
        const tfile = this.app.vault.getAbstractFileByPath(fullPath);

        if (tfile instanceof TFile) {
            return this.getResourceUrl(tfile);
        }

        return null;
    }

    /**
     * Convert file to vault resource URL usable in Audio()
     */
    getResourceUrl(tfile) {
        return this.app.vault.getResourcePath(tfile);
    }

    /**
     * Stop current audio
     */
    stopAudio() {
        if (this.audio) {
            this.audio.pause();
            this.audio = null;
            this.currentSrc = "";
        }
    }

    /**
     * Play audio, avoid reloading if same file
     */
    playAudio(src) {
        if (this.currentSrc === src) return; // avoid reloading same bgm

        this.stopAudio();

        this.audio = new Audio(src);
        this.audio.loop = true; // recommended behavior
        this.audio.volume = 0.9;
        this.audio.play().catch(err => console.error("Audio play error:", err));

        this.currentSrc = src;
    }
};
