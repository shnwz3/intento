import { Zap, Plus, LayoutGrid, Settings, X } from 'lucide-react';
import styles from '../BrainOnboarding.module.scss';
import { PROVIDER_METADATA } from '../constants';

export default function NeuralSidebar({ 
  brains, 
  activeTab, 
  setActiveTab, 
  handleSwitchBrain, 
  handleDeleteBrain, 
  setShowAddModal, 
  aiConfig, 
  apiCredits 
}) {
  const activeProviderName = aiConfig?.activeProvider 
    ? (PROVIDER_METADATA[aiConfig.activeProvider]?.name || aiConfig.activeProvider.toUpperCase())
    : 'NO API SET';

  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarHeader}>
        <div className={styles.brandGroup}>
          <div className={styles.neuralIcon}><Zap size={16} /></div>
          <span>BRAIN INDEX</span>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.addBrainBtn} onClick={() => setShowAddModal(true)}><Plus size={18} /></button>
        </div>
      </div>

      <div className={styles.brainList}>
        <div className={styles.sectionLabel}>NEURAL MODULES</div>
        {brains.map(b => (
          <div 
            key={b.id} 
            className={`${styles.brainNavItem} ${b.isActive && activeTab !== 'settings' ? styles.navActive : ''}`}
            onClick={() => { handleSwitchBrain(b.id); setActiveTab('memory'); }}
          >
            <div className={styles.navBrainIcon}><LayoutGrid size={14} /></div>
            <div className={styles.navInfo}>
              <span className={styles.navName}>{b.name}</span>
              <span className={styles.navMeta}>{b.filledCount || 0}/{b.tagCount || 0} Trained</span>
            </div>
            {!b.isActive && brains.length > 1 && (
              <button className={styles.navDelete} onClick={(e) => handleDeleteBrain(b.id, e)}><X size={12} /></button>
            )}
          </div>
        ))}
      </div>

      <div className={styles.sidebarSettings}>
         <div className={styles.sectionLabel}>SETTINGS</div>
         <div 
           className={`${styles.brainNavItem} ${activeTab === 'settings' ? styles.navActive : ''}`}
           onClick={() => setActiveTab('settings')}
         >
           <div className={styles.navBrainIcon}><Settings size={14} /></div>
           <div className={styles.navInfo}>
             <span className={styles.navName}>AI Settings</span>
             <span className={styles.navMeta}>{activeProviderName} • {apiCredits.balance}</span>
           </div>
         </div>
      </div>
    </aside>
  );
}
