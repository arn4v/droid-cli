import chalk from 'chalk';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export class Logger {
  private static level: LogLevel = process.env.DEBUG ? LogLevel.DEBUG : LogLevel.INFO;

  static setLevel(level: LogLevel) {
    Logger.level = level;
  }

  static debug(message: string, ...args: any[]) {
    if (Logger.level <= LogLevel.DEBUG) {
      console.log(chalk.gray('🔍 DEBUG:'), message, ...args);
    }
  }

  static info(message: string, ...args: any[]) {
    if (Logger.level <= LogLevel.INFO) {
      console.log(chalk.blue('ℹ️  INFO:'), message, ...args);
    }
  }

  static success(message: string, ...args: any[]) {
    if (Logger.level <= LogLevel.INFO) {
      console.log(chalk.green('✅ SUCCESS:'), message, ...args);
    }
  }

  static warn(message: string, ...args: any[]) {
    if (Logger.level <= LogLevel.WARN) {
      console.log(chalk.yellow('⚠️  WARN:'), message, ...args);
    }
  }

  static error(message: string, ...args: any[]) {
    if (Logger.level <= LogLevel.ERROR) {
      console.error(chalk.red('❌ ERROR:'), message, ...args);
    }
  }

  static step(message: string) {
    console.log(chalk.cyan('📋'), message);
  }

  static build(message: string) {
    console.log(chalk.magenta('🔨'), message);
  }

  static device(message: string) {
    console.log(chalk.green('📱'), message);
  }

  static gradle(message: string) {
    console.log(chalk.blue('⚙️ '), message);
  }
}