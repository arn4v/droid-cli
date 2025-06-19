import { Logger } from '../ui/logger';
import { AdbManager } from '../core/adb';
import { ConfigManager } from '../config/config-manager';
import { select, confirm } from '@inquirer/prompts';
import chalk from 'chalk';

export async function deviceCommand() {
  try {
    Logger.step('Checking available devices...');

    const adbManager = AdbManager.getInstance();
    const devices = await adbManager.getDevices();

    if (devices.length === 0) {
      Logger.warn('No devices found.');
      
      // Check if we can start an emulator
      const canStartEmulator = await adbManager.checkEmulatorCommand();
      if (canStartEmulator) {
        const availableEmulators = await adbManager.getAvailableEmulators();
        
        if (availableEmulators.length > 0) {
          const startEmulator = await confirm({
            message: 'No devices found. Would you like to start an emulator?',
            default: true,
          });

          if (startEmulator) {
            let selectedEmulator: string;
            
            if (availableEmulators.length === 1) {
              selectedEmulator = availableEmulators[0].name;
              Logger.info(`Starting emulator: ${availableEmulators[0].displayName}`);
            } else {
              const emulatorChoices = availableEmulators.map(emu => ({
                name: emu.displayName,
                value: emu.name,
              }));

              selectedEmulator = await select({
                message: 'Select emulator to start:',
                choices: emulatorChoices,
              });
            }

            const emulatorStarted = await adbManager.startEmulator(selectedEmulator);
            
            if (emulatorStarted) {
              Logger.success('Emulator started! You can now use it for builds.');
            } else {
              Logger.error('Failed to start emulator.');
            }
            return;
          }
        } else {
          Logger.info('No emulators found. Please create an AVD first.');
        }
      } else {
        Logger.info('Emulator command not found. Please ensure Android SDK is installed.');
      }
      
      Logger.info('Please ensure:');
      Logger.info('  • ADB is installed and in your PATH');
      Logger.info('  • USB debugging is enabled on your device');
      Logger.info('  • Your device is connected or an emulator is running');
      process.exit(1);
    }

    // Display current devices
    console.log(chalk.cyan('\n📱 Available Devices:'));
    console.log(chalk.gray('─'.repeat(60)));

    devices.forEach((device, index) => {
      const statusColor = device.state === 'device' ? chalk.green : 
                         device.state === 'offline' ? chalk.red : 
                         chalk.yellow;
      
      const typeIcon = device.type === 'emulator' ? '🖥️ ' : '📱';
      const apiInfo = device.apiLevel ? ` (API ${device.apiLevel})` : '';
      
      console.log(`${index + 1}. ${typeIcon} ${chalk.bold(device.name)}${apiInfo}`);
      console.log(`   ${chalk.gray('ID:')} ${device.id}`);
      console.log(`   ${chalk.gray('State:')} ${statusColor(device.state)}`);
      console.log(`   ${chalk.gray('Type:')} ${device.type}`);
      if (device.model && device.model !== device.name) {
        console.log(`   ${chalk.gray('Model:')} ${device.model}`);
      }
      console.log('');
    });

    const availableDevices = adbManager.getAvailableDevices();
    const physicalDevices = adbManager.getPhysicalDevices();
    const runningEmulators = adbManager.getRunningEmulators();
    
    console.log(chalk.blue('\n📊 Device Summary:'));
    console.log(chalk.gray('─'.repeat(40)));
    console.log(`📱 Physical devices: ${physicalDevices.length}`);
    console.log(`🖥️  Running emulators: ${runningEmulators.length}`);
    console.log(`✅ Available devices: ${availableDevices.length}`);
    console.log('');
    
    if (availableDevices.length === 0) {
      Logger.warn('No devices are currently available.');
      
      // Check if we can start an emulator
      const canStartEmulator = await adbManager.checkEmulatorCommand();
      if (canStartEmulator) {
        const availableEmulators = await adbManager.getAvailableEmulators();
        
        if (availableEmulators.length > 0) {
          const startEmulator = await confirm({
            message: 'No devices available. Would you like to start an emulator?',
            default: true,
          });

          if (startEmulator) {
            let selectedEmulator: string;
            
            if (availableEmulators.length === 1) {
              selectedEmulator = availableEmulators[0].name;
              Logger.info(`Starting emulator: ${availableEmulators[0].displayName}`);
            } else {
              const emulatorChoices = availableEmulators.map(emu => ({
                name: emu.displayName,
                value: emu.name,
              }));

              selectedEmulator = await select({
                message: 'Select emulator to start:',
                choices: emulatorChoices,
              });
            }

            const emulatorStarted = await adbManager.startEmulator(selectedEmulator);
            
            if (emulatorStarted) {
              Logger.success('Emulator started! You can now use it for builds.');
            } else {
              Logger.error('Failed to start emulator.');
            }
            return;
          }
        } else {
          Logger.info('No emulators found. Please create an AVD or connect a physical device.');
        }
      } else {
        Logger.info('Emulator command not found. Please connect a physical device.');
      }
      
      Logger.info('Please check device connection and authorization.');
      return;
    }

    // Get current config
    const configManager = ConfigManager.getInstance();
    const config = await configManager.load();
    const currentDevice = config.selectedDevice;

    if (currentDevice) {
      const device = adbManager.getDeviceById(currentDevice);
      if (device && device.state === 'device') {
        console.log(chalk.green(`✅ Current selected device: ${device.name} (${device.id})`));
      }
    }

    // Let user select a new device
    const deviceChoices = availableDevices.map(device => ({
      name: `${device.name} (${device.id}) - API ${device.apiLevel || 'Unknown'}`,
      value: device.id,
    }));

    const selectedDeviceId = await select({
      message: 'Select target device:',
      choices: deviceChoices,
      default: currentDevice && availableDevices.find(d => d.id === currentDevice) ? currentDevice : undefined,
    });

    const selectedDevice = adbManager.getDeviceById(selectedDeviceId);
    if (!selectedDevice) {
      Logger.error('Selected device not found.');
      process.exit(1);
    }

    // Save to config
    configManager.setSelectedDevice(selectedDeviceId);
    await configManager.save();

    Logger.success(`Selected device: ${selectedDevice.name} (${selectedDevice.id})`);
    Logger.info('Device preference saved. This device will be used for future builds.');

  } catch (error) {
    Logger.error('Device command failed:', error);
    process.exit(1);
  }
}