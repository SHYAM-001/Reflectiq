---
inclusion: fileMatch
fileMatchPattern: '**/client/**/*.{ts,tsx}'
---

# UI/UX Standards for ReflectIQ

## Design Principles

### Visual Hierarchy

- Use clear typography with appropriate font sizes
- Implement consistent spacing using Tailwind's spacing scale
- Apply proper contrast ratios for accessibility (WCAG AA)
- Use color coding for difficulty levels consistently
- Maintain visual balance in grid layouts

### Interactive Elements

- Provide immediate visual feedback for user actions
- Use hover states and transitions for better UX
- Implement loading states for async operations
- Show clear success/error states
- Use intuitive icons and symbols

## Component Standards

### Grid Components

- Ensure grid cells are properly sized and aligned
- Use consistent border styles and colors
- Implement responsive design for mobile devices
- Show clear visual distinction between materials
- Provide visual feedback for laser path tracing

### Material Visualization

- **Mirrors**: Reflective silver with angle indicators
- **Water**: Blue with wave patterns or transparency
- **Glass**: Clear with subtle borders and shine effects
- **Metal**: Dark metallic with strong borders
- **Absorbers**: Black or dark red with absorption indicators

### Laser Path Display

- Use bright, contrasting colors for laser beams
- Animate laser movement for better understanding
- Show reflection points clearly
- Indicate direction with arrows or gradients
- Highlight entry and exit points distinctly

## Accessibility Requirements

### Keyboard Navigation

- All interactive elements must be keyboard accessible
- Implement proper tab order and focus indicators
- Provide keyboard shortcuts for common actions
- Support screen reader navigation
- Include skip links for complex layouts

### Visual Accessibility

- Maintain minimum 4.5:1 contrast ratio for text
- Use patterns or shapes in addition to color coding
- Provide alternative text for all images
- Support high contrast mode
- Ensure minimum touch target sizes (44px)

### Cognitive Accessibility

- Use clear, simple language in instructions
- Provide consistent navigation patterns
- Implement progressive disclosure for complex features
- Offer multiple ways to complete tasks
- Include helpful error messages and recovery options

## Performance Standards

### Loading Performance

- Implement lazy loading for heavy components
- Use React.memo for expensive re-renders
- Optimize bundle size with code splitting
- Minimize initial page load time
- Show loading indicators for operations > 200ms

### Runtime Performance

- Avoid unnecessary re-renders in grid components
- Use efficient algorithms for path calculations
- Implement proper cleanup in useEffect hooks
- Monitor memory usage in complex animations
- Optimize event handlers and listeners

## Mobile Responsiveness

### Breakpoint Strategy

- Mobile: 320px - 768px
- Tablet: 768px - 1024px
- Desktop: 1024px+
- Use Tailwind's responsive prefixes consistently

### Touch Interactions

- Implement touch-friendly grid interactions
- Support pinch-to-zoom for detailed viewing
- Use appropriate touch targets (minimum 44px)
- Handle touch gestures for laser tracing
- Provide haptic feedback where appropriate

## State Management

### Component State

- Use useState for local component state
- Implement useReducer for complex state logic
- Use React Query for server state management
- Maintain immutable state updates
- Implement proper error boundaries

### Global State

- Use Context API for theme and user preferences
- Implement proper state persistence
- Handle offline scenarios gracefully
- Maintain state consistency across components
- Use proper loading and error states

## Testing Standards

### Component Testing

- Test all user interactions and edge cases
- Verify accessibility features work correctly
- Test responsive behavior at different breakpoints
- Validate error states and recovery flows
- Test keyboard navigation thoroughly

### Visual Testing

- Implement visual regression testing
- Test color contrast and accessibility
- Verify consistent styling across browsers
- Test print styles if applicable
- Validate dark/light theme consistency
