# Test on Save Hook

## Description

Automatically runs tests when TypeScript files are saved to catch issues early.

## Trigger

File save events for `.ts` and `.tsx` files

## Actions

1. Run type checking with `tsc --noEmit`
2. Run linting with `eslint`
3. Run unit tests for changed files
4. Display results in Kiro output panel

## Configuration

```json
{
  "name": "test-on-save",
  "trigger": "file-save",
  "filePattern": "**/*.{ts,tsx}",
  "actions": [
    {
      "type": "command",
      "command": "npm run type-check"
    },
    {
      "type": "command",
      "command": "npm run lint"
    },
    {
      "type": "command",
      "command": "npm test -- --related --passWithNoTests"
    }
  ],
  "showOutput": true,
  "continueOnError": true
}
```

## Benefits

- Immediate feedback on code changes
- Prevents broken code from being committed
- Maintains code quality standards
- Reduces debugging time
