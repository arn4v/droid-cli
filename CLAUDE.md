# Android Interactive CLI - Project Instructions

## Project Overview

This is **Android Interactive CLI**, a Node.js-based command-line tool that provides Android Studio's essential features in the terminal. It's inspired by Expo CLI and designed for developers who want fast Android development without the heavy GUI overhead of Android Studio.

## Tech Stack

- **Runtime**: Node.js (>=14.0.0) with TypeScript
- **Package Manager**: Yarn
- **CLI Framework**: Commander.js
- **Interactive Prompts**: Inquirer.js (@inquirer/prompts)
- **Process Management**: Execa
- **File Operations**: fs-extra
- **Configuration**: Joi (schema validation)
- **Logging**: Chalk (colored output), Ora (spinners)
- **Build Tool**: TypeScript compiler

## Architecture

```
src/
├── index.ts                 # CLI entry point with command parsing
├── commands/                # Command implementations
│   ├── build.ts            # Build & deploy to device
│   ├── device.ts           # Device selection & management
│   ├── logcat.ts           # Logcat monitoring
│   ├── gradle.ts           # Gradle task runner
│   └── init.ts             # Project initialization
├── core/                   # Core functionality modules
│   ├── android-project.ts  # Android project detection & parsing
│   ├── adb.ts              # ADB wrapper for device management
│   ├── gradle-wrapper.ts   # Gradle integration with caching
│   └── terminal.ts         # Cross-platform terminal spawning
├── config/                 # Configuration management
│   ├── config-manager.ts   # Config loading/saving/validation
│   └── schema.ts           # Config schema definitions
├── ui/                     # User interface components
│   ├── interactive-menu.ts # Main interactive menu
│   └── logger.ts           # Colored logging utilities
└── utils/                  # Utility modules
    ├── process.ts          # Process execution helpers
    └── validators.ts       # Input validation functions
```

## Key Features Implemented

### 1. **CLI Framework**
- Global `--project` flag to specify Android project directory from anywhere
- Interactive mode (no args) and direct commands
- Comprehensive help system and error handling

### 2. **Android Project Detection**
- Auto-detects Android projects by scanning for `settings.gradle`
- Extracts package name, build variants, and project structure
- Validates Gradle wrapper presence

### 3. **ADB Integration**
- Lists connected devices and emulators
- Installs APKs with progress tracking
- Launches apps automatically
- Device state management (device/offline/unauthorized)
- **Emulator Management**: Detects available AVDs and can start emulators
- **Smart Device Handling**: Offers to start emulator when no physical devices connected

### 4. **Gradle Integration**
- Incremental builds using Gradle's build cache
- Common tasks: build, clean, sync, dependencies
- Custom task execution with arguments
- Progress indicators and error handling

### 5. **Logcat Integration**
- Spawns platform-specific terminals (iTerm2, Terminal, gnome-terminal, etc.)
- Filters logs by application package name
- Optional log clearing on start

### 6. **Configuration System**
- Project-specific `android-cli.json` configuration
- Schema validation with Joi
- Auto-detection of project settings
- Persistent device selection

## Commands Available

```bash
# Interactive mode
android-cli [--project <path>]

# Direct commands
android-cli build [--variant debug|release] [--device <id>] [--project <path>]
android-cli device [--project <path>]
android-cli logcat [--device <id>] [--project <path>]
android-cli gradle <task> [--args <args>] [--project <path>]
android-cli init [--project <path>]
```

## Configuration Schema

```json
{
  "projectPath": "./app",
  "defaultVariant": "debug",
  "terminal": "auto",
  "gradleTasks": { "custom": [] },
  "buildCache": { "enabled": true, "maxSize": "1GB" },
  "logcat": { "clearOnStart": true, "colorize": true },
  "selectedDevice": "device-id"
}
```

## Development Commands

```bash
yarn install          # Install dependencies
yarn build            # Compile TypeScript
yarn dev              # Run in development mode
yarn start            # Run compiled version
yarn lint             # ESLint
yarn format           # Prettier
```

## Key Dependencies

- **commander**: CLI framework and argument parsing
- **inquirer**: Interactive prompts and menus
- **execa**: Process execution with better API than child_process
- **fs-extra**: Enhanced file system operations
- **chalk**: Terminal colors and styling
- **ora**: Loading spinners
- **joi**: Schema validation
- **chokidar**: File watching (unused currently)
- **terminal-kit**: Terminal utilities (unused currently)

## Project Status

✅ **Completed Core Features:**
- CLI framework with global project flag
- Android project detection and validation
- ADB device management with emulator support
- Gradle integration with incremental builds
- Logcat monitoring with terminal spawning
- Configuration system with validation
- Interactive menu system with variant selection
- Cross-platform terminal support
- Error handling and logging
- **Smart emulator startup when no devices connected**

🔄 **Tested & Working:**
- Successfully detects RemNote Android project
- Loads configuration correctly
- Interactive menu displays project status
- Help system works properly

⏳ **Future Enhancements:**
- Plugin system for extensibility
- Hot reload support
- Multiple app module support
- Build performance profiling
- VS Code extension
- Test framework integration

## Development Notes

### Important Patterns

1. **ConfigManager Singleton**: Use `ConfigManager.getInstance(projectPath)` to get config for specific project
2. **Graceful Error Handling**: Build failures return error objects instead of exiting; interactive mode continues
3. **Process Management**: Use ProcessManager class for consistent process execution
4. **Validation**: Validate inputs using Validators utility class
5. **Logging**: Use Logger class for consistent colored output
6. **Non-destructive Failures**: Emulators stay running when builds fail; CLI doesn't exit on errors

### Code Quality Rules

- No `any` types - use proper TypeScript interfaces
- Import Execa Options type instead of creating custom interfaces
- Comprehensive error handling with graceful fallbacks
- Clear separation of concerns between modules
- Consistent async/await patterns

### Testing Strategy

Commands can be tested using:
```bash
yarn dev --project /path/to/android/project [command]
```

The CLI has been tested with the RemNote Android project and successfully:
- Detected project at `/Users/arn4v/src/remnoteio/remnote-23jan25/client/android`
- Loaded package name `com.remnote.v2`
- Set default variant to `release`
- Displayed interactive menu

## Publishing

The project is configured for npm publishing with:
- Binary name: `android-cli`
- Entry point: `dist/index.js`
- Files included: `dist/`, `README.md`
- Engines: Node.js >=14.0.0

Ready for `npm publish` after running `yarn build`.