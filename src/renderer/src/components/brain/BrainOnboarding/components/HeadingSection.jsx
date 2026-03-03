import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MoreVertical, GripVertical, Plus, Trash2, Edit2, X, Check } from 'lucide-react';
import styles from '../BrainOnboarding.module.scss';

export function HeadingSection({ 
    heading, 
    tags, 
    onAddTag, 
    onEditTag, 
    onDeleteTag, 
    onDeleteHeading, 
    onUpdateHeading 
}) {
    const {
        setNodeRef,
        attributes,
        listeners,
        transform,
        transition,
    } = useSortable({
        id: heading.id,
        data: {
            type: 'Heading',
            embeddingId: heading.id,
        },
    });

    const [isEditing, setIsEditing] = React.useState(false);
    const [editValue, setEditValue] = React.useState(heading.label);
    const [isAddingTag, setIsAddingTag] = React.useState(false);
    const [newTagLabel, setNewTagLabel] = React.useState('');
    const [newTagValue, setNewTagValue] = React.useState('');

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const handleSaveHeading = () => {
        if (editValue.trim()) {
            onUpdateHeading(heading.id, editValue);
            setIsEditing(false);
        }
    };
    
    const handleSaveNewTag = () => {
        if (newTagLabel.trim()) {
            onAddTag(heading.id, { label: newTagLabel, value: newTagValue });
            setNewTagLabel('');
            setNewTagValue('');
            setIsAddingTag(false);
        }
    };

    return (
        <div ref={setNodeRef} style={style} className={styles.headingSection}>
            <div className={styles.headingHeader}>
                <div className={styles.headingTitleRow}>
                     {/* Drag Handle for Heading if we want to reorder headings later */}
                    {/* <div {...attributes} {...listeners} className={styles.dragHandle}>
                        <GripVertical size={16} />
                    </div> */}
                    
                    {isEditing ? (
                        <div className={styles.editHeadingInput}>
                            <input 
                                value={editValue} 
                                onChange={(e) => setEditValue(e.target.value)} 
                                autoFocus
                                onKeyDown={(e) => e.key === 'Enter' && handleSaveHeading()}
                            />
                            <button onClick={handleSaveHeading}><Check size={14} /></button>
                            <button onClick={() => setIsEditing(false)}><X size={14} /></button>
                        </div>
                    ) : (
                        <h3>{heading.label}</h3>
                    )}
                </div>

                <div className={styles.headingActions}>
                    <button onClick={() => setIsEditing(true)} title="Edit Heading">
                        <Edit2 size={14} />
                    </button>
                    <button onClick={() => onDeleteHeading(heading.id)} title="Delete Heading" className={styles.deleteBtn}>
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>

            <div className={styles.tagsContainer}>
                {tags.map((tag) => (
                    <SortableTag 
                        key={tag.id} 
                        tag={tag} 
                        onEdit={onEditTag} 
                        onDelete={onDeleteTag} 
                    />
                ))}
                
                {/* Add Tag Inline Form */}
                {isAddingTag ? (
                    <div className={styles.addTagForm}>
                         <input 
                            placeholder="Data Label" 
                            className={styles.tagLabelInput}
                            value={newTagLabel}
                            onChange={(e) => setNewTagLabel(e.target.value)}
                            autoFocus
                        />
                        <textarea 
                            placeholder="Value..." 
                            className={styles.tagValueInput}
                            value={newTagValue}
                            onChange={(e) => setNewTagValue(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && e.ctrlKey) handleSaveNewTag();
                            }}
                        />
                        <div className={styles.addTagActions}>
                            <button onClick={handleSaveNewTag} className={styles.confirmBtn}><Check size={14} /></button>
                            <button onClick={() => setIsAddingTag(false)} className={styles.cancelBtn}><X size={14} /></button>
                        </div>
                    </div>
                ) : (
                    <button className={styles.addTagBtn} onClick={() => setIsAddingTag(true)}>
                        <Plus size={14} /> Add Tag
                    </button>
                )}
            </div>
        </div>
    );
}

function SortableTag({ tag, onEdit, onDelete }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({
        id: tag.id,
        data: {
            type: 'Tag',
            tag: tag,
        }
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    const [isEditing, setIsEditing] = React.useState(false);
    const [editValue, setEditValue] = React.useState(tag.value);
    const [editLabel, setEditLabel] = React.useState(tag.label);

    const handleSave = () => {
        onEdit(tag.id, { label: editLabel, value: editValue });
        setIsEditing(false);
    };

    if (isEditing) {
        return (
            <div className={styles.tagCardEditing}>
                 <div className={styles.tagEditHeader}>
                    <input 
                        value={editLabel} 
                        onChange={(e) => setEditLabel(e.target.value)} 
                        className={styles.editLabelInput}
                    />
                    <div className={styles.editActions}>
                         <button onClick={handleSave}><Check size={14}/></button>
                         <button onClick={() => setIsEditing(false)}><X size={14}/></button>
                    </div>
                 </div>
                 <textarea 
                    value={editValue} 
                    onChange={(e) => setEditValue(e.target.value)}
                    className={styles.editValueInput}
                 />
            </div>
        );
    }

    return (
        <div ref={setNodeRef} style={style} className={styles.tagCard} {...attributes}>
            <div className={styles.tagHeader}>
                <div className={styles.tagLabel} {...listeners} style={{cursor: 'grab'}}>
                    <GripVertical size={12} className={styles.dragHandleIcon} />
                    <span>{tag.label}</span>
                </div>
                <div className={styles.tagActions}>
                     <button onClick={() => setIsEditing(true)}><Edit2 size={12} /></button>
                     <button onClick={() => onDelete(tag.id)} className={styles.deleteTagBtn}><X size={12} /></button>
                </div>
            </div>
            <div className={styles.tagValue} onClick={() => setIsEditing(true)}>
                {tag.value || <span className={styles.placeholder}>Empty</span>}
            </div>
        </div>
    );
}
