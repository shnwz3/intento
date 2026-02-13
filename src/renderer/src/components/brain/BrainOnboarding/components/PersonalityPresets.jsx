import styles from '../BrainOnboarding.module.scss';

export default function PersonalityPresets({ 
  PERSONALITY_TEMPLATES, 
  applyTemplate 
}) {
  return (
    <div className={styles.templatesPanel}>
      <div className={styles.panelHeader}>
        <h3>PERSONA PRESETS</h3>
        <span>Quick-train your assistant</span>
      </div>
      <div className={styles.templateScroll}>
        {PERSONALITY_TEMPLATES.map(t => (
          <button key={t.id} className={styles.nexusTemplateCard} onClick={() => applyTemplate(t)}>
            <span className={styles.tempIcon}>{t.icon && <t.icon size={24} />}</span>
            <div className={styles.tempLabels}>
              <span className={styles.tempName}>{t.name}</span>
              <span className={styles.tempDesc}>{t.description}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
