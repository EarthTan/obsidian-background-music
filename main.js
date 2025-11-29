// main.js
// Obsidian plugin: Play BGM when opening a note
// Supports property "BGM" or "bgm": url | local path | wikilink
// Supports "loudness" frontmatter for volume (0.0 - 1.0)

const { Plugin, TFile, normalizePath } = require('obsidian');

module.exports = class BGMOnOpenPlugin extends Plugin {
    constructor(app, manifest) {
        super(app, manifest);

        this.audio = null;
        this.currentSrc = "";
        this.currentTime = 0; // save playback progress
        this.initialPlay = true; // first open flag
        this.fadeInterval = null;
    }

    async onload() {
        console.log("BGM-on-open plugin loaded.");

        this.registerEvent(
            this.app.workspace.on("file-open", async (file) => {
                if (!file || !(file instanceof TFile)) return;
                await this.tryPlayForFile(file);
            })
        );
    }

    onunload() {
        console.log("BGM-on-open plugin unloaded.");
        this.stopAudio(true);
    }

    async tryPlayForFile(file) {
        const metadata = this.app.metadataCache.getFileCache(file);
        if (!metadata || !metadata.frontmatter) {
            this.stopAudio();
            return;
        }

        // Support "BGM" or "bgm"
        let bgm = metadata.frontmatter["BGM"] || metadata.frontmatter["bgm"];
        if (!bgm) {
            this.stopAudio();
            return;
        }

        let volume = metadata.frontmatter["loudness"];
        if (typeof volume !== "number" || volume < 0 || volume > 1) {
            volume = 0.9; // default volume
        }

        let audioSrc = await this.resolvePath(bgm, file);
        if (!audioSrc) {
            console.warn("Cannot resolve BGM:", bgm);
            this.stopAudio();
            return;
        }

        // If switching to a different file, save progress of previous
        if (this.audio && this.currentSrc !== audioSrc) {
            this.currentTime = this.audio.currentTime;
        }

        this.playAudio(audioSrc, volume);
    }

    async resolvePath(raw, currentFile) {
        raw = raw.trim();

        // URL
        if (raw.startsWith("http://") || raw.startsWith("https://")) {
            return raw;
        }

        // Wikilink [[xxx.mp3]]
        const wikilink = raw.match(/^\[\[(.+?)\]\]$/);
        if (wikilink) {
            let target = wikilink[1];
            let linked = this.app.metadataCache.getFirstLinkpathDest(target, currentFile.path);
            if (linked) return this.getResourceUrl(linked);
            return null;
        }

        // Local relative path
        const baseFolder = currentFile.parent.path;
        const fullPath = normalizePath(baseFolder + "/" + raw);
        const tfile = this.app.vault.getAbstractFileByPath(fullPath);

        if (tfile instanceof TFile) {
            return this.getResourceUrl(tfile);
        }

        return null;
    }

    getResourceUrl(tfile) {
        return this.app.vault.getResourcePath(tfile);
    }

    stopAudio(fast = false) {
        if (!this.audio) return;

        if (fast) {
            this.audio.pause();
            this.audio = null;
            this.currentSrc = "";
            return;
        }

        // Fade out before stopping
        this.fadeAudio(this.audio.volume, 0, 300, () => {
            this.audio.pause();
            this.audio = null;
            this.currentSrc = "";
        });
    }

    playAudio(src, volume = 0.9) {
        if (this.currentSrc === src && this.audio) return; // same track

        // Stop current with fade
        if (this.audio) {
            this.stopAudio();
        }

        this.audio = new Audio(src);
        this.audio.loop = true;
        this.audio.volume = this.initialPlay ? volume : 0; // fade in if not first open
        if (!this.initialPlay && this.currentTime > 0) {
            this.audio.currentTime = this.currentTime;
        }

        this.audio.play().catch(err => console.error("Audio play error:", err));

        if (!this.initialPlay) {
            this.fadeAudio(0, volume, 300); // fade in
        }

        this.currentSrc = src;
        this.initialPlay = false;
        this.currentTime = 0;
    }

    fadeAudio(from, to, duration = 500, callback = null) {
        if (!this.audio) return;
        if (this.fadeInterval) clearInterval(this.fadeInterval);

        const stepTime = 50;
        const steps = duration / stepTime;
        const delta = (to - from) / steps;
        let currentStep = 0;

        this.audio.volume = from;

        this.fadeInterval = setInterval(() => {
            if (!this.audio) {
                clearInterval(this.fadeInterval);
                return;
            }
            currentStep++;
            let newVol = this.audio.volume + delta;
            newVol = Math.max(0, Math.min(1, newVol));
            this.audio.volume = newVol;

            if (currentStep >= steps) {
                clearInterval(this.fadeInterval);
                if (callback) callback();
            }
        }, stepTime);
    }
};
