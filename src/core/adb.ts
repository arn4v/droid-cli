import { ProcessManager } from '../utils/process';
import { Logger } from '../ui/logger';
import { Validators } from '../utils/validators';

export interface InstallResult {
  success: boolean;
  error?: string;
  errorType?: 'INSUFFICIENT_STORAGE' | 'DUPLICATE_PACKAGE' | 'PERMISSION_DENIED' | 'INVALID_APK' | 'UNKNOWN';
  suggestion?: string;
}

export interface AndroidDevice {
  id: string;
  name: string;
  state: 'device' | 'offline' | 'unauthorized';
  type: 'emulator' | 'device';
  apiLevel?: number;
  model?: string;
}

export interface AvailableEmulator {
  name: string;
  displayName: string;
}

export class AdbManager {
  private static instance: AdbManager;
  private devices: AndroidDevice[] = [];

  static getInstance(): AdbManager {
    if (!AdbManager.instance) {
      AdbManager.instance = new AdbManager();
    }
    return AdbManager.instance;
  }

  async checkAdbAvailable(): Promise<boolean> {
    const available = await ProcessManager.checkCommand('adb');
    if (!available) {
      Logger.error('ADB not found. Please ensure Android SDK is installed and adb is in your PATH.');
    }
    return available;
  }

  async getDevices(): Promise<AndroidDevice[]> {
    if (!(await this.checkAdbAvailable())) {
      Logger.debug('ADB not available');
      return [];
    }

    try {
      const result = await ProcessManager.run('adb', ['devices', '-l']);
      
      if (!result.success) {
        Logger.error('Failed to get devices:', result.stderr);
        return [];
      }

      Logger.debug('ADB devices output:', result.stdout);
      this.devices = await this.parseDevicesList(result.stdout);
      Logger.debug('Parsed devices:', JSON.stringify(this.devices, null, 2));
      return this.devices;
    } catch (error) {
      Logger.error('Error getting devices:', error);
      return [];
    }
  }

  private async parseDevicesList(output: string): Promise<AndroidDevice[]> {
    const lines = output.split('\n');
    const devices: AndroidDevice[] = [];

    for (const line of lines) {
      // Skip header line and empty lines
      if (line.includes('List of devices attached') || !line.trim()) {
        continue;
      }
      
      // Parse device line - format: "deviceId    state    details..."
      // Split by whitespace and get first two parts
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 2) {
        const deviceId = parts[0].trim();
        const state = parts[1].trim() as AndroidDevice['state'];
        
        Logger.debug(`Parsing device line: "${line}"`);
        Logger.debug(`Device ID: "${deviceId}", State: "${state}"`);
        
        if (Validators.isValidDeviceId(deviceId)) {
          const device: AndroidDevice = {
            id: deviceId,
            name: await this.getDeviceName(deviceId),
            state,
            type: deviceId.includes('emulator') ? 'emulator' : 'device',
          };

          // Get additional device properties
          const properties = await this.getDeviceProperties(deviceId);
          device.apiLevel = properties.apiLevel;
          device.model = properties.model;

          devices.push(device);
          Logger.debug(`Added device: ${JSON.stringify(device, null, 2)}`);
        } else {
          Logger.debug(`Invalid device ID: ${deviceId}`);
        }
      }
    }

