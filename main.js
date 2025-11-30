// main.js
// Obsidian plugin: Play BGM when opening a note
// Supports property "BGM" or "bgm": url | local path | wikilink
// Supports "loudness" frontmatter for volume (0.0 - 1.0)
// Now with Global BGM support and Settings Tab

const { Plugin, TFile, normalizePath, PluginSettingTab, Setting } = require('obsidian');

class BGMSettingTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const { containerEl } = this;

        containerEl.empty();

        containerEl.createEl("h2", { text: "BGM-on-open Settings" });

        // Global BGM Enable/Disable
        new Setting(containerEl)
            .setName("Enable Global BGM")
            .setDesc("Play background music when no note-specific BGM is active.")
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableGlobalBGM)
                .onChange(async (value) => {
                    this.plugin.settings.enableGlobalBGM = value;
                    await this.plugin.saveSettings();
                    this.plugin.reloadGlobalBGM();
                })
            );

        // Global BGM Source
        new Setting(containerEl)
            .setName("Global BGM source")
            .setDesc("URL, wikilink or local path, e.g. [[bgm.mp3]].")
            .addText(text => text
                .setValue(this.plugin.settings.globalBGMSource)
                .onChange(async (value) => {
                    this.plugin.settings.globalBGMSource = value;
                    await this.plugin.saveSettings();
                    this.plugin.reloadGlobalBGM();
                })
            );

        // Global BGM Volume
        new Setting(containerEl)
            .setName("Global BGM Volume")
            .setDesc("0.0 - 1.0 (or 1 - 100)")
            .addText(text => text
                .setValue(String(this.plugin.settings.globalBGMLoudness))
                .onChange(async (value) => {
                    this.plugin.settings.globalBGMLoudness = parseFloat(value);
                    await this.plugin.saveSettings();
                    this.plugin.reloadGlobalBGM();
                })
            );

        // Fade Duration
        new Setting(containerEl)
            .setName("Fade Duration")
            .setDesc("Fade in/out duration in seconds")
            .addText(text => text
                .setValue(String(this.plugin.settings.fadeDuration))
                .onChange(async (value) => {
                    this.plugin.settings.fadeDuration = parseFloat(value);
                    await this.plugin.saveSettings();
                })
            );
    }
}

