import { Logger } from '../ui/logger';
import { AndroidProject } from '../core/android-project';
import { GradleWrapper } from '../core/gradle-wrapper';
import { ConfigManager } from '../config/config-manager';
import { select } from '@inquirer/prompts';

interface GradleOptions {
  args?: string;
}

export interface GradleResult {
  success: boolean;
  error?: string;
}

export async function gradleCommand(task: string, options: GradleOptions = {}): Promise<GradleResult> {
  try {
    Logger.step(`Running Gradle task: ${task}`);

    // Load configuration
    const configManager = ConfigManager.getInstance();
    const config = await configManager.load();

    // Detect Android project
    const project = await AndroidProject.detect(configManager.getProjectPath());
    if (!project) {
      const error = 'No Android project found. Please run this command from an Android project directory or run "droid-cli init" first.';
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

    // Parse additional arguments
    const additionalArgs = options.args ? options.args.split(' ').filter(arg => arg.trim()) : [];

    // Create gradle wrapper
    const gradleWrapper = new GradleWrapper(project);

    // Handle special tasks
    switch (task.toLowerCase()) {
      case 'clean':
        const cleanSuccess = await gradleWrapper.clean();
        if (!cleanSuccess) {
          const error = 'Clean task failed';
          Logger.error(error);
          return { success: false, error };
        }
        break;

      case 'sync':
        const syncSuccess = await gradleWrapper.syncProject();
        if (!syncSuccess) {
          const error = 'Sync task failed';
          Logger.error(error);
          return { success: false, error };
        }
        break;

      case 'tasks':
        Logger.step('Getting available Gradle tasks...');
        const tasks = await gradleWrapper.getTasks();
        
        if (tasks.length === 0) {
          Logger.warn('No Gradle tasks found');
        } else {
          Logger.success('Available Gradle tasks:');
          console.log('');
          
          // Group tasks by category
          const taskCategories = {
            build: tasks.filter(t => t.includes('assemble') || t.includes('build') || t === 'clean'),
            install: tasks.filter(t => t.includes('install') || t.includes('uninstall')),
            test: tasks.filter(t => t.includes('test') || t.includes('check')),
            other: tasks.filter(t => 
              !t.includes('assemble') && !t.includes('build') && t !== 'clean' &&
              !t.includes('install') && !t.includes('uninstall') &&
              !t.includes('test') && !t.includes('check')
            ),
          };

          Object.entries(taskCategories).forEach(([category, categoryTasks]) => {
            if (categoryTasks.length > 0) {
              console.log(`${category.toUpperCase()}:`);
              categoryTasks.forEach(task => console.log(`  • ${task}`));
              console.log('');
            }
          });
        }
        break;

      case 'dependencies':
        Logger.step('Getting project dependencies...');
        const dependencies = await gradleWrapper.getProjectDependencies();
        
        if (dependencies.length === 0) {
          Logger.warn('No dependencies found');
        } else {
          Logger.success(`Found ${dependencies.length} dependencies:`);
          console.log('');
          dependencies.forEach(dep => console.log(`  • ${dep}`));
        }
        break;

      default:
        // Run custom task
        const taskSuccess = await gradleWrapper.runTask(task, additionalArgs);
        if (!taskSuccess) {
          const error = `Task '${task}' failed`;
          Logger.error(error);
          return { success: false, error };
        }
        break;
    }

    Logger.success('Gradle task completed successfully!');
    return { success: true };

  } catch (error) {
    const errorMessage = `Gradle command failed: ${error instanceof Error ? error.message : String(error)}`;
    Logger.error('Gradle command failed:', error);
    return { success: false, error: errorMessage };
  }
}

// Helper function for interactive task selection
export async function selectGradleTask(): Promise<string> {
  try {
    const configManager = ConfigManager.getInstance();
    const config = await configManager.load();
    
    const project = await AndroidProject.detect(configManager.getProjectPath());
    if (!project) {
      throw new Error('No Android project found');
    }

    const gradleWrapper = new GradleWrapper(project);
    const tasks = await gradleWrapper.getTasks();
    
    // Add common tasks and custom tasks from config
    const commonTasks = ['clean', 'sync', 'tasks', 'dependencies'];
    const customTasks = config.gradleTasks.custom;
    
    const allTasks = [
      ...commonTasks,
      ...customTasks,
      ...tasks.filter(t => !commonTasks.includes(t) && !customTasks.includes(t))
    ];

    if (allTasks.length === 0) {
      throw new Error('No Gradle tasks available');
    }

    const taskChoices = allTasks.map(task => ({
      name: task,
      value: task,
    }));

    return await select({
      message: 'Select Gradle task to run:',
      choices: taskChoices,
    });

  } catch (error) {
    Logger.error('Failed to get Gradle tasks:', error);
    throw error;
  }
}