import * as fs from 'fs-extra';
import * as path from 'path';

export class Validators {
  static isAndroidProject(projectPath: string): boolean {
    const settingsGradle = path.join(projectPath, 'settings.gradle');
    const settingsGradleKts = path.join(projectPath, 'settings.gradle.kts');
    
    return fs.existsSync(settingsGradle) || fs.existsSync(settingsGradleKts);
  }

  static hasGradleWrapper(projectPath: string): boolean {
    const gradlewPath = path.join(projectPath, 'gradlew');
    return fs.existsSync(gradlewPath);
  }

  static isValidDeviceId(deviceId: string): boolean {
    // Basic validation for Android device IDs
    return /^[a-zA-Z0-9_-]+$/.test(deviceId) && deviceId.length > 0;
  }

  static isValidBuildVariant(variant: string): boolean {
    const validVariants = ['debug', 'release'];
    return validVariants.includes(variant.toLowerCase());
  }

  static isValidGradleTask(task: string): boolean {
    // Basic validation for gradle task names
    return /^[a-zA-Z][a-zA-Z0-9]*$/.test(task);
  }

  static async isDirectory(dirPath: string): Promise<boolean> {
    try {
      const stat = await fs.stat(dirPath);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  static async isFile(filePath: string): Promise<boolean> {
    try {
      const stat = await fs.stat(filePath);
      return stat.isFile();
    } catch {
      return false;
    }
  }

  static isPortAvailable(port: number): boolean {
    return port > 0 && port <= 65535;
  }
}