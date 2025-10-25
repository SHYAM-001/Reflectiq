# Requirements Document

## Introduction

Fix the splash screen asset references in the ReflectIQ Devvit app to ensure splash screen changes are properly reflected on Reddit posts. The current implementation incorrectly references assets with the full path including the assets directory, which prevents the splash screen from displaying correctly according to Devvit's media asset handling.

## Glossary

- **Devvit App**: A Reddit Developer Platform application that creates interactive posts
- **Splash Screen**: The initial loading screen displayed when users first view a Devvit post before the main app loads
- **Media Assets**: Images and other media files used by the Devvit app, configured through the media.dir setting
- **Asset Reference**: The path or filename used to reference media assets in the application code
- **Post Creation System**: The server-side code responsible for creating new Reddit posts with custom splash screens

## Requirements

### Requirement 1

**User Story:** As a Reddit user viewing a ReflectIQ post, I want to see the custom splash screen with proper branding and background images, so that I have a compelling first impression of the puzzle game.

#### Acceptance Criteria

1. WHEN a ReflectIQ post is created, THE Post Creation System SHALL reference splash screen assets using only the filename without directory prefixes
2. WHEN the media directory is configured as "assets" in devvit.json, THE Post Creation System SHALL reference background images as "RQ-background.png" instead of "assets/RQ-background.png"
3. WHEN the media directory is configured as "assets" in devvit.json, THE Post Creation System SHALL reference app icons as "RQ-icon.png" instead of "assets/RQ-icon.png"
4. WHEN a user views a ReflectIQ post on Reddit, THE Splash Screen SHALL displ
