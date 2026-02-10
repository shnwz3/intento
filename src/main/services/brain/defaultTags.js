/**
 * Refined Default Brain Tags — focus on behavior, professional context, and essential personal info.
 */
const DEFAULT_TAGS = [
    // === Personal Identity (Essential) ===
    {
        id: 'default_name',
        label: 'Full Name',
        value: '',
        category: 'personal',
        placeholder: 'e.g. Feroz Rahil'
    },
    {
        id: 'default_phone',
        label: 'Phone Number',
        value: '',
        category: 'personal',
        placeholder: 'e.g. +1 234 567 8900'
    },
    {
        id: 'default_email',
        label: 'Email Address',
        value: '',
        category: 'personal',
        placeholder: 'e.g. contact@example.com'
    },

    // === Work & Professional Context ===
    {
        id: 'default_role',
        label: 'Current Role',
        value: '',
        category: 'work',
        placeholder: 'e.g. Software Engineer, Product Manager'
    },
    {
        id: 'default_company',
        label: 'Company',
        value: '',
        category: 'work',
        placeholder: 'e.g. Tech Corp'
    },
    {
        id: 'default_skills',
        label: 'Key Skills',
        value: '',
        category: 'work',
        placeholder: 'e.g. React, Python, Sales'
    },
    {
        id: 'default_industry',
        label: 'Industry',
        value: '',
        category: 'work',
        placeholder: 'e.g. Tech, Finance, Healthcare'
    },

    // === Behavior & Personality ===
    {
        id: 'default_tone',
        label: 'Communication Tone',
        value: '',
        category: 'behavior',
        placeholder: 'Select a tone...',
        options: ['Professional', 'Casual', 'Friendly', 'Formal', 'Sarcastic', 'Empathetic', 'Optimistic']
    },
    {
        id: 'default_personality',
        label: 'Personality Traits',
        value: '',
        category: 'behavior',
        placeholder: 'Select traits...',
        options: ['Analytical', 'Creative', 'Direct', 'Patient', 'Energetic', 'Humorous', 'Reserved']
    },
    {
        id: 'default_reply_style',
        label: 'Reply Style',
        value: '',
        category: 'behavior',
        placeholder: 'Select a style...',
        options: ['Concise', 'Detailed', 'Bullet points', 'Question-driven', 'Uses emojis', 'Story-telling']
    },
    {
        id: 'default_bio',
        label: 'Professional Bio',
        value: '',
        category: 'context',
        placeholder: 'One sentence about your work focus'
    },
];

module.exports = { DEFAULT_TAGS };
