import { Camera, RefreshCcw } from 'lucide-react';
import styles from './CaptureArea.module.scss';

/**
 * CaptureArea - Screenshot capture button with thumbnail preview
 * @param {{screenshot: string|null, onCapture: Function, disabled?: boolean}} props
 */
export default function CaptureArea({ screenshot, onCapture, disabled = false }) {
  return (
    <div
      className={`${styles.captureArea} ${screenshot ? styles.hasScreenshot : ''}`}
      onClick={disabled ? undefined : onCapture}
      title={screenshot ? 'Click to Retake' : 'Capture Intent'}
      role="button"
      aria-label={screenshot ? 'Retake screenshot' : 'Capture screenshot'}
      aria-disabled={disabled}
    >
      <Camera size={20} className={styles.icon} />
      {screenshot && (
        <>
          <img
            src={screenshot}
            alt="Screenshot"
            className={styles.thumbnail}
          />
          <div className={styles.overlay}>
            <RefreshCcw size={18} className={styles.refreshIcon} />
          </div>
        </>
      )}
    </div>
  );
}
