# Devvit Sync Hook

## Description

Syncs configuration changes with Devvit platform when devvit.json is modified.

## Trigger

File save events for Devvit configuration files

## Actions

1. Validate devvit.json schema
2. Check permissions and endpoints
3. Upload configuration if valid
4. Test endpoints

## Configuration

```json
{
  "name": "devvit-sync",
  "trigger": "file-save",
  "filePattern": "devvit.json",
  "actions": [
    {
      "type": "command",
      "command": "devvit validate",
      "description": "Validating Devvit configuration..."
    },
    {
      "type": "conditional",
      "condition": "previous-success",
      "action": {
        "type": "command",
        "command": "npm run build && devvit upload",
        "description": "Syncing with Devvit platform..."
      }
    },
    {
      "type": "command",
      "command": "curl -f http://localhost:3000/api/health",
      "description": "Testing server endpoints...",
      "continueOnError": true
    }
  ],
  "showOutput": true,
  "notifications": {
    "success": "🔄 Devvit configuration synced!",
    "error": "⚠️ Devvit sync failed - check configuration"
  }
}
```

## Benefits

- Automatic configuration validation
- Immediate feedback on Devvit changes
- Prevents invalid configurations
- Streamlines deployment process
