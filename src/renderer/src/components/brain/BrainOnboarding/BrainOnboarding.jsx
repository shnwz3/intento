import { useState, useEffect, useCallback } from 'react';
import styles from './BrainOnboarding.module.scss';
import { Menu, ChevronLeft, ChevronDown, Upload, Plus, Save, LayoutGrid } from 'lucide-react';
import useIntentoStore from '../../../store/useIntentoStore';

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
import { AGENTS } from '../AgentRegistry';

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
    const [activeAgentId, setActiveAgentId] = useState('no_agent');
    const [showVoiceSettings, setShowVoiceSettings] = useState(false);
    
    // Global Status from Store
    const { setGlobalStatus, clearGlobalStatus } = useIntentoStore();

    const [isLoading, setIsLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [brainToDelete, setBrainToDelete] = useState(null);
    const [newBrainName, setNewBrainName] = useState('');
    const [isRenaming, setIsRenaming] = useState(false);
    const [renameValue, setRenameValue] = useState('');
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [aiConfig, setAiConfig] = useState(null);
    const [apiCredits, setApiCredits] = useState({ balance: '', status: 'loading' });
    const [providerOverview, setProviderOverview] = useState([]);
    const [isAddingHeading, setIsAddingHeading] = useState(false);
    const [newHeadingLabel, setNewHeadingLabel] = useState('');
    const [persistenceIssue, setPersistenceIssue] = useState('');

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
                setActiveAgentId(data.activeAgentId || 'no_agent');
                setPersistenceIssue(data.persistenceIssue || '');

                // Auto-open Voice & Style only if this brain's persona traits have values
                let hasTraits = false;
                const pHead = (data.headings || []).find(h => h.section === 'personality');
                if (pHead) {
                    const traitLabels = ['Communication Tone', 'Personality Traits', 'Reply Style'];
                    hasTraits = (data.tags || []).some(
                        t => t.headingId === pHead.id && traitLabels.includes(t.label) && t.value && t.value.trim() !== ''
                    );
                }
                setShowVoiceSettings(hasTraits);
            } else {
                setActiveBrain(null);
                setTags([]);
                setHeadings([]);
                setActiveAgentId('no_agent');
                setRenameValue('');
            }
        } catch (error) {
            console.error('Failed to load brain data:', error);
            setGlobalStatus('error', 'System Sync Error', 'Could not retrieve brain profiles.');
        }
        setIsLoading(false);
    }, []);

    const loadAIConfig = useCallback(async () => {
        try {
            const [config, overview] = await Promise.all([
                window.intentoAPI.getAIConfig(),
                window.intentoAPI.getProviderOverview(),
            ]);
            setAiConfig(config);
            setProviderOverview(overview || []);
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

        // Sync state when backend broadcasts updates
        const cleanupBrainUpdate = window.intentoAPI.onBrainUpdate((status) => {
            if (status.activeAgentId) {
                setActiveAgentId(status.activeAgentId);
            }
        });

        return () => {
            cleanupBrainUpdate?.();
        };
    }, [loadBrainData, loadAIConfig]);


    // --- Brain Management --- 

    const handleCreateBrain = async () => {
        if (!newBrainName.trim()) return;
        const result = await window.intentoAPI.brainCreate(newBrainName);
        if (result.success) {
            setNewBrainName('');
            setShowAddModal(false);
            loadBrainData();
            setGlobalStatus('success', 'Brain Initialized', `Module "${newBrainName}" is ready.`);
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
        setGlobalStatus('deleting', 'Decommissioning Brain...', `Removing "${brainToDelete.name}" from neural network.`);
        const result = await window.intentoAPI.brainDeleteProfile(brainToDelete.id);
        if (result.success) {
            loadBrainData();
            setBrainToDelete(null);
            setGlobalStatus('success', 'Brain Decommissioned', `Module "${brainToDelete.name}" was removed.`);
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
             setGlobalStatus('success', 'Data Saved', `Path "${label}" mapped successfully.`);
        }
    };

    const handleUpdateTag = async (id, updates) => {
        const result = await window.intentoAPI.brainUpdateTag(id, updates);
        if (result.success) {
            setTags(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
            setGlobalStatus('success', 'Data Updated', 'Changes synchronized.');
        }
    };

    const handleDeleteTag = async (id) => {
        const result = await window.intentoAPI.brainDeleteTag(id);
        if (result.success) {
            setTags(prev => prev.filter(t => t.id !== id));
            setGlobalStatus('success', 'Tag Removed', 'Synaptic path deleted.');
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

    const handleSwitchAgent = async (agentId) => {
        const res = await window.intentoAPI.brainSetActiveAgent(agentId);
        if (res.success) {
            setActiveAgentId(agentId);
            setGlobalStatus('success', 'Agent Activated', `${AGENTS.find(a => a.id === agentId)?.name} is now online.`);
        }
    };

    // --- AI Extraction ---
    const handleDocUpload = async () => {
        try {
            setGlobalStatus('uploading', 'Initializing Link...', 'Accessing document buffers.');
            const uploadRes = await window.intentoAPI.brainUploadDoc();
            
            if (uploadRes.success) {
                setGlobalStatus('analyzing', 'Extracting Insights...', 'AI is parsing document architecture.');
                let extractRes;
                if (uploadRes.ext === '.pdf') {
                    try {
                        setGlobalStatus('analyzing', 'Vision Analysis...', 'Rendering PDF pages for visual inspection.');
                        const pdfjsLib = await import('pdfjs-dist');
                        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

                        const buffer = await window.intentoAPI.brainReadFileBuffer(uploadRes.filePath);
                        const data = new Uint8Array(buffer);

                        const loadingTask = pdfjsLib.getDocument({ data });
                        const pdf = await loadingTask.promise;
                        
                        const numPages = Math.min(pdf.numPages, 3);
                        const base64Images = [];

                        for (let i = 1; i <= numPages; i++) {
                            const page = await pdf.getPage(i);
                            const viewport = page.getViewport({ scale: 2.0 });
                            
                            const canvas = document.createElement('canvas');
                            const context = canvas.getContext('2d');
                            canvas.height = viewport.height;
                            canvas.width = viewport.width;

                            await page.render({ canvasContext: context, viewport }).promise;
                            base64Images.push(canvas.toDataURL('image/png'));
                        }
                        
                        setGlobalStatus('analyzing', 'Vision Synthesis...', `Synthesizing context from ${numPages} pages.`);
                        extractRes = await window.intentoAPI.brainExtractTagsImages(base64Images);

                    } catch (pdfErr) {
                        console.error('PDF Vision processing failed, falling back to text:', pdfErr);
                        extractRes = await window.intentoAPI.brainExtractTags(uploadRes.text);
                    }
                } else {
                    extractRes = await window.intentoAPI.brainExtractTags(uploadRes.text);
                }
                
                if (extractRes.success) {
                    // Update state with new headings and tags
                    setHeadings(extractRes.headings || headings); 
                    setTags(extractRes.tags || tags); 
                    
                    setGlobalStatus('success', 'Context Synthesized', `Extracted ${extractRes.extracted || 0} intelligence items.`);
                    
                    loadBrainData(); 
                } else {
                    setGlobalStatus('error', 'Synthesis Failed', extractRes.error || 'Unknown extraction error.');
                }
            } else if (uploadRes.error !== 'cancelled') {
                setGlobalStatus('error', 'Upload Interrupted', uploadRes.error || 'Failed to access document.');
            } else {
                clearGlobalStatus();
            }
        } catch (err) {
            console.error('Doc upload failed:', err);
            setGlobalStatus('error', 'System Fault', 'Unexpected error during neural ingestion.');
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
                setActiveTab={setActiveTab}
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
                        {activeTab === 'settings' ? (
                            <div className={styles.headerBranding}>
                                <div className={styles.brandingTop}>SETTINGS</div>
                                <div className={styles.titleGroup}>
                                    <h1>AI Settings</h1>
                                </div>
                                <p className={styles.saveModeNote}>Manage provider keys and output countdown.</p>
                            </div>
                        ) : (
                            <>
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
                                                {activeBrain && (
                                                    <button className={styles.editBtn} onClick={() => setIsRenaming(true)}>
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div className={styles.statusRow}>
                                        <div className={styles.integrityBadge}>System Active</div>
                                    </div>
                                    <p className={styles.saveModeNote}>Changes save instantly to this device.</p>
                                    {persistenceIssue ? <p className={styles.persistenceWarning}>{persistenceIssue}</p> : null}
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
                                </div>
                            </>
                        )}
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
                            providerOverview={providerOverview}
                            onSave={async (payload) => {
                                const saveResult = await window.intentoAPI.saveAIConfig(payload);
                                const nextConfig = saveResult?.config || payload.config;
                                setAiConfig(nextConfig);
                                const overview = await window.intentoAPI.getProviderOverview();
                                setProviderOverview(overview || []);
                                // Reload credits for the new active provider
                                try {
                                    const credits = await window.intentoAPI.getAICredits(nextConfig.activeProvider);
                                    setApiCredits(credits);
                                } catch (e) {
                                    console.error('Failed to load credits:', e);
                                }
                            }}
                            onCheckCredits={async (providerId) => {
                                return await window.intentoAPI.getAICredits(providerId);
                            }}
                        />
                    ) : !activeBrain ? (
                        <div className={styles.neuralLoading} style={{minHeight: '400px', opacity: 0.8}}>
                            <div className={styles.emptyIcon} style={{marginBottom: 20, color: '#3f3f46'}}><LayoutGrid size={48} /></div>
                            <h3>Nexus Offline</h3>
                            <p style={{maxWidth: 300, textAlign: 'center', marginBottom: 24}}>No neural modules detected. Create your first brain to start digitizing context.</p>
                            <button className={styles.nexusActionBtn} onClick={() => setShowAddModal(true)} style={{padding: '12px 24px'}}>
                                <Plus size={16} /> INITIALIZE MODULE
                            </button>
                        </div>
                    ) : (
                        // HEADINGS VIEW (Identity or Personality)
                        <>
                           {activeTab === 'personality' ? (
                                <div className={styles.agentHub}>
                                    <div className={styles.agentGrid}>
                                        {AGENTS.map(agent => (
                                            <div 
                                                key={agent.id} 
                                                className={`${styles.agentCard} ${activeAgentId === agent.id ? styles.agentActive : ''}`}
                                                onClick={() => handleSwitchAgent(agent.id)}
                                            >
                                                <div className={styles.agentIcon}>
                                                    <agent.icon size={24} />
                                                </div>
                                                <div className={styles.agentInfo}>
                                                    <h4>{agent.name}</h4>
                                                    <p>{agent.description}</p>
                                                    <div className={styles.agentSkills}>
                                                        {agent.skills.map(skill => (
                                                            <span key={skill} className={styles.skillBadge}>{skill}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                                {activeAgentId === agent.id && <div className={styles.activeIndicator}>ACTIVE</div>}
                                            </div>
                                        ))}
                                    </div>

                                    <div 
                                        className={styles.personaDivider} 
                                        onClick={() => setShowVoiceSettings(!showVoiceSettings)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <span>Voice & Style</span>
                                        <ChevronDown 
                                            size={14} 
                                            style={{ 
                                                color: '#52525b', 
                                                transition: 'transform 0.3s',
                                                transform: showVoiceSettings ? 'rotate(180deg)' : 'rotate(0)'
                                            }} 
                                        />
                                    </div>

                                    {showVoiceSettings && (
                                        <div className={styles.traitsGrid}>
                                            {['Communication Tone', 'Personality Traits', 'Reply Style'].map(tagName => {
                                                const personaHeading = headings.find(h => h.section === 'personality');
                                                const currentTag = tags.find(t => t.headingId === personaHeading?.id && t.label === tagName);
                                                const currentValue = currentTag?.value || '';

                                                return (
                                                    <div key={tagName} className={styles.traitControl}>
                                                        <label>{tagName}</label>
                                                        <select
                                                            value={currentValue}
                                                            onChange={async (e) => {
                                                                const newVal = e.target.value;
                                                                let pHeading = headings.find(h => h.section === 'personality');
                                                                if (!pHeading) {
                                                                    const res = await window.intentoAPI.brainAddHeading('Persona', 'personality');
                                                                    if (res.success) {
                                                                        setHeadings(prev => [...prev, res.heading]);
                                                                        pHeading = res.heading;
                                                                    } else return;
                                                                }
                                                                
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
                                    )}
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
                                        <div style={{display: 'flex', gap: 8, marginBottom: 16}}>
                                            <button className={styles.nexusActionBtn} onClick={() => setIsAddingHeading(true)}>
                                                <Plus size={14} /> HEADING
                                            </button>
                                            <button className={styles.nexusActionBtn} onClick={handleDocUpload}>
                                                <Upload size={14} /> PDF
                                            </button>
                                        </div>
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
                                                <p>No personal info yet. Start by adding headings or upload a PDF.</p>
                                                <div style={{display: 'flex', gap: 12, marginTop: 12}}>
                                                    <button className={styles.addTagBtn} onClick={() => setIsAddingHeading(true)}>
                                                        <Plus size={16} /> Add Heading
                                                    </button>
                                                    <button className={styles.addTagBtn} onClick={handleDocUpload}>
                                                        <Upload size={16} /> Upload PDF
                                                    </button>
                                                </div>
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
