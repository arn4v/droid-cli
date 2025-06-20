import { describe, test, expect, beforeEach } from "bun:test";
import { processTemplate } from "../src/utils/template";
import { defaultConfig } from "../src/config/schema";

describe("Integration Tests", () => {
  describe("Full Logcat Command Flow", () => {
    let originalShell: string | undefined;

    beforeEach(() => {
      originalShell = process.env.SHELL;
    });

    test("simulates complete logcat command processing", () => {
      // Set up test environment
      process.env.SHELL = "/bin/zsh";
      
      // Simulate the actual variables that would be passed
      const templateVariables = {
        device_id: "cb5cd325",
        package_name: "com.remnote.v2"
      };

      // Step 1: Process the default template
      const parsedCommand = processTemplate(defaultConfig.logcat.template, templateVariables);
      let logcatCommand = parsedCommand.command;
      let logcatArgs = parsedCommand.args;

      // Verify initial parsing
      expect(logcatCommand).toBe("adb");
      expect(logcatArgs).toContain("-s");
      expect(logcatArgs).toContain("cb5cd325");

      // Step 2: Apply shell wrapping logic (like in actual logcat.ts)
      const fullCommand = `${logcatCommand} ${logcatArgs.join(' ')}`;
      if (fullCommand.includes('$(') && fullCommand.includes(')')) {
        const userShell = process.env.SHELL ? require('path').basename(process.env.SHELL) : 'bash';
        logcatCommand = userShell;
        logcatArgs = ['-c', fullCommand];
      }

      // Verify final command structure
      expect(logcatCommand).toBe("zsh");
      expect(logcatArgs).toHaveLength(2);
      expect(logcatArgs[0]).toBe("-c");
      expect(logcatArgs[1]).toContain("adb -s cb5cd325 logcat -v color --pid=$(adb -s cb5cd325 shell pidof -s com.remnote.v2)");

      // Restore environment
      process.env.SHELL = originalShell;
    });

    test("handles fallback scenario when package name is unknown", () => {
      const templateVariables = {
        device_id: "test-device",
        package_name: "" // Unknown package
      };

      const parsedCommand = processTemplate(defaultConfig.logcat.template, templateVariables);
      const fullCommand = `${parsedCommand.command} ${parsedCommand.args.join(' ')}`;

      // Even with empty package name, should still contain the structure
      expect(fullCommand).toContain("adb -s test-device logcat");
      expect(fullCommand).toContain("--pid=$(adb -s test-device shell pidof -s )");
    });

    test("simulates user's custom template scenario", () => {
      // User's custom template without device targeting
      const customTemplate = "adb logcat -v time {{package_name}}:V *:S";
      const templateVariables = {
        device_id: "ignored",
        package_name: "com.custom.app"
      };

      const parsedCommand = processTemplate(customTemplate, templateVariables);
      let logcatCommand = parsedCommand.command;
      let logcatArgs = parsedCommand.args;

      // This template doesn't have command substitution, so no shell wrapping
      const fullCommand = `${logcatCommand} ${logcatArgs.join(' ')}`;
      if (fullCommand.includes('$(') && fullCommand.includes(')')) {
        const userShell = process.env.SHELL ? require('path').basename(process.env.SHELL) : 'bash';
        logcatCommand = userShell;
        logcatArgs = ['-c', fullCommand];
      }

      expect(logcatCommand).toBe("adb");
      expect(logcatArgs).toEqual(["logcat", "-v", "time", "com.custom.app:V", "*:S"]);
    });
  });

  describe("Error Handling and Edge Cases", () => {
    test("handles malformed shell environment", () => {
      process.env.SHELL = ""; // Empty shell path
      
      const template = "adb logcat --pid=$(adb shell pidof -s {{package_name}})";
      const variables = { package_name: "com.test" };
      
      const parsedCommand = processTemplate(template, variables);
      let logcatCommand = parsedCommand.command;
      let logcatArgs = parsedCommand.args;
      
      const fullCommand = `${logcatCommand} ${logcatArgs.join(' ')}`;
      if (fullCommand.includes('$(') && fullCommand.includes(')')) {
        const userShell = process.env.SHELL ? require('path').basename(process.env.SHELL) : 'bash';
        logcatCommand = userShell;
        logcatArgs = ['-c', fullCommand];
      }
      
      // Should fall back to bash
      expect(logcatCommand).toBe("bash");
    });

    test("handles very long device IDs", () => {
      const longDeviceId = "very-long-device-id-that-might-cause-issues-1234567890";
      const template = "adb -s {{device_id}} logcat";
      const variables = { device_id: longDeviceId, package_name: "com.test" };
      
      const result = processTemplate(template, variables);
      
      expect(result.command).toBe("adb");
      expect(result.args).toContain(longDeviceId);
    });

    test("handles package names with special characters", () => {
      const specialPackage = "com.company-name.app_debug.test";
      const template = "adb shell pidof -s {{package_name}}";
      const variables = { device_id: "test", package_name: specialPackage };
      
      const result = processTemplate(template, variables);
      const fullCommand = `${result.command} ${result.args.join(' ')}`;
      
      expect(fullCommand).toBe("adb shell pidof -s com.company-name.app_debug.test");
    });

    test("preserves exact template structure with multiple variables", () => {
      const template = "{{device_id}}-{{package_name}}-{{device_id}}";
      const variables = { device_id: "DEV", package_name: "PKG" };
      
      const result = processTemplate(template, variables);
      
      // This creates a single "command" with no args since there are no spaces
      expect(result.command).toBe("DEV-PKG-DEV");
      expect(result.args).toEqual([]);
    });
  });

  describe("Performance and Reliability", () => {
    test("processes template quickly for common case", () => {
      const start = performance.now();
      
      for (let i = 0; i < 1000; i++) {
        processTemplate(defaultConfig.logcat.template, {
          device_id: `device-${i}`,
          package_name: `com.test.app${i}`
        });
      }
      
      const end = performance.now();
      const duration = end - start;
      
      // Should process 1000 templates in under 100ms
      expect(duration).toBeLessThan(100);
    });

    test("handles concurrent template processing", async () => {
      const promises = Array.from({ length: 100 }, (_, i) => 
        Promise.resolve(processTemplate(defaultConfig.logcat.template, {
          device_id: `device-${i}`,
          package_name: `com.test.app${i}`
        }))
      );
      
      const results = await Promise.all(promises);
      
      // All should succeed
      expect(results).toHaveLength(100);
      results.forEach((result, i) => {
        expect(result.command).toBe("adb");
        expect(result.args.join(' ')).toContain(`device-${i}`);
        expect(result.args.join(' ')).toContain(`com.test.app${i}`);
      });
    });

    test("maintains template immutability", () => {
      const originalTemplate = defaultConfig.logcat.template;
      const variables = { device_id: "test", package_name: "com.test" };
      
      // Process template multiple times
      processTemplate(originalTemplate, variables);
      processTemplate(originalTemplate, variables);
      processTemplate(originalTemplate, variables);
      
      // Original template should be unchanged
      expect(defaultConfig.logcat.template).toBe(originalTemplate);
      expect(originalTemplate).toContain("{{device_id}}");
      expect(originalTemplate).toContain("{{package_name}}");
    });
  });
});