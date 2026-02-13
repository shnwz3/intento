import {
    User,
    Briefcase,
    Smile,
    Cpu,
    Key,
    Globe,
    ShieldCheck,
    Sparkles,
    Upload
} from 'lucide-react';

export const CATEGORY_LABELS = {
    personal: 'Identity',
    work: 'Profession',
    behavior: 'Persona',
    context: 'Context'
};

export const CATEGORY_ICONS = {
    personal: User,
    work: Briefcase,
    behavior: Smile,
    context: Cpu,
    api: Key,
    model: Globe
};

export const TABS = [
    { id: 'identity', label: 'Identity', icon: ShieldCheck },
    { id: 'personality', label: 'Personality', icon: Sparkles },
    { id: 'sync', label: 'Neural Sync', icon: Upload }
];

export const PROVIDER_METADATA = {
    openai: { name: 'OPENAI', url: 'https://platform.openai.com/api-keys' },
    gemini: { name: 'GEMINI', url: 'https://aistudio.google.com/app/apikey' },
    anthropic: { name: 'ANTHROPIC', url: 'https://console.anthropic.com/settings/keys' },
    grok: { name: 'GROK', url: 'https://console.x.ai/', recommended: true },
    openrouter: { name: 'OPENROUTER', url: 'https://openrouter.ai/settings/keys' }
};

export const TAG_OPTIONS = {
    'Communication Tone': [
        'Professional',
        'Casual',
        'Empathetic',
        'Direct',
        'Humorous',
        'Formal',
        'Enthusiastic',
        'Neutral'
    ],
    'Personality Traits': [
        'Helpful',
        'Analytical',
        'Creative',
        'Witty',
        'Stoic',
        'Friendly',
        'Sarcastic',
        'Patient'
    ],
    'Reply Style': [
        'Concise',
        'Detailed',
        'Bulleted',
        'Conversational',
        'Technical',
        'Simple',
        'Storytelling',
        'Questioning'
    ]
};
