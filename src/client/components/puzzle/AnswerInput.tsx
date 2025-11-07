import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Target } from 'lucide-react';

import { GridPosition } from '../../types/api';

/**
 * Props for the AnswerInput component
 * @property gridSize - The size of the puzzle grid (used for validation)
 * @property selectedAnswer - The currently selected answer position, or null if none selected
 * @property onAnswerChange - Callback invoked when the answer changes (via typing, grid click, or button)
 */
interface AnswerInputProps {
  gridSize: number;
  selectedAnswer: GridPosition | null;
  onAnswerChange: (answer: GridPosition | null) => void;
}

export const AnswerInput = ({ gridSize, selectedAnswer, onAnswerChange }: AnswerInputProps) => {
  const [inputValue, setInputValue] = useState('');

  /**
   * Formats a GridPosition into a human-readable string (e.g., [0, 0] -> "A1").
   * @param answer - The grid position to format
   * @returns Formatted string in letter+number format
   */
  const formatAnswer = (answer: GridPosition): string => {
    const letter = String.fromCharCode(65 + answer[0]);
    const number = answer[1] + 1;
    return `${letter}${number}`;
  };

  /**
   * Synchronize input value with external selectedAnswer prop changes.
   * This enables grid cell clicks to update the input box display.
   */
  useEffect(() => {
    if (selectedAnswer) {
      const formatted = formatAnswer(selectedAnswer);
      setInputValue(formatted);
    } else {
      setInputValue('');
    }
  }, [selectedAnswer]);

  /**
   * Parses user input string into a GridPosition.
   * Supports formats like "A1", "B5", "Exit: A1", etc.
   * @param input - The user input string to parse
   * @returns GridPosition tuple [row, col] if valid, null otherwise
   */
  const parseAnswer = (input: string): GridPosition | null => {
    // Support formats like "A1", "B5", "Exit: A1", etc.
    const cleaned = input
      .replace(/exit:\s*/i, '')
      .trim()
      .toUpperCase();

    // Match letter + number pattern (e.g., "A1", "B5")
    const match = cleaned.match(/^([A-Z])(\d+)$/);
    if (!match) return null;

    const letter = match[1];
    const number = parseInt(match[2]);

    // Convert letter to row (A=0, B=1, etc.)
    const row = letter.charCodeAt(0) - 65;
    const col = number - 1;

    // Validate bounds
    if (row < 0 || row >= gridSize || col < 0 || col >= gridSize) {
      return null;
    }

    return [row, col];
  };

  /**
   * Handles manual input changes from the text field
   * @param value - The new input value
   * @returns void
   */
  const handleInputChange = (value: string): void => {
    setInputValue(value);
    const parsed = parseAnswer(value);
    onAnswerChange(parsed);
  };

  /**
   * Handles quick-select button clicks
   * @param row - The row index of the selected cell
   * @param col - The column index of the selected cell
   * @returns void
   */
  const handleQuickSelect = (row: number, col: number): void => {
    const answer: GridPosition = [row, col];
    const formatted = formatAnswer(answer);
    setInputValue(formatted);
    onAnswerChange(answer);
  };

  // Generate quick select buttons for grid edges
  const getEdgeCells = () => {
    const cells: Array<{ row: number; col: number; label: string }> = [];

    // Top and bottom edges
    for (let col = 0; col < gridSize; col++) {
      cells.push({ row: 0, col, label: formatAnswer([0, col]) });
      if (gridSize > 1) {
        cells.push({ row: gridSize - 1, col, label: formatAnswer([gridSize - 1, col]) });
      }
    }

    // Left and right edges (excluding corners already added)
    for (let row = 1; row < gridSize - 1; row++) {
      cells.push({ row, col: 0, label: formatAnswer([row, 0]) });
      cells.push({ row, col: gridSize - 1, label: formatAnswer([row, gridSize - 1]) });
    }

    return cells.slice(0, 12); // Limit to prevent UI overflow
  };

  const edgeCells = getEdgeCells();

  return (
    <div className="bg-card/50 backdrop-blur-sm rounded-xl p-4 border border-border/50 space-y-4">
      <div className="flex items-center space-x-2 text-sm text-foreground/80">
        <Target className="h-4 w-4" />
        <span>Select the laser exit point:</span>
      </div>

      {/* Manual input */}
      <div className="space-y-2">
        <Input
          value={inputValue}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder="Enter exit cell (e.g., A1, B5)"
          className="text-center font-orbitron"
        />

        {selectedAnswer && (
          <div className="text-center text-sm text-green-500">
            ✓ Selected: {formatAnswer(selectedAnswer)}
          </div>
        )}

        {inputValue && !selectedAnswer && (
          <div className="text-center text-sm text-destructive">
            Invalid format. Use letter + number (e.g., A1)
          </div>
        )}
      </div>

      {/* Quick select buttons */}
      <div className="space-y-2">
        <div className="text-xs text-foreground/60 text-center">Quick select edge cells:</div>
        <div className="grid grid-cols-6 gap-1">
          {edgeCells.map((cell) => (
            <Button
              key={cell.label}
              onClick={() => handleQuickSelect(cell.row, cell.col)}
              variant={
                selectedAnswer && selectedAnswer[0] === cell.row && selectedAnswer[1] === cell.col
                  ? 'default'
                  : 'outline'
              }
              size="sm"
              className="text-xs font-orbitron h-8"
            >
              {cell.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
};
