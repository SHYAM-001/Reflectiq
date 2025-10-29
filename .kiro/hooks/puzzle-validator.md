# Puzzle Validator Hook

## Description

Validates puzzle generation logic and tests puzzle solvability when puzzle files are modified.

## Trigger

File save events for puzzle generation files

## Actions

1. Run puzzle generation tests
2. Validate puzzle physics
3. Test all difficulty levels
4. Check distance constraints

## Configuration

```json
{
  "name": "puzzle-validator",
  "trigger": "file-save",
  "filePattern": "src/shared/puzzle/**/*.ts",
  "actions": [
    {
      "type": "command",
      "command": "npm test -- --testPathPattern=puzzle",
      "description": "Running puzzle validation tests..."
    },
    {
      "type": "custom",
      "script": "scripts/validate-puzzles.js",
      "description": "Validating puzzle generation logic..."
    },
    {
      "type": "command",
      "command": "npm run type-check -- src/shared/puzzle",
      "description": "Type checking puzzle modules..."
    }
  ],
  "showOutput": true,
  "notifications": {
    "success": "✅ Puzzle validation passed!",
    "error": "🧩 Puzzle validation failed - check logic"
  }
}
```

## Benefits

- Ensures puzzle generation quality
- Catches physics simulation errors early
- Validates difficulty progression
- Maintains game balance
