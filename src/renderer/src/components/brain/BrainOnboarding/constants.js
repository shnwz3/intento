import {
    ShieldCheck,
    Sparkles
} from 'lucide-react';

export const TABS = [
    { id: 'identity', label: 'Personal Info', icon: ShieldCheck },
    { id: 'personality', label: 'Persona', icon: Sparkles }
];

export const PROVIDER_METADATA = {
    grok: { name: 'GROK', url: 'https://console.groq.com/keys', recommended: true },
    openai: { name: 'OPENAI', url: 'https://platform.openai.com/api-keys' },
    gemini: { name: 'GEMINI', url: 'https://aistudio.google.com/app/apikey' },
    anthropic: { name: 'ANTHROPIC', url: 'https://console.anthropic.com/settings/keys' },
    openrouter: { name: 'OPENROUTER', url: 'https://openrouter.ai/settings/keys' }
};

export const OUTPUT_MODE_OPTIONS = [
    {
        id: 'type',
        label: 'Auto Type',
        description: 'Intento types characters directly into the active app.',
    },
    {
        id: 'paste',
        label: 'Paste',
        description: 'Intento pastes the full response at once with Ctrl+V.',
    },
    {
        id: 'clipboard_only',
        label: 'Clipboard Only',
        description: 'Intento copies the result and lets you paste it manually.',
    },
];

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
