import { Logger } from '../ui/logger';
import { AndroidProject } from '../core/android-project';
import { ConfigManager } from '../config/config-manager';
import { TerminalManager } from '../core/terminal';
import { ProcessManager } from '../utils/process';
import { input, select, confirm } from '@inquirer/prompts';
import * as path from 'path';
import * as fs from 'fs-extra';
import chalk from 'chalk';

export async function initCommand() {
  try {
    console.log(chalk.cyan('🚀 Initializing Android Interactive CLI\n'));

    // Check prerequisites
    Logger.step('Checking prerequisites...');
    await checkPrerequisites();

    // Detect or prompt for project path
    const projectPath = await detectOrPromptProjectPath();
    
    // Initialize config manager with project path
    const configManager = ConfigManager.getInstance(projectPath);

    // Check if config already exists
    if (await configManager.exists()) {
      const overwrite = await confirm({
        message: 'Configuration already exists. Do you want to overwrite it?',
        default: false,
      });

      if (!overwrite) {
        Logger.info('Initialization cancelled.');
        return;
      }
    }

    // Load or create project
    let project = await AndroidProject.detect(projectPath);
    if (!project) {
      Logger.error(`No Android project found at: ${projectPath}`);
      Logger.info('Please ensure this is a valid Android project directory with build.gradle files.');
      process.exit(1);
    }

    const projectInfo = project.getInfo();
    if (!projectInfo) {
      Logger.error('Failed to load Android project information.');
      process.exit(1);
    }

    Logger.success(`Found Android project: ${projectInfo.packageName}`);

    // Configure settings
    const config = await configureSettings(project, configManager);

    // Save configuration
    await configManager.save();

    // Display summary
    displayConfigSummary(config, configManager.getConfigPath());

    Logger.success('Android Interactive CLI initialized successfully!');
    Logger.info('\nNext steps:');
    Logger.info('  • Run "droid-cli" to start interactive mode');
    Logger.info('  • Run "droid-cli build" to build and deploy your app');
    Logger.info('  • Run "droid-cli device" to select a target device');
    Logger.info('  • Run "droid-cli logcat" to view app logs');

  } catch (error) {
    Logger.error('Initialization failed:', error);
    process.exit(1);
  }
}

async function checkPrerequisites(): Promise<void> {
  const checks = [
    { name: 'Node.js', command: 'node', flag: '--version' },
    { name: 'ADB', command: 'adb', flag: 'version' },
  ];

  const results = await Promise.all(
    checks.map(async (check) => {
      const available = await ProcessManager.checkCommand(check.command);
      if (available) {
        const version = await ProcessManager.getCommandVersion(check.command, check.flag);
        return { ...check, available, version };
      }
      return { ...check, available, version: null };
    })
  );

  console.log(chalk.blue('Prerequisites Check:'));
  console.log(chalk.gray('─'.repeat(40)));

  let allGood = true;
  results.forEach((result) => {
    const status = result.available ? chalk.green('✓') : chalk.red('✗');
    const version = result.version ? chalk.gray(`(${result.version})`) : '';
    console.log(`${status} ${result.name} ${version}`);
    
    if (!result.available) {
      allGood = false;
    }
  });

  if (!allGood) {
    console.log('\n' + chalk.red('Missing prerequisites detected!'));
    console.log(chalk.yellow('Please install the missing tools and run "droid-cli init" again.'));
    process.exit(1);
  }

  console.log(chalk.green('\n✅ All prerequisites are available!\n'));
}

async function detectOrPromptProjectPath(): Promise<string> {
  // Try to detect Android project in current directory
  let projectPath = process.cwd();
  let project = await AndroidProject.detect(projectPath);

  if (project) {
    Logger.success(`Detected Android project in current directory: ${projectPath}`);
    
    const useCurrentDir = await confirm({
      message: 'Use current directory as project root?',
      default: true,
    });

    if (useCurrentDir) {
      return projectPath;
    }
  }

  // Prompt for project path
  const inputPath = await input({
    message: 'Enter path to Android project:',
    default: projectPath,
    validate: async (path: string) => {
      const absolutePath = path.startsWith('/') ? path : require('path').resolve(projectPath, path);
      
      if (!await fs.pathExists(absolutePath)) {
        return 'Path does not exist';
      }

      const testProject = await AndroidProject.detect(absolutePath);
      if (!testProject) {
        return 'No Android project found at this path';
      }

      return true;
    },
  });

  return path.resolve(projectPath, inputPath);
}

async function configureSettings(project: AndroidProject, configManager: ConfigManager) {
  Logger.step('Configuring settings...');

  const projectInfo = project.getInfo()!;
  const config = configManager.get();

  // Build variant
  const availableVariants = project.getBuildVariants();
  if (availableVariants.length > 1) {
    const defaultVariant = await select({
      message: 'Select default build variant:',
      choices: availableVariants.map(variant => ({
        name: variant,
        value: variant,
      })),
      default: config.defaultVariant,
    });
    config.defaultVariant = defaultVariant;
  }

  // Terminal preference
  const availableTerminals = await TerminalManager.getAvailableTerminals();
  if (availableTerminals.length > 0) {
    const terminalChoices = [
      { name: 'Auto-detect', value: 'auto' },
      ...availableTerminals.map(terminal => ({
        name: terminal,
        value: terminal,
      })),
    ];

    const terminal = await select({
      message: 'Select terminal for logcat:',
      choices: terminalChoices,
      default: config.terminal,
    });
    config.terminal = terminal;
  }

  // Build cache
  const enableBuildCache = await confirm({
    message: 'Enable build cache for faster builds?',
    default: config.buildCache.enabled,
  });
  config.buildCache.enabled = enableBuildCache;

  // Logcat settings
  const clearLogcatOnStart = await confirm({
    message: 'Clear logcat on start?',
    default: config.logcat.clearOnStart,
  });
  config.logcat.clearOnStart = clearLogcatOnStart;

  const colorizeLogcat = await confirm({
    message: 'Colorize logcat output?',
    default: config.logcat.colorize,
  });
  config.logcat.colorize = colorizeLogcat;

  // Update config
  configManager.set(config);

  return config;
}

function displayConfigSummary(config: any, configPath: string): void {
  console.log(chalk.cyan('\n📋 Configuration Summary:'));
  console.log(chalk.gray('─'.repeat(50)));
  console.log(`${chalk.bold('Project Path:')} ${config.projectPath}`);
  console.log(`${chalk.bold('Default Variant:')} ${config.defaultVariant}`);
  console.log(`${chalk.bold('Terminal:')} ${config.terminal}`);
  console.log(`${chalk.bold('Build Cache:')} ${config.buildCache.enabled ? 'Enabled' : 'Disabled'}`);
  console.log(`${chalk.bold('Clear Logcat:')} ${config.logcat.clearOnStart ? 'Yes' : 'No'}`);
  console.log(`${chalk.bold('Colorize Logcat:')} ${config.logcat.colorize ? 'Yes' : 'No'}`);
  console.log(`${chalk.bold('Config File:')} ${configPath}`);
  console.log('');
}