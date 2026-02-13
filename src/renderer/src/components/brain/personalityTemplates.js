import { Briefcase, Coffee, Target, Palette } from 'lucide-react';

export const PERSONALITY_TEMPLATES = [
    {
        id: 'elite_executive',
        name: 'Elite Executive',
        description: 'Professional, high-IQ, and results-oriented.',
        icon: Briefcase,
        tags: {
            default_tone: 'Professional',
            default_personality: 'Analytical',
            default_reply_style: 'Concise'
        }
    },
    {
        id: 'warm_assistant',
        name: 'Warm Assistant',
        description: 'Friendly, empathetic, and helpful.',
        icon: Coffee,
        tags: {
            default_tone: 'Friendly',
            default_personality: 'Patient',
            default_reply_style: 'Detailed'
        }
    },
    {
        id: 'direct_expert',
        name: 'Direct Expert',
        description: 'Straight to the point, authoritative.',
        icon: Target,
        tags: {
            default_tone: 'Formal',
            default_personality: 'Direct',
            default_reply_style: 'Concise'
        }
    },
    {
        id: 'creative_collab',
        name: 'Creative Partner',
        description: 'Casual, imaginative, and energetic.',
        icon: Palette,
        tags: {
            default_tone: 'Casual',
            default_personality: 'Creative',
            default_reply_style: 'Bullet points'
        }
    }
];
