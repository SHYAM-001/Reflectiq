# Build and Deploy Hook

## Description

Automatically builds and deploys ReflectIQ when puzzle generation logic changes.

## Trigger

File save events for puzzle-related files

## Actions

1. Build client and server
2. Run puzzle generation tests
3. Deploy to Devvit if tests pass
4. Show deployment status

## Configuration

```json
{
  "name": "build-and-deploy",
  "trigger": "file-save",
  "filePattern": "src/shared/puzzle/**/*.ts",
  "actions": [
    {
      "type": "command",
      "command": "npm run build",
      "description": "Building ReflectIQ..."
    },
    {
      "type": "command",
      "command": "npm test -- src/shared/puzzle",
      "description": "Testing puzzle generation..."
    },
    {
      "type": "conditional",
      "condition": "previous-success",
      "action": {
        "type": "command",
        "command": "devvit upload",
        "description": "Deploying to Devvit..."
      }
    }
  ],
  "showOutput": true,
  "notifications": {
    "success": "🚀 ReflectIQ deployed successfully!",
    "error": "❌ Deployment failed - check output for details"
  }
}
```

## Benefits

- Automated deployment pipeline
- Ensures puzzle logic is tested before deployment
- Immediate feedback on critical changes
- Reduces manual deployment steps
