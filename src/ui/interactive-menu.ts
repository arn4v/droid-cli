import { select, confirm, rawlist, input } from '@inquirer/prompts';
import chalk from 'chalk';
import { Logger } from './logger';
import { buildCommand } from '../commands/build';
import { deviceCommand } from '../commands/device';
import { logcatCommand } from '../commands/logcat';
import { gradleCommand, selectGradleTask, GradleResult } from '../commands/gradle';
import { initCommand } from '../commands/init';
import { variantCommand } from '../commands/variant';
import { ConfigManager } from '../config/config-manager';
import { AndroidProject } from '../core/android-project';
import { AdbManager } from '../core/adb';

async function handleTaskFailure(taskName: string, error: string): Promise<'retry' | 'menu'> {
  console.log(''); // Add spacing
  Logger.error(`${taskName} failed:`, error);
  console.log(''); // Add spacing
  console.log(chalk.gray('───────────────────────────────────────'));
  console.log(chalk.cyan('🔄 Press r to retry'));
  console.log(chalk.cyan('🏠 Press x to return to main menu'));
  console.log(chalk.gray('───────────────────────────────────────'));
  console.log(''); // Add spacing
  
  while (true) {
    const choice = await input({
      message: 'Enter your choice (r/x):',
      validate: (input: string) => {
        const choice = input.toLowerCase().trim();
        if (choice === 'r' || choice === 'x') {
          return true;
        }
        return 'Please enter "r" to retry or "x" to return to main menu';
      },
    });
    
    const normalizedChoice = choice.toLowerCase().trim();
    if (normalizedChoice === 'r') {
      return 'retry';
    } else if (normalizedChoice === 'x') {
      return 'menu';
    }
  }
}

async function handleBuildFailure(error: string): Promise<'retry' | 'menu'> {
  return handleTaskFailure('Build', error);
}

async function handleBuildSuccess(): Promise<'logcat' | 'build' | 'device' | 'menu'> {
  console.log(''); // Add spacing
  console.log(chalk.green('🎉 Build, install, and launch completed successfully!'));
  console.log(chalk.cyan('📱 Your app is now running on the device'));
  console.log(''); // Add spacing
  console.log(chalk.gray('───────────────────────────────────────'));
  console.log(chalk.cyan('📋 View app logs in real-time'));
  console.log(chalk.cyan('🔨 Build again to test changes'));
  console.log(chalk.cyan('📱 Switch to different device'));
  console.log(chalk.cyan('🏠 Return to main menu'));
  console.log(chalk.gray('───────────────────────────────────────'));
  console.log(''); // Add spacing
  
  const choice = await select({
    message: 'What would you like to do next?',
    choices: [
      { name: '📋 Open Logcat', value: 'logcat' as const },
      { name: '🔨 Build Again', value: 'build' as const },
      { name: '📱 Select Different Device', value: 'device' as const },
      { name: '🏠 Return to Main Menu', value: 'menu' as const },
    ],
  });
  
  switch (choice) {
    case 'logcat':
      await logcatCommand();
      return choice;
    case 'build':
      return choice; // Will trigger another build in the next iteration
    case 'device':
      await deviceCommand();
      return choice;
    case 'menu':
      return choice; // Will return to main menu in the next iteration
    default:
      return 'menu';
  }
}

