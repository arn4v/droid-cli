import * as fs from 'fs-extra';
import * as path from 'path';
import { AndroidCliConfig, androidCliConfigSchema, defaultConfig } from './schema';
import { Logger } from '../ui/logger';
import { AndroidProject } from '../core/android-project';

export class ConfigManager {
  private static instance: ConfigManager;
  private config: AndroidCliConfig;
  private configPath: string;
  private projectRoot: string;

  private constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
    this.configPath = path.join(projectRoot, 'droid-cli.json');
    this.config = { ...defaultConfig };
  }

  static getInstance(projectRoot?: string): ConfigManager {
    if (!ConfigManager.instance || (projectRoot && projectRoot !== ConfigManager.instance.projectRoot)) {
      ConfigManager.instance = new ConfigManager(projectRoot);
    }
    return ConfigManager.instance;
  }

  async load(): Promise<AndroidCliConfig> {
    try {
      if (await fs.pathExists(this.configPath)) {
        Logger.debug(`Loading config from: ${this.configPath}`);
        
        const configData = await fs.readJson(this.configPath);
        const { error, value } = androidCliConfigSchema.validate(configData, {
          allowUnknown: false,
          abortEarly: false,
        });

        if (error) {
          Logger.warn('Config validation errors:', error.details.map(d => d.message).join(', '));
          Logger.warn('Using default config with valid values merged');
          
          // Merge valid values with defaults
          this.config = { ...defaultConfig, ...this.extractValidConfig(configData) };
        } else {
          this.config = value;
        }
      } else {
        Logger.debug('No config file found, using defaults');
        await this.autoDetectProjectSettings();
      }

      return this.config;
    } catch (error) {
      Logger.error('Error loading config:', error);
      Logger.info('Using default configuration');
      return this.config;
    }
  }

  async save(): Promise<void> {
    try {
      Logger.debug(`Saving config to: ${this.configPath}`);
      
      await fs.ensureDir(path.dirname(this.configPath));
      await fs.writeJson(this.configPath, this.config, { spaces: 2 });
      
      Logger.success('Configuration saved');
    } catch (error) {
      Logger.error('Error saving config:', error);
      throw error;
    }
  }

  get(): AndroidCliConfig {
    return { ...this.config };
  }

  set(updates: Partial<AndroidCliConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  getProjectPath(): string {
    return path.resolve(this.projectRoot, this.config.projectPath);
  }

  getDefaultVariant(): string {
    return this.config.defaultVariant;
  }

  getTerminal(): string {
    return this.config.terminal;
  }

  getCustomGradleTasks(): string[] {
    return this.config.gradleTasks.custom;
  }

  isBuildCacheEnabled(): boolean {
    return this.config.buildCache.enabled;
  }

  getBuildCacheMaxSize(): string {
    return this.config.buildCache.maxSize;
  }

  shouldClearLogcatOnStart(): boolean {
    return this.config.logcat.clearOnStart;
  }

  shouldColorizeLogcat(): boolean {
    return this.config.logcat.colorize;
  }

  getSelectedDevice(): string | undefined {
    return this.config.selectedDevice;
  }

  setSelectedDevice(deviceId: string): void {
    this.config.selectedDevice = deviceId;
  }

  async exists(): Promise<boolean> {
    return await fs.pathExists(this.configPath);
  }

  getConfigPath(): string {
    return this.configPath;
  }

  private extractValidConfig(configData: any): Partial<AndroidCliConfig> {
    const validConfig: Partial<AndroidCliConfig> = {};

    if (typeof configData.projectPath === 'string') {
      validConfig.projectPath = configData.projectPath;
    }

    if (['debug', 'release'].includes(configData.defaultVariant)) {
      validConfig.defaultVariant = configData.defaultVariant;
    }

    if (typeof configData.terminal === 'string') {
      validConfig.terminal = configData.terminal;
    }

    if (configData.gradleTasks && Array.isArray(configData.gradleTasks.custom)) {
      validConfig.gradleTasks = {
        custom: configData.gradleTasks.custom.filter((task: any) => typeof task === 'string'),
      };
    }

    if (configData.buildCache && typeof configData.buildCache === 'object') {
      validConfig.buildCache = {
        enabled: Boolean(configData.buildCache.enabled),
        maxSize: typeof configData.buildCache.maxSize === 'string' 
          ? configData.buildCache.maxSize 
          : defaultConfig.buildCache.maxSize,
      };
    }

    if (configData.logcat && typeof configData.logcat === 'object') {
      validConfig.logcat = {
        clearOnStart: Boolean(configData.logcat.clearOnStart),
        colorize: Boolean(configData.logcat.colorize),
        template: typeof configData.logcat.template === 'string' 
          ? configData.logcat.template 
          : defaultConfig.logcat.template,
      };
    }

    if (typeof configData.selectedDevice === 'string') {
      validConfig.selectedDevice = configData.selectedDevice;
    }

    return validConfig;
  }

  private async autoDetectProjectSettings(): Promise<void> {
    try {
      const project = await AndroidProject.detect(this.projectRoot);
      
      if (project) {
        const projectInfo = project.getInfo();
        if (projectInfo) {
          // Update config with detected project settings
          this.config.projectPath = path.relative(this.projectRoot, projectInfo.rootPath) || './';
          
          // Set default variant based on available variants
          const variants = project.getBuildVariants();
          if (variants.includes('debug')) {
            this.config.defaultVariant = 'debug';
          } else if (variants.length > 0) {
            this.config.defaultVariant = variants[0];
          }
          
          Logger.info('Auto-detected Android project settings');
        }
      }
    } catch (error) {
      Logger.debug('Failed to auto-detect project settings:', error);
    }
  }

  async reset(): Promise<void> {
    this.config = { ...defaultConfig };
    await this.autoDetectProjectSettings();
    await this.save();
    Logger.success('Configuration reset to defaults');
  }

  validate(): { valid: boolean; errors: string[] } {
    const { error } = androidCliConfigSchema.validate(this.config, {
      allowUnknown: false,
      abortEarly: false,
    });

    if (error) {
      return {
        valid: false,
        errors: error.details.map(d => d.message),
      };
    }

    return { valid: true, errors: [] };
  }
}