import styles from '../BrainOnboarding.module.scss';

export default function NexusFooter({ 
  tags, 
  isSaving, 
  handleSave 
}) {
  return (
    <footer className={styles.nexusFooter}>
      <div className={styles.footerInfo}>
         Neural Integrity: {tags.length > 0 ? Math.round((tags.filter(t => t.value).length / tags.length) * 100) : 0}%
      </div>
      <button 
        className={styles.saveNexusBtn} 
        disabled={isSaving}
        onClick={handleSave}
      >
        {isSaving ? 'PERSISTING...' : 'SAVE CONFIGURATION'}
      </button>
    </footer>
  );
}
