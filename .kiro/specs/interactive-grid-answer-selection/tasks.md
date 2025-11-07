# Implementation Plan

- [x] 1. Enhance GridCell component with click interaction

  - Add new props to GridCellProps interface: `isEdgeCell`, `isSelected`, and `onCellClick` callback
  - Implement click handler that invokes `onCellClick` callback with row and col parameters only when `isEdgeCell` is true
  - Add CSS classes for selected state using `cn` utility: ring-2, ring-blue-500, shadow-lg, shadow-blue-500/30, z-10
  - Add CSS classes for edge cell hover state: cursor-pointer, hover:border-primary/50, hover:scale-105
  - Add CSS class for non-edge cells: cursor-default to prevent pointer cursor
  - Ensure existing visual indicators (material, entry, exit, laser path) remain functional
  - _Requirements: 1.1, 1.4, 2.1, 2.4, 4.2, 4.3, 4.4_

- [x] 2. Update PuzzleGrid component with selection state management

  - Add new props to PuzzleGridProps interface: `selectedAnswer` and `onCellClick` callback
  - Create helper function `isEdgeCell(row, col, gridSize)` that returns true if cell is on grid perimeter
  - In grid rendering loop, calculate `isEdgeCell` boolean for each cell position
  - In grid rendering loop, calculate `isSelected` boolean by comparing cell position with `selectedAnswer` prop
  - Pass `isEdgeCell`, `isSelected`, and `onCellClick` props to each GridCell component
  - Maintain existing laser path rendering, hint animation, and material positioning logic
  - _Requirements: 1.1, 2.2, 2.3, 4.1, 4.5_

- [x] 3. Implement AnswerInput synchronization with external state

  - Add `useEffect` hook that watches `selectedAnswer` prop changes
  - In useEffect, update `inputValue` state by calling `formatAnswer(selectedAnswer)` when selectedAnswer is not null
  - In useEffect, clear `inputValue` state (set to empty string) when selectedAnswer is null
  - Ensure existing `handleInputChange` function continues to work for manual typing
  - Ensure existing `handleQuickSelect` function continues to work for button clicks
  - Verify that all three input methods (typing, grid click, button click) trigger the same `onAnswerChange` callback
  - _Requirements: 1.2, 1.3, 3.1, 3.2, 3.3, 3.4, 3.5, 5.1, 5.2, 5.3_

- [x] 4. Wire up state management in PuzzleScreen component

  - Import `useCallback` hook from React
  - Create `handleCellClick` callback function using `useCallback` that accepts row and col parameters
  - In `handleCellClick`, create GridPosition tuple `[row, col]` and call `setSelectedAnswer`
  - Rename existing `onAnswerChange` callback to `handleAnswerChange` for consistency
  - Pass `selectedAnswer` state to PuzzleGrid component as prop
  - Pass `handleCellClick` callback to PuzzleGrid component as `onCellClick` prop
  - Pass `selectedAnswer` state to AnswerInput component (already exists, verify it's passed)
  - Pass `handleAnswerChange` callback to AnswerInput component (already exists as `onAnswerChange`, verify it's passed)
  - _Requirements: 1.1, 1.2, 1.3, 5.3, 6.1, 6.4_

- [x] 5. Add TypeScript type safety and validation

  - Verify all new props have explicit type annotations in component interfaces
  - Add JSDoc comments to new functions explaining parameters and return values
  - Ensure `GridPosition` type is imported from correct location in all modified files
  - Add bounds validation in `handleCellClick` to ensure row and col are within grid size
  - Use existing utility functions (`cn` for className merging, `formatAnswer` for position formatting)
  - _Requirements: 6.2, 6.3, 6.5_

- [ ]\* 6. Write unit tests for component behavior

  - Create test file for GridCell component testing click handlers and visual states
  - Write test: edge cell click invokes onCellClick callback with correct coordinates
  - Write test: non-edge cell click does not invoke onCellClick callback
  - Write test: isSelected prop applies correct CSS classes (ring-2, ring-blue-500)
  - Write test: isEdgeCell prop applies cursor-pointer class
  - Create test file for PuzzleGrid component testing edge cell calculation
  - Write test: isEdgeCell calculation returns true for all perimeter cells on 4x4 grid
  - Write test: isEdgeCell calculation returns true for all perimeter cells on 6x6 grid
  - Write test: isSelected correctly identifies cell matching selectedAnswer prop
  - Create test file for AnswerInput component testing synchronization
  - Write test: useEffect updates inputValue when selectedAnswer prop changes
  - Write test: manual input typing updates selectedAnswer via onAnswerChange callback
  - Write test: quick-select button click updates selectedAnswer via onAnswerChange callback
  - _Requirements: 1.1, 1.4, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 4.1_

- [ ]\* 7. Create integration tests for end-to-end flow
  - Write integration test: click edge cell → verify input box text updates → verify cell shows selected state
  - Write integration test: type valid input in box → verify grid cell shows selected state
  - Write integration test: click quick-select button → verify grid cell shows selected state and input box updates
  - Write integration test: click different edge cell → verify previous cell deselects and new cell selects
  - Write integration test: type invalid input → verify no cell selected and error message displays
  - Test with different grid sizes (4x4, 6x6, 8x8) to ensure edge cell calculation works correctly
  - _Requirements: 1.1, 1.2, 1.3, 1.5, 2.2, 2.3, 3.3, 5.3_
