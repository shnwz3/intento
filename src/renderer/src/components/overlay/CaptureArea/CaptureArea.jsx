import { Camera, RefreshCcw } from 'lucide-react';
import styles from './CaptureArea.module.scss';

/**
 * CaptureArea - Screenshot capture button with thumbnail preview
 * @param {{screenshot: string|null, onCapture: Function}} props
 */
export default function CaptureArea({ screenshot, onCapture }) {
  return (
    <div
      className={`${styles.captureArea} ${screenshot ? styles.hasScreenshot : ''}`}
      onClick={onCapture}
      title={screenshot ? "Click to Retake" : "Capture Intent"}
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
