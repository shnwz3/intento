import { Edit3, ChevronDown } from 'lucide-react';
import styles from '../BrainOnboarding.module.scss';
import { TAG_OPTIONS } from '../constants';

export default function TagGrid({ 
  filteredTags, 
  editingTag, 
  setEditingTag, 
  setTags, 
  CATEGORY_LABELS, 
  CATEGORY_ICONS, 
  handleResetCategory 
}) {
  const handleTagChange = (id, value) => {
    setTags(prev => prev.map(t => t.id === id ? {...t, value} : t));
    // For dropdowns, we blur immediately after selection
    if (TAG_OPTIONS[value]) return; 
  };

  return (
    <div className={styles.tagsPanel}>
      {Object.keys(CATEGORY_LABELS).map(cat => {
          const catTags = filteredTags.filter(t => t.category === cat);
          if (catTags.length === 0) return null;
          const Icon = CATEGORY_ICONS[cat];
          return (
            <div key={cat} className={styles.nexusCategory}>
              <div className={styles.catHeader}>
                <div className={styles.catTitleGroup}>
                  {Icon && <Icon size={14} className={styles.catIcon} />}
                  <h3>{CATEGORY_LABELS[cat]}</h3>
                </div>
                {cat === 'behavior' && (
                  <button className={styles.resetBtn} onClick={() => handleResetCategory(cat)}>Reset</button>
                )}
              </div>
              <div className={styles.nexusTagGrid}>
                {catTags.map(tag => {
                  const hasOptions = TAG_OPTIONS[tag.label];
                  
                  return (
                    <div key={tag.id} className={styles.nexusTagCard}>
                      <label>{tag.label}</label>
                      
                      {editingTag === tag.id ? (
                        hasOptions ? (
                          <div className={styles.selectWrapper}>
                            <select
                              autoFocus
                              value={tag.value}
                              onChange={(e) => {
                                handleTagChange(tag.id, e.target.value);
                                setEditingTag(null);
                              }}
                              onBlur={() => setEditingTag(null)}
                              className={styles.tagSelect}
                              defaultOpen={true}
                            >
                              <option value="" disabled>Select {tag.label}...</option>
                              {hasOptions.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                            <ChevronDown size={14} className={styles.selectArrow} />
                          </div>
                        ) : (
                          <input 
                            autoFocus 
                            value={tag.value} 
                            onChange={(e) => handleTagChange(tag.id, e.target.value)}
                            onBlur={() => setEditingTag(null)}
                            onKeyDown={e => e.key === 'Enter' && setEditingTag(null)}
                          />
                        )
                      ) : (
                        <div 
                          className={`${styles.valDisplay} ${!tag.value ? styles.empty : ''}`} 
                          onClick={() => setEditingTag(tag.id)}
                        >
                          {tag.value || <span>Empty Pathway</span>}
                          <Edit3 size={12} className={styles.editIcon} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
      })}
    </div>
  );
}
