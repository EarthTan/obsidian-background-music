# Obsidian Background Music Player

A professional Obsidian plugin that automatically plays background music when opening notes. Each note can have different background music with intelligent volume control and professional-grade audio switching experience.

## 🌍 Language Versions

- **[中文文档](README_CN.md)** - 中文版本说明文档
- **[English Documentation](README_EN.md)** - English version documentation

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

## 🚀 Quick Start

### Installation

1. Open Obsidian Settings
2. Go to "Community Plugins" tab
3. Click "Browse" button
4. Search for "Background Music Player"
5. Click Install and Enable

### Basic Usage

Add background music to your notes using frontmatter:

```yaml
---
title: My Note
bgm: [[music.mp3]]
loudness: 0.5
---
```

### Volume Control Examples

```yaml
---
bgm: [[music.mp3]]
loudness: 0.3    # 0-1 range
---

---
bgm: [[music.mp3]]  
loudness: 50     # 1-100 range (auto-converted to 0.5)
---
```

## 📖 Detailed Documentation

For complete documentation, please refer to the language-specific versions:

- **[中文完整文档](README_CN.md)** - 包含详细的使用说明、技术特性和故障排除
- **[English Full Documentation](README_EN.md)** - Complete usage guide, technical features, and troubleshooting

## 🔧 Technical Highlights

- **Web Audio API** - Professional audio processing
- **GainNode Control** - Sample-level volume fading
- **Promise-based Operations** - Race condition free switching
- **Smart State Management** - Intelligent audio lifecycle

## 📄 License

MIT License - See [LICENSE](LICENSE) file for details.

---

**Note**: Please ensure you have legal rights to use the music files. This plugin only provides technical functionality and does not provide any music content.
