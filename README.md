# MoonEye

A browser extension that intelligently applies dark mode to any website, reducing eye strain and improving readability in low-light environments.

## Features

### Intelligent Dark Mode
- Automatic detection of native dark mode support
- Selective inversion for light-themed websites
- Preserves images, videos, and media in their original colors

### Customizable Presets
- **B&W Mode**: High contrast grayscale for focused reading
- **Night Mode**: Warm tones with reduced brightness
- **Deep Mode**: Maximum darkness with subtle warmth

### Blue Light Filter
- Independent blue light reduction slider (0-100%)
- Orange overlay that reduces eye strain during night use
- Works alongside dark mode filters

### Manual Control
- Brightness adjustment (50-150%)
- Contrast control (50-150%)
- Warmth/Sepia filter (0-100%)
- Grayscale intensity (0-100%)

### Per-Site Settings
- Whitelist specific websites
- Settings persist across browser sessions
- Real-time updates without page refresh

## Installation

### From Source
1. Clone this repository
2. Open your browser's extension management page
   - Chrome: `chrome://extensions`
   - Brave: `brave://extensions`
   - Edge: `edge://extensions`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the extension directory

### From Release
Download the latest release from the Releases page and follow the installation instructions above.

## Usage

1. Click the MoonEye icon in your browser toolbar
2. Toggle the power button to enable/disable
3. Select a preset (B&W, Night, or Deep) for quick setup
4. Use Manual mode for fine-grained control
5. Adjust the Blue Light Filter slider as needed
6. Click "Whitelist" to disable on specific sites

### Keyboard Shortcut
- `Alt + D` - Toggle extension on/off (coming soon)

## Technical Details

### Architecture
```
MoonEye/
├── manifest.json          # Extension configuration
├── background/
│   └── service_worker.js  # State management and messaging
├── content/
│   ├── engine.js          # DOM manipulation and filter application
│   └── styles.css         # CSS filters and dark mode rules
├── popup/
│   ├── popup.html         # Extension UI
│   ├── style.css          # Glassmorphism styling
│   └── script.js          # UI logic and state handling
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

### How It Works
1. Content script injects at `document_start` to prevent flash of white
2. Service worker maintains global state and broadcasts updates
3. Dark mode is applied using CSS `filter: invert(1) hue-rotate(180deg)`
4. Media elements are reverse-inverted to preserve original colors
5. Blue light filter uses a fixed overlay with `mix-blend-mode: multiply`

### Browser Compatibility
- Google Chrome (Manifest V3)
- Brave Browser
- Microsoft Edge
- Other Chromium-based browsers

## Permissions

- `storage` - Save user preferences
- `tabs` - Apply settings to active tab
- `alarms` - Periodic state synchronization
- `activeTab` - Access current page for dark mode application

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/new-feature`)
3. Commit your changes (`git commit -am 'Add new feature'`)
4. Push to the branch (`git push origin feature/new-feature`)
5. Open a Pull Request

## License

MIT License - see LICENSE file for details.

## Acknowledgments

- Inspired by dark mode extensions like Dark Reader
- Uses CSS filter-based inversion technique
- Glassmorphism UI design principles

---

**Version**: 1.0.0  
**Author**: [Your Name]  
**Repository**: [GitHub URL]
