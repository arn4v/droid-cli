import * as path from 'path';
import { ProcessManager } from '../utils/process';
import { Logger } from '../ui/logger';
import { AndroidProject } from './android-project';
import ora from 'ora';

export interface GradleBuildResult {
  success: boolean;
  duration: number;
  apkPath?: string;
  error?: string;
}

export class GradleWrapper {
  private project: AndroidProject;
  private spinner = ora();

  constructor(project: AndroidProject) {
    this.project = project;
  }

  async build(variant: string = 'debug', showProgress: boolean = true): Promise<GradleBuildResult> {
    const startTime = Date.now();
    
    if (showProgress) {
      this.spinner.start(`Building ${variant} variant...`);
    }

    try {
      const gradleCommand = this.project.getGradleCommand();
      const taskName = `assemble${variant.charAt(0).toUpperCase() + variant.slice(1)}`;
      
      Logger.build(`Running: ${gradleCommand} ${taskName}`);
      
      const result = await ProcessManager.run(
        gradleCommand,
        [taskName, '--build-cache', '--daemon'],
        {
          cwd: this.project.getRootPath(),
          stdio: showProgress ? 'pipe' : 'inherit',
        }
      );

      const duration = Date.now() - startTime;

      if (result.success) {
        const apkPath = await this.project.getApkPath(variant);
        
        if (showProgress) {
          this.spinner.succeed(`Build completed in ${(duration / 1000).toFixed(1)}s`);
        }
        
        Logger.success(`Build successful! APK: ${apkPath}`);
        
        return {
          success: true,
          duration,
          apkPath,
        };
      } else {
        if (showProgress) {
          this.spinner.fail('Build failed');
        }
        
        Logger.error('Build failed:', result.stderr);
        
        return {
          success: false,
          duration,
          error: result.stderr,
        };
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      
      if (showProgress) {
        this.spinner.fail('Build failed');
      }
      
      Logger.error('Build error:', error);
      
      return {
        success: false,
        duration,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async clean(): Promise<boolean> {
    this.spinner.start('Cleaning project...');

    try {
      const gradleCommand = this.project.getGradleCommand();
      
      Logger.gradle('Running clean task...');
      
      const result = await ProcessManager.run(
        gradleCommand,
        ['clean'],
        {
          cwd: this.project.getRootPath(),
          stdio: 'pipe',
        }
      );

      if (result.success) {
        this.spinner.succeed('Clean completed');
        Logger.success('Project cleaned successfully');
        return true;
      } else {
        this.spinner.fail('Clean failed');
        Logger.error('Clean failed:', result.stderr);
        return false;
      }
    } catch (error) {
      this.spinner.fail('Clean failed');
      Logger.error('Clean error:', error);
      return false;
    }
  }

  async syncProject(): Promise<boolean> {
    this.spinner.start('Syncing Gradle files...');

    try {
      const gradleCommand = this.project.getGradleCommand();
      
      Logger.gradle('Syncing project dependencies...');
      
      const result = await ProcessManager.run(
        gradleCommand,
        ['build', '--dry-run'],
        {
          cwd: this.project.getRootPath(),
          stdio: 'pipe',
        }
      );

      if (result.success) {
        this.spinner.succeed('Gradle sync completed');
        Logger.success('Project synced successfully');
        return true;
      } else {
        this.spinner.fail('Gradle sync failed');
        Logger.error('Sync failed:', result.stderr);
        return false;
      }
    } catch (error) {
      this.spinner.fail('Gradle sync failed');
      Logger.error('Sync error:', error);
      return false;
    }
  }

  async runTask(taskName: string, args: string[] = []): Promise<boolean> {
    this.spinner.start(`Running Gradle task: ${taskName}...`);

    try {
      const gradleCommand = this.project.getGradleCommand();
      const allArgs = [taskName, ...args];
      
      Logger.gradle(`Running: ${gradleCommand} ${allArgs.join(' ')}`);
      
      const result = await ProcessManager.run(
        gradleCommand,
        allArgs,
        {
          cwd: this.project.getRootPath(),
          stdio: 'pipe',
        }
      );

      if (result.success) {
        this.spinner.succeed(`Task ${taskName} completed`);
        Logger.success(`Task ${taskName} completed successfully`);
        
        if (result.stdout) {
          console.log(result.stdout);
        }
        
        return true;
      } else {
        this.spinner.fail(`Task ${taskName} failed`);
        Logger.error(`Task ${taskName} failed:`, result.stderr);
        return false;
      }
    } catch (error) {
      this.spinner.fail(`Task ${taskName} failed`);
      Logger.error(`Task ${taskName} error:`, error);
      return false;
    }
  }

  async getTasks(): Promise<string[]> {
    try {
      const gradleCommand = this.project.getGradleCommand();
      
      const result = await ProcessManager.run(
        gradleCommand,
        ['tasks', '--all'],
        {
          cwd: this.project.getRootPath(),
          stdio: 'pipe',
        }
      );

      if (result.success) {
        return this.parseTasksList(result.stdout);
      } else {
        Logger.error('Failed to get tasks:', result.stderr);
        return [];
      }
    } catch (error) {
      Logger.error('Error getting tasks:', error);
      return [];
    }
  }

  private parseTasksList(output: string): string[] {
    const tasks: string[] = [];
    const lines = output.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('-') && !trimmed.includes('Rule based tasks:')) {
        const taskMatch = trimmed.match(/^(\w+)/);
        if (taskMatch) {
          const taskName = taskMatch[1];
          if (!tasks.includes(taskName) && taskName !== 'tasks') {
            tasks.push(taskName);
          }
        }
      }
    }
    
    return tasks.sort();
  }

  async getProjectDependencies(): Promise<string[]> {
    try {
      const gradleCommand = this.project.getGradleCommand();
      
      const result = await ProcessManager.run(
        gradleCommand,
        ['dependencies'],
        {
          cwd: this.project.getRootPath(),
          stdio: 'pipe',
        }
      );

      if (result.success) {
        return this.parseDependencies(result.stdout);
      } else {
        Logger.error('Failed to get dependencies:', result.stderr);
        return [];
      }
    } catch (error) {
      Logger.error('Error getting dependencies:', error);
      return [];
    }
  }

  private parseDependencies(output: string): string[] {
    const dependencies: string[] = [];
    const lines = output.split('\n');
    
    for (const line of lines) {
      const dependencyMatch = line.match(/[\+\\`]-+ (.+):(.+):(.+)/);
      if (dependencyMatch) {
        const dependency = `${dependencyMatch[1]}:${dependencyMatch[2]}:${dependencyMatch[3]}`;
        if (!dependencies.includes(dependency)) {
          dependencies.push(dependency);
        }
      }
    }
    
    return dependencies.sort();
  }
}