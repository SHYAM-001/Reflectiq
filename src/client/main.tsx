import './index.css';
import './components/game/PuzzleGrid.css';
import './components/game/HintSystem.css';
import './components/game/GameTimer.css';
import './components/ui/PuzzleFilter.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
