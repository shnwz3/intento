import { useState, useEffect } from 'react';
import {
  CheckCircle,
  Clipboard,
  ExternalLink,
  Eye,
  EyeOff,
  Globe,
  Keyboard,
  Key,
  MousePointerClick,
  Wallet,
} from 'lucide-react';
import styles from '../BrainOnboarding.module.scss';
import { OUTPUT_MODE_OPTIONS, PROVIDER_METADATA } from '../constants';

export default function AIEngineConfig({
  aiConfig,
  apiCredits,
  providerOverview,
  onSave,
  onCheckCredits,
}) {
  const [selectedProvider, setSelectedProvider] = useState(aiConfig?.activeProvider || 'grok');
  const [localKeys, setLocalKeys] = useState(aiConfig?.keys || {});
  const [typingMode, setTypingMode] = useState(aiConfig?.typing?.mode || 'type');
  const [countdownSeconds, setCountdownSeconds] = useState(aiConfig?.typing?.countdownSeconds || 5);
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [checking, setChecking] = useState(false);
  const [localCredits, setLocalCredits] = useState(apiCredits);

  useEffect(() => {
    if (aiConfig) {
      setSelectedProvider(aiConfig.activeProvider);
      setLocalKeys(aiConfig.keys || {});
      setTypingMode(aiConfig.typing?.mode || 'type');
      setCountdownSeconds(aiConfig.typing?.countdownSeconds || 5);
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
    const configToSave = {
      ...aiConfig,
      activeProvider: selectedProvider,
      keys: localKeys,
      typing: {
        mode: typingMode,
        countdownSeconds: Number.isFinite(countdownSeconds) ? countdownSeconds : 5,
      },
    };
    await onSave(configToSave);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const currentMeta = PROVIDER_METADATA[selectedProvider] || {};
  const currentOverview = providerOverview?.find((item) => item.id === selectedProvider);
  const configuredCount = providerOverview?.filter((item) => item.hasKey).length || 0;

  return (
    <div className={styles.settingsZone}>
      <div className={styles.settingsCard}>
        <div className={styles.settingsHeader}>
          <Globe size={24} className={styles.coreIcon} />
          <div>
            <h3>AI Engine Configuration</h3>
            <p>Choose your active provider and how Intento outputs text.</p>
          </div>
        </div>

        <div className={styles.settingsSummary}>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>Active Provider</span>
            <strong>{currentMeta.name || selectedProvider.toUpperCase()}</strong>
            <small>{currentOverview?.hasKey ? 'Key configured' : 'Key missing'}</small>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>Output Mode</span>
            <strong>{OUTPUT_MODE_OPTIONS.find((option) => option.id === typingMode)?.label || 'Auto Type'}</strong>
            <small>{countdownSeconds}s countdown before output</small>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>Configured Providers</span>
            <strong>{configuredCount}</strong>
            <small>{configuredCount > 1 ? 'Fallback choices available' : 'No fallback yet'}</small>
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
                <span>{meta.name}</span>
                {meta.recommended && <span className={styles.recommendBadge}>RECOMMENDED</span>}
                <span className={`${styles.providerStatusPill} ${styles[overview?.status || 'missing']}`}>
                  {overview?.status || 'missing'}
                </span>
                {aiConfig?.activeProvider === id && aiConfig?.keys[id] && (
                  <span className={styles.activeDot}></span>
                )}
              </button>
            );
          })}
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
              {checking ? <span>Checking...</span> : <span>{localCredits.balance}</span>}
              <div className={`${styles.statusDot} ${styles[localCredits.status]}`}></div>
            </div>
          </div>
        </div>

        <div className={styles.outputConfig}>
          <div className={styles.outputHeader}>
            <Keyboard size={18} />
            <div>
              <h4>Output Behavior</h4>
              <p>Choose whether Intento types, pastes, or only prepares the clipboard.</p>
            </div>
          </div>

          <div className={styles.outputModeGrid}>
            {OUTPUT_MODE_OPTIONS.map((option) => {
              const Icon = option.id === 'type'
                ? Keyboard
                : option.id === 'paste'
                  ? MousePointerClick
                  : Clipboard;

              return (
                <button
                  key={option.id}
                  type="button"
                  className={`${styles.outputModeCard} ${typingMode === option.id ? styles.outputModeActive : ''}`}
                  onClick={() => {
                    setTypingMode(option.id);
                    setSaved(false);
                  }}
                >
                  <Icon size={18} />
                  <strong>{option.label}</strong>
                  <span>{option.description}</span>
                </button>
              );
            })}
          </div>

          <div className={styles.countdownGroup}>
            <label htmlFor="countdownSeconds">Countdown before output</label>
            <input
              id="countdownSeconds"
              type="number"
              min="0"
              max="15"
              value={countdownSeconds}
              onChange={(e) => {
                const nextValue = Number.parseInt(e.target.value, 10);
                setCountdownSeconds(Number.isNaN(nextValue) ? 0 : nextValue);
                setSaved(false);
              }}
            />
            <small>Used by the main overlay before Intento writes anything into the active app.</small>
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
