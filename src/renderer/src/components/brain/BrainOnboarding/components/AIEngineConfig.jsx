import { useState, useEffect } from 'react';
import {
  CheckCircle,
  ExternalLink,
  Eye,
  EyeOff,
  Globe,
  Key,
  Wallet,
} from 'lucide-react';
import styles from '../BrainOnboarding.module.scss';
import { PROVIDER_METADATA } from '../constants';

export default function AIEngineConfig({
  aiConfig,
  apiCredits,
  providerOverview,
  onSave,
  onCheckCredits,
}) {
  const emptyKeys = Object.keys(PROVIDER_METADATA).reduce((acc, providerId) => {
    acc[providerId] = '';
    return acc;
  }, {});
  const [selectedProvider, setSelectedProvider] = useState(aiConfig?.activeProvider || 'grok');
  const [localKeys, setLocalKeys] = useState(aiConfig?.keys || emptyKeys);
  const [dirtyKeys, setDirtyKeys] = useState({});
  const [pendingClears, setPendingClears] = useState({});
  const [countdownSeconds, setCountdownSeconds] = useState(aiConfig?.typing?.countdownSeconds || 3);
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [checking, setChecking] = useState(false);
  const [localCredits, setLocalCredits] = useState(apiCredits);
  const normalizedCountdown = Math.min(15, Math.max(3, Number.isFinite(countdownSeconds) ? countdownSeconds : 3));

  useEffect(() => {
    if (aiConfig) {
      setSelectedProvider(aiConfig.activeProvider);
      setLocalKeys(aiConfig.keys || emptyKeys);
      setDirtyKeys({});
      setPendingClears({});
      setCountdownSeconds(aiConfig.typing?.countdownSeconds || 3);
    }
  }, [aiConfig]);

  useEffect(() => {
    setLocalCredits(apiCredits);
  }, [apiCredits]);

  const handleSelectProvider = async (id) => {
    setSelectedProvider(id);
    setShowKey(false);
    setSaved(false);

    if (onCheckCredits) {
      setChecking(true);
      try {
        const credits = await onCheckCredits(id);
        setLocalCredits(credits);
      } catch (_e) {
        setLocalCredits({ balance: 'Error', status: 'error' });
      }
      setChecking(false);
    }
  };

  const handleSave = async () => {
    const keyUpdates = {};
    Object.entries(localKeys).forEach(([providerId, value]) => {
      if (dirtyKeys[providerId]) {
        const trimmed = value.trim();
        if (trimmed) {
          keyUpdates[providerId] = trimmed;
        }
      }
    });

    const clearKeys = Object.entries(pendingClears)
      .filter(([, shouldClear]) => shouldClear)
      .map(([providerId]) => providerId);

    const configToSave = {
      ...aiConfig,
      activeProvider: selectedProvider,
      typing: {
        mode: 'type',
        countdownSeconds: normalizedCountdown,
      },
    };
    await onSave({
      config: configToSave,
      keyUpdates,
      clearKeys,
    });
    setLocalKeys(emptyKeys);
    setDirtyKeys({});
    setPendingClears({});
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const currentMeta = PROVIDER_METADATA[selectedProvider] || {};
  const currentOverview = providerOverview?.find((item) => item.id === selectedProvider);
  const hasStoredKey = Boolean(currentOverview?.hasKey || aiConfig?.keyStatus?.[selectedProvider]);
  const isPendingClear = Boolean(pendingClears[selectedProvider]);
  const keyPlaceholder = isPendingClear
    ? 'Stored key will be removed when you save.'
    : hasStoredKey && !dirtyKeys[selectedProvider]
      ? `Stored securely. Enter a new ${currentMeta.name || 'provider'} key to replace it.`
      : `Enter ${currentMeta.name || 'provider'} API key...`;

  return (
    <div className={styles.settingsZone}>
      <div className={styles.settingsCard}>
        <div className={styles.settingsHeader}>
          <Globe size={24} className={styles.coreIcon} />
          <div>
            <h3>AI Engine Configuration</h3>
            <p>Choose your active provider and countdown before output.</p>
          </div>
        </div>

        <div className={styles.providerGrid}>
          {Object.entries(PROVIDER_METADATA).map(([id, meta]) => {
            const overview = providerOverview?.find((item) => item.id === id);
            return (
              <button
                key={id}
                className={`${styles.providerBtn} ${selectedProvider === id ? styles.providerActive : ''} ${aiConfig?.activeProvider === id ? styles.providerConnected : ''}`}
                onClick={() => handleSelectProvider(id)}
              >
                <div className={styles.providerTopRow}>
                  <span className={styles.providerName}>{meta.name}</span>
                  {meta.recommended && <span className={styles.recommendBadge}>RECOMMENDED</span>}
                </div>
                <span className={`${styles.providerStatusPill} ${styles[overview?.status || 'missing']}`}>
                  {overview?.status || 'missing'}
                </span>
              </button>
            );
          })}
        </div>

        <div className={styles.keyManagement}>
          <div className={styles.keyInputGroup}>
            <div className={styles.keyHeader}>
              <label><Key size={14} /> {currentMeta.name} API KEY</label>
              <div className={styles.keyActions}>
                {hasStoredKey && (
                  <button
                    className={styles.getKeyLink}
                    onClick={() => {
                      setPendingClears((prev) => ({
                        ...prev,
                        [selectedProvider]: !prev[selectedProvider],
                      }));
                      setLocalKeys((prev) => ({
                        ...prev,
                        [selectedProvider]: '',
                      }));
                      setDirtyKeys((prev) => ({
                        ...prev,
                        [selectedProvider]: false,
                      }));
                      setSaved(false);
                    }}
                  >
                    {isPendingClear ? 'Undo Clear' : 'Clear Saved Key'}
                  </button>
                )}
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
                placeholder={keyPlaceholder}
                onChange={(e) => {
                  setLocalKeys({ ...localKeys, [selectedProvider]: e.target.value });
                  setDirtyKeys({ ...dirtyKeys, [selectedProvider]: true });
                  setPendingClears({ ...pendingClears, [selectedProvider]: false });
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
              {checking ? <span>Checking...</span> : <span>{localCredits.balance}</span>}
              <div className={`${styles.statusDot} ${styles[localCredits.status]}`}></div>
            </div>
          </div>
        </div>

        <div className={styles.outputConfig}>
          <div className={styles.countdownGroup}>
            <label htmlFor="countdownSeconds">Countdown before output (seconds)</label>
            <input
              id="countdownSeconds"
              type="number"
              min="3"
              max="15"
              value={normalizedCountdown}
              onChange={(e) => {
                const nextValue = Number.parseInt(e.target.value, 10);
                if (Number.isNaN(nextValue)) {
                  setCountdownSeconds(3);
                } else {
                  setCountdownSeconds(Math.min(15, Math.max(3, nextValue)));
                }
                setSaved(false);
              }}
            />
          </div>
        </div>

        <button
          className={`${styles.configSaveBtn} ${saved ? styles.configSaved : ''}`}
          onClick={handleSave}
        >
          {saved ? (
            <><CheckCircle size={14} style={{ marginRight: 6 }} /> SAVED AND ACTIVE</>
          ) : (
            'SAVE SETTINGS'
          )}
        </button>
      </div>
    </div>
  );
}
