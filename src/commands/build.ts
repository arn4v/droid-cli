import { Logger } from '../ui/logger';
import { AndroidProject } from '../core/android-project';
import { GradleWrapper } from '../core/gradle-wrapper';
import { AdbManager } from '../core/adb';
import { ConfigManager } from '../config/config-manager';
import { select, confirm } from '@inquirer/prompts';

interface BuildOptions {
  variant?: string;
  device?: string;
  interactive?: boolean;
}

export interface BuildResult {
  success: boolean;
  error?: string;
}

async function ensureDeviceAvailable(adbManager: AdbManager, options: BuildOptions): Promise<{ success: boolean; error?: string }> {
  const devices = await adbManager.getDevices();
  let availableDevices = adbManager.getAvailableDevices();

  if (availableDevices.length === 0) {
    Logger.warn('No devices are currently available.');
    
    const physicalDevices = adbManager.getPhysicalDevices();
    const runningEmulators = adbManager.getRunningEmulators();
    
    Logger.info(`Found: ${physicalDevices.length} physical device(s), ${runningEmulators.length} running emulator(s)`);
    
    if (devices.length > 0) {
      Logger.info('Device states:');
      devices.forEach(device => {
        Logger.info(`  • ${device.name} (${device.id}): ${device.state}`);
      });
    }

    // Check if we can start an emulator
    const canStartEmulator = await adbManager.checkEmulatorCommand();
    if (canStartEmulator) {
      const availableEmulators = await adbManager.getAvailableEmulators();
      
      if (availableEmulators.length > 0) {
        Logger.step('Would you like to start an emulator?');
        
        const startEmulator = await confirm({
          message: 'No devices connected. Start an emulator?',
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
            // Refresh device list after emulator starts
            await adbManager.getDevices();
            availableDevices = adbManager.getAvailableDevices();
            
            if (availableDevices.length > 0) {
              Logger.success('Emulator is ready! Continuing with build...');
              return { success: true };
            } else {
              const error = 'Emulator started but may still be booting. Please try again in a moment.';
              Logger.warn(error);
              return { success: false, error };
            }
          } else {
            const error = 'Failed to start emulator.';
            Logger.error(error);
            return { success: false, error };
          }
        } else {
          const error = 'No devices available and emulator startup declined.';
          Logger.error(error);
          Logger.info('Please connect a device or start an emulator manually.');
          return { success: false, error };
        }
      } else {
        const error = 'No emulators found. Please create an AVD or connect a physical device.';
        Logger.error(error);
        return { success: false, error };
      }
    } else {
      const error = 'Emulator command not found. Please connect a physical device.';
      Logger.error(error);
      Logger.info('To use emulators, ensure Android SDK emulator tools are installed.');
      return { success: false, error };
    }
  }

  return { success: true };
}

