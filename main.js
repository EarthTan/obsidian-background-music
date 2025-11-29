// main.js
// Obsidian plugin: Play BGM when opening a note
// Supports property "BGM" or "bgm": url | local path | wikilink
// Supports "loudness" frontmatter for volume (0.0 - 1.0)

const { Plugin, TFile, normalizePath } = require('obsidian');

module.exports = class BGMOnOpenPlugin extends Plugin {
    constructor(app, manifest) {
        super(app, manifest);

        this.audio = null;
        this.audioContext = null;
        this.gainNode = null;
        this.source = null;
        this.currentSrc = "";
        this.audioTimes = new Map(); // Save playback progress for each file
        this.initialPlay = true; // first open flag
        this.currentVolume = 0.9; // Track current volume for smooth transitions
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
        // Use fast stop for unload (no need to wait for fade)
        this.stopAudio(true);
        // Clean up audio context
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
        }
    }

    async tryPlayForFile(file) {
        const metadata = this.app.metadataCache.getFileCache(file);
        if (!metadata || !metadata.frontmatter) {
            await this.stopAudio();
            return;
        }

        // Support "BGM" or "bgm"
        let bgm = metadata.frontmatter["BGM"] || metadata.frontmatter["bgm"];
        if (!bgm) {
            await this.stopAudio();
            return;
        }

        // Handle volume with better error tolerance
        let volume = metadata.frontmatter["loudness"];
        if (typeof volume === "string") {
            volume = parseFloat(volume);
        }
        // Support 1-100 range (for "蠢货" users like you 😉)
        if (volume > 1 && volume <= 100) {
            volume = volume / 100; // Convert to 0-1 range
            console.log(`Converted loudness from ${metadata.frontmatter["loudness"]} to ${volume}`);
        }
        // Ensure volume is valid number between 0 and 1
        volume = Math.min(Math.max(volume || 0.9, 0), 1);

        let audioSrc = await this.resolvePath(bgm, file);
        if (!audioSrc) {
            console.warn("Cannot resolve BGM:", bgm);
            await this.stopAudio();
            return;
        }

        // Save current playback progress before switching
        if (this.audio && this.currentSrc !== audioSrc) {
            this.audioTimes.set(this.currentSrc, this.audio.currentTime);
            await this.stopAudio();  // ⚡ 等待 fade-out 完成再播放新音频
        }

        this.playAudio(audioSrc, volume);
    }

    async resolvePath(raw, currentFile) {
        raw = raw.trim();

        // URL - direct return
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

        // Local relative path - normalize and resolve
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
        return new Promise(resolve => {
            if (!this.audio) return resolve();

            if (fast) {
                this.audio.pause();
                this.audio = null;
                this.currentSrc = "";
                if (this.audioContext && this.audioContext.state !== 'closed') {
                    this.audioContext.close();
                }
                this.audioContext = null;
                this.gainNode = null;
                this.source = null;
                return resolve();
            }

            // Fade out before stopping using Web Audio API
            this.fadeAudio(this.currentVolume, 0, 0.3, () => {
                this.audio.pause();
                this.audio = null;
                this.currentSrc = "";
                if (this.audioContext && this.audioContext.state !== 'closed') {
                    this.audioContext.close();
                }
                this.audioContext = null;
                this.gainNode = null;
                this.source = null;
                resolve();
            });
        });
    }

    playAudio(src, volume = 0.9) {
        // Initialize audio object if not exists
        if (!this.audio) {
            this.audio = new Audio();
            this.audio.loop = true;
        }

        // Get saved playback time for this file
        const savedTime = this.audioTimes.get(src) || 0;

        // If same track is already playing, just update volume if needed
        if (this.currentSrc === src) {
            if (Math.abs(this.currentVolume - volume) > 0.01) {
                this.fadeAudio(this.currentVolume, volume, 0.2);
            }
            return;
        }

        // Different track - update source and play
        if (this.currentSrc !== src) {
            this.audio.src = src;
            this.audio.currentTime = savedTime;
        }

        // Initialize Web Audio API if not exists
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.gainNode = this.audioContext.createGain();
            this.source = this.audioContext.createMediaElementSource(this.audio);
            this.source.connect(this.gainNode);
            this.gainNode.connect(this.audioContext.destination);
        }

        // Resume audio context if suspended (browser autoplay policy)
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        // Set initial volume using Web Audio API for sample-level precision
        if (this.initialPlay) {
            // First play - set volume directly without fade
            this.gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
            this.currentVolume = volume;
        } else {
            // Subsequent plays - start at 0 and fade in
            this.gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
            this.currentVolume = 0;
        }

        // Play audio
        this.audio.play().catch(err => console.error("Audio play error:", err));

        // Fade in if not first play
        if (!this.initialPlay) {
            this.fadeAudio(0, volume, 0.3);
        }

        this.currentSrc = src;
        this.initialPlay = false;
    }

    fadeAudio(from, to, duration = 0.5, callback = null) {
        if (!this.audioContext || !this.gainNode) return;

        const currentTime = this.audioContext.currentTime;

        // Cancel any existing scheduled changes
        this.gainNode.gain.cancelScheduledValues(currentTime);

        // Set current value
        this.gainNode.gain.setValueAtTime(from, currentTime);

        // Schedule linear ramp to target value
        this.gainNode.gain.linearRampToValueAtTime(to, currentTime + duration);

        // Update current volume tracking
        this.currentVolume = to;

        // Set up callback if provided
        if (callback) {
            setTimeout(callback, duration * 1000);
        }
    }
};
