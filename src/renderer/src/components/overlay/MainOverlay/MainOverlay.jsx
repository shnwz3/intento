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
  const [activeBrainName, setActiveBrainName] = useState('');

  // Check for brain context on mount and listen for updates
  useEffect(() => {
    // Initial fetch
    window.intentoAPI.getBrainStatus().then((status) => {
      setHasBrain(status.hasContext);
      setActiveBrainName(status.activeName);
    });

    // Listen for real-time updates
    if (window.intentoAPI.onBrainUpdate) {
        window.intentoAPI.onBrainUpdate((status) => {
            setHasBrain(status.hasContext);
            setActiveBrainName(status.activeName);
        });
    }
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

    if (!screenshot) {
      window.intentoAPI.hudShow('⚠️ Please capture an image first!');
      setTimeout(() => window.intentoAPI.hudReset(), 3000);
      return;
    }

    setIsLoading(true);
    // Show HUD to remind user to place cursor
    window.intentoAPI.hudShow('Intento thinking... Place cursor for output!');

    try {
      const result = await window.intentoAPI.analyze(
        '',
        prompt || 'Look at the screen and answer my question or give actions.'
      );

      // Hide thinking HUD (countdown will show its own updates)
      window.intentoAPI.hudHide();

      if (result.success) {
        await window.intentoAPI.typeAtCursor(result.response, 5);
        setPrompt('');
        setPlaceholder('Response sent to cursor!');
        setTimeout(() => setPlaceholder('Ask about the screen...'), 3000);
      } else {
        setPlaceholder('Error: ' + result.error);
      }
    } catch (err) {
      window.intentoAPI.hudHide();
      setPlaceholder('Error during analysis');
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

      <BrainButton 
        hasContext={hasBrain} 
        activeBrainName={activeBrainName}
        isProcessing={isLoading}
        onClick={handleOpenBrain} 
      />

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
