import { describe, test, expect } from "bun:test";
import { processTemplate, substituteTemplate, parseTemplateCommand } from "../src/utils/template";

describe("Template Processing", () => {
  describe("substituteTemplate", () => {
    test("substitutes basic template variables", () => {
      const template = "adb -s {{device_id}} logcat {{package_name}}";
      const variables = { device_id: "cb5cd325", package_name: "com.remnote.v2" };
      const result = substituteTemplate(template, variables);
      
      expect(result).toBe("adb -s cb5cd325 logcat com.remnote.v2");
    });

    test("handles empty string variables", () => {
      const template = "adb logcat {{package_name}}:V";
      const variables = { device_id: "test", package_name: "" };
      const result = substituteTemplate(template, variables);
      
      expect(result).toBe("adb logcat :V");
    });

    test("throws error for missing variables", () => {
      const template = "adb -s {{device_id}} logcat {{missing_var}}";
      const variables = { device_id: "cb5cd325" };
      
      expect(() => {
        substituteTemplate(template, variables);
      }).toThrow("Template variable 'missing_var' is not defined");
    });

    test("preserves special characters in variables", () => {
      const template = "adb -s {{device_id}} shell \"echo {{message}}\"";
      const variables = { device_id: "test-device_123", message: "hello world" };
      const result = substituteTemplate(template, variables);
      
      expect(result).toBe("adb -s test-device_123 shell \"echo hello world\"");
    });
  });

  describe("parseTemplateCommand", () => {
    test("parses simple command with arguments", () => {
      const template = "adb -s cb5cd325 logcat";
      const result = parseTemplateCommand(template);
      
      expect(result.command).toBe("adb");
      expect(result.args).toEqual(["-s", "cb5cd325", "logcat"]);
    });

    test("preserves shell substitution syntax", () => {
      const template = "adb logcat --pid=$(adb shell pidof -s com.test)";
      const result = parseTemplateCommand(template);
      
      expect(result.command).toBe("adb");
      expect(result.args).toEqual(["logcat", "--pid=$(adb shell pidof -s com.test)"]);
    });

    test("handles quoted strings correctly", () => {
      const template = 'sh -c "adb logcat --pid=$(adb shell pidof -s test)"';
      const result = parseTemplateCommand(template);
      
      expect(result.command).toBe("sh");
      expect(result.args).toEqual(["-c", '"adb logcat --pid=$(adb shell pidof -s test)"']);
    });

    test("handles nested parentheses", () => {
      const template = "bash -c \"echo $(echo $(date))\"";
      const result = parseTemplateCommand(template);
      
      expect(result.command).toBe("bash");
      expect(result.args).toEqual(["-c", '"echo $(echo $(date))"']);
    });

    test("throws error for empty template", () => {
      expect(() => {
        parseTemplateCommand("");
      }).toThrow("Template command cannot be empty");
    });

    test("throws error for whitespace-only template", () => {
      expect(() => {
        parseTemplateCommand("   ");
      }).toThrow("Template command cannot be empty");
    });
  });

  describe("processTemplate", () => {
    test("processes complete logcat template with device targeting", () => {
      const template = "adb -s {{device_id}} logcat -v color --pid=$(adb -s {{device_id}} shell pidof -s {{package_name}})";
      const variables = { device_id: "cb5cd325", package_name: "com.remnote.v2" };
      const result = processTemplate(template, variables);
      
      expect(result.command).toBe("adb");
      expect(result.args[0]).toBe("-s");
      expect(result.args[1]).toBe("cb5cd325");
      expect(result.args[2]).toBe("logcat");
      expect(result.args[3]).toBe("-v");
      expect(result.args[4]).toBe("color");
      
      // Check that the PID argument contains the substituted values
      const pidArg = result.args.find(arg => arg.includes("--pid="));
      expect(pidArg).toBeDefined();
      expect(pidArg).toContain("cb5cd325");
      expect(pidArg).toContain("com.remnote.v2");
    });

    test("handles shell command template", () => {
      const template = 'bash -c "adb -s {{device_id}} logcat --pid=$(adb -s {{device_id}} shell pidof -s {{package_name}})"';
      const variables = { device_id: "test123", package_name: "com.example.app" };
      const result = processTemplate(template, variables);
      
      expect(result.command).toBe("bash");
      expect(result.args[0]).toBe("-c");
      
      const commandArg = result.args[1];
      expect(commandArg).toContain("test123");
      expect(commandArg).toContain("com.example.app");
    });

    test("propagates substitution errors", () => {
      const template = "adb -s {{missing}} logcat";
      const variables = { device_id: "test" };
      
      expect(() => {
        processTemplate(template, variables);
      }).toThrow("Template variable 'missing' is not defined");
    });
  });
});