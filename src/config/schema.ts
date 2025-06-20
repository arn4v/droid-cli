import Joi from 'joi';

export interface AndroidCliConfig {
  projectPath: string;
  defaultVariant: string;
  terminal: string;
  gradleTasks: {
    custom: string[];
  };
  buildCache: {
    enabled: boolean;
    maxSize: string;
  };
  logcat: {
    clearOnStart: boolean;
    colorize: boolean;
    template: string;
  };
  adbReverse: {
    enabled: boolean;
    ports: number[];
  };
  selectedDevice?: string;
}

export const androidCliConfigSchema = Joi.object<AndroidCliConfig>({
  projectPath: Joi.string().required().description('Path to the Android project directory'),
  defaultVariant: Joi.string().valid('debug', 'release').default('debug').description('Default build variant'),
  terminal: Joi.string().default('auto').description('Terminal application to use for logcat'),
  gradleTasks: Joi.object({
    custom: Joi.array().items(Joi.string()).default([]).description('Custom gradle tasks'),
  }).default({ custom: [] }),
  buildCache: Joi.object({
    enabled: Joi.boolean().default(true).description('Enable build caching'),
    maxSize: Joi.string().default('1GB').description('Maximum cache size'),
  }).default({ enabled: true, maxSize: '1GB' }),
  logcat: Joi.object({
    clearOnStart: Joi.boolean().default(true).description('Clear logcat on start'),
    colorize: Joi.boolean().default(true).description('Colorize logcat output'),
    template: Joi.string().default('adb logcat --pid=$(adb shell pidof -s {{package_name}})').description('Logcat command template with variable substitution'),
  }).default({ clearOnStart: true, colorize: true, template: 'adb logcat --pid=$(adb shell pidof -s {{package_name}})' }),
  adbReverse: Joi.object({
    enabled: Joi.boolean().default(false).description('Enable automatic adb reverse port forwarding'),
    ports: Joi.array().items(Joi.number().port()).default([8081]).description('Ports to forward (e.g., [8081] for React Native Metro)'),
  }).default({ enabled: false, ports: [8081] }),
  selectedDevice: Joi.string().optional().description('Last selected device ID'),
});

export const defaultConfig: AndroidCliConfig = {
  projectPath: './app',
  defaultVariant: 'debug',
  terminal: 'auto',
  gradleTasks: {
    custom: [],
  },
  buildCache: {
    enabled: true,
    maxSize: '1GB',
  },
  logcat: {
    clearOnStart: true,
    colorize: true,
    template: 'adb logcat --pid=$(adb shell pidof -s {{package_name}})',
  },
  adbReverse: {
    enabled: false,
    ports: [8081],
  },
};