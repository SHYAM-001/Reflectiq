# Requirements Document

## Introduction

This feature enhances the ReflectIQ puzzle-solving user experience by enabling bidirectional interaction between the puzzle grid and the answer input mechanism. Users will be able to select their answer by clicking directly on grid cells in addition to typing in the input box. The system will maintain synchronization between grid cell selection and input box state, providing a more intuitive and flexible answer submission workflow within the Devvit framework.

## Glossary

- **PuzzleGrid**: The visual grid component that displays the laser puzzle cells, materials, entry point, and exit point
- **GridCell**: An individual cell within the PuzzleGrid that represents a position in the puzzle
- **AnswerInput**: The component that manages answer selection through text input and quick-select buttons
- **SelectedAnswer**: The current GridPosition that the user has chosen as their answer
- **EdgeCell**: A cell located on the perimeter of the grid (valid exit points for the laser)
- **GridPosition**: A tuple [row, col] representing a cell's coordinates in the grid
- **AnswerState**: The synchronized state between grid selection and input display

## Requirements

### Requirement 1

**User Story:** As a puzzle solver, I want to click on grid cells to select my answer, so that I can interact with the puzzle more intuitively

#### Acceptance Criteria

1. WHEN the user clicks on an EdgeCell in the PuzzleGrid, THE PuzzleGrid SHALL invoke a callback function with the GridPosition of the clicked cell
2. WHEN the user clicks on an EdgeCell in the PuzzleGrid, THE AnswerInput SHALL update the input box text to display the formatted GridPosition
3. WHEN the user clicks on an EdgeCell in the PuzzleGrid, THE AnswerInput SHALL update the SelectedAnswer state to match the clicked GridPosition
4. WHEN the user clicks on a non-edge cell in the PuzzleGrid, THE PuzzleGrid SHALL provide visual feedback indicating the cell is not selectable
5. WHERE the user has already selected an answer, WHEN the user clicks on a different EdgeCell, THE system SHALL update the SelectedAnswer to the new GridPosition

### Requirement 2

**User Story:** As a puzzle solver, I want visual feedback on the grid when I select a cell, so that I can clearly see which answer I have chosen

#### Acceptance Criteria

1. WHEN a GridCell is selected as the SelectedAnswer, THE GridCell SHALL display a distinct visual indicator (ring, highlight, or border)
2. WHEN the SelectedAnswer changes to a different GridPosition, THE previously selected GridCell SHALL remove its selection indicator
3. WHEN the SelectedAnswer changes to a different GridPosition, THE newly selected GridCell SHALL display the selection indicator
4. WHILE hovering over an EdgeCell, THE GridCell SHALL display a hover state indicating it is clickable
5. WHILE hovering over a non-edge cell, THE GridCell SHALL NOT display a clickable hover state

### Requirement 3

**User Story:** As a puzzle solver, I want the input box to automatically update when I click on grid cells, so that I can see my selection reflected in both places

#### Acceptance Criteria

1. WHEN the user clicks on an EdgeCell with GridPosition [row, col], THE AnswerInput input box SHALL display the formatted text in the pattern "{Letter}{Number}" (e.g., "A1", "B5")
2. WHEN the SelectedAnswer is updated through grid cell click, THE AnswerInput SHALL display the success message "✓ Selected: {formatted position}"
3. WHEN the user manually types in the input box after selecting via grid click, THE system SHALL update the SelectedAnswer to match the typed input if valid
4. WHEN the user manually types an invalid format in the input box, THE AnswerInput SHALL display an error message and set SelectedAnswer to null
5. THE system SHALL maintain synchronization between the input box value and the SelectedAnswer state at all times

### Requirement 4

**User Story:** As a puzzle solver, I want to distinguish between clickable and non-clickable cells, so that I understand which cells are valid exit points

#### Acceptance Criteria

1. THE GridCell SHALL determine if it is an EdgeCell by checking if row equals 0, row equals gridSize-1, col equals 0, or col equals gridSize-1
2. WHERE a GridCell is an EdgeCell, THE GridCell SHALL apply a CSS class that enables pointer cursor and hover effects
3. WHERE a GridCell is not an EdgeCell, THE GridCell SHALL apply a CSS class that disables pointer cursor and prevents click events
4. WHEN the user hovers over an EdgeCell, THE GridCell SHALL display a visual indicator (border glow, scale transform, or color change) with transition duration of 300 milliseconds or less
5. THE PuzzleGrid SHALL pass the isEdgeCell property to each GridCell component during rendering

### Requirement 5

**User Story:** As a puzzle solver, I want the quick-select buttons to remain functional alongside grid clicking, so that I have multiple ways to select my answer

#### Acceptance Criteria

1. WHEN the user clicks a quick-select button, THE AnswerInput SHALL update the SelectedAnswer and input box text identically to a grid cell click
2. WHEN the user clicks on a GridCell, THE corresponding quick-select button SHALL display the selected state if it exists in the quick-select list
3. WHEN the SelectedAnswer is updated through any method (typing, grid click, or button click), THE system SHALL synchronize all three input mechanisms
4. THE AnswerInput SHALL maintain the existing quick-select button grid layout with 6 columns and edge cell options
5. THE system SHALL ensure that grid cell clicks, manual input, and quick-select buttons all trigger the same state update logic

### Requirement 6

**User Story:** As a developer, I want the implementation to follow Devvit best practices, so that the code is maintainable and consistent with the platform

#### Acceptance Criteria

1. THE implementation SHALL use React hooks (useState, useCallback) for state management following Devvit patterns
2. THE implementation SHALL use TypeScript with explicit type annotations for all props and state
3. THE implementation SHALL follow the existing naming conventions (camelCase for functions, PascalCase for components)
4. THE implementation SHALL maintain the existing component structure without introducing new files unless necessary
5. THE implementation SHALL use the existing utility functions (cn for className merging, formatAnswer for position formatting)
