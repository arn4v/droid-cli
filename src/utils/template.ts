/**
 * Template substitution utilities for command templates
 */

export interface TemplateVariables {
  device_id?: string;
  package_name?: string;
  [key: string]: string | number | boolean | undefined;
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
 * Parses a template string into command and arguments, respecting shell syntax
 * @param template Template string with variables substituted
 * @returns Object with command and args array
 */
export function parseTemplateCommand(template: string): { command: string; args: string[] } {
  const trimmed = template.trim();
  if (trimmed.length === 0) {
    throw new Error('Template command cannot be empty');
  }
  
  const args: string[] = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = '';
  let parenDepth = 0;
  
  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i];
    
    if (!inQuotes && (char === '"' || char === "'")) {
      inQuotes = true;
      quoteChar = char;
      current += char;
    } else if (inQuotes && char === quoteChar) {
      inQuotes = false;
      quoteChar = '';
      current += char;
    } else if (!inQuotes && char === '(') {
      parenDepth++;
      current += char;
    } else if (!inQuotes && char === ')') {
      parenDepth--;
      current += char;
    } else if (!inQuotes && parenDepth === 0 && /\s/.test(char)) {
      if (current.length > 0) {
        args.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }
  
  // Add the last argument if any
  if (current.length > 0) {
    args.push(current);
  }
  
  if (args.length === 0) {
    throw new Error('Template command cannot be empty');
  }
  
  return {
    command: args[0],
    args: args.slice(1)
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