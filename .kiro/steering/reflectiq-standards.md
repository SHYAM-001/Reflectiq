---
inclusion: always
---

# ReflectIQ Development Standards

## Code Quality Standards

### TypeScript Requirements

- All code must be written in TypeScript with strict mode enabled
- Use explicit type annotations for function parameters and return types
- Avoid `any` type - use proper interfaces and union types
- Enable all strict TypeScript compiler options

### Naming Conventions

- **Files**: Use kebab-case for file names (e.g., `puzzle-generator.ts`)
- **Classes**: Use PascalCase (e.g., `PuzzleGenerator`)
- **Functions/Variables**: Use camelCase (e.g., `generatePuzzle`)
- **Constants**: Use SCREAMING_SNAKE_CASE (e.g., `DIFFICULTY_CONFIGS`)
- **Interfaces**: Use PascalCase with descriptive names (e.g., `PuzzleConfiguration`)

### Error Handling

- Always use try-catch blocks for async operations
- Implement circuit breakers for external service calls
- Log errors with context information
- Provide meaningful error messages to users
- Use proper HTTP status codes for API responses

### Performance Guidelines

- Use Redis for caching with appropriate TTL values
- Implement pagination for large data sets
- Use lazy loading for heavy computations
- Optimize database queries and avoid N+1 problems
- Monitor memory usage in puzzle generation

## Devvit Best Practices

### Reddit API Usage

- Always check permissions before making API calls
- Use rate limiting to avoid API throttling
- Handle Reddit API errors gracefully
- Cache Reddit data when appropriate
- Follow Reddit's content policy and guidelines

### Redis Usage

- Use consistent key naming patterns: `reflectiq:{type}:{identifier}`
- Set appropriate expiration times for all keys
- Use atomic operations for critical data updates
- Implement proper error handling for Redis failures
- Monitor Redis memory usage and implement cleanup

### Security Practices

- Validate all user inputs
- Use private messages for sensitive feedback
- Implement proper authentication checks
- Sanitize data before storage
- Follow principle of least privilege for permissions

## Testing Requirements

### Unit Tests

- Write tests for all puzzle generation logic
- Test error conditions and edge cases
- Maintain minimum 80% code coverage
- Use descriptive test names and organize in suites
- Mock external dependencies properly

### Integration Tests

- Test Redis integration and data persistence
- Verify Reddit API integration
- Test scheduled job execution
- Validate end-to-end puzzle solving flow
- Test error recovery mechanisms

## Documentation Standards

### Code Documentation

- Document all public methods with JSDoc comments
- Include parameter types and return value descriptions
- Provide usage examples for complex functions
- Document any non-obvious business logic
- Keep documentation up-to-date with code changes

### API Documentation

- Document all endpoints with request/response examples
- Include error response formats
- Specify required permissions for each endpoint
- Document rate limiting and usage constraints
- Provide integration examples
