import { Edit3, Check, Save } from 'lucide-react';
import styles from '../BrainOnboarding.module.scss';

export default function NexusControls({ 
  activeBrain, 
  isRenaming, 
  setIsRenaming, 
  renameValue, 
  setRenameValue, 
  handleRename, 
  activeTab, 
  setActiveTab, 
  TABS,
  tags,
  isSaving,
  handleSave,
}) {
  const integrity = tags.length > 0 ? Math.round((tags.filter(t => t.value).length / tags.length) * 100) : 0;

  return (
    <div className={styles.nexusControls}>
      <header className={styles.nexusHeader}>
        <div className={styles.headerBranding}>
          <div className={styles.titleWithRename}>
            {isRenaming ? (
              <div className={styles.renameWrapper}>
                <input 
                  autoFocus 
                  value={renameValue} 
                  onChange={e => setRenameValue(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleRename()}
                />
                <button onClick={handleRename}><Check size={16} /></button>
              </div>
            ) : (
              <div className={styles.titleGroup}>
                <h1>{activeBrain?.name || 'INITIALIZING...'}</h1>
                {activeBrain && (
                  <button className={styles.editBtn} onClick={() => { setIsRenaming(true); setRenameValue(activeBrain.name); }}>
                    <Edit3 size={16} />
                  </button>
                )}
              </div>
            )}
          </div>
          <div className={styles.statusRow}>
            <div className={styles.integrityBadge}>
               Neural Integrity: {integrity}%
            </div>
          </div>
        </div>
        
        <div className={styles.controlsRight}>
          <div className={styles.tabNav}>
            {TABS.map(tab => (
              <button 
                key={tab.id}
                className={`${styles.tabBtn} ${activeTab === tab.id ? styles.tabActive : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <tab.icon size={16} />
                {tab.label}
              </button>
            ))}
          </div>

          <button 
            className={styles.saveNexusBtn} 
            disabled={isSaving}
            onClick={handleSave}
          >
            {isSaving ? 'PERSISTING...' : (
              <>
                <Save size={14} />
                SAVE CONFIG
              </>
            )}
          </button>
        </div>
      </header>
    </div>
  );
}
