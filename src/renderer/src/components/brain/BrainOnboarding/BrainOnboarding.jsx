import { useState, useEffect, useCallback } from 'react';
import styles from './BrainOnboarding.module.scss';
import { Menu, ChevronLeft, Upload } from 'lucide-react';
import { PERSONALITY_TEMPLATES } from '../personalityTemplates';

// Sub-components
import NeuralSidebar from './components/NeuralSidebar';
import AIEngineConfig from './components/AIEngineConfig';
import TagGrid from './components/TagGrid';
import PersonalityPresets from './components/PersonalityPresets';
import NexusControls from './components/NexusControls';
import AddBrainModal from './components/AddBrainModal';
import DeleteConfirmModal from './components/DeleteConfirmModal';

// Constants
import { 
  TABS, 
  CATEGORY_LABELS, 
  CATEGORY_ICONS 
} from './constants';

export default function BrainOnboarding() {
  const [brains, setBrains] = useState([]);
  const [activeBrain, setActiveBrain] = useState(null);
  const [tags, setTags] = useState([]);
  const [activeTab, setActiveTab] = useState('identity');
  const [status, setStatus] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [brainToDelete, setBrainToDelete] = useState(null);
  const [newBrainName, setNewBrainName] = useState('');
  const [editingTag, setEditingTag] = useState(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [aiConfig, setAiConfig] = useState(null);
  const [apiCredits, setApiCredits] = useState({ balance: '', status: 'loading' });

  const loadBrains = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await window.intentoAPI.brainList();
      const brainList = result || [];
      setBrains(brainList);
      
      const active = brainList.find(b => b.isActive);
      if (active) {
        setActiveBrain(active);
        const tagsRes = await window.intentoAPI.brainGetTags();
        setTags(tagsRes?.tags || []);
        
        // Prioritize Neural Sync for untrained brains
        if (active.filledCount === 0) {
          setActiveTab('sync');
        }
      }
    } catch (error) {
      console.error('Failed to load brains:', error);
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
    loadBrains();
    loadAIConfig();
  }, [loadBrains, loadAIConfig]);

  const handleCreateBrain = async () => {
    if (!newBrainName.trim()) return;
    const result = await window.intentoAPI.brainCreate(newBrainName);
    if (result.success) {
      setNewBrainName('');
      setShowAddModal(false);
      loadBrains();
      setActiveTab('sync'); // Default to sync for new brains
      setStatus(`Initialized: ${newBrainName}`);
    }
  };

  const handleDocUpload = async () => {
    try {
      setStatus('Reading document...');
      const uploadRes = await window.intentoAPI.brainUploadDoc();
      
      if (uploadRes.success) {
        setStatus('Extracting neural patterns...');
        const extractRes = await window.intentoAPI.brainExtractTags(uploadRes.text);
        
        if (extractRes.success) {
          setTags(extractRes.tags || []);
          setStatus(`Extracted ${extractRes.extracted || 0} patterns!`);
          setTimeout(() => {
            setActiveTab('identity');
            setStatus('');
          }, 2000);
          loadBrains(); // Refresh counts
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

  const handleSwitchBrain = async (id) => {
    await window.intentoAPI.brainSetActive(id);
    loadBrains();
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
      loadBrains();
      setBrainToDelete(null);
      setStatus(`Decommissioned: ${brainToDelete.name}`);
      setTimeout(() => setStatus(''), 3000);
    }
  };

  const handleRename = async () => {
    if (!renameValue.trim() || !activeBrain) return;
    const result = await window.intentoAPI.brainRenameProfile(activeBrain.id, renameValue);
    if (result.success) {
      setIsRenaming(false);
      loadBrains();
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    const result = await window.intentoAPI.brainSaveTags(tags);
    if (result.success) {
      setStatus('Neural state preserved.');
      setTimeout(() => setStatus(''), 3000);
      loadBrains();
    }
    setIsSaving(false);
  };

  const applyTemplate = (template) => {
    setTags(prev => prev.map(tag => {
      if (template.tags[tag.id]) return { ...tag, value: template.tags[tag.id] };
      return tag;
    }));
    setStatus(`Applied "${template.name}" template`);
  };

  const handleResetCategory = (category) => {
    setTags(prev => prev.map(tag => {
      if (tag.category === category) return { ...tag, value: '' };
      return tag;
    }));
  };

  const handleUpdateConfig = async (updates) => {
    const newConfig = { ...aiConfig, ...updates };
    setAiConfig(newConfig);
    const result = await window.intentoAPI.saveAIConfig(newConfig);
    if (result.success) {
        const credits = await window.intentoAPI.getAICredits(newConfig.activeProvider);
        setApiCredits(credits);
    }
  };

  const filteredTags = Array.isArray(tags) ? tags.filter(t => {
    if (activeTab === 'identity') return t.category === 'personal' || t.category === 'work';
    if (activeTab === 'personality') return t.category === 'behavior' || t.category === 'context';
    return false;
  }) : [];

  return (
    <div className={`
      ${styles.nexusContainer} 
      ${!isSidebarOpen ? styles.sidebarClosed : ''} 
      ${activeTab === 'settings' ? styles.settingsActive : ''}
    `}>
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
        {activeTab !== 'settings' && (
          <NexusControls 
            activeBrain={activeBrain}
            isRenaming={isRenaming}
            setIsRenaming={setIsRenaming}
            renameValue={renameValue}
            setRenameValue={setRenameValue}
            handleRename={handleRename}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            TABS={TABS}
            tags={tags}
            isSaving={isSaving}
            handleSave={handleSave}
          />
        )}

        <section className={styles.neuralZone}>
          {isLoading ? (
            <div className={styles.neuralLoading}>
              <div className={styles.syncSpinner}></div>
              <span>Synchronizing Pathways...</span>
            </div>
          ) : activeTab === 'sync' ? (
            <div className={styles.syncZone}>
              <div className={styles.uploadCard}>
                <Upload size={40} className={styles.uploadIcon} />
                <h3>Ingest Knowledge Base</h3>
                <p>Upload PDFs or documents to train this brain on specific facts.</p>
                <button className={styles.nexusActionBtn} onClick={handleDocUpload}>Select Documents</button>
              </div>
            </div>
          ) : activeTab === 'settings' ? (
            <AIEngineConfig 
              aiConfig={aiConfig}
              apiCredits={apiCredits}
              handleUpdateConfig={handleUpdateConfig}
            />
          ) : (
            <div className={styles.trainingGrid}>
              {activeTab === 'personality' && (
                <PersonalityPresets 
                  PERSONALITY_TEMPLATES={PERSONALITY_TEMPLATES}
                  applyTemplate={applyTemplate}
                />
              )}
              <TagGrid 
                filteredTags={filteredTags}
                editingTag={editingTag}
                setEditingTag={setEditingTag}
                setTags={setTags}
                CATEGORY_LABELS={CATEGORY_LABELS}
                CATEGORY_ICONS={CATEGORY_ICONS}
                handleResetCategory={handleResetCategory}
              />
            </div>
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
