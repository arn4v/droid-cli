# Android Interactive CLI

A powerful, interactive CLI tool for Android development that brings the essential features of Android Studio to your terminal. Inspired by Expo CLI, this tool provides fast incremental builds, device management, and debugging without the heavy GUI overhead.

## Features

- 🔨 **Incremental Builds** - Fast builds using Gradle's build cache
- 📱 **Device Management** - Easy selection and management of emulators and physical devices  
- 🚀 **Smart Emulator Startup** - Automatically offers to start emulators when no devices connected
- 📋 **Logcat Integration** - Spawns terminal with filtered app logs
- ⚙️ **Gradle Tasks** - Run common tasks like clean, sync, and custom tasks
- 🎯 **Interactive Menu** - User-friendly menu system for all operations
- 🛠️ **Configuration** - Project-specific settings via `android-cli.json`
- 🔄 **Auto-detection** - Automatically detects Android projects and devices

## Installation

```bash
npm install -g android-interactive-cli
```

## Prerequisites

- **Node.js** >= 14.0.0
- **Android SDK** with ADB in PATH
- **Java Development Kit (JDK)**
- An Android project with Gradle wrapper

## Quick Start

1. Navigate to your Android project directory
2. Initialize the CLI configuration:
   ```bash
   android-cli init
   ```
3. Start the interactive menu:
   ```bash
   android-cli
   ```

## Commands

### Global Options

All commands support the `--project` (or `-p`) flag to specify the Android project directory:

```bash
android-cli --project /path/to/android/project [command]
```

This allows you to run the CLI from anywhere while targeting a specific project.

### Interactive Mode
```bash
android-cli [--project <path>]
```
Launches the main interactive menu with all available options.

### Direct Commands

#### Build & Run
```bash
android-cli build [--variant debug|release] [--device device-id] [--project <path>]
```
Builds the app and deploys it to the selected device.

#### Device Management
```bash
android-cli device [--project <path>]
```
List and select target devices/emulators.

#### Logcat
```bash
android-cli logcat [--device device-id] [--project <path>]
```
Opens logcat in a new terminal window, filtered for your app.

#### Gradle Tasks
```bash
android-cli gradle <task> [--args "additional arguments"] [--project <path>]
```
Run any Gradle task with optional arguments.

#### Initialize Configuration
```bash
android-cli init [--project <path>]
```
Set up or reconfigure the CLI for your project.

#### Build Variant Selection
```bash
android-cli variant [--project <path>]
```
Select the default build variant (debug/release) for the project.

## Configuration

The CLI uses an `android-cli.json` file in your project root for configuration:

```json
{
  "projectPath": "./app",
  "defaultVariant": "debug",
  "terminal": "auto",
  "gradleTasks": {
    "custom": ["myCustomTask"]
  },
  "buildCache": {
    "enabled": true,
    "maxSize": "1GB"
  },
  "logcat": {
    "clearOnStart": true,
    "colorize": true
  },
  "selectedDevice": "emulator-5554"
}
```

### Configuration Options

- **`projectPath`** - Path to your Android project directory
- **`defaultVariant`** - Default build variant (debug/release)
- **`terminal`** - Terminal to use for logcat (auto/iterm2/terminal/gnome-terminal/etc.)
- **`gradleTasks.custom`** - Array of custom Gradle tasks to show in menu
- **`buildCache.enabled`** - Enable Gradle build cache for faster builds
- **`buildCache.maxSize`** - Maximum cache size
- **`logcat.clearOnStart`** - Clear logcat before starting new session
- **`logcat.colorize`** - Enable colored logcat output
- **`selectedDevice`** - Last selected device (auto-saved)

## Supported Terminals

The CLI automatically detects and supports:

- **macOS**: iTerm2, Terminal.app
- **Linux**: gnome-terminal, konsole, xterm
- **Windows**: Windows Terminal

## Use Cases

### Daily Development Workflow

1. **Morning Setup**:
   ```bash
   android-cli device  # Select your preferred device
   android-cli build   # Build and deploy
   ```

2. **Development Loop**:
   ```bash
   android-cli         # Interactive menu
   # Select "Build & Run" for quick iterations
   # Select "Open Logcat" when debugging
   ```

3. **Clean Builds**:
   ```bash
   android-cli gradle clean
   android-cli build
   ```

### CI/CD Integration

```bash
# In your CI script
android-cli gradle clean
android-cli gradle assembleRelease
```

### Team Development

Share the `android-cli.json` configuration with your team for consistent build settings.

## Comparison with Android Studio

| Feature | Android Studio | Android Interactive CLI |
|---------|---------------|------------------------|
| Memory Usage | ~2-4 GB RAM | ~50-100 MB RAM |
| Build Speed | Full IDE overhead | Direct Gradle execution |
| Logcat | Built-in viewer | Native terminal |
| Device Management | GUI selection | CLI selection |
| Project Navigation | Full IDE | Terminal/Editor of choice |
| Debugging | Full debugger | Logcat + external tools |

## Troubleshooting

### Common Issues

1. **"ADB not found"**
   - Ensure Android SDK is installed
   - Add `adb` to your PATH
   - Verify with: `adb version`

2. **"No Android project found"**
   - Run `android-cli init` in your project directory
   - Ensure `build.gradle` and `settings.gradle` exist

3. **Device not detected**
   - Enable USB debugging on your device
   - Check device connection: `adb devices`
   - For emulators, ensure they're running

4. **Build failures**
   - Run `android-cli gradle clean`
   - Check Gradle wrapper permissions: `chmod +x gradlew`
   - Verify Java version compatibility

### Debug Mode

Set environment variable for verbose logging:
```bash
DEBUG=android-cli android-cli build
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## Development

```bash
# Clone the repository
git clone https://github.com/your-username/android-interactive-cli.git
cd android-interactive-cli

# Install dependencies
yarn install

# Build the project
yarn build

# Run in development mode
yarn dev

# Run tests
yarn test
```

## License

MIT License - see LICENSE file for details.

## Roadmap

- [ ] Hot reload support
- [ ] Multiple app module support
- [ ] Wireless debugging integration
- [ ] Build performance profiling
- [ ] Plugin system
- [ ] VS Code extension
- [ ] Windows PowerShell support
- [ ] Docker container builds

## Support

- 📖 Documentation: [GitHub Wiki](https://github.com/your-username/android-interactive-cli/wiki)
- 🐛 Bug Reports: [GitHub Issues](https://github.com/your-username/android-interactive-cli/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/your-username/android-interactive-cli/discussions)

---

**Made with ❤️ for Android developers who love the terminal**