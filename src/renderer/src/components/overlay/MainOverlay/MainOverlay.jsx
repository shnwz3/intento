import { useState, useEffect, useCallback, useRef } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Send } from 'lucide-react';
import CaptureArea from '../CaptureArea/CaptureArea';
import BrainButton from '../BrainButton/BrainButton';
import styles from './MainOverlay.module.scss';

const INITIAL_HINT = 'Ask Intento anything...';

export default function MainOverlay() {
  const inputRef = useRef(null);
  const [prompt, setPrompt] = useState('');
  const [phase, setPhase] = useState('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [screenshot, setScreenshot] = useState(null);
  const [hasBrain, setHasBrain] = useState(false);
  const [activeBrainName, setActiveBrainName] = useState('');
  const [typingMode, setTypingMode] = useState('type');
  const [countdownSeconds, setCountdownSeconds] = useState(3);

  const isBusy = phase === 'capturing' || phase === 'analyzing' || phase === 'typing';

  const focusPromptInput = useCallback(() => {
    requestAnimationFrame(() => {
      const input = inputRef.current;
      if (!input) return;
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    });
  }, []);

  useEffect(() => {
    let cleanupBrain = null;
    let cleanupConfig = null;

    window.intentoAPI.getBrainStatus().then((status) => {
      setHasBrain(status.hasContext);
      setActiveBrainName(status.activeName);
    });

    window.intentoAPI.getAIConfig().then((config) => {
      setTypingMode(config?.typing?.mode || 'type');
      setCountdownSeconds(config?.typing?.countdownSeconds ?? 3);
    });

    if (window.intentoAPI.onBrainUpdate) {
      cleanupBrain = window.intentoAPI.onBrainUpdate((status) => {
        setHasBrain(status.hasContext);
        setActiveBrainName(status.activeName);
      });
    }

    if (window.intentoAPI.onConfigUpdate) {
      cleanupConfig = window.intentoAPI.onConfigUpdate((config) => {
        setTypingMode(config?.typing?.mode || 'type');
        setCountdownSeconds(config?.typing?.countdownSeconds ?? 3);
      });
    }

    return () => {
      cleanupBrain?.();
      cleanupConfig?.();
    };
  }, []);

  const handleCapture = useCallback(async () => {
    setPhase('capturing');
    setScreenshot(null);
    setErrorMessage('');
    setStatusMessage('Capturing your intent...');

    const result = await window.intentoAPI.captureScreen();
    if (result.success) {
      setScreenshot(result.base64);
      setPhase('ready');
      setStatusMessage('Intento is ready for your next response.');
      focusPromptInput();
      return;
    }

    setScreenshot(null);
    setPhase('error');
    setErrorMessage(result.message || result.error || 'Intento could not get ready.');
    setStatusMessage('Intento could not get ready right now.');
  }, [focusPromptInput]);

  useEffect(() => {
    focusPromptInput();
  }, [focusPromptInput]);

  useEffect(() => {
    const cleanupShortcut = window.intentoAPI.onShortcut(async () => {
      await handleCapture();
      focusPromptInput();
    });

    return () => {
      cleanupShortcut?.();
    };
  }, [focusPromptInput, handleCapture]);

  const handleSend = useCallback(async () => {
    if (isBusy) return;

    if (!screenshot) {
      setPhase('error');
      setErrorMessage('Press Ctrl+Alt+C to start Intento first.');
      setStatusMessage('Press Ctrl+Alt+C to start Intento first.');
      return;
    }

    setPhase('analyzing');
    setErrorMessage('');
    setStatusMessage('Preparing your Intento response...');
    window.intentoAPI.hudShow('Intento is thinking...');
    window.intentoAPI.minimize?.();

    try {
      const formState = await window.intentoAPI.inspectForm(screenshot);

      if (formState?.success === false) {
        window.intentoAPI.hudHide();
        setPhase('error');
        setErrorMessage(formState.error || 'Form inspection failed.');
        setStatusMessage('Intento could not inspect the form right now.');
        return;
      }

      if (formState.isForm) {
        setPhase('typing');
        setStatusMessage('Form detected. Automating fill...');
        window.intentoAPI.hudShow('Automating form...');

        const autoResult = await window.intentoAPI.automateForm();
        window.intentoAPI.hudHide();

        if (autoResult.success) {
          setPhase('success');
          setStatusMessage(`Form filled! ${autoResult.fieldCount} fields completed.`);
          setTimeout(() => {
            setPhase('ready');
            setStatusMessage('Form automation complete.');
          }, 3000);
          return;
        }

        setPhase('error');
        setErrorMessage(autoResult.error || 'Form automation failed.');
        setStatusMessage('Intento hit a snag during form filling.');
        return;
      }

      setStatusMessage('Drafting a response...');
      const result = await window.intentoAPI.analyze(
        '',
        prompt || 'Look at the screen and generate a short but detailed response in about 2-4 sentences. Keep it specific, useful, and not too long.'
      );

      if (!result.success) {
        window.intentoAPI.hudHide();
        setPhase('error');
        setErrorMessage(result.message || result.error || 'Analysis failed.');
        setStatusMessage('Intento could not generate a usable response.');
        return;
      }

      setPhase('typing');
      setStatusMessage(
        result.provider
          ? `Intento response ready from ${result.provider}. It will ${describeOutputMode(typingMode)} after ${countdownSeconds}s.`
          : `Intento response ready. It will ${describeOutputMode(typingMode)} after ${countdownSeconds}s.`
      );

      const typingResult = await window.intentoAPI.typeAtCursor(result.response, countdownSeconds);
      window.intentoAPI.hudHide();

      if (!typingResult.success) {
        setPhase('error');
        setErrorMessage(typingResult.message || typingResult.error || 'Typing failed.');
        setStatusMessage('Intento generated a response but could not type it.');
        return;
      }

      setPrompt('');
      setPhase('success');
      setStatusMessage('Intento response typed successfully at the cursor.');
      setTimeout(() => {
        setPhase((current) => (current === 'success' ? 'ready' : current));
        setStatusMessage((current) =>
          current === 'Intento response typed successfully at the cursor.'
            ? 'Intento is ready for another follow-up.'
            : current
        );
      }, 2500);
    } catch (_err) {
      window.intentoAPI.hudHide();
      setPhase('error');
      setErrorMessage(_err.message || 'Unexpected error during analysis.');
      setStatusMessage('Intento hit an unexpected problem.');
    }
  }, [countdownSeconds, isBusy, prompt, screenshot, typingMode]);

  const handleOpenBrain = useCallback(() => {
    window.intentoAPI.openBrain();
  }, []);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter') handleSend();
    },
    [handleSend]
  );

  return (
    <div className={styles.container}>
      <CaptureArea screenshot={screenshot} onCapture={handleCapture} disabled={isBusy} />

      <BrainButton
        hasContext={hasBrain}
        activeBrainName={activeBrainName}
        isProcessing={isBusy}
        onClick={handleOpenBrain}
      />

      <div className={styles.inputWrapper}>
        <input
          ref={inputRef}
          type="text"
          className={styles.input}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={INITIAL_HINT}
          disabled={isBusy}
        />
        <div className={styles.statusRow}>
          {statusMessage ? (
            <div className={`${styles.statusBadge} ${styles[phase] || ''}`}>
              {phase === 'analyzing' || phase === 'capturing' || phase === 'typing' ? (
                <Loader2 size={12} />
              ) : null}
              {phase === 'success' ? <CheckCircle2 size={12} /> : null}
              {phase === 'error' ? <AlertCircle size={12} /> : null}
              <span>{statusMessage}</span>
            </div>
          ) : null}
          {errorMessage ? <p className={styles.errorText}>{errorMessage}</p> : null}
        </div>
      </div>

      <button
        className={`${styles.sendBtn} ${isBusy ? styles.loading : ''}`}
        onClick={handleSend}
        disabled={isBusy}
        title={screenshot ? 'Analyze and type' : 'Press Ctrl+Alt+C first'}
      >
        <Send size={18} />
      </button>
    </div>
  );
}

function describeOutputMode(mode) {
  if (mode === 'paste') return 'paste the response';
  if (mode === 'clipboard_only') return 'copy the response to your clipboard';
  return 'type the response';
}
