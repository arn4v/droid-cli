#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import * as path from 'path';
import { interactiveMenu } from './ui/interactive-menu';
import { buildCommand } from './commands/build';
import { deviceCommand } from './commands/device';
import { logcatCommand } from './commands/logcat';
import { gradleCommand } from './commands/gradle';
import { initCommand } from './commands/init';
import { variantCommand } from './commands/variant';
import { ConfigManager } from './config/config-manager';

const program = new Command();

program
  .name('droid-cli')
  .description('Interactive CLI for Android development')
  .version('1.0.0')
  .option('-p, --project <path>', 'Path to Android project directory');

// Helper function to wrap command actions with project path handling
function wrapCommand<T extends any[]>(
  commandFn: (...args: T) => Promise<any>
) {
  return async (...args: T) => {
    const globalOptions = program.opts();
    if (globalOptions.project) {
      const projectPath = path.resolve(globalOptions.project);
      
      // Validate project path exists
      try {
        const fs = await import('fs-extra');
        if (!(await fs.pathExists(projectPath))) {
          console.error(chalk.red(`Error: Project path does not exist: ${projectPath}`));
          process.exit(1);
        }
        
        if (!(await fs.stat(projectPath)).isDirectory()) {
          console.error(chalk.red(`Error: Project path is not a directory: ${projectPath}`));
          process.exit(1);
        }
      } catch (error) {
        console.error(chalk.red(`Error: Cannot access project path: ${projectPath}`));
        process.exit(1);
      }
      
      // Initialize config manager with the specified project path
      ConfigManager.getInstance(projectPath);
      // Change working directory context for relative paths to work
      process.chdir(projectPath);
    }
    
    const result = await commandFn(...args);
    
    // Handle BuildResult specifically for build command
    if (result && typeof result === 'object' && 'success' in result) {
      if (!result.success) {
        console.error(chalk.red(`Command failed: ${result.error || 'Unknown error'}`));
        process.exit(1);
      }
    }
  };
}

program
  .command('build')
  .description('Build and run the Android app')
  .option('-v, --variant <variant>', 'Build variant (debug/release)', 'debug')
  .option('-d, --device <device>', 'Target device ID')
  .option('-s, --stay', 'Stay alive after build for monitoring (press Ctrl+C to exit)')
  .action(wrapCommand(buildCommand));

program
  .command('device')
  .description('Select target device')
  .action(wrapCommand(deviceCommand));

program
  .command('logcat')
  .description('Open logcat for the app')
  .option('-d, --device <device>', 'Target device ID')
  .action(wrapCommand(logcatCommand));

program
  .command('gradle')
  .description('Run gradle task')
  .argument('<task>', 'Gradle task to run')
  .option('-a, --args <args>', 'Additional gradle arguments')
  .action(wrapCommand(gradleCommand));

program
  .command('init')
  .description('Initialize droid-cli configuration')
  .action(wrapCommand(initCommand));

program
  .command('variant')
  .description('Select default build variant')
  .action(wrapCommand(variantCommand));

// If no command is provided, start interactive mode
async function startInteractiveMode() {
  // Handle project path for interactive mode
  const projectIndex = process.argv.indexOf('--project') !== -1 ? process.argv.indexOf('--project') : process.argv.indexOf('-p');
  if (projectIndex !== -1 && process.argv[projectIndex + 1]) {
    const projectPath = path.resolve(process.argv[projectIndex + 1]);
    
    // Validate project path exists
    try {
      const fs = await import('fs-extra');
      if (!(await fs.pathExists(projectPath))) {
        console.error(chalk.red(`Error: Project path does not exist: ${projectPath}`));
        process.exit(1);
      }
      
      if (!(await fs.stat(projectPath)).isDirectory()) {
        console.error(chalk.red(`Error: Project path is not a directory: ${projectPath}`));
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red(`Error: Cannot access project path: ${projectPath}`));
      process.exit(1);
    }
    
    ConfigManager.getInstance(projectPath);
    process.chdir(projectPath);
  }
  
  console.log(chalk.cyan('🤖 Welcome to Android Interactive CLI'));
  await interactiveMenu();
}

if (process.argv.length <= 2 || (process.argv.length === 4 && (process.argv[2] === '--project' || process.argv[2] === '-p'))) {
  startInteractiveMode();
} else {
  program.parse();
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red('Unhandled Rejection at:'), promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error(chalk.red('Uncaught Exception:'), error);
  process.exit(1);
});