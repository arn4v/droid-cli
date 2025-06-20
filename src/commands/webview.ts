/**
 * WebView debugging command - detects WebViews and opens Chrome DevTools
 */

import { Command } from 'commander';
import { Logger } from '../ui/logger.js';
import { ConfigManager } from '../config/config-manager.js';
import { AdbManager } from '../core/adb.js';
import { WebViewManager, WebViewProcess } from '../core/webview.js';
import { select, confirm } from '@inquirer/prompts';

const logger = new Logger();

export interface WebViewCommandOptions {
  device?: string;
  project?: string;
  open?: boolean;
  setup?: boolean;
}

/**
 * Executes the webview command
 */
export async function executeWebViewCommand(options: WebViewCommandOptions): Promise<{ success: boolean; error?: string }> {
  try {
    Logger.info('🔍 Detecting WebView processes...');

    const configManager = ConfigManager.getInstance(options.project || process.cwd());
    const adbManager = new AdbManager();
    const webviewManager = new WebViewManager();

    // Get device
    let deviceId = options.device;
    if (!deviceId) {
      const devices = await adbManager.getDevices();
      const availableDevices = devices.filter(d => d.state === 'device');

      if (availableDevices.length === 0) {
        return { success: false, error: 'No devices available. Please connect a device or start an emulator.' };
      }

      if (availableDevices.length === 1) {
        deviceId = availableDevices[0].id;
        Logger.info(`Using device: ${deviceId}`);
      } else {
        deviceId = await select({
          message: 'Select device:',
          choices: availableDevices.map(device => ({
            name: `${device.id} (${device.model || 'Unknown'})`,
            value: device.id
          }))
        });
      }
    }

    // Detect WebViews
    const webviews = await webviewManager.detectWebViews(deviceId);

    if (webviews.length === 0) {
      Logger.warn('No WebView processes detected.');
      Logger.info('To debug WebViews, ensure:');
      Logger.info('1. Your app has WebView.setWebContentsDebuggingEnabled(true)');
      Logger.info('2. The app is running and has loaded web content');
      Logger.info('3. The app is debuggable or running in debug mode');
      return { success: true };
    }

    Logger.success(`Found ${webviews.length} WebView process(es):`);
    
    // Display detected WebViews
    for (const webview of webviews) {
      const packageInfo = webview.packageName ? ` (${webview.packageName})` : '';
      Logger.info(`  • PID ${webview.pid}${packageInfo}`);
    }

    // Set up debugging if requested or if there are multiple WebViews
    if (options.setup || webviews.length > 1) {
      const selectedWebView = await selectWebViewForDebugging(webviews);
      if (selectedWebView) {
        await setupWebViewDebugging(selectedWebView, webviewManager, deviceId);
      }
    } else if (webviews.length === 1) {
      await setupWebViewDebugging(webviews[0], webviewManager, deviceId);
    }

    // Open Chrome DevTools if requested or by default
    if (options.open !== false) {
      const shouldOpen = options.open || await confirm({
        message: 'Open chrome://inspect in your browser?',
        default: true
      });

      if (shouldOpen) {
        const success = await webviewManager.openChromeInspect();
        if (success) {
          Logger.success('Chrome DevTools opened! Look for your WebView in the "Remote Target" section.');
          Logger.info('💡 Tip: If you don\'t see your WebView, try refreshing the page or restarting your app.');
        } else {
          Logger.error('Failed to open Chrome DevTools. You can manually navigate to chrome://inspect');
        }
      }
    }

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    Logger.error('WebView detection failed:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Allows user to select which WebView to debug when multiple are found
 */
async function selectWebViewForDebugging(webviews: WebViewProcess[]): Promise<WebViewProcess | null> {
  const choices = webviews.map(webview => {
    const packageInfo = webview.packageName ? ` - ${webview.packageName}` : '';
    return {
      name: `PID ${webview.pid}${packageInfo}`,
      value: webview
    };
  });

  choices.push({
    name: 'Set up debugging for all WebViews',
    value: 'all' as any
  });

  const selection = await select({
    message: 'Select WebView to set up debugging for:',
    choices
  });

  if (typeof selection === 'string' && selection === 'all') {
    return null; // Will trigger setup for all WebViews
  }

  return selection as WebViewProcess;
}

/**
 * Sets up port forwarding and debugging for a WebView
 */
async function setupWebViewDebugging(
  webview: WebViewProcess, 
  webviewManager: WebViewManager, 
  deviceId?: string
): Promise<void> {
  Logger.info(`Setting up debugging for WebView PID ${webview.pid}...`);
  
  const port = await webviewManager.setupWebViewDebugging(webview, deviceId);
  
  if (port) {
    Logger.success(`✅ WebView debugging available on http://localhost:${port}`);
    Logger.info(`   You can access DevTools at: http://localhost:${port}/json`);
  } else {
    Logger.warn(`⚠️  Could not set up debugging for WebView PID ${webview.pid}`);
    Logger.info('   This WebView may not have debugging enabled or may not be accessible.');
  }
}

/**
 * Sets up the webview command for Commander.js
 */
export function setupWebViewCommand(program: Command): void {
  program
    .command('webview')
    .description('Detect WebView processes and open Chrome DevTools')
    .option('-d, --device <device_id>', 'Target device ID')
    .option('-p, --project <path>', 'Android project path')
    .option('--no-open', 'Don\'t automatically open chrome://inspect')
    .option('--setup', 'Force setup menu even for single WebView')
    .action(async (options: WebViewCommandOptions) => {
      const result = await executeWebViewCommand(options);
      if (!result.success) {
        process.exit(1);
      }
    });
}