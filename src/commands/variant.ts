import { Logger } from '../ui/logger';
import { AndroidProject } from '../core/android-project';
import { ConfigManager } from '../config/config-manager';
import { select } from '@inquirer/prompts';

export async function variantCommand() {
  try {
    Logger.step('Selecting build variant...');

    // Load configuration
    const configManager = ConfigManager.getInstance();
    const config = await configManager.load();

    // Detect Android project
    const project = await AndroidProject.detect(configManager.getProjectPath());
    if (!project) {
      Logger.error('No Android project found. Please run this command from an Android project directory or run "android-cli init" first.');
      process.exit(1);
    }

    const projectInfo = project.getInfo();
    if (!projectInfo) {
      Logger.error('Failed to load Android project information.');
      process.exit(1);
    }

    const availableVariants = project.getBuildVariants();
    
    Logger.info(`Current default variant: ${config.defaultVariant}`);
    Logger.info(`Available variants: ${availableVariants.join(', ')}`);

    const variantChoices = availableVariants.map(variant => ({
      name: `${variant.charAt(0).toUpperCase() + variant.slice(1)}${variant === config.defaultVariant ? ' (current)' : ''}`,
      value: variant,
    }));

    const selectedVariant = await select({
      message: 'Select new default build variant:',
      choices: variantChoices,
      default: config.defaultVariant,
    });

    if (selectedVariant === config.defaultVariant) {
      Logger.info(`Variant remains: ${selectedVariant}`);
      return;
    }

    // Update config
    config.defaultVariant = selectedVariant;
    configManager.set(config);
    await configManager.save();

    Logger.success(`Default build variant changed to: ${selectedVariant}`);

  } catch (error) {
    Logger.error('Variant command failed:', error);
    process.exit(1);
  }
}

export async function selectBuildVariant(): Promise<string> {
  try {
    const configManager = ConfigManager.getInstance();
    const config = await configManager.load();
    
    const project = await AndroidProject.detect(configManager.getProjectPath());
    if (!project) {
      throw new Error('No Android project found');
    }

    const availableVariants = project.getBuildVariants();
    
    const variantChoices = availableVariants.map(variant => ({
      name: variant.charAt(0).toUpperCase() + variant.slice(1),
      value: variant,
    }));

    return await select({
      message: 'Select build variant:',
      choices: variantChoices,
      default: config.defaultVariant,
    });

  } catch (error) {
    Logger.error('Failed to select build variant:', error);
    throw error;
  }
}