# Kiro Configuration for ReflectIQ

This directory contains Kiro IDE configuration files that enhance the development experience for the ReflectIQ project.

## 🎣 Hooks

Automated workflows that trigger on specific events to maintain code quality and streamline development.

### Active Hooks

#### `format-on-save`

- **Trigger**: File save events for code files
- **Actions**: Prettier formatting + ESLint auto-fix
- **Benefits**: Consistent code style, reduced review friction

#### `test-on-save`

- **Trigger**: TypeScript file saves
- **Actions**: Type checking + linting
- **Benefits**: Immediate feedback, early error detection

#### `puzzle-validator`

- **Trigger**: Puzzle module file saves
- **Actions**: Puzzle-specific validation and testing
- **Benefits**: Ensures puzzle generation quality

#### `devvit-sync`

- **Trigger**: devvit.json changes
- **Actions**: Build + upload to Devvit platform
- **Benefits**: Automatic configuration sync

#### `build-and-deploy` (Manual)

- **Trigger**: Manual execution
- **Actions**: Full build, test, and deploy pipeline
- **Benefits**: One-click deployment process

### Hook Management

To enable/disable hooks, edit `.kiro/hooks/config.json`:

```json
{
  "name": "hook-name",
  "enabled": true/false
}
```

## 🎯 Steering

Context-aware guidelines that provide relevant standards and best practices based on the files you're working on.

### Steering Files

#### `reflectiq-standards.md` (Always Active)

- Core development standards
- TypeScript requirements
- Error handling patterns
- Testing requirements

#### `puzzle-design-guidelines.md` (Puzzle Files)

- Puzzle generation principles
- Physics simulation standards
- Difficulty progression rules
- Performance optimization

#### `devvit-integration.md` (Server Files)

- Reddit API best practices
- Scheduling and automation
- Data management patterns
- Security guidelines

#### `ui-ux-standards.md` (Client Files)

- Design principles
- Component standards
- Accessibility requirements
- Performance standards

### Steering Configuration

Steering files are automatically included based on file patterns. To modify inclusion rules, edit `.kiro/steering/config.json`.

## 📁 Directory Structure

```
.kiro/
├── hooks/
│   ├── config.json              # Hook configuration
│   ├── test-on-save.md         # Test automation hook
│   ├── format-on-save.md       # Code formatting hook
│   ├── puzzle-validator.md     # Puzzle validation hook
│   ├── devvit-sync.md          # Devvit synchronization hook
│   └── build-and-deploy.md     # Deployment automation hook
├── steering/
│   ├── config.json              # Steering configuration
│   ├── reflectiq-standards.md  # Core development standards
│   ├── puzzle-design-guidelines.md  # Puzzle-specific guidelines
│   ├── devvit-integration.md   # Devvit platform standards
│   └── ui-ux-standards.md      # Frontend development standards
└── README.md                   # This file
```

## 🚀 Benefits

### Development Velocity

- Automated formatting and linting
- Immediate feedback on code changes
- One-click deployment process
- Context-aware guidance

### Code Quality

- Consistent coding standards
- Automated testing on save
- Puzzle-specific validation
- Accessibility compliance

### Team Collaboration

- Shared development standards
- Consistent code formatting
- Clear guidelines for different modules
- Automated quality checks

## 🔧 Customization

### Adding New Hooks

1. Create a new `.md` file in `.kiro/hooks/`
2. Add configuration to `.kiro/hooks/config.json`
3. Define trigger conditions and actions
4. Test the hook with sample files

### Adding New Steering

1. Create a new `.md` file in `.kiro/steering/`
2. Add configuration to `.kiro/steering/config.json`
3. Define inclusion rules and file patterns
4. Set appropriate priority levels

### Modifying Existing Configuration

- Edit the respective `.json` config files
- Restart Kiro IDE to apply changes
- Test configuration with relevant files

## 📝 Notes

- Hooks run automatically based on file events
- Steering content is injected contextually
- All configurations support hot reloading
- Logs are available in Kiro's output panel
- Disable hooks temporarily by setting `enabled: false`

This configuration enhances the ReflectIQ development experience by providing automated quality checks, consistent formatting, and context-aware guidance throughout the development process.