module.exports = class BGMOnOpenPlugin extends Plugin {
    constructor(app, manifest) {
        super(app, manifest);

        // Note BGM player
        this.noteAudio = null;
        this.noteAudioContext = null;
        this.noteGainNode = null;
        this.noteSource = null;
        this.noteCurrentSrc = "";
        this.noteCurrentVolume = 0.9;
        this.noteInitialPlay = true;

        // Global BGM player
        this.globalAudio = null;
        this.globalAudioContext = null;
        this.globalGainNode = null;
        this.globalSource = null;
        this.globalCurrentSrc = "";
        this.globalCurrentVolume = 0.9;
        this.globalInitialPlay = true;

        // Shared state
        this.audioTimes = new Map(); // Save playback progress for each file
        this.settings = {
            enableGlobalBGM: true,
            globalBGMSource: "",
            globalBGMLoudness: 0.8,
            fadeDuration: 0.5
        };
    }

    async onload() {
        console.log("BGM-on-open plugin loaded.");

        // Load settings
        await this.loadSettings();

        // Register settings tab
        this.addSettingTab(new BGMSettingTab(this.app, this));

        // Register file open event
        this.registerEvent(
            this.app.workspace.on("file-open", async (file) => {
                if (!file || !(file instanceof TFile)) {
                    // No file opened - play global BGM if enabled
                    await this.handleNoFile();
                    return;
                }
                await this.tryPlayForFile(file);
            })
        );

        // Register active leaf change for detecting when no files are open
        this.registerEvent(
            this.app.workspace.on("active-leaf-change", async (leaf) => {
                if (!leaf || !leaf.view || !leaf.view.file) {
                    // No active file - play global BGM if enabled
                    await this.handleNoFile();
                }
            })
        );

        // Initialize global BGM if enabled
        if (this.settings.enableGlobalBGM && this.settings.globalBGMSource) {
            await this.playGlobalBGM();
        }

        // --- Add status bar volume slider ---
        this.volumeSliderEl = this.addStatusBarItem();
        this.volumeSliderEl.style.display = "flex";
        this.volumeSliderEl.style.alignItems = "center";
        this.volumeSliderEl.style.padding = "0 6px";

        this.volumeSliderInput = document.createElement("input");
        this.volumeSliderInput.type = "range";
        this.volumeSliderInput.min = "0";
        this.volumeSliderInput.max = "1";
        this.volumeSliderInput.step = "0.01";
        this.volumeSliderInput.value = this.settings.globalBGMLoudness || 0.8;
        this.volumeSliderInput.style.width = "100px";
        this.volumeSliderInput.style.cursor = "pointer";

        this.volumeSliderEl.appendChild(this.volumeSliderInput);

        // Change volume without restarting playback
        this.volumeSliderInput.addEventListener("input", (evt) => {
            const v = parseFloat(evt.target.value);

            // Save new global volume to settings
            this.settings.globalBGMLoudness = v;
            this.saveSettings();

            // Apply volume to NOTE BGM if playing
            if (this.noteGainNode) {
                this.noteGainNode.gain.setValueAtTime(
                    v,
                    this.noteAudioContext.currentTime
                );
                this.noteCurrentVolume = v;
            }

            // Apply volume to GLOBAL BGM if playing
            if (this.globalGainNode) {
                this.globalGainNode.gain.setValueAtTime(
                    v,
                    this.globalAudioContext.currentTime
                );
                this.globalCurrentVolume = v;
            }
        });
    }

    async onunload() {
        console.log("BGM-on-open plugin unloaded.");
        // Use fast stop for unload (no need to wait for fade)
        this.stopNoteAudio(true);
        this.stopGlobalAudio(true);
        // Clean up audio contexts
        if (this.noteAudioContext && this.noteAudioContext.state !== 'closed') {
            this.noteAudioContext.close();
        }
        if (this.globalAudioContext && this.globalAudioContext.state !== 'closed') {
            this.globalAudioContext.close();
        }
    }

    async loadSettings() {
        this.settings = Object.assign({}, this.settings, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async reloadGlobalBGM() {
        // Stop current global BGM
        await this.stopGlobalAudio();
        
        // If global BGM is enabled and has source, play it
        if (this.settings.enableGlobalBGM && this.settings.globalBGMSource) {
            await this.playGlobalBGM();
        }
    }

    async handleNoFile() {
        // No file is open - stop note BGM and play global BGM if enabled
        if (this.noteAudio && this.noteCurrentSrc) {
            this.audioTimes.set(this.noteCurrentSrc, this.noteAudio.currentTime);
            await this.stopNoteAudio();
        }
        
        if (this.settings.enableGlobalBGM && this.settings.globalBGMSource) {
            await this.playGlobalBGM();
        }
    }

    async tryPlayForFile(file) {
        const metadata = this.app.metadataCache.getFileCache(file);
        if (!metadata || !metadata.frontmatter) {
            // No frontmatter - stop note BGM and play global BGM
            if (this.noteAudio && this.noteCurrentSrc) {
                this.audioTimes.set(this.noteCurrentSrc, this.noteAudio.currentTime);
                await this.stopNoteAudio();
            }
            
            if (this.settings.enableGlobalBGM && this.settings.globalBGMSource) {
                await this.playGlobalBGM();
            }
            return;
        }

        // Support "BGM" or "bgm"
        let bgm = metadata.frontmatter["BGM"] || metadata.frontmatter["bgm"];
        if (!bgm) {
            // No BGM in frontmatter - stop note BGM and play global BGM
            if (this.noteAudio && this.noteCurrentSrc) {
                this.audioTimes.set(this.noteCurrentSrc, this.noteAudio.currentTime);
                await this.stopNoteAudio();
            }
            
            if (this.settings.enableGlobalBGM && this.settings.globalBGMSource) {
                await this.playGlobalBGM();
            }
            return;
        }

        // Handle volume with better error tolerance
        let volume = metadata.frontmatter["loudness"];
        if (typeof volume === "string") {
            volume = parseFloat(volume);
        }
        // Support 1-100 range
        if (volume > 1 && volume <= 100) {
            volume = volume / 100; // Convert to 0-1 range
            console.log(`Converted loudness from ${metadata.frontmatter["loudness"]} to ${volume}`);
        }
        // Ensure volume is valid number between 0 and 1
        volume = Math.min(Math.max(volume || 0.9, 0), 1);

        let audioSrc = await this.resolvePath(bgm, file);
        if (!audioSrc) {
            console.warn("Cannot resolve BGM:", bgm);
            // Save current playback progress and stop note BGM
            if (this.noteAudio && this.noteCurrentSrc) {
                this.audioTimes.set(this.noteCurrentSrc, this.noteAudio.currentTime);
                await this.stopNoteAudio();
            }
            
            if (this.settings.enableGlobalBGM && this.settings.globalBGMSource) {
                await this.playGlobalBGM();
            }
            return;
        }

        // Stop global BGM first
        if (this.globalAudio && this.globalCurrentSrc) {
            this.audioTimes.set("__global__", this.globalAudio.currentTime);
            await this.stopGlobalAudio();
        }

        // Save current note playback progress before switching
        if (this.noteAudio && this.noteCurrentSrc !== audioSrc) {
            this.audioTimes.set(this.noteCurrentSrc, this.noteAudio.currentTime);
            await this.stopNoteAudio();
        }

        this.playNoteAudio(audioSrc, volume);
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

    // Note Audio Methods
    stopNoteAudio(fast = false) {
        return new Promise(resolve => {
            if (!this.noteAudio) return resolve();

            if (fast) {
                this.noteAudio.pause();
                this.noteAudio = null;
                this.noteCurrentSrc = "";
                if (this.noteAudioContext && this.noteAudioContext.state !== 'closed') {
                    this.noteAudioContext.close();
                }
                this.noteAudioContext = null;
                this.noteGainNode = null;
                this.noteSource = null;
                return resolve();
            }

            // Fade out before stopping using Web Audio API
            this.fadeAudio('note', this.noteCurrentVolume, 0, this.settings.fadeDuration, () => {
                this.noteAudio.pause();
                this.noteAudio = null;
                this.noteCurrentSrc = "";
                if (this.noteAudioContext && this.noteAudioContext.state !== 'closed') {
                    this.noteAudioContext.close();
                }
                this.noteAudioContext = null;
                this.noteGainNode = null;
                this.noteSource = null;
                resolve();
            });
        });
    }

    playNoteAudio(src, volume = 0.9) {
        // Initialize audio object if not exists
        if (!this.noteAudio) {
            this.noteAudio = new Audio();
            this.noteAudio.loop = true;
        }

        // Get saved playback time for this file
        const savedTime = this.audioTimes.get(src) || 0;

        // If same track is already playing, just update volume if needed
        if (this.noteCurrentSrc === src) {
            // Commented out to prevent fade when volume changes via slider
            // if (Math.abs(this.noteCurrentVolume - volume) > 0.01) {
            //     this.fadeAudio('note', this.noteCurrentVolume, volume, 0.2);
            // }
            return;
        }

        // Different track - update source and play
        if (this.noteCurrentSrc !== src) {
            this.noteAudio.src = src;
            this.noteAudio.currentTime = savedTime;
        }

        // Initialize Web Audio API if not exists
        if (!this.noteAudioContext) {
            this.noteAudioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.noteGainNode = this.noteAudioContext.createGain();
            this.noteSource = this.noteAudioContext.createMediaElementSource(this.noteAudio);
            this.noteSource.connect(this.noteGainNode);
            this.noteGainNode.connect(this.noteAudioContext.destination);
        }

        // Resume audio context if suspended (browser autoplay policy)
        if (this.noteAudioContext.state === 'suspended') {
            this.noteAudioContext.resume();
        }

        // Set initial volume using Web Audio API for sample-level precision
        if (this.noteInitialPlay) {
            // First play - set volume directly without fade
            this.noteGainNode.gain.setValueAtTime(volume, this.noteAudioContext.currentTime);
            this.noteCurrentVolume = volume;
        } else {
            // Subsequent plays - start at 0 and fade in
            this.noteGainNode.gain.setValueAtTime(0, this.noteAudioContext.currentTime);
            this.noteCurrentVolume = 0;
        }

        // Play audio
        this.noteAudio.play().catch(err => console.error("Note Audio play error:", err));

        // Fade in if not first play
        if (!this.noteInitialPlay) {
            this.fadeAudio('note', 0, volume, this.settings.fadeDuration);
        }

        this.noteCurrentSrc = src;
        this.noteInitialPlay = false;

        // Update slider to match current volume
        if (this.volumeSliderInput) {
            this.volumeSliderInput.value = volume;
        }
    }

    // Global Audio Methods
    stopGlobalAudio(fast = false) {
        return new Promise(resolve => {
            if (!this.globalAudio) return resolve();

            if (fast) {
                this.globalAudio.pause();
                this.globalAudio = null;
                this.globalCurrentSrc = "";
                if (this.globalAudioContext && this.globalAudioContext.state !== 'closed') {
                    this.globalAudioContext.close();
                }
                this.globalAudioContext = null;
                this.globalGainNode = null;
                this.globalSource = null;
                return resolve();
            }

            // Fade out before stopping using Web Audio API
            this.fadeAudio('global', this.globalCurrentVolume, 0, this.settings.fadeDuration, () => {
                this.globalAudio.pause();
                this.globalAudio = null;
                this.globalCurrentSrc = "";
                if (this.globalAudioContext && this.globalAudioContext.state !== 'closed') {
                    this.globalAudioContext.close();
                }
                this.globalAudioContext = null;
                this.globalGainNode = null;
                this.globalSource = null;
                resolve();
            });
        });
    }

    async playGlobalBGM() {
        if (!this.settings.enableGlobalBGM || !this.settings.globalBGMSource) {
            return;
        }

        // Resolve global BGM source
        let audioSrc = await this.resolveGlobalBGMSource();
        if (!audioSrc) {
            console.warn("Cannot resolve Global BGM:", this.settings.globalBGMSource);
            return;
        }

        // Handle volume conversion for global BGM
        let volume = this.settings.globalBGMLoudness;
        if (volume > 1 && volume <= 100) {
            volume = volume / 100;
        }
        volume = Math.min(Math.max(volume || 0.8, 0), 1);

        this.playGlobalAudio(audioSrc, volume);
    }

    async resolveGlobalBGMSource() {
        const raw = this.settings.globalBGMSource.trim();

        // URL - direct return
        if (raw.startsWith("http://") || raw.startsWith("https://")) {
            return raw;
        }

        // Wikilink [[xxx.mp3]]
        const wikilink = raw.match(/^\[\[(.+?)\]\]$/);
        if (wikilink) {
            let target = wikilink[1];
            let linked = this.app.metadataCache.getFirstLinkpathDest(target, "");
            if (linked) return this.getResourceUrl(linked);
            return null;
        }

        // Local relative path - try to resolve from vault root
        const fullPath = normalizePath(raw);
        const tfile = this.app.vault.getAbstractFileByPath(fullPath);

        if (tfile instanceof TFile) {
            return this.getResourceUrl(tfile);
        }

        return null;
    }

    playGlobalAudio(src, volume = 0.8) {
        // Initialize audio object if not exists
        if (!this.globalAudio) {
            this.globalAudio = new Audio();
            this.globalAudio.loop = true;
        }

        // Get saved playback time for global BGM
        const savedTime = this.audioTimes.get("__global__") || 0;

        // If same track is already playing, just update volume if needed
        if (this.globalCurrentSrc === src) {
            // Commented out to prevent fade when volume changes via slider
            // if (Math.abs(this.globalCurrentVolume - volume) > 0.01) {
            //     this.fadeAudio('global', this.globalCurrentVolume, volume, 0.2);
            // }
            return;
        }

        // Different track - update source and play
        if (this.globalCurrentSrc !== src) {
            this.globalAudio.src = src;
            this.globalAudio.currentTime = savedTime;
        }

        // Initialize Web Audio API if not exists
        if (!this.globalAudioContext) {
            this.globalAudioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.globalGainNode = this.globalAudioContext.createGain();
            this.globalSource = this.globalAudioContext.createMediaElementSource(this.globalAudio);
            this.globalSource.connect(this.globalGainNode);
            this.globalGainNode.connect(this.globalAudioContext.destination);
        }

        // Resume audio context if suspended (browser autoplay policy)
        if (this.globalAudioContext.state === 'suspended') {
            this.globalAudioContext.resume();
        }

        // Set initial volume using Web Audio API for sample-level precision
        if (this.globalInitialPlay) {
            // First play - set volume directly without fade
            this.globalGainNode.gain.setValueAtTime(volume, this.globalAudioContext.currentTime);
            this.globalCurrentVolume = volume;
        } else {
            // Subsequent plays - start at 0 and fade in
            this.globalGainNode.gain.setValueAtTime(0, this.globalAudioContext.currentTime);
            this.globalCurrentVolume = 0;
        }

        // Play audio
        this.globalAudio.play().catch(err => console.error("Global Audio play error:", err));

        // Fade in if not first play
        if (!this.globalInitialPlay) {
            this.fadeAudio('global', 0, volume, this.settings.fadeDuration);
        }

        this.globalCurrentSrc = src;
        this.globalInitialPlay = false;

        // Update slider to match current volume
        if (this.volumeSliderInput) {
            this.volumeSliderInput.value = volume;
        }
    }

    // Shared fade audio function
    fadeAudio(playerType, from, to, duration = 0.5, callback = null) {
        let gainNode, audioContext;
        
        if (playerType === 'note') {
            gainNode = this.noteGainNode;
            audioContext = this.noteAudioContext;
        } else if (playerType === 'global') {
            gainNode = this.globalGainNode;
            audioContext = this.globalAudioContext;
        } else {
            return;
        }

        if (!audioContext || !gainNode) return;

        const currentTime = audioContext.currentTime;

        // Cancel any existing scheduled changes
        gainNode.gain.cancelScheduledValues(currentTime);

        // Set current value
        gainNode.gain.setValueAtTime(from, currentTime);

        // Schedule linear ramp to target value
        gainNode.gain.linearRampToValueAtTime(to, currentTime + duration);

        // Update current volume tracking
        if (playerType === 'note') {
            this.noteCurrentVolume = to;
        } else if (playerType === 'global') {
            this.globalCurrentVolume = to;
        }

        // Set up callback if provided
        if (callback) {
            setTimeout(callback, duration * 1000);
        }
    }
};
