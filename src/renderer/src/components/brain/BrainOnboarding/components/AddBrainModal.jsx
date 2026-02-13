import styles from '../BrainOnboarding.module.scss';

export default function AddBrainModal({ 
  newBrainName, 
  setNewBrainName, 
  handleCreateBrain, 
  setShowAddModal 
}) {
  return (
    <div className={styles.modalBackdrop}>
      <div className={styles.nexusModal}>
        <h3>INITIALIZE NEW BRAIN</h3>
        <input 
          placeholder="Enter brain designation..." 
          value={newBrainName}
          onChange={(e) => setNewBrainName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleCreateBrain()}
          autoFocus
        />
        <div className={styles.modalActions}>
          <button className={styles.confirmBtn} onClick={handleCreateBrain}>INITIALIZE</button>
          <button onClick={() => setShowAddModal(false)}>CANCEL</button>
        </div>
      </div>
    </div>
  );
}
