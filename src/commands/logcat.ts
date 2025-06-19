import { Logger } from '../ui/logger';
import { AdbManager } from '../core/adb';
import { AndroidProject } from '../core/android-project';
import { ConfigManager } from '../config/config-manager';
import { TerminalManager } from '../core/terminal';
import { select } from '@inquirer/prompts';

interface LogcatOptions {
  device?: string;
}

export async function logcatCommand(options: LogcatOptions = {}) {
  try {
    Logger.step('Setting up logcat monitoring...');

    // Load configuration
    const configManager = ConfigManager.getInstance();
    const config = await configManager.load();

    // Detect Android project
    const project = await AndroidProject.detect(configManager.getProjectPath());
    if (!project) {
      Logger.error('No Android project found. Please run this command from an Android project directory or run "droid-cli init" first.');
      process.exit(1);
    }

    const projectInfo = project.getInfo();
    if (!projectInfo) {
      Logger.error('Failed to load Android project information.');
      process.exit(1);
    }

    // Get ADB manager and check devices
    const adbManager = AdbManager.getInstance();
    const devices = await adbManager.getDevices();
    const availableDevices = adbManager.getAvailableDevices();

    if (availableDevices.length === 0) {
      Logger.error('No devices available. Please connect a device or start an emulator.');
      process.exit(1);
    }

    // Determine target device
    let targetDeviceId = options.device || config.selectedDevice;
    
    if (!targetDeviceId || !availableDevices.find(d => d.id === targetDeviceId)) {
      if (availableDevices.length === 1) {
        targetDeviceId = availableDevices[0].id;
        Logger.info(`Using device: ${availableDevices[0].name} (${targetDeviceId})`);
      } else {
        // Let user select device
        const deviceChoices = availableDevices.map(device => ({
          name: `${device.name} (${device.id}) - API ${device.apiLevel || 'Unknown'}`,
          value: device.id,
        }));

        targetDeviceId = await select({
          message: 'Select device for logcat:',
          choices: deviceChoices,
        });
      }
    }

    const targetDevice = adbManager.getDeviceById(targetDeviceId);
    if (!targetDevice) {
      Logger.error(`Device ${targetDeviceId} not found or not available.`);
      process.exit(1);
    }

    Logger.device(`Target device: ${targetDevice.name} (${targetDevice.id})`);

    // Build logcat command
    const logcatArgs = [
      '-s', targetDevice.id,
      'logcat'
    ];

    // Filter by package name to show only app logs
    if (projectInfo.packageName !== 'unknown') {
      logcatArgs.push(`${projectInfo.packageName}:V`, '*:S');
      Logger.info(`Filtering logs for package: ${projectInfo.packageName}`);
    } else {
      Logger.warn('Package name unknown, showing all logs');
    }

    // Clear logcat if configured
    if (config.logcat.clearOnStart) {
      Logger.info('Clearing existing logcat...');
      await adbManager.checkAdbAvailable(); // Ensure ADB is available
      
      const result = await require('../utils/process').ProcessManager.run('adb', [
        '-s', targetDevice.id,
        'logcat', '-c'
      ]);
      
      if (result.success) {
        Logger.success('Logcat cleared');
      } else {
        Logger.warn('Failed to clear logcat, continuing anyway...');
      }
    }

    // Determine terminal to use
    let terminalType = config.terminal;
    if (terminalType === 'auto') {
      const detectedTerminal = await TerminalManager.detectTerminal();
      if (!detectedTerminal) {
        Logger.error('No supported terminal detected');
        Logger.info('Please set a specific terminal in your droid-cli.json config');
        process.exit(1);
      }
      terminalType = detectedTerminal;
    }

    // Spawn terminal with logcat
    const title = `Logcat - ${projectInfo.packageName} (${targetDevice.name})`;
    
    Logger.step(`Opening logcat in ${terminalType}...`);
    
    const success = await TerminalManager.spawnTerminal('adb', logcatArgs, {
      title,
      terminal: terminalType as any,
    });

    if (success) {
      Logger.success('Logcat opened in new terminal window');
      Logger.info('Press Ctrl+C in the terminal to stop logcat');
    } else {
      Logger.error('Failed to open terminal');
      Logger.info('You can manually run the following command:');
      Logger.info(`adb ${logcatArgs.join(' ')}`);
      
      // Fallback: run logcat in current terminal
      Logger.step('Running logcat in current terminal (press Ctrl+C to stop)...');
      
      const logcatProcess = require('../utils/process').ProcessManager.spawn('adb', logcatArgs);
      
      // Handle process termination
      process.on('SIGINT', () => {
        Logger.info('Stopping logcat...');
        logcatProcess.kill('SIGINT');
        process.exit(0);
      });

      await logcatProcess;
    }

  } catch (error) {
    Logger.error('Logcat command failed:', error);
    process.exit(1);
  }
}