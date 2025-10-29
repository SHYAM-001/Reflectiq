---
inclusion: fileMatch
fileMatchPattern: '**/puzzle/**/*.ts'
---

# Puzzle Design Guidelines

## Puzzle Generation Principles

### Difficulty Progression

- **Easy (6x6)**: Simple mirrors and absorbers only
- **Medium (8x8)**: Add water and glass for complexity
- **Hard (10x10)**: Include all materials with metal reversals

### Distance Requirements

- **Easy**: Minimum 4 boxes between entry and exit
- **Medium**: Minimum 5 boxes between entry and exit
- **Hard**: Minimum 8 boxes between entry and exit
- Always validate that entry ≠ exit point

### Material Density Guidelines

- **Easy**: 70% material coverage for manageable complexity
- **Medium**: 80% material coverage for moderate challenge
- **Hard**: 85% material coverage for maximum difficulty

## Physics Simulation Standards

### Material Behavior

- **Mirrors**: 100% reflection with configurable angles (15° increments)
- **Water**: 80% reflection with 30% diffusion chance
- **Glass**: 50% reflection, 50% pass-through probability
- **Metal**: 100% reflection with complete direction reversal
- **Absorbers**: Complete beam termination

### Path Validation

- Ensure exactly one valid solution exists
- Validate path reaches grid boundary
- Check for infinite loops (max 50 bounces)
- Verify minimum intensity thresholds

## Hint System Design

### Progressive Revelation

- **Hint 1**: Reveal 25% of solution path
- **Hint 2**: Reveal 50% of solution path
- **Hint 3**: Reveal 75% of solution path
- **Hint 4**: Reveal complete solution path

### Scoring Impact

- No hints: 100% score multiplier
- 1 hint: 80% score multiplier
- 2 hints: 60% score multiplier
- 3 hints: 40% score multiplier
- 4 hints: 20% score multiplier

## Performance Optimization

### Generation Efficiency

- Limit puzzle generation attempts to 100 per difficulty
- Use efficient collision detection for material placement
- Cache frequently used calculations
- Implement early termination for invalid puzzles

### Memory Management

- Clean up temporary objects during generation
- Use object pooling for frequently created instances
- Implement proper garbage collection triggers
- Monitor memory usage during batch generation

## Quality Assurance

### Validation Checklist

- [ ] Puzzle has exactly one solution
- [ ] Entry and exit points are on grid boundary
- [ ] Distance requirements are met
- [ ] Material density is within acceptable range
- [ ] Solution path is physically possible
- [ ] Hint system reveals path correctly

### Testing Requirements

- Test each difficulty level independently
- Verify edge cases (corners, boundaries)
- Test with different material combinations
- Validate hint progression accuracy
- Performance test with batch generation
