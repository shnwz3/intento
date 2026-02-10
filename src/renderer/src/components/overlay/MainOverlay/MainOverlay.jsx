import { useState, useEffect, useCallback } from 'react';
import { Camera, Brain, Send } from 'lucide-react';
import CaptureArea from '../CaptureArea/CaptureArea';
import BrainButton from '../BrainButton/BrainButton';
import styles from './MainOverlay.module.scss';

export default function MainOverlay() {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [placeholder, setPlaceholder] = useState('Ask about the screen...');
  const [screenshot, setScreenshot] = useState(null);
  const [hasBrain, setHasBrain] = useState(false);

  // Check for brain context on mount
  useEffect(() => {
    window.intentoAPI.getBrainStatus().then((status) => {
      setHasBrain(status.hasContext);
    });
  }, []);

  // Listen for shortcut trigger
  useEffect(() => {
    window.intentoAPI.onShortcut(() => {
      handleCapture();
    });
  }, []);

  const handleCapture = useCallback(async () => {
    const result = await window.intentoAPI.captureScreen();
    if (result.success) {
      setScreenshot(result.base64);
    }
  }, []);

  const handleSend = useCallback(async () => {
    if (!screenshot && !prompt) return;

    setIsLoading(true);
    const result = await window.intentoAPI.analyze(
      '',
      prompt || 'Look at the screen and answer my question or give actions.'
    );

    if (result.success) {
      await window.intentoAPI.typeAtCursor(result.response, 5);
      setPrompt('');
      setPlaceholder('Response sent to cursor!');
      setTimeout(() => setPlaceholder('Ask about the screen...'), 3000);
    } else {
      setPlaceholder('Error: ' + result.error);
    }

    setIsLoading(false);
  }, [screenshot, prompt]);

  const handleOpenBrain = useCallback(() => {
    window.intentoAPI.openBrain();
  }, []);

  const handleKeyPress = useCallback(
    (e) => {
      if (e.key === 'Enter') handleSend();
    },
    [handleSend]
  );

  return (
    <div className={styles.container}>
      <CaptureArea screenshot={screenshot} onCapture={handleCapture} />

      <BrainButton hasContext={hasBrain} onClick={handleOpenBrain} />

      <div className={styles.inputWrapper}>
        <input
          type="text"
          className={styles.input}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={placeholder}
          disabled={isLoading}
        />
      </div>

      <button
        className={`${styles.sendBtn} ${isLoading ? styles.loading : ''}`}
        onClick={handleSend}
        disabled={isLoading}
      >
        <Send size={18} />
      </button>
    </div>
  );
}
