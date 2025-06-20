/**
 * WebView detection and debugging utilities
 */

import { execa } from 'execa';
import { Logger } from '../ui/logger.js';

export interface WebViewProcess {
  pid: string;
  socketName: string;
  packageName?: string;
  port?: number;
}

export interface BrowserInfo {
  name: string;
  command: string;
  isChromiumBased: boolean;
}

export class WebViewManager {

  /**
   * Detects all active WebView processes on the specified device
   */
  async detectWebViews(deviceId?: string): Promise<WebViewProcess[]> {
    try {
      const adbArgs = deviceId ? ['-s', deviceId] : [];
      
      // Get all WebView debugging sockets
      const { stdout } = await execa('adb', [
        ...adbArgs,
        'shell',
        'cat /proc/net/unix | grep webview_devtools_remote'
      ]);

      if (!stdout.trim()) {
        return [];
      }

      const webviews: WebViewProcess[] = [];
      const lines = stdout.trim().split('\n');

      for (const line of lines) {
        const socketName = line.split(/\s+/).pop();
        if (!socketName || !socketName.includes('webview_devtools_remote_')) {
          continue;
        }

        const cleanSocketName = socketName.replace('@', '');
        const pid = cleanSocketName.replace('webview_devtools_remote_', '');

        // Get package name for this PID
        let packageName: string | undefined;
        try {
          const { stdout: psOutput } = await execa('adb', [
            ...adbArgs,
            'shell',
            `ps | grep ${pid}`
          ]);

          if (psOutput.trim()) {
            // Extract package name from ps output (usually the last column)
            const psFields = psOutput.trim().split(/\s+/);
            packageName = psFields[psFields.length - 1];
          }
        } catch (error) {
          // If we can't get package name, continue anyway
        }

        webviews.push({
          pid,
          socketName: cleanSocketName,
          packageName
        });
      }

      return webviews;
    } catch (error) {
      Logger.error('Failed to detect WebViews:', error instanceof Error ? error.message : String(error));
      return [];
    }
  }

