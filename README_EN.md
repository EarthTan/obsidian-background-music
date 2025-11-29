# Obsidian Background Music Player

A professional Obsidian plugin that automatically plays background music when opening notes. Each note can have different background music with intelligent volume control and professional-grade audio switching experience.

## ✨ Core Features

### 🎵 Professional Audio Experience
- **Noise-free fading** - Uses Web Audio API for sample-level smooth transitions
- **Intelligent volume control** - Supports both 0-1 and 1-100 volume ranges
- **Playback progress saving** - Automatically saves and restores playback position when switching notes
- **Loop playback** - Background music automatically loops

### 🔄 Smart Switching Management
- **Sequential audio switching** - Waits for previous music to completely fade out before playing new music
- **Pane awareness** - Automatically stops music when the last pane is closed
- **No race conditions** - Promise-based audio operations ensure switching stability

### 📁 Flexible Music Source Support
- **Local files** - Supports relative and absolute paths
- **Wiki links** - Uses `[[music-file.mp3]]` format
- **Online URLs** - Supports HTTP/HTTPS online music
- **Multiple formats** - MP3, WAV, OGG, AAC and other browser-supported formats

## 🚀 Installation

### Install from Community Plugins (Recommended)

1. Open Obsidian Settings
2. Go to "Community Plugins" tab
3. Click "Browse" button
4. Search for "Background Music Player"
5. Click Install
6. Enable the plugin

### Manual Installation

1. Download the latest version of the plugin files
2. Extract to your Obsidian vault's plugins folder: `.obsidian/plugins/obsidian-backgroud-music/`
3. Reload Obsidian
4. Enable "Background Music Player" in Community Plugins

## 📖 Usage

### Adding Background Music to a Note

Add a `bgm` or `BGM` field in the note's metadata section to specify the music file path or URL:

```yaml
---
title: My Note
bgm: /path/to/music.mp3
loudness: 0.5
---
```

### Volume Control

Supports two volume range formats:

```yaml
---
bgm: [[music.mp3]]
loudness: 0.3    # 0-1 range (standard)
---

---
bgm: [[music.mp3]]  
loudness: 50     # 1-100 range (automatically converted to 0.5)
---

---
bgm: [[music.mp3]]
loudness: "75"   # String format also supported
---
```

### Supported Music Source Formats

1. **Local relative path**: `music.mp3` or `audio/music.mp3`
2. **Local absolute path**: `/path/to/music.mp3`
3. **Obsidian wiki link**: `[[music-file.mp3]]`
4. **Online URL**: `https://example.com/music.mp3`

## 🎯 Usage Examples

### Basic Usage

```yaml
---
title: Study Notes
bgm: [[study-music.mp3]]
loudness: 0.4
---
```

### Online Music

```yaml
---
title: Work Notes  
bgm: https://example.com/focus-music.mp3
loudness: 60
---
```

### Different Volume Settings

```yaml
---
title: Relaxation Notes
bgm: [[relaxing-music.mp3]]
loudness: 0.2    # 20% volume
---

---
title: Motivation Notes
bgm: [[energetic-music.mp3]]  
loudness: 80     # 80% volume
---
```

## 🔧 Technical Features

### Professional Audio Processing
- **Web Audio API** - Uses browser's native audio engine
- **GainNode control** - Sample-level volume fading without noise
- **AudioContext management** - Intelligent audio context lifecycle management
- **Promise-based operations** - Ensures sequential audio switching

### Smart State Management
- **Map storage for progress** - Each file's playback progress is saved independently
- **active-leaf-change listening** - Detects pane changes and intelligently stops music
- **file-open event** - Traditional file opening event support
- **Race condition protection** - Prevents audio overlap during fast switching

### User Experience Optimization
- **No fade-in on first play** - Direct playback when opening a note for the first time
- **Fade-in on subsequent switches** - Smooth fade-in effect when switching notes
- **Stop on pane close** - Automatically stops music when the last pane is closed
- **Error tolerance** - Robust volume and path handling

## 🛠️ Troubleshooting

### Music Won't Play

1. **Check file path**: Ensure the music file path is correct and the file exists
2. **Check file permissions**: Ensure Obsidian has permission to access the music file
3. **Check network connection**: If using online URL, ensure network connection is working
4. **Check audio format**: Ensure the audio format is supported by the browser

### Playback Issues

1. **Volume issues**: Check system volume and browser volume settings
2. **Playback delay**: Large audio files may require loading time
3. **Switching noise**: Ensure you're using the latest version, switching noise issues have been fixed

### Common Questions

**Q: There's a "pop" sound when switching notes**
A: This has been resolved through sequential audio switching technology. Make sure you're using the latest version.

**Q: Music continues playing after closing a note**
A: This has been resolved through active-leaf-change listening. The plugin intelligently detects pane status.

**Q: Volume settings don't work**
A: Supports both 0-1 and 1-100 ranges. The plugin automatically converts between them.

## 🏗️ Development Information

### Building the Plugin

```bash
npm install
npm run build
```

### Development Mode

```bash
npm run dev
```

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Issues and pull requests are welcome!

## 📋 Changelog

### v4.0.0
- **Professional audio architecture** - Uses AudioBufferSourceNode for truly noise-free playback
- **Intelligent volume conversion** - Supports automatic conversion of 1-100 range
- **Smart pane management** - Automatically stops music when panes are closed
- **Sequential audio switching** - Promise-based switching control eliminates race conditions

### v3.0.0
- **Web Audio API** - Uses GainNode for sample-level volume fading
- **Playback progress saving** - Each file's playback progress is saved independently
- **Smart state management** - Improved audio state machine

### v2.0.0
- **Performance optimization** - Avoids repeated Audio object creation
- **requestAnimationFrame** - Smoother fading effects
- **Error tolerance** - Robust volume handling logic

### v1.0.0
- Initial release
- Support for local files and online URLs
- Auto-play functionality

---

**Note**: Please ensure you have legal rights to use the music files. This plugin only provides technical functionality and does not provide any music content.
