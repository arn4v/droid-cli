/**
 * Template substitution utilities for command templates
 */

export interface TemplateVariables {
  device_id: string;
  package_name: string;
  [key: string]: string | number | boolean;
}

/**
 * Substitutes template variables in a command template string
 * @param template Template string with {{variable}} placeholders
 * @param variables Object containing variable values
 * @returns Processed template string with variables substituted
 */
export function substituteTemplate(template: string, variables: TemplateVariables): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, variableName) => {
    const value = variables[variableName];
    if (value === undefined) {
      throw new Error(`Template variable '${variableName}' is not defined`);
    }
    return String(value);
  });
}

/**
 * Parses a template string into command and arguments
 * @param template Template string with variables substituted
 * @returns Object with command and args array
 */
export function parseTemplateCommand(template: string): { command: string; args: string[] } {
  const parts = template.trim().split(/\s+/);
  if (parts.length === 0) {
    throw new Error('Template command cannot be empty');
  }
  
  return {
    command: parts[0],
    args: parts.slice(1)
  };
}

/**
 * Convenience function to substitute template and parse command in one step
 * @param template Template string with {{variable}} placeholders
 * @param variables Object containing variable values
 * @returns Object with command and args array
 */
export function processTemplate(template: string, variables: TemplateVariables): { command: string; args: string[] } {
  const substituted = substituteTemplate(template, variables);
  return parseTemplateCommand(substituted);
}