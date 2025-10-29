---
inclusion: fileMatch
fileMatchPattern: '**/server/**/*.ts'
---

# Devvit Integration Guidelines

## Reddit API Best Practices

### Post Creation

- Use descriptive titles with emojis for visual appeal
- Include difficulty indicators (🟢 Easy, 🟡 Medium, 🔴 Hard)
- Format post content with proper markdown
- Add interactive elements for user engagement
- Set appropriate post flairs when available

### Comment Processing

- Parse answer formats: "Exit: A1" or "Exit: [x,y]"
- Send private messages for answer feedback
- Avoid public comment replies to maintain privacy
- Handle malformed input gracefully
- Log all answer attempts for analytics

### Private Messaging

- Use encouraging language for correct answers
- Provide helpful hints for incorrect answers
- Include score information and difficulty level
- Add links to leaderboards and next puzzles
- Maintain consistent message formatting

## Scheduling and Automation

### Cron Job Configuration

```
Daily Puzzle Generation: 0 0 * * *    (Midnight)
Daily Puzzle Posts:      5 0 * * *    (12:05 AM)
Daily Leaderboards:      0 1 * * *    (1:00 AM)
Weekly Maintenance:      0 2 * * 0    (Sunday 2:00 AM)
```

### Error Recovery

- Implement retry logic for failed operations
- Use exponential backoff for API rate limits
- Log all scheduled job executions
- Send alerts for critical failures
- Maintain fallback puzzle generation

## Data Management

### Redis Key Patterns

```
Puzzles:        reflectiq:puzzles:{date}
Leaderboards:   reflectiq:leaderboard:{type}:{date}
Sessions:       reflectiq:session:{userId}:{puzzleId}
Submissions:    reflectiq:submissions:{puzzleId}
Archives:       reflectiq:archive:{date}
```

### Data Retention

- Puzzle data: 7 days active, 90 days archived
- Leaderboard data: 30 days active, 1 year archived
- Session data: 24 hours active
- Submission data: 7 days active
- Archive data: 90 days retention

## Security and Privacy

### User Data Protection

- Never store personal information beyond usernames
- Use private messages for all answer feedback
- Implement proper input validation
- Sanitize all user-generated content
- Follow Reddit's privacy guidelines

### Permission Management

- Use minimal required permissions
- Validate permissions before API calls
- Handle permission errors gracefully
- Log permission-related issues
- Regular permission audits

## Performance Monitoring

### Key Metrics

- Puzzle generation success rate
- Average response times
- Redis hit/miss ratios
- API call success rates
- User engagement metrics

### Alerting Thresholds

- Puzzle generation failures > 10%
- API response time > 5 seconds
- Redis connection failures > 5%
- Scheduled job failures > 1 per day
- Memory usage > 80%

## Development Workflow

### Local Testing

- Use playtest subreddit for development
- Test all scheduled jobs manually
- Verify private message functionality
- Test error conditions and edge cases
- Performance test with realistic data

### Deployment Process

1. Run full test suite
2. Build client and server
3. Upload to Devvit platform
4. Verify deployment in playtest environment
5. Monitor logs for errors
6. Update production if tests pass
