import { describe, test, expect } from "bun:test";
import { defaultConfig, androidCliConfigSchema } from "../src/config/schema";

describe("Configuration Schema", () => {
  describe("Default Configuration", () => {
    test("has correct default logcat template", () => {
      expect(defaultConfig.logcat.template).toBe(
        "adb -s {{device_id}} logcat -v color --pid=$(adb -s {{device_id}} shell pidof -s {{package_name}})"
      );
    });

    test("has expected default values", () => {
      expect(defaultConfig.logcat.clearOnStart).toBe(true);
      expect(defaultConfig.logcat.colorize).toBe(true);
      expect(defaultConfig.defaultVariant).toBe("debug");
      expect(defaultConfig.terminal).toBe("auto");
    });

    test("includes device targeting in template", () => {
      const template = defaultConfig.logcat.template;
      expect(template).toContain("{{device_id}}");
      expect(template).toContain("{{package_name}}");
      expect(template).toContain("-s {{device_id}}");
    });

    test("includes colorization in template", () => {
      const template = defaultConfig.logcat.template;
      expect(template).toContain("-v color");
    });

    test("uses PID-based filtering", () => {
      const template = defaultConfig.logcat.template;
      expect(template).toContain("--pid=$(adb");
      expect(template).toContain("shell pidof -s");
    });
  });

  describe("Schema Validation", () => {
    test("validates correct configuration", () => {
      const validConfig = {
        projectPath: "./app",
        defaultVariant: "debug",
        terminal: "auto",
        gradleTasks: { custom: [] },
        buildCache: { enabled: true, maxSize: "1GB" },
        logcat: { 
          clearOnStart: true, 
          colorize: true,
          template: "adb -s {{device_id}} logcat -v color --pid=$(adb -s {{device_id}} shell pidof -s {{package_name}})"
        },
        adbReverse: { enabled: false, ports: [8081] }
      };

      const { error } = androidCliConfigSchema.validate(validConfig);
      expect(error).toBeUndefined();
    });

    test("accepts custom logcat template", () => {
      const configWithCustomTemplate = {
        projectPath: "./app",
        defaultVariant: "release",
        terminal: "iterm2",
        gradleTasks: { custom: ["customTask"] },
        buildCache: { enabled: false, maxSize: "500MB" },
        logcat: { 
          clearOnStart: false, 
          colorize: false,
          template: "adb logcat -v time {{package_name}}:V"
        },
        adbReverse: { enabled: true, ports: [8081, 3000] }
      };

      const { error } = androidCliConfigSchema.validate(configWithCustomTemplate);
      expect(error).toBeUndefined();
    });

    test("rejects invalid variant", () => {
      const invalidConfig = {
        ...defaultConfig,
        defaultVariant: "invalid"
      };

      const { error } = androidCliConfigSchema.validate(invalidConfig);
      expect(error).toBeDefined();
      expect(error?.message).toContain("must be one of");
    });

    test("requires template to be string", () => {
      const invalidConfig = {
        ...defaultConfig,
        logcat: {
          ...defaultConfig.logcat,
          template: 123 // Invalid: should be string
        }
      };

      const { error } = androidCliConfigSchema.validate(invalidConfig);
      expect(error).toBeDefined();
      expect(error?.message).toContain("must be a string");
    });

    test("validates port numbers in adbReverse", () => {
      const invalidConfig = {
        ...defaultConfig,
        adbReverse: {
          enabled: true,
          ports: [99999] // Invalid: port out of range
        }
      };

      const { error } = androidCliConfigSchema.validate(invalidConfig);
      expect(error).toBeDefined();
    });
  });

  describe("Template Variables", () => {
    test("default template contains expected variables", () => {
      const template = defaultConfig.logcat.template;
      const variables = template.match(/\{\{(\w+)\}\}/g);
      
      expect(variables).toContain("{{device_id}}");
      expect(variables).toContain("{{package_name}}");
    });

    test("template supports command substitution", () => {
      const template = defaultConfig.logcat.template;
      
      expect(template).toContain("$(");
      expect(template).toContain(")");
      expect(template).toContain("shell pidof");
    });

    test("template maintains device consistency", () => {
      const template = defaultConfig.logcat.template;
      
      // Both the main command and the pidof command should target the same device
      const deviceReferences = (template.match(/\{\{device_id\}\}/g) || []).length;
      expect(deviceReferences).toBe(2); // One for -s flag, one for pidof command
    });
  });
});