export async function interactiveMenu(): Promise<void> {
  while (true) {
    try {
      await displayStatus();
      
      const choice = await select({
        message: 'What would you like to do?',
        choices: [
          { name: '🔨 Build & Run App', value: 'build' },
          { name: '📱 Select Device', value: 'device' },
          { name: '🏗️  Change Build Variant', value: 'variant' },
          { name: '📋 Open Logcat', value: 'logcat' },
          { name: '⚙️  Run Gradle Task', value: 'gradle' },
          { name: '🧹 Clean Project', value: 'clean' },
          { name: '🔄 Sync Project', value: 'sync' },
          { name: '🛠️  Configure Settings', value: 'config' },
          { name: '❌ Exit', value: 'exit' },
        ],
      });

      console.log(''); // Add spacing

      switch (choice) {
        case 'build': {
          let continueBuildFlow = true;
          while (continueBuildFlow) {
            const buildResult = await buildCommand({ interactive: true });
            if (buildResult.success) {
              const nextAction = await handleBuildSuccess();
              if (nextAction === 'menu') {
                continueBuildFlow = false; // Exit build flow and return to main menu
              } else if (nextAction === 'build') {
                // Continue the loop for another build
                continue;
              } else {
                // For logcat or device commands, we've handled them and can exit build flow
                continueBuildFlow = false;
              }
            } else {
              const action = await handleBuildFailure(buildResult.error || 'Unknown error');
              if (action === 'menu') {
                continueBuildFlow = false; // Exit build flow and return to main menu
              }
              // If action is 'retry', the loop continues
            }
          }
          break;
        }
        case 'device':
          await deviceCommand();
          break;
        case 'variant':
          await variantCommand();
          break;
        case 'logcat':
          await logcatCommand();
          break;
        case 'gradle': {
          const task = await selectGradleTask();
          let taskSuccess = false;
          while (!taskSuccess) {
            const result = await gradleCommand(task);
            if (result.success) {
              taskSuccess = true;
            } else {
              const action = await handleTaskFailure(`Gradle task '${task}'`, result.error || 'Unknown error');
              if (action === 'menu') {
                break;
              }
            }
          }
          break;
        }
        case 'clean': {
          let cleanSuccess = false;
          while (!cleanSuccess) {
            const result = await gradleCommand('clean');
            if (result.success) {
              cleanSuccess = true;
            } else {
              const action = await handleTaskFailure('Clean', result.error || 'Unknown error');
              if (action === 'menu') {
                break;
              }
            }
          }
          break;
        }
        case 'sync': {
          let syncSuccess = false;
          while (!syncSuccess) {
            const result = await gradleCommand('sync');
            if (result.success) {
              syncSuccess = true;
            } else {
              const action = await handleTaskFailure('Sync', result.error || 'Unknown error');
              if (action === 'menu') {
                break;
              }
            }
          }
          break;
        }
        case 'config':
          await initCommand();
          break;
        case 'exit':
          Logger.info('Goodbye! 👋');
          process.exit(0);
          break;
        default:
          Logger.error('Invalid choice');
      }

      console.log(''); // Add spacing between iterations
    } catch (error) {
      if (error instanceof Error && error.message.includes('User force closed')) {
        Logger.info('\\nGoodbye! 👋');
        process.exit(0);
      }
      Logger.error('Menu error:', error);
      console.log(''); // Add spacing after error
    }
  }
}

async function displayStatus(): Promise<void> {
  console.clear();
  console.log(chalk.cyan.bold('🤖 Droid CLI'));
  console.log(chalk.gray('─'.repeat(50)));

  try {
    // Try to load config and project info
    const configManager = ConfigManager.getInstance();
    const config = await configManager.load();
    
    const project = await AndroidProject.detect(configManager.getProjectPath());
    
    if (project) {
      const projectInfo = project.getInfo();
      if (projectInfo) {
        console.log(`${chalk.bold('📁 Project:')} ${chalk.green(projectInfo.packageName)}`);
        console.log(`${chalk.bold('📂 Path:')} ${projectInfo.rootPath}`);
        console.log(`${chalk.bold('🏗️  Variant:')} ${config.defaultVariant}`);
        
        // Display selected device
        if (config.selectedDevice) {
          const adbManager = AdbManager.getInstance();
          const devices = await adbManager.getDevices();
          const selectedDevice = devices.find(d => d.id === config.selectedDevice);
          
          if (selectedDevice && selectedDevice.state === 'device') {
            console.log(`${chalk.bold('📱 Device:')} ${chalk.green(selectedDevice.name)} (${selectedDevice.id})`);
          } else {
            console.log(`${chalk.bold('📱 Device:')} ${chalk.yellow('Not connected or unavailable')}`);
          }
        } else {
          console.log(`${chalk.bold('📱 Device:')} ${chalk.gray('None selected')}`);
        }
      } else {
        console.log(`${chalk.bold('📁 Project:')} ${chalk.red('Failed to load project info')}`);
      }
    } else {
      console.log(`${chalk.bold('📁 Project:')} ${chalk.yellow('No Android project detected')}`);
      console.log(`${chalk.gray('Run "Configure Settings" to set up a project')}`);
    }

    // Display device status
    const adbManager = AdbManager.getInstance();
    const devices = await adbManager.getDevices();
    const availableDevices = adbManager.getAvailableDevices();
    
    if (devices.length > 0) {
      console.log(`${chalk.bold('🔌 Devices:')} ${availableDevices.length}/${devices.length} available`);
    } else {
      console.log(`${chalk.bold('🔌 Devices:')} ${chalk.red('None detected')}`);
    }

  } catch (error) {
    console.log(`${chalk.bold('📁 Project:')} ${chalk.red('Error loading status')}`);
    Logger.debug('Status error:', error);
  }

  console.log(chalk.gray('─'.repeat(50)));
  console.log('');
}