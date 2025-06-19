import { select } from '@inquirer/prompts';
import chalk from 'chalk';
import { Logger } from './logger';
import { buildCommand } from '../commands/build';
import { deviceCommand } from '../commands/device';
import { logcatCommand } from '../commands/logcat';
import { gradleCommand, selectGradleTask } from '../commands/gradle';
import { initCommand } from '../commands/init';
import { variantCommand } from '../commands/variant';
import { ConfigManager } from '../config/config-manager';
import { AndroidProject } from '../core/android-project';
import { AdbManager } from '../core/adb';

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
        case 'build':
          const buildResult = await buildCommand({ interactive: true });
          if (!buildResult.success) {
            Logger.error('Build failed:', buildResult.error);
            Logger.info('Press any key to return to menu...');
            // Don't exit, just continue to next iteration
          }
          break;
        case 'device':
          await deviceCommand();
          break;
        case 'variant':
          await variantCommand();
          break;
        case 'logcat':
          await logcatCommand();
          break;
        case 'gradle':
          const task = await selectGradleTask();
          await gradleCommand(task);
          break;
        case 'clean':
          await gradleCommand('clean');
          break;
        case 'sync':
          await gradleCommand('sync');
          break;
        case 'config':
          await initCommand();
          break;
        case 'exit':
          Logger.info('Goodbye! 👋');
          process.exit(0);
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
  console.log(chalk.cyan.bold('🤖 Android Interactive CLI'));
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