import { Brain as BrainIcon } from 'lucide-react';
import styles from './BrainButton.module.scss';

/**
 * BrainButton - Upload documents to the Brain context
 * @param {{hasContext: boolean, onUpload: Function}} props
 */
export default function BrainButton({ hasContext, activeBrainName, isProcessing, onClick }) {
  return (
    <button
      className={`
        ${styles.brainBtn} 
        ${hasContext ? styles.hasDoc : ''} 
        ${isProcessing ? styles.processing : ''}
      `}
      onClick={onClick}
      title="Intento Brain"
    >
      <BrainIcon size={20} />
      {hasContext && <span className={styles.status}>{activeBrainName || 'Brain'}</span>}
      {/* Optional: Add a small dot or glow for processing if CSS animation isn't enough */}
    </button>
  );
}
