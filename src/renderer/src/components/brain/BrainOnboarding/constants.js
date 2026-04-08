import {
    ShieldCheck,
    Sparkles
} from 'lucide-react';

export const TABS = [
    { id: 'identity', label: 'Personal Info', icon: ShieldCheck },
    { id: 'personality', label: 'Persona', icon: Sparkles }
];

export const PROVIDER_METADATA = {
    grok: { name: 'Groq', url: 'https://console.groq.com/keys', recommended: true },
    openai: { name: 'OpenAI', url: 'https://platform.openai.com/api-keys' },
    gemini: { name: 'Gemini', url: 'https://aistudio.google.com/app/apikey' },
    anthropic: { name: 'Anthropic', url: 'https://console.anthropic.com/settings/keys' },
    openrouter: { name: 'OpenRouter', url: 'https://openrouter.ai/settings/keys' }
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
