import { execa } from 'execa';
import type { Options } from 'execa';
import { Logger } from '../ui/logger';

export interface ProcessResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  success: boolean;
}

export class ProcessManager {
  static async run(
    command: string,
    args: string[] = [],
    options: Options = {}
  ): Promise<ProcessResult> {
    try {
      Logger.debug(`Running: ${command} ${args.join(' ')}`);
      
      const result = await execa(command, args, {
        stdio: options.stdio || 'pipe',
        cwd: options.cwd || process.cwd(),
        env: { ...process.env, ...options.env },
        ...options,
      });

      return {
        stdout: String(result.stdout || ''),
        stderr: String(result.stderr || ''),
        exitCode: result.exitCode || 0,
        success: true,
      };
    } catch (error: any) {
      Logger.debug(`Command failed: ${command} ${args.join(' ')}`);
      
      return {
        stdout: String(error.stdout || ''),
        stderr: String(error.stderr || error.message || ''),
        exitCode: error.exitCode || 1,
        success: false,
      };
    }
  }

  static spawn(
    command: string,
    args: string[] = [],
    options: Options = {}
  ) {
    Logger.debug(`Spawning: ${command} ${args.join(' ')}`);
    
    return execa(command, args, {
      stdio: 'inherit',
      cwd: options.cwd || process.cwd(),
      env: { ...process.env, ...options.env },
      ...options,
    });
  }

  static async checkCommand(command: string): Promise<boolean> {
    try {
      await execa('which', [command], { stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }

  static async getCommandVersion(command: string, versionFlag = '--version'): Promise<string | null> {
    try {
      const result = await execa(command, [versionFlag], { stdio: 'pipe' });
      return String(result.stdout || '').trim();
    } catch {
      return null;
    }
  }
}