import { useState, useEffect, useCallback } from 'react';
import styles from './BrainOnboarding.module.scss';
import { Menu, ChevronLeft, Upload, Plus, Save } from 'lucide-react';

// Drag & Drop
import {
    DndContext,
    DragOverlay,
    closestCorners,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    rectSortingStrategy,
} from '@dnd-kit/sortable';

// Sub-components
import NeuralSidebar from './components/NeuralSidebar';
import AIEngineConfig from './components/AIEngineConfig';
import { HeadingSection } from './components/HeadingSection';
import AddBrainModal from './components/AddBrainModal';
import DeleteConfirmModal from './components/DeleteConfirmModal';

// Constants
import { TABS, TAG_OPTIONS } from './constants';
import { PERSONALITY_TEMPLATES } from '../personalityTemplates';

const dropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: '0.5',
        },
      },
    }),
};

export default function BrainOnboarding() {
    // --- State ---
    const [brains, setBrains] = useState([]);
    const [activeBrain, setActiveBrain] = useState(null);
    const [tags, setTags] = useState([]);
    const [headings, setHeadings] = useState([]);
    const [activeTab, setActiveTab] = useState('identity'); // 'identity', 'personality', 'sync', 'settings'
    const [status, setStatus] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [brainToDelete, setBrainToDelete] = useState(null);
    const [newBrainName, setNewBrainName] = useState('');
    const [isRenaming, setIsRenaming] = useState(false);
    const [renameValue, setRenameValue] = useState('');
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [aiConfig, setAiConfig] = useState(null);
    const [apiCredits, setApiCredits] = useState({ balance: '', status: 'loading' });
    const [isAddingHeading, setIsAddingHeading] = useState(false);
    const [newHeadingLabel, setNewHeadingLabel] = useState('');

    // Dnd Sensors
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );
    const [activeDragId, setActiveDragId] = useState(null);

    // --- Loading Data ---

    const loadBrainData = useCallback(async () => {
        setIsLoading(true);
        try {
            // 1. List Brains
            const brainList = await window.intentoAPI.brainList();
            setBrains(brainList || []);

            const active = brainList.find(b => b.isActive);
            if (active) {
                setActiveBrain(active);
                setRenameValue(active.name);

                // 2. Get Tags & Headings
                const data = await window.intentoAPI.brainGetTags();
                setTags(data.tags || []);
                setHeadings(data.headings || []);
            }
        } catch (error) {
            console.error('Failed to load brain data:', error);
            setStatus('System Sync Error');
        }
        setIsLoading(false);
    }, []);

    const loadAIConfig = useCallback(async () => {
        try {
            const config = await window.intentoAPI.getAIConfig();
            setAiConfig(config);
            if (config.activeProvider) {
                const credits = await window.intentoAPI.getAICredits(config.activeProvider);
                setApiCredits(credits);
            }
        } catch (e) {
            console.error('Failed to load AI config:', e);
        }
    }, []);

    useEffect(() => {
        loadBrainData();
        loadAIConfig();
    }, [loadBrainData, loadAIConfig]);


    // --- Brain Management --- 

    const handleCreateBrain = async () => {
        if (!newBrainName.trim()) return;
        const result = await window.intentoAPI.brainCreate(newBrainName);
        if (result.success) {
            setNewBrainName('');
            setShowAddModal(false);
            loadBrainData();
            setStatus(`Initialized: ${newBrainName}`);
        }
    };

    const handleSwitchBrain = async (id) => {
        await window.intentoAPI.brainSetActive(id);
        loadBrainData();
    };

    const handleDeleteBrain = async (id, e) => {
        e.stopPropagation();
        const brain = brains.find(b => b.id === id);
        if (brain) setBrainToDelete(brain);
    };

    const confirmDelete = async () => {
        if (!brainToDelete) return;
        const result = await window.intentoAPI.brainDeleteProfile(brainToDelete.id);
        if (result.success) {
            loadBrainData();
            setBrainToDelete(null);
            setStatus(`Decommissioned: ${brainToDelete.name}`);
        }
    };

    const handleRename = async () => {
        if (!renameValue.trim() || !activeBrain) return;
        const result = await window.intentoAPI.brainRenameProfile(activeBrain.id, renameValue);
        if (result.success) {
            setIsRenaming(false);
            loadBrainData();
        }
    };

    // --- Heading CRUD ---

    const handleAddHeading = async () => {
        if (!newHeadingLabel.trim()) return;
        // Pass activeTab as section
        const section = activeTab === 'sync' ? 'identity' : activeTab; 
        const result = await window.intentoAPI.brainAddHeading(newHeadingLabel, section);
        if (result.success) {
            setHeadings(prev => [...prev, result.heading]);
            setNewHeadingLabel('');
            setIsAddingHeading(false);
        }
    };

    const handleUpdateHeading = async (id, label) => {
        const result = await window.intentoAPI.brainUpdateHeading(id, label);
        if (result.success) {
            setHeadings(prev => prev.map(h => h.id === id ? { ...h, label } : h));
        }
    };

    const handleDeleteHeading = async (id) => {
        if (confirm('Delete this heading and all its tags?')) {
            const result = await window.intentoAPI.brainDeleteHeading(id);
            if (result.success) {
                setHeadings(prev => prev.filter(h => h.id !== id));
                setTags(prev => prev.filter(t => t.headingId !== id));
            }
        }
    };

    // --- Tag CRUD ---

    const handleAddTag = async (headingId, { label, value }) => {
        const result = await window.intentoAPI.brainAddTag(headingId, label, value);
        if (result.success) {
             setTags(prev => [...prev, result.tag]);
        }
    };

    const handleUpdateTag = async (id, updates) => {
        const result = await window.intentoAPI.brainUpdateTag(id, updates);
        if (result.success) {
            setTags(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
        }
    };

    const handleDeleteTag = async (id) => {
        const result = await window.intentoAPI.brainDeleteTag(id);
        if (result.success) {
            setTags(prev => prev.filter(t => t.id !== id));
        }
    };

    // --- Search / Filter / Sorting Helpers ---
    
    // Group tags by heading for rendering, BUT keep single source of truth in 'tags'
    const getTagsForHeading = (headingId) => tags.filter(t => t.headingId === headingId);

    // Filter headings by Section (Tab)
    const getHeadingsForTab = () => {
        if (activeTab === 'settings' || activeTab === 'sync') return [];
        return headings.filter(h => {
            // Backward compatibility: if no section, assume identity
            const section = h.section || 'identity';
            return section === activeTab;
        });
    };

    // --- Drag & Drop Handler ---

    const handleDragStart = (event) => {
        setActiveDragId(event.active.id);
    };

    const handleDragEnd = async (event) => {
        const { active, over } = event;
        setActiveDragId(null);

        if (!over) return;
        
        // Find the dragged tag
        const draggedTag = tags.find(t => t.id === active.id);
        if (!draggedTag) return;

        // If dropped over a Heading (container)
        const isOverHeading = headings.some(h => h.id === over.id);
        
        // If dropped over another Tag
        const overTag = tags.find(t => t.id === over.id);

        let newHeadingId = draggedTag.headingId;

        if (isOverHeading) {
            newHeadingId = over.id;
        } else if (overTag) {
            newHeadingId = overTag.headingId;
        }

        if (newHeadingId !== draggedTag.headingId) {
            // Move to new heading
            const updatedTag = { ...draggedTag, headingId: newHeadingId };
            
            // Optimistic update
            setTags(prev => prev.map(t => t.id === active.id ? updatedTag : t));
            
            // API call
            await window.intentoAPI.brainUpdateTag(active.id, { headingId: newHeadingId });
        }
    };

    // --- Template Handler ---

    const handleApplyTemplate = async (template) => {
        // 1. Ensure 'Persona' heading exists
        let personaHeading = headings.find(h => h.section === 'personality' && (h.label === 'Persona' || h.label === 'Personality'));
        
        if (!personaHeading) {
            const res = await window.intentoAPI.brainAddHeading('Persona', 'personality');
            if (res.success) {
                setHeadings(prev => [...prev, res.heading]);
                personaHeading = res.heading;
            } else {
                return; // Failed
            }
        }

        // 2. Add tags from template
        const newTags = [];
        // Map template tags to labels expected by TAG_OPTIONS
        const mapping = {
            'default_tone': 'Communication Tone',
            'default_personality': 'Personality Traits',
            'default_reply_style': 'Reply Style'
        };

        for (const [key, value] of Object.entries(template.tags)) {
            const label = mapping[key];
            if (!label) continue;

            // Check if tag already exists
            const existing = tags.find(t => t.headingId === personaHeading.id && t.label === label);
            if (existing) {
                await window.intentoAPI.brainUpdateTag(existing.id, { value });
                setTags(prev => prev.map(t => t.id === existing.id ? { ...t, value } : t));
            } else {
                const res = await window.intentoAPI.brainAddTag(personaHeading.id, label, value);
                if (res.success) {
                    setTags(prev => [...prev, res.tag]);
                }
            }
        }
    };

    // --- AI Extraction ---
    const handleDocUpload = async () => {
        try {
            setStatus('Reading document...');
            const uploadRes = await window.intentoAPI.brainUploadDoc();
            
            if (uploadRes.success) {
                setStatus('AI Analyzing & organizing...');
                const extractRes = await window.intentoAPI.brainExtractTags(uploadRes.text);
                
                if (extractRes.success) {
                    // Update state with new headings and tags
                    setHeadings(extractRes.headings || headings); 
                    setTags(extractRes.tags || tags); // Full refresh usually better but extractRes returns full active state now
                    
                    setStatus(`Extracted ${extractRes.extracted || 0} items!`);
                    setTimeout(() => setStatus(''), 3000);
                    
                    // Force refresh to be safe
                    loadBrainData(); 
                } else {
                    setStatus(`Extraction failed: ${extractRes.error}`);
                }
            } else if (uploadRes.error !== 'cancelled') {
                setStatus(`Upload failed: ${uploadRes.error}`);
            } else {
                setStatus('');
            }
        } catch (err) {
            console.error('Doc upload failed:', err);
            setStatus('Error processing document.');
        }
    };

    // --- Render ---

    return (
        <div className={`${styles.nexusContainer} ${!isSidebarOpen ? styles.sidebarClosed : ''}`}>
             <button className={styles.nexusToggle} onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
                {isSidebarOpen ? <ChevronLeft size={18} /> : <Menu size={20} />}
            </button>

            <NeuralSidebar 
                brains={brains}
                activeTab={activeTab}
                setActiveTab={setActiveTab} // Note: This might need adjustment if we removed tabs
                handleSwitchBrain={handleSwitchBrain}
                handleDeleteBrain={handleDeleteBrain}
                setShowAddModal={setShowAddModal}
                aiConfig={aiConfig}
                apiCredits={apiCredits}
            />

            <main className={styles.commandCenter}>
                {/* Header Control Bar */}
                <div className={styles.nexusControls}>
                    <div className={styles.nexusHeader}>
                         <div className={styles.headerBranding}>
                             <div className={styles.brandingTop}>Intent Memory</div>
                             <div className={styles.titleWithRename}>
                                {isRenaming ? (
                                    <div className={styles.renameWrapper}>
                                        <input 
                                            value={renameValue}
                                            onChange={(e) => setRenameValue(e.target.value)}
                                            autoFocus
                                        />
                                        <button onClick={handleRename}><Save size={18} /></button>
                                    </div>
                                ) : (
                                    <div className={styles.titleGroup}>
                                        <h1>{activeBrain?.name || 'Load Brain...'}</h1>
                                        <button className={styles.editBtn} onClick={() => setIsRenaming(true)}>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                                        </button>
                                    </div>
                                )}
                             </div>
                             {status && <div className={styles.statusRow}>
                                <div className={styles.integrityBadge}>System Active</div>
                                <span className={styles.nexusStatus}>{status}</span>
                             </div>}
                         </div>

                         <div className={styles.controlsRight}>
                             {/* Tabs Navigation */}
                             <div className={styles.tabNav}>
                                {TABS.map(tab => (
                                    <button 
                                        key={tab.id}
                                        className={`${styles.tabBtn} ${activeTab === tab.id ? styles.tabActive : ''}`}
                                        onClick={() => setActiveTab(tab.id)}
                                    >
                                        <tab.icon size={14} />
                                        {tab.label}
                                    </button>
                                ))}
                             </div>
                             
                             {activeTab !== 'settings' && activeTab !== 'sync' && activeTab !== 'personality' && (
                                 <button className={styles.nexusActionBtn} onClick={() => setIsAddingHeading(true)} style={{marginLeft: 12}}>
                                    <Plus size={14} /> HEADING
                                 </button>
                             )}
                         </div>
                    </div>
                </div>

                {/* Main Content Area */}
                <section className={styles.neuralZone}>
                    {isLoading ? (
                        <div className={styles.neuralLoading}>
                            <div className={styles.syncSpinner}></div>
                            <span>Synchronizing Pathways...</span>
                        </div>
                    ) : activeTab === 'settings' ? (
                        <AIEngineConfig 
                            aiConfig={aiConfig}
                            apiCredits={apiCredits}
                            onSave={async (fullConfig) => {
                                setAiConfig(fullConfig);
                                await window.intentoAPI.saveAIConfig(fullConfig);
                                // Reload credits for the new active provider
                                try {
                                    const credits = await window.intentoAPI.getAICredits(fullConfig.activeProvider);
                                    setApiCredits(credits);
                                } catch (e) {
                                    console.error('Failed to load credits:', e);
                                }
                            }}
                            onCheckCredits={async (providerId) => {
                                return await window.intentoAPI.getAICredits(providerId);
                            }}
                        />
                    ) : activeTab === 'sync' ? (
                         // Upload Tab
                         <div className={styles.syncZone}>
                            <div className={styles.uploadCard}>
                                <Upload size={40} className={styles.uploadIcon} />
                                <h3>Ingest New Info</h3>
                                <p>Upload PDFs to automatically extract headings and tags into your Brain.</p>
                                <button className={styles.nexusActionBtn} onClick={handleDocUpload}>Select Document</button>
                            </div>
                        </div>
                    ) : (
                        // HEADINGS VIEW (Identity or Personality)
                        // HEADINGS VIEW (Identity or Personality)
                        <>
                           {activeTab === 'personality' ? (
                                <div className={styles.personaConfigContainer}>
                                    {/* 1. Template Selector */}
                                    <div className={styles.configRow} style={{marginBottom: 24}}>
                                        <label>BASE PERSONA TEMPLATE</label>
                                        <select 
                                            className={styles.templateSelect}
                                            onChange={(e) => {
                                                const tmpl = PERSONALITY_TEMPLATES.find(t => t.id === e.target.value);
                                                if (tmpl) handleApplyTemplate(tmpl);
                                            }}
                                            defaultValue=""
                                        >
                                            <option value="" disabled>Select a base persona...</option>
                                            {PERSONALITY_TEMPLATES.map(t => (
                                                <option key={t.id} value={t.id}>{t.name} — {t.description}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* 2. Distinct Tag Dropdowns */}
                                    {['Communication Tone', 'Personality Traits', 'Reply Style'].map(tagName => {
                                        // Find existing value
                                        const personaHeading = headings.find(h => h.section === 'personality');
                                        const currentTag = tags.find(t => t.headingId === personaHeading?.id && t.label === tagName);
                                        const currentValue = currentTag?.value || '';

                                        return (
                                            <div key={tagName} className={styles.configRow}>
                                                <label>{tagName}</label>
                                                <select
                                                    value={currentValue}
                                                    onChange={async (e) => {
                                                        const newVal = e.target.value;
                                                        // Ensure heading exists
                                                        let pHeading = headings.find(h => h.section === 'personality');
                                                        if (!pHeading) {
                                                            const res = await window.intentoAPI.brainAddHeading('Persona', 'personality');
                                                            if (res.success) {
                                                                setHeadings(prev => [...prev, res.heading]);
                                                                pHeading = res.heading;
                                                            } else return;
                                                        }
                                                        
                                                        // Upsert Tag
                                                        if (currentTag) {
                                                             await window.intentoAPI.brainUpdateTag(currentTag.id, { value: newVal });
                                                             setTags(prev => prev.map(t => t.id === currentTag.id ? { ...t, value: newVal } : t));
                                                        } else {
                                                             const res = await window.intentoAPI.brainAddTag(pHeading.id, tagName, newVal);
                                                             if (res.success) setTags(prev => [...prev, res.tag]);
                                                        }
                                                    }}
                                                >
                                                    <option value="">Select...</option>
                                                    {TAG_OPTIONS[tagName]?.map(opt => (
                                                        <option key={opt} value={opt}>{opt}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        );
                                    })}
                                </div>
                           ) : (
                                // IDENTITY TAB (Generic Drag & Drop)
                                <DndContext 
                                    sensors={sensors}
                                    collisionDetection={closestCorners}
                                    onDragStart={handleDragStart}
                                    onDragEnd={handleDragEnd}
                                >
                                    <div className={styles.headingsContainer}>
                                        {isAddingHeading && (
                                            <div className={styles.headingSection} style={{ borderStyle: 'dashed' }}>
                                                <div className={styles.headingHeader}>
                                                     <div className={styles.editHeadingInput}>
                                                        <input 
                                                            value={newHeadingLabel}
                                                            onChange={(e) => setNewHeadingLabel(e.target.value)}
                                                            placeholder="New Heading Name..."
                                                            autoFocus
                                                            onKeyDown={(e) => e.key === 'Enter' && handleAddHeading()}
                                                        />
                                                        <button onClick={handleAddHeading}><Save size={14} /></button>
                                                        <button onClick={() => setIsAddingHeading(false)}><Menu size={14} style={{transform: 'rotate(45deg)'}} /></button>
                                                     </div>
                                                </div>
                                            </div>
                                        )}

                                        {getHeadingsForTab().length === 0 && !isAddingHeading ? (
                                            <div className={styles.neuralLoading} style={{minHeight: '200px', opacity: 0.5}}>
                                                <p>No headings in this section.</p>
                                                <button className={styles.addTagBtn} onClick={() => setIsAddingHeading(true)}>
                                                    <Plus size={16} /> Add Personal Info Heading
                                                </button>
                                            </div>
                                        ) : (
                                            getHeadingsForTab().map(heading => (
                                                <SortableContext 
                                                    key={heading.id} 
                                                    items={getTagsForHeading(heading.id).map(t => t.id)}
                                                    strategy={rectSortingStrategy}
                                                >
                                                    <HeadingSection 
                                                        heading={heading}
                                                        tags={getTagsForHeading(heading.id)}
                                                        onAddTag={handleAddTag}
                                                        onEditTag={handleUpdateTag}
                                                        onDeleteTag={handleDeleteTag}
                                                        onDeleteHeading={handleDeleteHeading}
                                                        onUpdateHeading={handleUpdateHeading}
                                                        tagOptions={TAG_OPTIONS} 
                                                    />
                                                </SortableContext>
                                            ))
                                        )}
                                    </div>

                                    <DragOverlay dropAnimation={dropAnimation}>
                                        {activeDragId ? (
                                            /* Render a static preview of the tag */
                                            <div className={styles.tagCard} style={{ cursor: 'grabbing', transform: 'scale(1.05)' }}>
                                                <div className={styles.tagHeader}>
                                                    <div className={styles.tagLabel}>
                                                        <span>{tags.find(t => t.id === activeDragId)?.label}</span>
                                                    </div>
                                                </div>
                                                <div className={styles.tagValue}>
                                                    {tags.find(t => t.id === activeDragId)?.value}
                                                </div>
                                            </div>
                                        ) : null}
                                    </DragOverlay>
                                </DndContext>
                           )}
                        </>
                    )}
                </section>
            </main>


            {showAddModal && (
                <AddBrainModal 
                    newBrainName={newBrainName}
                    setNewBrainName={setNewBrainName}
                    handleCreateBrain={handleCreateBrain}
                    setShowAddModal={setShowAddModal}
                />
            )}

            {brainToDelete && (
                <DeleteConfirmModal 
                    brainName={brainToDelete.name}
                    onConfirm={confirmDelete}
                    onCancel={() => setBrainToDelete(null)}
                />
            )}
        </div>
    );
}

