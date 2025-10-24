import { useEffect, useState } from 'react';
import { LogicReflectionsGame } from './components/LogicReflectionsGame.js';
import './components/LogicReflectionsGame.css';

export const App = () => {
  const [username, setUsername] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initialize the app and get user info
    const initializeApp = async () => {
      try {
        const response = await fetch('/api/init');
        if (response.ok) {
          const data = await response.json();
          setUsername(data.username || '');
        }
      } catch (error) {
        console.error('Failed to initialize app:', error);
      } finally {
        setLoading(false);
      }
    };

    void initializeApp();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-500 to-purple-600">
        <div className="text-white text-xl">Loading Logic Reflections...</div>
      </div>
    );
  }

  return <LogicReflectionsGame username={username} />;
};
