import { useState, useEffect } from 'react';
import { Globe, Key, ExternalLink, Wallet, Eye, EyeOff, CheckCircle } from 'lucide-react';
import styles from '../BrainOnboarding.module.scss';
import { PROVIDER_METADATA } from '../constants';

export default function AIEngineConfig({ 
  aiConfig, 
  apiCredits, 
  onSave,
  onCheckCredits 
}) {
  // Local state — changes here do NOT affect sidebar or backend
  const [selectedProvider, setSelectedProvider] = useState(aiConfig?.activeProvider || 'grok');
  const [localKeys, setLocalKeys] = useState(aiConfig?.keys || {});
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [checking, setChecking] = useState(false);
  const [localCredits, setLocalCredits] = useState(apiCredits);

  // Sync when parent aiConfig changes (e.g. on initial load)
  useEffect(() => {
    if (aiConfig) {
      setSelectedProvider(aiConfig.activeProvider);
      setLocalKeys(aiConfig.keys || {});
    }
  }, [aiConfig?.activeProvider]);

  // Sync credits when parent refreshes them (e.g. after save)
  useEffect(() => {
    setLocalCredits(apiCredits);
  }, [apiCredits]);

  // When user clicks a provider, check credits for that provider
  const handleSelectProvider = async (id) => {
    setSelectedProvider(id);
    setShowKey(false);
    setSaved(false);

    // Check credits for browsed provider
    if (onCheckCredits) {
      setChecking(true);
      try {
        const credits = await onCheckCredits(id);
        setLocalCredits(credits);
      } catch (e) {
        setLocalCredits({ balance: 'Error', status: 'error' });
      }
      setChecking(false);
    }
  };

  // SAVE — commits selectedProvider + localKeys to backend
  const handleSave = async () => {
    const configToSave = {
      ...aiConfig,
      activeProvider: selectedProvider,
      keys: localKeys,
    };
    await onSave(configToSave);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const currentMeta = PROVIDER_METADATA[selectedProvider] || {};

  return (
    <div className={styles.settingsZone}>
       <div className={styles.settingsCard}>
          <div className={styles.settingsHeader}>
            <Globe size={24} className={styles.coreIcon}/>
            <div>
                <h3>AI Engine Configuration</h3>
                <p>Select a provider, enter your API key, then hit Save.</p>
            </div>
          </div>

          <div className={styles.providerGrid}>
             {Object.entries(PROVIDER_METADATA).map(([id, meta]) => (
               <button 
                 key={id} 
                 className={`${styles.providerBtn} ${selectedProvider === id ? styles.providerActive : ''} ${aiConfig?.activeProvider === id ? styles.providerConnected : ''}`}
                 onClick={() => handleSelectProvider(id)}
               >
                 {meta.name}
                 {meta.recommended && <span className={styles.recommendBadge}>RECOMMENDED</span>}
                 {aiConfig?.activeProvider === id && aiConfig?.keys[id] && (
                   <span className={styles.activeDot}></span>
                 )}
               </button>
             ))}
          </div>

          <div className={styles.keyManagement}>
            <div className={styles.keyInputGroup}>
                <div className={styles.keyHeader}>
                    <label><Key size={14} /> {currentMeta.name} API KEY</label>
                    <div className={styles.keyActions}>
                        <button 
                            className={styles.getKeyLink}
                            onClick={() => window.intentoAPI.openExternal(currentMeta.url)}
                        >
                            Get Key <ExternalLink size={12} />
                        </button>
                    </div>
                </div>
                <div className={styles.inputWrapper}>
                    <input 
                        type={showKey ? 'text' : 'password'} 
                        value={localKeys[selectedProvider] || ''}
                        placeholder={`Enter ${currentMeta.name || 'provider'} API key...`}
                        onChange={(e) => {
                            setLocalKeys({ ...localKeys, [selectedProvider]: e.target.value });
                            setSaved(false);
                        }}
                    />
                    <button 
                        className={styles.toggleKeyBtn}
                        onClick={() => setShowKey(!showKey)}
                        title={showKey ? 'Hide key' : 'Show key'}
                    >
                        {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                </div>
            </div>

            <div className={styles.creditStats}>
                <div className={styles.statBox}>
                    <Wallet size={14} />
                    {checking ? (
                      <span>Checking...</span>
                    ) : (
                      <span>{localCredits.balance}</span>
                    )}
                    <div className={`${styles.statusDot} ${styles[localCredits.status]}`}></div>
                </div>
            </div>
          </div>
          
          <button 
            className={`${styles.configSaveBtn} ${saved ? styles.configSaved : ''}`} 
            onClick={handleSave}
          >
            {saved ? (
              <><CheckCircle size={14} style={{marginRight: 6}} /> SAVED — {currentMeta.name} IS NOW ACTIVE</>
            ) : (
              `SAVE & ACTIVATE ${currentMeta.name}`
            )}
          </button>
       </div>
    </div>
  );
}
