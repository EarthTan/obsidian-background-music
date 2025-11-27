# Background Music Player

A simple Obsidian plugin that automatically plays background music when you open a note. You can choose different background music for each note.

## Features

- Set different background music for each note
- Support for local files and online URLs
- Automatic playback and stopping of music
- Simple metadata configuration

## Installation

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

## Usage

### Adding Background Music to a Note

Add a `bgm` or `BGM` field in the note's metadata section to specify the music file path or URL:

```yaml
---
bgm: /path/to/music.mp3
---
```

### Supported Formats

1. **Local absolute path**: `/path/to/music.mp3`
2. **Obsidian internal link**: `[[music.mp3]]`
3. **Online URL**: `{{https://example.com/music.mp3}}`

### Examples

```yaml
---
title: My Note
bgm: [[relaxing-music.mp3]]
---
```

Or using online music:

```yaml
---
title: Study Notes
bgm: {{https://example.com/study-music.mp3}}
---
```

## Supported Audio Formats

- MP3
- WAV
- OGG
- AAC
- Other browser-supported audio formats

## Configuration Options

Currently, the plugin provides the following configuration options:

- **Auto-play**: Automatically play music when opening a note
- **Loop**: Automatically restart music when it ends
- **Volume Control**: Set default volume level

## Troubleshooting

### Music Won't Play

1. **Check file path**: Ensure the music file path is correct and the file exists
2. **Check file permissions**: Ensure Obsidian has permission to access the music file
3. **Check network connection**: If using online URL, ensure network connection is working
4. **Check audio format**: Ensure the audio format is supported by the browser

### Music Playback Issues

1. **Volume issues**: Check system volume and browser volume settings
2. **Playback delay**: Large audio files may require loading time
3. **Multiple tabs issue**: Opening multiple notes with music in different tabs may cause conflicts

## Development Information

### Building the Plugin

```bash
npm install
npm run build
```

### Development Mode

```bash
npm run dev
```

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Contributing

Issues and pull requests are welcome!

## Changelog

### v1.0.0
- Initial release
- Support for local files and online URLs
- Auto-play functionality

---

**Note**: Please ensure you have legal rights to use the music files. This plugin only provides technical functionality and does not provide any music content.
