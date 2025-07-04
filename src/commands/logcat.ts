import { Logger } from '../ui/logger';
import { AdbManager } from '../core/adb';
import { AndroidProject } from '../core/android-project';
import { ConfigManager } from '../config/config-manager';
import { TerminalManager } from '../core/terminal';
import { select } from '@inquirer/prompts';
import { processTemplate, TemplateVariables } from '../utils/template';

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

    // Build logcat command using configurable template
    const templateVariables: TemplateVariables = {
      device_id: targetDevice.id,
      package_name: projectInfo.packageName !== 'unknown' ? projectInfo.packageName : ''
    };

    let logcatCommand: string;
    let logcatArgs: string[];

    try {
      const parsedCommand = processTemplate(config.logcat.template, templateVariables);
      logcatCommand = parsedCommand.command;
      logcatArgs = parsedCommand.args;
      
      // If the command contains shell substitution, wrap it in shell execution
      const fullCommand = `${logcatCommand} ${logcatArgs.join(' ')}`;
      if (fullCommand.includes('$(') && fullCommand.includes(')')) {
        const userShell = process.env.SHELL ? require('path').basename(process.env.SHELL) : 'bash';
        logcatCommand = userShell;
        logcatArgs = ['-c', fullCommand];
      }
      
      Logger.info(`Using template: ${config.logcat.template}`);
      if (projectInfo.packageName !== 'unknown') {
        Logger.info(`Filtering logs for package: ${projectInfo.packageName}`);
      } else {
        Logger.warn('Package name unknown, template may not filter correctly');
      }
    } catch (error) {
      Logger.error(`Template processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      Logger.info('Falling back to default logcat command');
      
      // Fallback to original logic
      if (projectInfo.packageName !== 'unknown') {
        const userShell = process.env.SHELL ? require('path').basename(process.env.SHELL) : 'bash';
        logcatCommand = userShell;
        logcatArgs = ['-c', `adb -s ${targetDevice.id} logcat -v color --pid=$(adb -s ${targetDevice.id} shell pidof -s ${projectInfo.packageName})`];
        Logger.info(`Using PID-based filtering for package: ${projectInfo.packageName}`);
      } else {
        logcatCommand = 'adb';
        logcatArgs = ['-s', targetDevice.id, 'logcat', '-v', 'color'];
        Logger.warn('Package name unknown, using device-specific logcat');
      }
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
    
    const success = await TerminalManager.spawnTerminal(logcatCommand, logcatArgs, {
      title,
      terminal: terminalType as any,
    });

    if (success) {
      Logger.success('Logcat opened in new terminal window');
      Logger.info('Press Ctrl+C in the terminal to stop logcat');
    } else {
      Logger.error('Failed to open terminal');
      Logger.info('You can manually run the following command:');
      Logger.info(`${logcatCommand} ${logcatArgs.join(' ')}`);
      
      // Fallback: run logcat in current terminal
      Logger.step('Running logcat in current terminal (press Ctrl+C to stop)...');
      
      // Use the already processed command and args (shell wrapping is already done in main logic)
      const logcatProcess = require('../utils/process').ProcessManager.spawn(logcatCommand, logcatArgs);
      
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