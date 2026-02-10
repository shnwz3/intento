import { useState, useEffect, useCallback } from 'react';
import styles from './BrainOnboarding.module.scss';
import { ShieldCheck, Upload, Sparkles, Plus, X, Save, Trash2, Edit3, ChevronDown, Check } from 'lucide-react';

const CATEGORY_LABELS = {
  personal: '👤 Personal Identity',
  behavior: '🎭 Behavior & Personality',
  work: '💼 Work & Professional',
  context: '🧠 AI Context',
  extracted: '📄 Additional Info',
  custom: '✏️ Custom Tags',
};

/**
 * BrainOnboarding - Supports multiple memory profiles (Brains).
 * Initially shows ONLY upload and privacy notice if no brains have context.
 * Allows switching between brains, renaming, and deleting.
 */
export default function BrainOnboarding() {
  const [brains, setBrains] = useState([]);
  const [activeBrain, setActiveBrain] = useState(null);
  const [tags, setTags] = useState([]);
  const [hasUploaded, setHasUploaded] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [newTag, setNewTag] = useState({ label: '', value: '' });
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Multi-Brain UI State
  const [showBrainList, setShowBrainList] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [tempBrainName, setTempBrainName] = useState('');

  // Load all brains and initial context
  const loadBrains = useCallback(async () => {
    const list = await window.intentoAPI.brainList();
    setBrains(list);
    const active = list.find(b => b.isActive);
    setActiveBrain(active);
    
    const tagResult = await window.intentoAPI.brainGetTags();
    setTags(tagResult.tags);
    
    // Check if current brain has any filled context
    const filled = tagResult.tags.some(t => t.value && t.value.trim());
    if (filled) {
      setHasUploaded(true);
    } else {
      setHasUploaded(false);
    }
  }, []);

  useEffect(() => {
    loadBrains();
  }, [loadBrains]);

  // Group tags by category
  const groupedTags = tags.reduce((acc, tag) => {
    const cat = tag.category || 'custom';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(tag);
    return acc;
  }, {});

  // Switching Brains
  const handleSwitchBrain = async (id) => {
    await window.intentoAPI.brainSetActive(id);
    setShowBrainList(false);
    loadBrains();
    setStatus(`Switched to ${brains.find(b => b.id === id).name}`);
  };

  const handleCreateBrain = async () => {
    const name = `Brain ${brains.length + 1}`;
    const result = await window.intentoAPI.brainCreate(name);
    if (result.success) {
      loadBrains();
      setStatus(`Created ${name}`);
      setShowBrainList(false);
    }
  };

  const handleDeleteBrain = async (e, id) => {
    e.stopPropagation();
    if (brains.length <= 1) {
      setStatus('⚠️ Cannot delete the only brain profile');
      return;
    }
    const result = await window.intentoAPI.brainDeleteProfile(id);
    if (result.success) {
      loadBrains();
      setStatus('Brain deleted');
    } else {
      setStatus(`❌ ${result.error}`);
    }
  };

  const startRenaming = () => {
    setTempBrainName(activeBrain.name);
    setIsRenaming(true);
  };

  const handleRename = async () => {
    if (!tempBrainName.trim()) return;
    const result = await window.intentoAPI.brainRenameProfile(activeBrain.id, tempBrainName);
    if (result.success) {
      setIsRenaming(false);
      loadBrains();
      setStatus('Brain renamed');
    }
  };

  // Upload document and extract tags
  const handleUpload = useCallback(async () => {
    setIsUploading(true);
    setStatus('Opening file picker...');

    const uploadResult = await window.intentoAPI.brainUploadDoc();
    if (!uploadResult.success) {
      setIsUploading(false);
      setStatus(uploadResult.error === 'cancelled' ? '' : 'Upload failed');
      return;
    }

    setStatus(`Uploaded ${uploadResult.fileName}. AI is analyzing...`);
    setIsUploading(false);
    setIsExtracting(true);

    const extractResult = await window.intentoAPI.brainExtractTags(uploadResult.text);

    if (extractResult.success) {
      setTags(extractResult.tags);
      setHasUploaded(true);
      setStatus(`✅ AI analysis complete for ${activeBrain?.name}!`);
    } else {
      setStatus('❌ ' + extractResult.error);
    }
    setIsExtracting(false);
  }, [activeBrain]);

  const handleEditTag = (id, newValue) => {
    setTags((prev) => prev.map((t) => (t.id === id ? { ...t, value: newValue } : t)));
  };

  const handleDeleteTag = (id) => {
    setTags((prev) => prev.filter((t) => t.id !== id));
  };

  const handleAddTag = () => {
    if (!newTag.label.trim() || !newTag.value.trim()) return;
    const tag = { id: Date.now().toString(), label: newTag.label, value: newTag.value, category: 'custom' };
    setTags((prev) => [...prev, tag]);
    setNewTag({ label: '', value: '' });
    setShowAddForm(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    const result = await window.intentoAPI.brainSaveTags(tags);
    if (result.success) {
      setStatus(`✅ [${activeBrain?.name}] saved locally.`);
    }
    setIsSaving(false);
  };

  const filledCount = tags.filter((t) => t.value && t.value.trim()).length;

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.iconContainer}>
            <Sparkles className={styles.sparkleIcon} />
          </div>
          <h1 className={styles.title}>Memory Setup</h1>
          <p className={styles.subtitle}>
            Manage multiple "Brains" for different professional contexts.
          </p>
        </div>

        {/* Multi-Brain Selector */}
        <div className={styles.brainSelector}>
           <div className={styles.activeBrainContainer} onClick={() => setShowBrainList(!showBrainList)}>
              {isRenaming ? (
                <div className={styles.renameWrapper} onClick={e => e.stopPropagation()}>
                   <input 
                     value={tempBrainName} 
                     onChange={e => setTempBrainName(e.target.value)}
                     onKeyDown={e => e.key === 'Enter' && handleRename()}
                     autoFocus
                   />
                   <button className={styles.confirmRename} onClick={handleRename}><Check size={14} /></button>
                </div>
              ) : (
                <div className={styles.activeBrainName}>
                  <BrainIcon size={18} className={styles.brainBrandIcon} />
                  <span>{activeBrain?.name || 'Loading Brain...'}</span>
                  <ChevronDown size={14} className={showBrainList ? styles.rotated : ''} />
                </div>
              )}
              
              {!isRenaming && (
                <button className={styles.renameBtn} onClick={(e) => { e.stopPropagation(); startRenaming(); }} title="Rename Brain">
                  <Edit3 size={14} />
                </button>
              )}
           </div>

           {showBrainList && (
             <div className={styles.brainDropdown}>
               {brains.map(b => (
                 <div 
                   key={b.id} 
                   className={`${styles.brainItem} ${b.isActive ? styles.activeItem : ''}`}
                   onClick={() => handleSwitchBrain(b.id)}
                 >
                   <div className={styles.brainItemInfo}>
                      <span className={styles.brainItemName}>{b.name}</span>
                      <span className={styles.brainItemTags}>{b.filledCount} tags</span>
                   </div>
                   {brains.length > 1 && (
                     <button className={styles.deleteBrainBtn} onClick={(e) => handleDeleteBrain(e, b.id)} title="Delete Brain">
                       <Trash2 size={12} />
                     </button>
                   )}
                 </div>
               ))}
               <button className={styles.createBrainBtn} onClick={handleCreateBrain}>
                 <Plus size={14} /> New Brain Profile
               </button>
             </div>
           )}
        </div>

        {/* Upload Section - Primary Action */}
        {!hasUploaded && !isExtracting && (
          <div className={styles.uploadSection}>
            <button
               className={styles.uploadBtnLarge}
               onClick={handleUpload}
               disabled={isUploading}
            >
              <Upload size={24} />
              <span>Upload Info for "{activeBrain?.name}"</span>
            </button>
            <div className={styles.privacyNotice}>
              <ShieldCheck size={16} className={styles.shieldIcon} />
              <p>
                Intento does <strong>not</strong> save your data to the cloud. 
                Each Brain profile stays strictly on your machine.
              </p>
            </div>
          </div>
        )}

        {isExtracting && (
          <div className={styles.loadingSection}>
            <div className={styles.spinnerLarge} />
            <p>Training "{activeBrain?.name}" with your document...</p>
          </div>
        )}

        {/* Tags UI - Only visible after upload or if existing */}
        {hasUploaded && !isExtracting && (
          <div className={styles.tagsContainer}>
            <div className={styles.topActions}>
               <div className={styles.progressInfo}>
                 <span className={styles.filledText}>{filledCount}/{tags.length} Memory Points</span>
                 <div className={styles.miniProgress}>
                   <div className={styles.miniFill} style={{ width: `${tags.length ? (filledCount / tags.length) * 100 : 0}%` }} />
                 </div>
               </div>
               <button className={styles.reUploadBtn} onClick={handleUpload}>
                  <Upload size={14} /> Update Doc
               </button>
            </div>

            {status && <p className={styles.statusLine}>{status}</p>}

            <div className={styles.scrollArea}>
              {Object.entries(CATEGORY_LABELS).map(([category, label]) => {
                const catTags = groupedTags[category];
                if (!catTags || catTags.length === 0) return null;

                return (
                  <div key={category} className={styles.categoryBlock}>
                    <h3 className={styles.categoryTitle}>{label}</h3>
                    <div className={styles.tagGrid}>
                      {catTags.map((tag) => (
                        <div key={tag.id} className={`${styles.tagCard} ${!tag.value ? styles.tagEmpty : ''}`}>
                          <div className={styles.tagInfo}>
                            <label className={styles.tagLabel}>{tag.label}</label>
                            {editingId === tag.id ? (
                              tag.options ? (
                                <select
                                  className={styles.tagSelect}
                                  value={tag.value}
                                  onChange={(e) => {
                                    handleEditTag(tag.id, e.target.value);
                                    setEditingId(null);
                                  }}
                                  onBlur={() => setEditingId(null)}
                                  autoFocus
                                >
                                  <option value="" disabled>Select...</option>
                                  {tag.options.map(opt => (
                                    <option key={opt} value={opt}>{opt}</option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  className={styles.tagInput}
                                  value={tag.value}
                                  onChange={(e) => handleEditTag(tag.id, e.target.value)}
                                  onBlur={() => setEditingId(null)}
                                  autoFocus
                                />
                              )
                            ) : (
                              <div className={styles.tagValue} onClick={() => setEditingId(tag.id)}>
                                {tag.value || <span className={styles.placeholderText}>{tag.placeholder || 'Click to fill...'}</span>}
                              </div>
                            )}
                          </div>
                          <button className={styles.tagAction} onClick={() => handleDeleteTag(tag.id)}>
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className={styles.footerActions}>
              <button className={styles.addBtn} onClick={() => setShowAddForm(true)}>
                <Plus size={16} /> Add Tag
              </button>
              <button 
                className={styles.saveBtnLarge} 
                onClick={handleSave}
                disabled={isSaving}
              >
                <Save size={18} />
                {isSaving ? 'Storing...' : `Update [${activeBrain?.name}]`}
              </button>
            </div>

            {showAddForm && (
              <div className={styles.modalOverlay}>
                <div className={styles.addModal}>
                  <h3>New Memory Point for {activeBrain?.name}</h3>
                  <input 
                    placeholder="Label" 
                    value={newTag.label}
                    onChange={e => setNewTag({...newTag, label: e.target.value})}
                  />
                  <input 
                    placeholder="Value" 
                    value={newTag.value}
                    onChange={e => setNewTag({...newTag, value: e.target.value})}
                  />
                  <div className={styles.modalBtns}>
                    <button onClick={() => setShowAddForm(false)}>Cancel</button>
                    <button className={styles.confirmBtn} onClick={handleAddTag}>Add Tag</button>
                  </div>
                </div>
              </div>
            )}

            <div className={styles.privacyFooter}>
              <ShieldCheck size={12} />
              <span>Everything stays on your disk. Switch brains to change context.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Simple Brain Icon for the brand
function BrainIcon({ size, className }) {
  return (
    <svg 
      width={size} height={size} 
      viewBox="0 0 24 24" fill="none" 
      stroke="currentColor" strokeWidth="2" 
      strokeLinecap="round" strokeLinejoin="round" 
      className={className}
    >
      <path d="M9.5 2A5 5 0 0 1 12 7v5" />
      <path d="M12 12v5a5 5 0 0 1-2.5 5" />
      <path d="M12 12H7a5 5 0 0 1-5-2.5" />
      <path d="M17 12h5a5 5 0 0 1 2.5 5" />
      <path d="M12 12V7a5 5 0 0 1 5-5" />
      <path d="M12 12v5a5 5 0 0 1 2.5 5" />
      <path d="M12 12H7a5 5 0 0 0-5 2.5" />
      <path d="M17 12h5a5 5 0 0 0 2.5-5" />
    </svg>
  );
}
