import { Edit3, Check } from 'lucide-react';
import styles from '../BrainOnboarding.module.scss';

export default function NexusHeader({ 
  activeBrain, 
  isRenaming, 
  setIsRenaming, 
  renameValue, 
  setRenameValue, 
  handleRename, 
  activeTab, 
  setActiveTab, 
  TABS 
}) {
  return (
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
        <p>Configure neural pathways and behavioral constraints.</p>
      </div>
      
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
    </header>
  );
}
