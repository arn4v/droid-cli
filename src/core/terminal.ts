import { ProcessManager } from '../utils/process';
import { Logger } from '../ui/logger';
import * as os from 'os';

export type TerminalType = 'auto' | 'iterm2' | 'terminal' | 'gnome-terminal' | 'konsole' | 'xterm' | 'wt';

export class TerminalManager {
  private static supportedTerminals: Record<string, TerminalType[]> = {
    darwin: ['iterm2', 'terminal'],
    linux: ['gnome-terminal', 'konsole', 'xterm'],
    win32: ['wt'], // Windows Terminal
  };

  static async detectTerminal(): Promise<TerminalType | null> {
    const platform = os.platform();
    const terminals = TerminalManager.supportedTerminals[platform] || [];

    for (const terminal of terminals) {
      if (await TerminalManager.isTerminalAvailable(terminal)) {
        Logger.debug(`Detected terminal: ${terminal}`);
        return terminal;
      }
    }

    Logger.debug('No supported terminal detected');
    return null;
  }

  static async isTerminalAvailable(terminal: TerminalType): Promise<boolean> {
    switch (terminal) {
      case 'iterm2':
        return await ProcessManager.checkCommand('osascript');
      case 'terminal':
        return os.platform() === 'darwin';
      case 'gnome-terminal':
        return await ProcessManager.checkCommand('gnome-terminal');
      case 'konsole':
        return await ProcessManager.checkCommand('konsole');
      case 'xterm':
        return await ProcessManager.checkCommand('xterm');
      case 'wt':
        return await ProcessManager.checkCommand('wt');
      default:
        return false;
    }
  }

  static async spawnTerminal(
    command: string,
    args: string[] = [],
    options: {
      title?: string;
      workingDirectory?: string;
      terminal?: TerminalType;
    } = {}
  ): Promise<boolean> {
    const terminal = options.terminal || await TerminalManager.detectTerminal();
    
    if (!terminal) {
      Logger.error('No supported terminal found');
      return false;
    }

    const title = options.title || 'Android CLI';
    const workingDirectory = options.workingDirectory || process.cwd();
    const escapedArgs = args.map(arg => TerminalManager.escapeShellArg(arg));
    const fullCommand = `${command} ${escapedArgs.join(' ')}`;

    Logger.debug(`Spawning terminal: ${terminal}, command: ${fullCommand}`);

    try {
      switch (terminal) {
        case 'iterm2':
          return await TerminalManager.spawnITerm2(fullCommand, title, workingDirectory);
        case 'terminal':
          return await TerminalManager.spawnTerminalApp(fullCommand, title, workingDirectory);
        case 'gnome-terminal':
          return await TerminalManager.spawnGnomeTerminal(fullCommand, title, workingDirectory);
        case 'konsole':
          return await TerminalManager.spawnKonsole(fullCommand, title, workingDirectory);
        case 'xterm':
          return await TerminalManager.spawnXterm(fullCommand, title, workingDirectory);
        case 'wt':
          return await TerminalManager.spawnWindowsTerminal(fullCommand, title, workingDirectory);
        default:
          Logger.error(`Unsupported terminal: ${terminal}`);
          return false;
      }
    } catch (error) {
      Logger.error(`Failed to spawn terminal: ${error}`);
      return false;
    }
  }

  private static async spawnITerm2(command: string, title: string, workingDirectory: string): Promise<boolean> {
    const appleScript = `
      tell application "iTerm"
        create window with default profile
        tell current session of current window
          set name to "${title}"
          write text "cd '${workingDirectory}'"
          write text "${command}"
        end tell
        activate
      end tell
    `;

    const result = await ProcessManager.run('osascript', ['-e', appleScript]);
    return result.success;
  }

  private static async spawnTerminalApp(command: string, title: string, workingDirectory: string): Promise<boolean> {
    const appleScript = `
      tell application "Terminal"
        do script "cd '${workingDirectory}' && ${command}"
        set custom title of front window to "${title}"
        activate
      end tell
    `;

    const result = await ProcessManager.run('osascript', ['-e', appleScript]);
    return result.success;
  }

  private static async spawnGnomeTerminal(command: string, title: string, workingDirectory: string): Promise<boolean> {
    const result = await ProcessManager.run('gnome-terminal', [
      '--title', title,
      '--working-directory', workingDirectory,
      '--', 'bash', '-c', `${command}; exec bash`
    ]);
    return result.success;
  }

  private static async spawnKonsole(command: string, title: string, workingDirectory: string): Promise<boolean> {
    const result = await ProcessManager.run('konsole', [
      '--title', title,
      '--workdir', workingDirectory,
      '-e', 'bash', '-c', `${command}; exec bash`
    ]);
    return result.success;
  }

  private static async spawnXterm(command: string, title: string, workingDirectory: string): Promise<boolean> {
    const result = await ProcessManager.run('xterm', [
      '-title', title,
      '-e', 'bash', '-c', `cd '${workingDirectory}' && ${command}; exec bash`
    ]);
    return result.success;
  }

  private static async spawnWindowsTerminal(command: string, title: string, workingDirectory: string): Promise<boolean> {
    const result = await ProcessManager.run('wt', [
      '--title', title,
      '--startingDirectory', workingDirectory,
      'cmd', '/c', command
    ]);
    return result.success;
  }

  static getAvailableTerminals(): Promise<TerminalType[]> {
    const platform = os.platform();
    const terminals = TerminalManager.supportedTerminals[platform] || [];
    
    return Promise.all(
      terminals.map(async (terminal) => {
        const available = await TerminalManager.isTerminalAvailable(terminal);
        return available ? terminal : null;
      })
    ).then(results => results.filter((t): t is TerminalType => t !== null));
  }

  private static escapeShellArg(arg: string): string {
    // If the argument contains special shell characters, quote it
    if (/[*?\s'"$`\\|&;<>(){}[\]]/.test(arg)) {
      // Use single quotes and escape any single quotes within the argument
      return `'${arg.replace(/'/g, "'\"'\"'")}'`;
    }
    return arg;
  }
}