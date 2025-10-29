# Format on Save Hook

## Description

Automatically formats code using Prettier when files are saved.

## Trigger

File save events for code files

## Actions

1. Run Prettier formatting
2. Fix ESLint auto-fixable issues
3. Organize imports
4. Update file

## Configuration

```json
{
  "name": "format-on-save",
  "trigger": "file-save",
  "filePattern": "**/*.{ts,tsx,js,jsx,json,md}",
  "actions": [
    {
      "type": "command",
      "command": "prettier --write ${filePath}",
      "description": "Formatting with Prettier..."
    },
    {
      "type": "command",
      "command": "eslint --fix ${filePath}",
      "description": "Fixing ESLint issues...",
      "continueOnError": true
    }
  ],
  "silent": true,
  "runInBackground": true
}
```

## Benefits

- Consistent code formatting across the project
- Automatic code style compliance
- Reduces code review friction
- Maintains professional code appearance
