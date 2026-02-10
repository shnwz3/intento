import { Brain as BrainIcon } from 'lucide-react';
import styles from './BrainButton.module.scss';

/**
 * BrainButton - Upload documents to the Brain context
 * @param {{hasContext: boolean, onUpload: Function}} props
 */
export default function BrainButton({ hasContext, onClick }) {
  return (
    <button
      className={`${styles.brainBtn} ${hasContext ? styles.hasDoc : ''}`}
      onClick={onClick}
      title="Open Brain Memory & Setup"
    >
      <BrainIcon size={20} />
      {hasContext && <span className={styles.status}>DOC</span>}
    </button>
  );
}
