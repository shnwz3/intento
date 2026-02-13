import { Globe, Key, ExternalLink, Wallet, Cpu } from 'lucide-react';
import styles from '../BrainOnboarding.module.scss';
import { PROVIDER_METADATA } from '../constants';

export default function AIEngineConfig({ 
  aiConfig, 
  apiCredits, 
  handleUpdateConfig 
}) {
  return (
    <div className={styles.settingsZone}>
       <div className={styles.settingsCard}>
          <div className={styles.settingsHeader}>
            <Globe size={24} className={styles.coreIcon}/>
            <div>
                <h3>AI Engine Configuration</h3>
                <p>Select your active provider and manage secure API keys.</p>
            </div>
          </div>

          <div className={styles.providerGrid}>
             {Object.entries(PROVIDER_METADATA).map(([id, meta]) => (
               <button 
                 key={id} 
                 className={`${styles.providerBtn} ${aiConfig?.activeProvider === id ? styles.providerActive : ''}`}
                 onClick={() => handleUpdateConfig({ activeProvider: id })}
               >
                 {meta.name}
                 {/* {meta.recommended && <span className={styles.recommendBadge}>BEST</span>} */}
               </button>
             ))}
          </div>

          <div className={styles.keyManagement}>
            <div className={styles.keyInputGroup}>
                <div className={styles.keyHeader}>
                    <label><Key size={14} /> API KEY</label>
                    {aiConfig?.activeProvider && (
                        <button 
                            className={styles.getKeyLink}
                            onClick={() => window.intentoAPI.openExternal(PROVIDER_METADATA[aiConfig.activeProvider].url)}
                        >
                            Generate Key <ExternalLink size={12} />
                        </button>
                    )}
                </div>
                <div className={styles.inputWrapper}>
                    <input 
                        type="password" 
                        value={aiConfig?.keys[aiConfig?.activeProvider] || ''}
                        placeholder={`Enter ${aiConfig?.activeProvider || 'provider'} key...`}
                        onChange={(e) => {
                            if (!aiConfig) return;
                            const keys = { ...aiConfig.keys, [aiConfig.activeProvider]: e.target.value };
                            handleUpdateConfig({ keys });
                        }}
                    />
                </div>
            </div>

            <div className={styles.creditStats}>
                <div className={styles.statBox}>
                    <Wallet size={14} />
                    <span>CREDITS: {apiCredits.balance}</span>
                    <div className={`${styles.statusDot} ${styles[apiCredits.status]}`}></div>
                </div>
                <div className={styles.statBox}>
                    <Cpu size={14} />
                    <span>MODEL: {aiConfig?.models[aiConfig.activeProvider]}</span>
                </div>
            </div>
          </div>
          
          <button 
            className={styles.configSaveBtn} 
            onClick={() => handleUpdateConfig(aiConfig)}
          >
            SAVE ENGINE CONFIG
          </button>
       </div>
    </div>
  );
}