export async function buildCommand(options: BuildOptions = {}): Promise<BuildResult> {
  try {
    Logger.step('Starting Android build process...');

    // Load configuration
    const configManager = ConfigManager.getInstance();
    const config = await configManager.load();

    // Detect Android project
    const project = await AndroidProject.detect(configManager.getProjectPath());
    if (!project) {
      const error = 'No Android project found. Please run this command from an Android project directory or run "android-cli init" first.';
      Logger.error(error);
      return { success: false, error };
    }

    const projectInfo = project.getInfo();
    if (!projectInfo) {
      const error = 'Failed to load Android project information.';
      Logger.error(error);
      return { success: false, error };
    }

    Logger.info(`Found Android project: ${projectInfo.packageName}`);
    Logger.info(`Project path: ${projectInfo.rootPath}`);

    // Determine build variant
    let variant = options.variant || config.defaultVariant;
    const availableVariants = project.getBuildVariants();
    
    // If interactive mode and no variant specified, ask user
    if (options.interactive && !options.variant) {
      Logger.step('Select build variant:');
      
      const variantChoices = availableVariants.map(v => ({
        name: v.charAt(0).toUpperCase() + v.slice(1),
        value: v,
      }));

      variant = await select({
        message: 'Which variant would you like to build?',
        choices: variantChoices,
        default: config.defaultVariant,
      });
      
      // Update default variant in config if different
      if (variant !== config.defaultVariant) {
        config.defaultVariant = variant;
        configManager.set(config);
        await configManager.save();
        Logger.success(`Default variant updated to: ${variant}`);
      }
    }
    
    if (!availableVariants.includes(variant)) {
      const error = `Invalid build variant: ${variant}. Available variants: ${availableVariants.join(', ')}`;
      Logger.error(`Invalid build variant: ${variant}`);
      Logger.info(`Available variants: ${availableVariants.join(', ')}`);
      return { success: false, error };
    }

    // Get ADB manager and ensure device is available
    const adbManager = AdbManager.getInstance();
    const deviceResult = await ensureDeviceAvailable(adbManager, options);
    
    if (!deviceResult.success) {
      return { success: false, error: deviceResult.error };
    }
    
    // Refresh device list after potential emulator start
    await adbManager.getDevices();
    const availableDevices = adbManager.getAvailableDevices();

    // Determine target device
    let targetDeviceId = options.device || config.selectedDevice;
    
    if (!targetDeviceId || !availableDevices.find(d => d.id === targetDeviceId)) {
      if (availableDevices.length === 1) {
        targetDeviceId = availableDevices[0].id;
        Logger.info(`Using device: ${availableDevices[0].name} (${targetDeviceId})`);
      } else {
        // Let user select device
        Logger.step('No device selected. Please choose a target device:');
        
        const deviceChoices = availableDevices.map(device => ({
          name: `${device.name} (${device.id}) - API ${device.apiLevel || 'Unknown'}`,
          value: device.id,
        }));

        targetDeviceId = await select({
          message: 'Select target device:',
          choices: deviceChoices,
        });
        
        Logger.success(`Selected device: ${adbManager.getDeviceById(targetDeviceId)?.name} (${targetDeviceId})`);
      }

      // Save selected device to config
      configManager.setSelectedDevice(targetDeviceId);
      await configManager.save();
    }

    const targetDevice = adbManager.getDeviceById(targetDeviceId);
    if (!targetDevice) {
      const error = `Device ${targetDeviceId} not found or not available.`;
      Logger.error(error);
      return { success: false, error };
    }

    Logger.device(`Target device: ${targetDevice.name} (${targetDevice.id})`);

    // Build the project
    const gradleWrapper = new GradleWrapper(project);
    Logger.build(`Building ${variant} variant...`);
    
    const buildResult = await gradleWrapper.build(variant, true);
    
    if (!buildResult.success) {
      const error = 'Build failed. Please check the error messages above.';
      Logger.error(error);
      return { success: false, error: buildResult.error || error };
    }

    if (!buildResult.apkPath) {
      const error = 'Build succeeded but APK path not found.';
      Logger.error(error);
      return { success: false, error };
    }

    // Install APK on device
    Logger.step('Installing APK on device...');
    const installSuccess = await adbManager.installApk(targetDevice.id, buildResult.apkPath);
    
    if (!installSuccess) {
      const error = 'Failed to install APK on device.';
      Logger.error(error);
      return { success: false, error };
    }

    // Launch the app
    Logger.step('Launching app...');
    const launchSuccess = await adbManager.launchApp(targetDevice.id, projectInfo.packageName);
    
    if (!launchSuccess) {
      Logger.warn('App installed but failed to launch automatically.');
      Logger.info('You can manually launch the app from the device.');
    }

    Logger.success('Build and deployment completed successfully!');
    Logger.info(`Total time: ${(buildResult.duration / 1000).toFixed(1)}s`);
    Logger.info('You can now run "android-cli logcat" to view app logs.');

    return { success: true };

  } catch (error) {
    const errorMessage = `Build command failed: ${error instanceof Error ? error.message : String(error)}`;
    Logger.error('Build command failed:', error);
    return { success: false, error: errorMessage };
  }
}