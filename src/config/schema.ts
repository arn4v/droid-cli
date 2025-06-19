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
  }).default({ clearOnStart: true, colorize: true }),
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
  },
};