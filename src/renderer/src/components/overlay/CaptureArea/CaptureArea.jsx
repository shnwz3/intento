import { RefreshCcw, Wand2 } from 'lucide-react';
import styles from './CaptureArea.module.scss';

/**
 * CaptureArea - Intento wake/refresh button
 * @param {{screenshot: string|null, onCapture: Function, disabled?: boolean}} props
 */
export default function CaptureArea({ screenshot, onCapture, disabled = false }) {
  return (
    <button
      type="button"
      className={`${styles.captureArea} ${screenshot ? styles.hasScreenshot : ''}`}
      onClick={onCapture}
      disabled={disabled}
      title={screenshot ? 'Refresh Intento' : 'Wake Intento'}
      aria-label={screenshot ? 'Refresh Intento' : 'Wake Intento'}
    >
      {screenshot ? (
        <RefreshCcw size={18} className={`${styles.icon} ${styles.readyIcon}`} />
      ) : (
        <Wand2 size={20} className={styles.icon} />
      )}
    </button>
  );
}
