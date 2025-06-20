import { describe, test, expect, mock, beforeEach } from "bun:test";
import { processTemplate } from "../src/utils/template";

describe("Logcat Command Processing", () => {
  describe("Shell Detection and Command Wrapping", () => {
    let originalShell: string | undefined;

    beforeEach(() => {
      originalShell = process.env.SHELL;
    });

    test("detects command substitution and wraps with user shell", () => {
      process.env.SHELL = "/bin/zsh";
      
      const template = "adb -s {{device_id}} logcat --pid=$(adb -s {{device_id}} shell pidof -s {{package_name}})";
      const variables = { device_id: "cb5cd325", package_name: "com.remnote.v2" };
      
      // Process template first
      const parsedCommand = processTemplate(template, variables);
      let logcatCommand = parsedCommand.command;
      let logcatArgs = parsedCommand.args;
      
      // Apply shell wrapping logic (like in the actual code)
      const fullCommand = `${logcatCommand} ${logcatArgs.join(' ')}`;
      if (fullCommand.includes('$(') && fullCommand.includes(')')) {
        const userShell = process.env.SHELL ? require('path').basename(process.env.SHELL) : 'bash';
        logcatCommand = userShell;
        logcatArgs = ['-c', fullCommand];
      }
      
      expect(logcatCommand).toBe("zsh");
      expect(logcatArgs[0]).toBe("-c");
      expect(logcatArgs[1]).toContain("adb -s cb5cd325 logcat");
      expect(logcatArgs[1]).toContain("--pid=$(adb -s cb5cd325 shell pidof -s com.remnote.v2)");
      
      // Restore original SHELL
      process.env.SHELL = originalShell;
    });

    test("falls back to bash when SHELL is not set", () => {
      delete process.env.SHELL;
      
      const template = "adb logcat --pid=$(adb shell pidof -s {{package_name}})";
      const variables = { package_name: "com.test.app" };
      
      const parsedCommand = processTemplate(template, variables);
      let logcatCommand = parsedCommand.command;
      let logcatArgs = parsedCommand.args;
      
      const fullCommand = `${logcatCommand} ${logcatArgs.join(' ')}`;
      if (fullCommand.includes('$(') && fullCommand.includes(')')) {
        const userShell = process.env.SHELL ? require('path').basename(process.env.SHELL) : 'bash';
        logcatCommand = userShell;
        logcatArgs = ['-c', fullCommand];
      }
      
      expect(logcatCommand).toBe("bash");
      expect(logcatArgs[0]).toBe("-c");
      
      // Restore original SHELL
      process.env.SHELL = originalShell;
    });

    test("does not wrap commands without shell substitution", () => {
      const template = "adb -s {{device_id}} logcat -v color";
      const variables = { device_id: "test123" };
      
      const parsedCommand = processTemplate(template, variables);
      let logcatCommand = parsedCommand.command;
      let logcatArgs = parsedCommand.args;
      
      const fullCommand = `${logcatCommand} ${logcatArgs.join(' ')}`;
      if (fullCommand.includes('$(') && fullCommand.includes(')')) {
        const userShell = process.env.SHELL ? require('path').basename(process.env.SHELL) : 'bash';
        logcatCommand = userShell;
        logcatArgs = ['-c', fullCommand];
      }
      
      // Should not be wrapped since no command substitution
      expect(logcatCommand).toBe("adb");
      expect(logcatArgs).toEqual(["-s", "test123", "logcat", "-v", "color"]);
    });

    test("handles different shell paths correctly", () => {
      const testCases = [
        { shell: "/usr/local/bin/fish", expected: "fish" },
        { shell: "/bin/bash", expected: "bash" },
        { shell: "/usr/bin/zsh", expected: "zsh" },
        { shell: "/opt/homebrew/bin/fish", expected: "fish" }
      ];

      for (const { shell, expected } of testCases) {
        process.env.SHELL = shell;
        
        const template = "adb logcat --pid=$(adb shell pidof -s test)";
        const parsedCommand = processTemplate(template, {});
        let logcatCommand = parsedCommand.command;
        let logcatArgs = parsedCommand.args;
        
        const fullCommand = `${logcatCommand} ${logcatArgs.join(' ')}`;
        if (fullCommand.includes('$(') && fullCommand.includes(')')) {
          const userShell = process.env.SHELL ? require('path').basename(process.env.SHELL) : 'bash';
          logcatCommand = userShell;
          logcatArgs = ['-c', fullCommand];
        }
        
        expect(logcatCommand).toBe(expected);
      }
      
      // Restore original SHELL
      process.env.SHELL = originalShell;
    });
  });

  describe("Template Variable Edge Cases", () => {
    test("handles complex package names", () => {
      const template = "adb shell pidof -s {{package_name}}";
      const variables = { 
        package_name: "com.company.app.debug",
        device_id: "emulator-5554" 
      };
      
      const result = processTemplate(template, variables);
      const fullCommand = `${result.command} ${result.args.join(' ')}`;
      
      expect(fullCommand).toBe("adb shell pidof -s com.company.app.debug");
    });

    test("handles device IDs with special characters", () => {
      const template = "adb -s {{device_id}} logcat";
      const variables = { 
        device_id: "HT7A1B123456",
        package_name: "com.test" 
      };
      
      const result = processTemplate(template, variables);
      
      expect(result.command).toBe("adb");
      expect(result.args).toEqual(["-s", "HT7A1B123456", "logcat"]);
    });

    test("preserves command structure with empty package name", () => {
      const template = "adb logcat {{package_name}}:V *:S";
      const variables = { 
        device_id: "test",
        package_name: "" 
      };
      
      const result = processTemplate(template, variables);
      const fullCommand = `${result.command} ${result.args.join(' ')}`;
      
      expect(fullCommand).toBe("adb logcat :V *:S");
    });
  });

  describe("Default Configuration Template", () => {
    test("processes default template correctly", () => {
      const defaultTemplate = "adb -s {{device_id}} logcat -v color --pid=$(adb -s {{device_id}} shell pidof -s {{package_name}})";
      const variables = {
        device_id: "cb5cd325",
        package_name: "com.remnote.v2"
      };
      
      const result = processTemplate(defaultTemplate, variables);
      
      expect(result.command).toBe("adb");
      expect(result.args).toContain("-s");
      expect(result.args).toContain("cb5cd325");
      expect(result.args).toContain("logcat");
      expect(result.args).toContain("-v");
      expect(result.args).toContain("color");
      
      // Verify the PID argument is properly formed
      const pidArg = result.args.find(arg => arg.startsWith("--pid="));
      expect(pidArg).toBeDefined();
      expect(pidArg).toContain("$(adb -s cb5cd325 shell pidof -s com.remnote.v2)");
    });

    test("default template requires shell wrapping", () => {
      const defaultTemplate = "adb -s {{device_id}} logcat -v color --pid=$(adb -s {{device_id}} shell pidof -s {{package_name}})";
      const variables = {
        device_id: "test",
        package_name: "com.test"
      };
      
      const result = processTemplate(defaultTemplate, variables);
      const fullCommand = `${result.command} ${result.args.join(' ')}`;
      
      // Should contain command substitution
      expect(fullCommand.includes('$(') && fullCommand.includes(')')).toBe(true);
    });
  });
});