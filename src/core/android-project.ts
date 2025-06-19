import * as fs from 'fs-extra';
import * as path from 'path';
import { Logger } from '../ui/logger';
import { Validators } from '../utils/validators';

export interface AndroidProjectInfo {
  rootPath: string;
  appPath: string;
  packageName: string;
  buildVariants: string[];
  hasGradleWrapper: boolean;
  gradleWrapperPath: string;
}

export class AndroidProject {
  private projectInfo: AndroidProjectInfo | null = null;

  static async detect(startPath: string = process.cwd()): Promise<AndroidProject | null> {
    const project = new AndroidProject();
    
    // Search for Android project from current directory upwards
    let currentPath = path.resolve(startPath);
    
    while (currentPath !== path.dirname(currentPath)) {
      if (Validators.isAndroidProject(currentPath)) {
        Logger.debug(`Found Android project at: ${currentPath}`);
        await project.loadProjectInfo(currentPath);
        return project;
      }
      currentPath = path.dirname(currentPath);
    }
    
    Logger.debug('No Android project found');
    return null;
  }

  private async loadProjectInfo(rootPath: string): Promise<void> {
    try {
      const appPath = path.join(rootPath, 'app');
      const buildGradlePath = path.join(appPath, 'build.gradle');
      const buildGradleKtsPath = path.join(appPath, 'build.gradle.kts');
      
      let buildGradleContent = '';
      
      if (await Validators.isFile(buildGradlePath)) {
        buildGradleContent = await fs.readFile(buildGradlePath, 'utf-8');
      } else if (await Validators.isFile(buildGradleKtsPath)) {
        buildGradleContent = await fs.readFile(buildGradleKtsPath, 'utf-8');
      }

      const packageName = this.extractPackageName(buildGradleContent);
      const buildVariants = this.extractBuildVariants(buildGradleContent);
      const hasGradleWrapper = Validators.hasGradleWrapper(rootPath);
      const gradleWrapperPath = path.join(rootPath, 'gradlew');

      this.projectInfo = {
        rootPath,
        appPath,
        packageName,
        buildVariants,
        hasGradleWrapper,
        gradleWrapperPath,
      };

      Logger.debug(`Loaded project info: ${JSON.stringify(this.projectInfo, null, 2)}`);
    } catch (error) {
      Logger.error('Failed to load project info:', error);
      throw error;
    }
  }

  private extractPackageName(buildGradleContent: string): string {
    // Extract applicationId from build.gradle
    const match = buildGradleContent.match(/applicationId\s+['"](.*?)['"]/);
    return match ? match[1] : 'unknown';
  }

  private extractBuildVariants(buildGradleContent: string): string[] {
    const variants = ['debug', 'release']; // Default variants
    
    // Look for custom build types
    const buildTypesMatch = buildGradleContent.match(/buildTypes\s*\{([\s\S]*?)\}/);
    if (buildTypesMatch) {
      const buildTypesContent = buildTypesMatch[1];
      const customVariants = buildTypesContent.match(/(\w+)\s*\{/g);
      
      if (customVariants) {
        customVariants.forEach(variant => {
          const variantName = variant.replace(/\s*\{/, '').trim();
          if (!variants.includes(variantName)) {
            variants.push(variantName);
          }
        });
      }
    }
    
    return variants;
  }

  getInfo(): AndroidProjectInfo | null {
    return this.projectInfo;
  }

  getRootPath(): string {
    return this.projectInfo?.rootPath || process.cwd();
  }

  getAppPath(): string {
    return this.projectInfo?.appPath || path.join(process.cwd(), 'app');
  }

  getPackageName(): string {
    return this.projectInfo?.packageName || 'unknown';
  }

  getBuildVariants(): string[] {
    return this.projectInfo?.buildVariants || ['debug', 'release'];
  }

  hasGradleWrapper(): boolean {
    return this.projectInfo?.hasGradleWrapper || false;
  }

  getGradleWrapperPath(): string {
    return this.projectInfo?.gradleWrapperPath || './gradlew';
  }

  getGradleCommand(): string {
    if (this.hasGradleWrapper()) {
      return this.getGradleWrapperPath();
    }
    return 'gradle';
  }

  async getApkPath(variant: string = 'debug'): Promise<string> {
    const apkDir = path.join(this.getAppPath(), 'build', 'outputs', 'apk', variant);
    
    if (await Validators.isDirectory(apkDir)) {
      const files = await fs.readdir(apkDir);
      const apkFile = files.find(file => file.endsWith('.apk'));
      
      if (apkFile) {
        return path.join(apkDir, apkFile);
      }
    }
    
    // Return expected path even if file doesn't exist yet
    return path.join(apkDir, `app-${variant}.apk`);
  }
}