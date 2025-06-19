# Droid CLI

A powerful, interactive CLI tool for Android development that brings the essential features of Android Studio to your terminal. Inspired by Expo CLI, this tool provides fast incremental builds, device management, and debugging without the heavy GUI overhead.

## Features

- 🔨 **Incremental Builds** - Fast builds using Gradle's build cache
- 📱 **Device Management** - Easy selection and management of emulators and physical devices
- 🚀 **Smart Emulator Startup** - Automatically offers to start emulators when no devices connected
- 📋 **Logcat Integration** - Spawns terminal with filtered app logs
- ⚙️ **Gradle Tasks** - Run common tasks like clean, sync, and custom tasks
- 🎯 **Interactive Menu** - User-friendly menu system for all operations
- 🛠️ **Configuration** - Project-specific settings via `droid-cli.json`
- 🔄 **Auto-detection** - Automatically detects Android projects and devices

## Installation

```bash
npm install -g droid-cli
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
   droid-cli init
   ```
3. Start the interactive menu:
   ```bash
   droid-cli
   ```

## Commands

### Global Options

All commands support the `--project` (or `-p`) flag to specify the Android project directory:

```bash
droid-cli --project /path/to/android/project [command]
```

This allows you to run the CLI from anywhere while targeting a specific project.

### Interactive Mode

```bash
droid-cli [--project <path>]
```

Launches the main interactive menu with all available options.

### Direct Commands

#### Build & Run

```bash
droid-cli build [--variant debug|release] [--device device-id] [--project <path>]
```

Builds the app and deploys it to the selected device.

#### Device Management

```bash
droid-cli device [--project <path>]
```

List and select target devices/emulators.

#### Logcat

```bash
droid-cli logcat [--device device-id] [--project <path>]
```

Opens logcat in a new terminal window, filtered for your app.

#### Gradle Tasks

```bash
droid-cli gradle <task> [--args "additional arguments"] [--project <path>]
```

Run any Gradle task with optional arguments.

#### Initialize Configuration

```bash
droid-cli init [--project <path>]
```

Set up or reconfigure the CLI for your project.

#### Build Variant Selection

```bash
droid-cli variant [--project <path>]
```

Select the default build variant (debug/release) for the project.

## Configuration

The CLI uses an `droid-cli.json` file in your project root for configuration:

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
  "adbReverse": {
    "enabled": false,
    "ports": [8081]
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
- **`adbReverse.enabled`** - Automatically run `adb reverse` for React Native development
- **`adbReverse.ports`** - Ports to forward from device to host (e.g., [8081] for Metro bundler)
- **`selectedDevice`** - Last selected device (auto-saved)

### CI/CD Integration

```bash
# In your CI script
droid-cli gradle clean
droid-cli gradle assembleRelease
```

### Team Development

Share the `droid-cli.json` configuration with your team for consistent build settings.

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
