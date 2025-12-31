# MoonEye

A smart dark mode browser extension that intelligently applies dark mode to any website, reducing eye strain and improving readability in low-light environments.

## Download

**[Download Latest Release (v1.0.0)](https://github.com/sidshot/MoonEye/releases/download/v1.0.0/MoonEye-v1.0.0.zip)**

## Installation

1. Download `MoonEye-v1.0.0.zip` from the Releases section
2. Extract the zip file to a folder
3. Open your browser's extension page:
   - Chrome: `chrome://extensions`
   - Brave: `brave://extensions`
   - Edge: `edge://extensions`
4. Enable **Developer mode** (toggle in top-right)
5. Click **Load unpacked**
6. Select the extracted folder
7. MoonEye icon will appear in your toolbar

## Features

### Intelligent Dark Mode
- Automatic detection of native dark mode support
- Selective inversion for light-themed websites
- Preserves images, videos, and media in original colors

### Customizable Presets
- **B&W Mode**: High contrast grayscale for focused reading
- **Night Mode**: Warm tones with reduced brightness (default)
- **Deep Mode**: Maximum darkness with subtle warmth

### Blue Light Filter
- Independent slider (0-100%)
- Orange overlay reducing eye strain at night
- Works alongside dark mode filters

### Manual Control
- Brightness (50-150%)
- Contrast (50-150%)
- Warmth/Sepia (0-100%)
- Grayscale (0-100%)

### Per-Site Settings
- Whitelist specific websites
- Settings persist across sessions
- Real-time updates without page refresh

## Usage

1. Click the MoonEye icon in your toolbar
2. Toggle power button to enable/disable
3. Select a preset (B&W, Night, or Deep)
4. Use Manual mode for fine-grained control
5. Adjust Blue Light Filter as needed
6. Click Whitelist to disable on specific sites

### Keyboard Shortcut
- `Alt + D` - Toggle extension (coming soon)

## Technical Details

### File Structure
```
MoonEye/
├── manifest.json
├── background/
│   └── service_worker.js
├── content/
│   ├── engine.js
│   └── styles.css
├── popup/
│   ├── popup.html
│   ├── style.css
│   └── script.js
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

### Browser Compatibility
- Google Chrome (Manifest V3)
- Brave Browser
- Microsoft Edge
- Other Chromium-based browsers

### Permissions
- `storage` - Save preferences
- `tabs` - Apply to active tab
- `alarms` - State sync
- `activeTab` - Page access

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/name`)
3. Commit changes (`git commit -am 'Add feature'`)
4. Push branch (`git push origin feature/name`)
5. Open Pull Request

## License

MIT License

---

**Version**: 1.0.0  
**Author**: sidshot