    return devices;
  }

  private async getDeviceName(deviceId: string): Promise<string> {
    try {
      const result = await ProcessManager.run('adb', [
        '-s', deviceId,
        'shell', 'getprop', 'ro.product.model'
      ]);
      
      if (result.success && result.stdout.trim()) {
        return result.stdout.trim();
      }
    } catch (error) {
      Logger.debug(`Failed to get device name for ${deviceId}:`, error);
    }
    
    return deviceId;
  }

  private async getDeviceProperties(deviceId: string): Promise<{
    apiLevel?: number;
    model?: string;
  }> {
    const properties: { apiLevel?: number; model?: string } = {};

    try {
      // Get API level
      const apiResult = await ProcessManager.run('adb', [
        '-s', deviceId,
        'shell', 'getprop', 'ro.build.version.sdk'
      ]);
      
      if (apiResult.success && apiResult.stdout.trim()) {
        properties.apiLevel = parseInt(apiResult.stdout.trim(), 10);
      }

      // Get model
      const modelResult = await ProcessManager.run('adb', [
        '-s', deviceId,
        'shell', 'getprop', 'ro.product.model'
      ]);
      
      if (modelResult.success && modelResult.stdout.trim()) {
        properties.model = modelResult.stdout.trim();
      }
    } catch (error) {
      Logger.debug(`Failed to get properties for ${deviceId}:`, error);
    }

    return properties;
  }

  async installApk(deviceId: string, apkPath: string): Promise<InstallResult> {
    if (!(await this.checkAdbAvailable())) {
      return {
        success: false,
        error: 'ADB is not available',
        errorType: 'UNKNOWN',
        suggestion: 'Please ensure Android SDK is installed and ADB is in PATH'
      };
    }

    try {
      Logger.info(`Installing APK on ${deviceId}...`);
      
      const result = await ProcessManager.run('adb', [
        '-s', deviceId,
        'install', '-r', apkPath
      ]);

      if (result.success) {
        Logger.success(`APK installed successfully on ${deviceId}`);
        return { success: true };
      } else {
        const errorOutput = result.stderr || result.stdout || '';
        Logger.error(`Failed to install APK on ${deviceId}:`, errorOutput);
        
        return this.analyzeInstallError(errorOutput);
      }
    } catch (error) {
      Logger.error('Error installing APK:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        errorType: 'UNKNOWN',
        suggestion: 'Check that the device is connected and the APK file exists'
      };
    }
  }

  private analyzeInstallError(errorOutput: string): InstallResult {
    const error = errorOutput.toLowerCase();

    if (error.includes('install_failed_insufficient_storage')) {
      return {
        success: false,
        error: errorOutput,
        errorType: 'INSUFFICIENT_STORAGE',
        suggestion: 'The device is running out of storage space. Try uninstalling unused apps or clearing app data.'
      };
    }

    if (error.includes('install_failed_already_exists') || error.includes('install_failed_duplicate_package')) {
      return {
        success: false,
        error: errorOutput,
        errorType: 'DUPLICATE_PACKAGE',
        suggestion: 'The app is already installed. Try uninstalling it first or use the force reinstall option.'
      };
    }

    if (error.includes('install_failed_invalid_apk') || error.includes('failed to parse')) {
      return {
        success: false,
        error: errorOutput,
        errorType: 'INVALID_APK',
        suggestion: 'The APK file is corrupted or invalid. Try rebuilding the project.'
      };
    }

    if (error.includes('permission denied') || error.includes('install_failed_user_restricted')) {
      return {
        success: false,
        error: errorOutput,
        errorType: 'PERMISSION_DENIED',
        suggestion: 'Installation blocked by device security. Enable "Install from unknown sources" or check device permissions.'
      };
    }

    return {
      success: false,
      error: errorOutput,
      errorType: 'UNKNOWN',
      suggestion: 'Check device connection and try again. If the problem persists, try restarting ADB or the device.'
    };
  }

  async uninstallApp(deviceId: string, packageName: string): Promise<boolean> {
    if (!(await this.checkAdbAvailable())) {
      return false;
    }

    try {
      Logger.info(`Uninstalling ${packageName} from ${deviceId}...`);
      
      const result = await ProcessManager.run('adb', [
        '-s', deviceId,
        'uninstall', packageName
      ]);

      if (result.success) {
        Logger.success(`${packageName} uninstalled successfully from ${deviceId}`);
        return true;
      }
      
      Logger.warn(`Could not uninstall ${packageName}:`, result.stderr);
      return false;
    } catch (error) {
      Logger.error('Error uninstalling app:', error);
      return false;
    }
  }

  async getStorageInfo(deviceId: string): Promise<{ total: string; available: string } | null> {
    if (!(await this.checkAdbAvailable())) {
      return null;
    }

    try {
      const result = await ProcessManager.run('adb', [
        '-s', deviceId,
        'shell', 'df', '/data'
      ]);

      if (result.success) {
        // Parse df output to get storage info
        const lines = result.stdout.split('\n');
        const dataLine = lines.find(line => line.includes('/data'));
        
        if (dataLine) {
          const parts = dataLine.split(/\s+/);
          if (parts.length >= 4) {
            const total = this.formatBytes(Number.parseInt(parts[1]) * 1024);
            const available = this.formatBytes(Number.parseInt(parts[3]) * 1024);
            return { total, available };
          }
        }
      }
      
      return null;
    } catch (error) {
      Logger.debug('Error getting storage info:', error);
      return null;
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
  }

  async launchApp(deviceId: string, packageName: string, activityName?: string): Promise<boolean> {
    if (!(await this.checkAdbAvailable())) {
      return false;
    }

    try {
      const activity = activityName || await this.getMainActivity(deviceId, packageName);
      
      if (!activity) {
        Logger.error(`Could not find main activity for ${packageName}`);
        return false;
      }

      Logger.info(`Launching ${packageName} on ${deviceId}...`);
      
      const result = await ProcessManager.run('adb', [
        '-s', deviceId,
        'shell', 'am', 'start',
        '-n', `${packageName}/${activity}`
      ]);

      if (result.success) {
        Logger.success(`App launched successfully on ${deviceId}`);
        return true;
      } else {
        Logger.error(`Failed to launch app on ${deviceId}:`, result.stderr);
        return false;
      }
    } catch (error) {
      Logger.error('Error launching app:', error);
      return false;
    }
  }

  private async getMainActivity(deviceId: string, packageName: string): Promise<string | null> {
    try {
      const result = await ProcessManager.run('adb', [
        '-s', deviceId,
        'shell', 'pm', 'dump', packageName
      ]);

      if (result.success) {
        const lines = result.stdout.split('\n');
        for (const line of lines) {
          if (line.includes('android.intent.action.MAIN')) {
            const activityMatch = line.match(/([a-zA-Z0-9._]+\/[a-zA-Z0-9._]+)/);
            if (activityMatch) {
              return activityMatch[1].split('/')[1];
            }
          }
        }
      }
    } catch (error) {
      Logger.debug(`Failed to get main activity for ${packageName}:`, error);
    }

    // Fallback to common activity names
    const commonActivities = ['.MainActivity', '.Main', '.HomeActivity'];
    for (const activity of commonActivities) {
      if (await this.activityExists(deviceId, packageName, activity)) {
        return activity;
      }
    }

    return null;
  }

  private async activityExists(deviceId: string, packageName: string, activityName: string): Promise<boolean> {
    try {
      const result = await ProcessManager.run('adb', [
        '-s', deviceId,
        'shell', 'pm', 'list', 'packages', packageName
      ]);

      return result.success && result.stdout.includes(packageName);
    } catch {
      return false;
    }
  }

  async clearAppData(deviceId: string, packageName: string): Promise<boolean> {
    if (!(await this.checkAdbAvailable())) {
      return false;
    }

    try {
      Logger.info(`Clearing app data for ${packageName} on ${deviceId}...`);
      
      const result = await ProcessManager.run('adb', [
        '-s', deviceId,
        'shell', 'pm', 'clear', packageName
      ]);

      if (result.success) {
        Logger.success(`App data cleared for ${packageName}`);
        return true;
      } else {
        Logger.error(`Failed to clear app data:`, result.stderr);
        return false;
      }
    } catch (error) {
      Logger.error('Error clearing app data:', error);
      return false;
    }
  }

  getDeviceById(deviceId: string): AndroidDevice | null {
    return this.devices.find(device => device.id === deviceId) || null;
  }

  getAvailableDevices(): AndroidDevice[] {
    return this.devices.filter(device => device.state === 'device');
  }

  getPhysicalDevices(): AndroidDevice[] {
    return this.devices.filter(device => device.type === 'device' && device.state === 'device');
  }

  getRunningEmulators(): AndroidDevice[] {
    return this.devices.filter(device => device.type === 'emulator' && device.state === 'device');
  }

  async getAvailableEmulators(): Promise<AvailableEmulator[]> {
    try {
      const result = await ProcessManager.run('emulator', ['-list-avds']);
      
      if (!result.success) {
        Logger.debug('Failed to get available emulators:', result.stderr);
        return [];
      }

      const emulators: AvailableEmulator[] = [];
      const lines = result.stdout.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        const name = line.trim();
        if (name) {
          emulators.push({
            name,
            displayName: name.replace(/_/g, ' '),
          });
        }
      }

      Logger.debug('Available emulators:', emulators);
      return emulators;
    } catch (error) {
      Logger.debug('Error getting available emulators:', error);
      return [];
    }
  }

  async startEmulator(emulatorName: string): Promise<boolean> {
    try {
      Logger.info(`Starting emulator: ${emulatorName}...`);
      
      // Start emulator in background
      const emulatorProcess = ProcessManager.spawn('emulator', ['-avd', emulatorName, '-no-audio'], {
        stdio: 'ignore',
      });

      // Don't wait for emulator to fully start, just check if it launched
      await new Promise(resolve => setTimeout(resolve, 3000));

      Logger.success(`Emulator ${emulatorName} is starting...`);
      Logger.info('Waiting for emulator to boot (this may take a minute)...');

      // Wait for emulator to appear in device list
      let attempts = 0;
      const maxAttempts = 30; // 30 seconds
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const devices = await this.getDevices();
        const runningEmulators = this.getRunningEmulators();
        
        if (runningEmulators.length > 0) {
          const emulator = runningEmulators.find(e => e.name.includes(emulatorName) || e.id.includes('emulator'));
          if (emulator) {
            Logger.success(`Emulator ready: ${emulator.name} (${emulator.id})`);
            return true;
          }
        }
        
        attempts++;
      }

      Logger.warn('Emulator started but may still be booting. You can check status with "adb devices"');
      return true;

    } catch (error) {
      Logger.error('Error starting emulator:', error);
      return false;
    }
  }

  async setupAdbReverse(deviceId: string, ports: number[]): Promise<boolean> {
    try {
      Logger.step('Setting up port forwarding...');
      
      for (const port of ports) {
        Logger.info(`Setting up adb reverse for port ${port}...`);
        
        const result = await ProcessManager.run('adb', [
          '-s', deviceId,
          'reverse', `tcp:${port}`, `tcp:${port}`
        ]);

        if (result.success) {
          Logger.success(`Port forwarding set up: device:${port} -> host:${port}`);
        } else {
          Logger.warn(`Failed to set up port forwarding for port ${port}: ${result.stderr}`);
          // Continue with other ports even if one fails
        }
      }
      
      return true;
    } catch (error) {
      Logger.error('Error setting up adb reverse:', error);
      return false;
    }
  }

  async checkEmulatorCommand(): Promise<boolean> {
    return await ProcessManager.checkCommand('emulator');
  }
}