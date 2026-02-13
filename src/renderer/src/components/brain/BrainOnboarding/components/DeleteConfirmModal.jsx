import { AlertTriangle } from 'lucide-react';
import styles from '../BrainOnboarding.module.scss';

export default function DeleteConfirmModal({ 
  brainName, 
  onConfirm, 
  onCancel 
}) {
  return (
    <div className={styles.modalBackdrop}>
      <div className={`${styles.nexusModal} ${styles.deleteModal}`}>
        <div className={styles.warningHeader}>
          <AlertTriangle size={32} className={styles.warningIcon} />
          <h3>Delete Memory?</h3>
        </div>
        
        <p className={styles.deleteWarning}>
          You are about to permanently delete <strong>{brainName}</strong>. 
          All neural pathways and associated memory data will be purged.
        </p>

        <div className={styles.modalActions}>
          <button className={styles.decommissionBtn} onClick={onConfirm}>
            DELETE
          </button>
          <button className={styles.cancelBtn} onClick={onCancel}>
            KEEP PROFILE
          </button>
        </div>
      </div>
    </div>
  );
}