  /**
   * Sets up port forwarding for a WebView and tests if DevTools is accessible
   */
  async setupWebViewDebugging(webview: WebViewProcess, deviceId?: string): Promise<number | null> {
    try {
      const adbArgs = deviceId ? ['-s', deviceId] : [];
      
      // Use a dynamic port based on PID to avoid conflicts
      const port = 9222 + parseInt(webview.pid.slice(-3));
      
      // Set up port forwarding
      await execa('adb', [
        ...adbArgs,
        'forward',
        `tcp:${port}`,
        `localabstract:${webview.socketName}`
      ]);

      // Test if the debugging endpoint is accessible
      try {
        const { stdout } = await execa('curl', [
          '-s',
          '--connect-timeout', '5',
          `http://localhost:${port}/json`
        ]);

        if (stdout.trim()) {
          webview.port = port;
          return port;
        }
      } catch (curlError) {
        // DevTools not accessible
      }

      // Clean up port forwarding if not accessible
      await execa('adb', [...adbArgs, 'forward', '--remove', `tcp:${port}`]).catch(() => {});
      
      return null;
    } catch (error) {
      Logger.error(`Failed to setup debugging for WebView PID ${webview.pid}:`, error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  /**
   * Detects available Chromium-based browsers on the system
   */
  async detectChromiumBrowsers(): Promise<BrowserInfo[]> {
    const browsers: BrowserInfo[] = [];
    
    // Platform-specific browser detection
    const platform = process.platform;
    
    const browserCandidates = platform === 'darwin' ? [
      { name: 'Google Chrome', command: 'open -a "Google Chrome"', isChromiumBased: true },
      { name: 'Microsoft Edge', command: 'open -a "Microsoft Edge"', isChromiumBased: true },
      { name: 'Brave Browser', command: 'open -a "Brave Browser"', isChromiumBased: true },
      { name: 'Chromium', command: 'open -a "Chromium"', isChromiumBased: true },
      { name: 'Arc', command: 'open -a "Arc"', isChromiumBased: true },
      { name: 'Safari', command: 'open -a "Safari"', isChromiumBased: false },
      { name: 'Firefox', command: 'open -a "Firefox"', isChromiumBased: false }
    ] : platform === 'win32' ? [
      { name: 'Google Chrome', command: 'start chrome', isChromiumBased: true },
      { name: 'Microsoft Edge', command: 'start msedge', isChromiumBased: true },
      { name: 'Brave Browser', command: 'start brave', isChromiumBased: true },
      { name: 'Chromium', command: 'start chromium', isChromiumBased: true }
    ] : [
      { name: 'Google Chrome', command: 'google-chrome', isChromiumBased: true },
      { name: 'Chromium', command: 'chromium-browser', isChromiumBased: true },
      { name: 'Microsoft Edge', command: 'microsoft-edge', isChromiumBased: true },
      { name: 'Brave Browser', command: 'brave-browser', isChromiumBased: true }
    ];

    for (const browser of browserCandidates) {
      if (await this.isBrowserAvailable(browser)) {
        browsers.push(browser);
      }
    }

    return browsers;
  }

  /**
   * Checks if a browser is available on the system
   */
  private async isBrowserAvailable(browser: BrowserInfo): Promise<boolean> {
    try {
      if (process.platform === 'darwin') {
        // Check if app exists in Applications
        const appName = browser.command.match(/"([^"]+)"/)?.[1];
        if (appName) {
          await execa('osascript', ['-e', `tell application "System Events" to exists application "${appName}"`]);
          return true;
        }
      } else if (process.platform === 'win32') {
        // Check if command exists in PATH
        const command = browser.command.split(' ')[1];
        await execa('where', [command]);
        return true;
      } else {
        // Check if command exists in PATH
        const command = browser.command.split(' ')[0];
        await execa('which', [command]);
        return true;
      }
    } catch (error) {
      // Browser not available
    }
    
    return false;
  }

  /**
   * Opens chrome://inspect in the best available Chromium browser
   */
  async openChromeInspect(): Promise<boolean> {
    try {
      const browsers = await this.detectChromiumBrowsers();
      const chromiumBrowsers = browsers.filter(b => b.isChromiumBased);
      
      if (chromiumBrowsers.length === 0) {
        Logger.error('No Chromium-based browsers found. Chrome DevTools requires a Chromium-based browser.');
        return false;
      }

      // Try to open chrome://inspect in the first available Chromium browser
      const browser = chromiumBrowsers[0];
      
      if (process.platform === 'darwin') {
        await execa('open', ['-a', browser.name, 'chrome://inspect']);
      } else if (process.platform === 'win32') {
        const command = browser.command.split(' ')[1];
        await execa(command, ['chrome://inspect']);
      } else {
        const command = browser.command.split(' ')[0];
        await execa(command, ['chrome://inspect']);
      }

      Logger.info(`Opened chrome://inspect in ${browser.name}`);
      return true;
    } catch (error) {
      Logger.error('Failed to open chrome://inspect:', error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  /**
   * Gets the default browser and checks if it's Chromium-based
   */
  async getDefaultBrowser(): Promise<BrowserInfo | null> {
    try {
      if (process.platform === 'darwin') {
        // Get default browser on macOS
        const { stdout } = await execa('osascript', [
          '-e', 'tell application "System Events" to get name of default application of (info for (path to desktop) & "test.html")'
        ]);
        
        const browserName = stdout.trim();
        const browsers = await this.detectChromiumBrowsers();
        return browsers.find(b => b.name.includes(browserName)) || null;
      } else if (process.platform === 'win32') {
        // Windows default browser detection is complex, fall back to trying common browsers
        const browsers = await this.detectChromiumBrowsers();
        return browsers[0] || null;
      } else {
        // Linux - check xdg-settings
        const { stdout } = await execa('xdg-settings', ['get', 'default-web-browser']);
        const defaultBrowser = stdout.trim();
        
        // Map desktop file to browser name
        const browserMap: { [key: string]: string } = {
          'google-chrome.desktop': 'Google Chrome',
          'chromium.desktop': 'Chromium',
          'microsoft-edge.desktop': 'Microsoft Edge',
          'brave-browser.desktop': 'Brave Browser'
        };
        
        const browserName = browserMap[defaultBrowser];
        if (browserName) {
          const browsers = await this.detectChromiumBrowsers();
          return browsers.find(b => b.name === browserName) || null;
        }
      }
    } catch (error) {
      // Fall back to first available Chromium browser
    }
    
    const browsers = await this.detectChromiumBrowsers();
    return browsers.find(b => b.isChromiumBased) || null;
  }
}