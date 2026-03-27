const OPEN_ENDED_PATTERNS = [
    'describe',
    'tell us',
    'summary',
    'why ',
    'how ',
    'please provide',
    'please share',
    'what makes',
    'what interests',
    'cover letter',
    'motivation',
    'achievement',
    'challenge',
    'project',
    'explain',
];

const TRUE_WORDS = new Set(['yes', 'true', 'y', '1']);
const FALSE_WORDS = new Set(['no', 'false', 'n', '0']);
const BOOLEAN_FIELD_ALIASES = [
    {
        patterns: ['authorized to work', 'work authorization', 'legally authorized', 'work permit'],
        aliases: ['work authorization', 'authorized to work', 'legally authorized', 'work permit'],
    },
    {
        patterns: ['sponsorship', 'visa sponsorship', 'require sponsorship'],
        aliases: ['require sponsorship', 'visa sponsorship', 'sponsorship'],
    },
    {
        patterns: ['relocate', 'relocation'],
        aliases: ['willing to relocate', 'relocation'],
    },
    {
        patterns: ['travel'],
        aliases: ['willing to travel', 'travel'],
    },
    {
        patterns: ['available to start', 'start immediately', 'available immediately'],
        aliases: ['available to start', 'available immediately', 'start immediately'],
    },
];
const RELATION_STOP_WORDS = new Set([
    'a', 'an', 'and', 'any', 'are', 'box', 'date', 'day', 'do', 'does', 'for',
    'if', 'in', 'is', 'of', 'on', 'or', 'select', 'the', 'to', 'what', 'which',
    'with', 'would', 'you', 'your',
]);
const MONTH_NAMES = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december',
];
const FRONTEND_TECH_CANDIDATES = [
    'react',
    'angular',
    'vue.js',
    'vue',
    'svelte',
    'vanilla javascript/jquery',
    'javascript',
    'jquery',
];
const BACKEND_TECH_CANDIDATES = [
    'node.js',
    'node',
    'express',
    'nestjs',
    'django',
    'flask',
    'laravel',
    'spring boot',
    'java',
    'python',
    'php',
    'ruby on rails',
    'ruby',
    'asp.net',
    '.net',
    'go',
];

class ProfileValueResolver {
    constructor(profileEntries = [], profileText = '') {
        this.profileEntries = profileEntries;
        this.profileText = this._normalize(profileText);
    }

    static fromBrain(brainService) {
        return new ProfileValueResolver(
            typeof brainService.getFilledProfileEntries === 'function' ? brainService.getFilledProfileEntries() : [],
            typeof brainService.getProfileText === 'function' ? brainService.getProfileText() : brainService.getContext()
        );
    }

    resolve(field) {
        const normalizedFieldText = this._fieldText(field);
        const datePlan = this._resolveDatePlan(field, normalizedFieldText);

        if (datePlan) {
            return {
                ...field,
                ...datePlan,
                source: 'brain',
            };
        }

        if (field.type === 'checkbox') {
            return {
                ...field,
                strategy: 'checkbox',
                shouldSelect: this._shouldSelectOption(field),
                source: 'brain',
            };
        }

        if (field.type === 'radio') {
            return {
                ...field,
                strategy: 'radio',
                shouldSelect: this._shouldSelectOption(field),
                source: 'brain',
            };
        }

        if (field.type === 'dropdown') {
            const dropdownValue = this._resolveDropdownValue(field);
            if (dropdownValue) {
                return { ...field, strategy: 'dropdown', value: dropdownValue, source: 'brain' };
            }
            return { ...field, strategy: 'skip', value: '', source: 'review' };
        }

        const directValue = this._resolveDirectValue(field, normalizedFieldText);
        if (directValue) {
            return { ...field, strategy: 'text', value: directValue, source: 'brain' };
        }

        return this._needsAI(field)
            ? { ...field, strategy: 'ai', source: 'ai' }
            : { ...field, strategy: 'skip', value: '', source: 'review' };
    }

    _resolveDirectValue(field, normalizedFieldText) {
        if (field.type === 'email') {
            return this._getEntryValue(['email', 'email address']);
        }

        if (field.type === 'phone') {
            return this._getEntryValue(['phone', 'mobile', 'phone number', 'mobile number']);
        }

        if (field.type === 'url') {
            if (normalizedFieldText.includes('linkedin')) {
                return this._getEntryValue(['linkedin', 'linkedin url', 'linkedin profile']);
            }
            if (normalizedFieldText.includes('github')) {
                return this._getEntryValue(['github', 'github url', 'github profile']);
            }
            if (normalizedFieldText.includes('portfolio')) {
                return this._getEntryValue(['portfolio', 'portfolio url', 'website', 'personal website'])
                    || this._getEntryValue(['github', 'github url', 'github profile'])
                    || this._getEntryValue(['linkedin', 'linkedin url', 'linkedin profile']);
            }
            return this._getEntryValue(['website', 'portfolio', 'homepage']);
        }

        if (normalizedFieldText.includes('linkedin')) {
            return this._getEntryValue(['linkedin', 'linkedin url', 'linkedin profile']);
        }

        if (normalizedFieldText.includes('github')) {
            return this._getEntryValue(['github', 'github url', 'github profile']);
        }

        if (normalizedFieldText.includes('portfolio') || normalizedFieldText.includes('website')) {
            return this._getEntryValue(['portfolio', 'portfolio url', 'website', 'personal website', 'homepage'])
                || this._getEntryValue(['github', 'github url', 'github profile'])
                || this._getEntryValue(['linkedin', 'linkedin url', 'linkedin profile']);
        }

        if (normalizedFieldText.includes('front-end')
            && (normalizedFieldText.includes('framework') || normalizedFieldText.includes('library'))) {
            return this._findPreferredTech(FRONTEND_TECH_CANDIDATES);
        }

        if (normalizedFieldText.includes('back-end')
            && (normalizedFieldText.includes('framework') || normalizedFieldText.includes('language'))) {
            return this._findPreferredTech(BACKEND_TECH_CANDIDATES);
        }

        if (normalizedFieldText.includes('first name')) {
            return this._getEntryValue(['first name']) || this._splitFullName().first;
        }

        if (normalizedFieldText.includes('last name')) {
            return this._getEntryValue(['last name']) || this._splitFullName().last;
        }

        if (normalizedFieldText.includes('full name') || /\bname\b/.test(normalizedFieldText)) {
            return this._getEntryValue(['full name', 'name']);
        }

        if (normalizedFieldText.includes('address line 1') || normalizedFieldText.includes('street address')) {
            return this._getEntryValue(['address line 1', 'street address', 'address']);
        }

        if (normalizedFieldText.includes('address line 2')) {
            return this._getEntryValue(['address line 2']);
        }

        if (normalizedFieldText.includes('city')) {
            return this._getEntryValue(['city']);
        }

        if (normalizedFieldText.includes('state') || normalizedFieldText.includes('province')) {
            return this._getEntryValue(['state', 'province', 'region']);
        }

        if (normalizedFieldText.includes('country')) {
            return this._getEntryValue(['country']);
        }

        if (normalizedFieldText.includes('zip') || normalizedFieldText.includes('postal')) {
            return this._getEntryValue(['zip', 'zipcode', 'postal code', 'pin code']);
        }

        if (normalizedFieldText.includes('location')) {
            return this._getEntryValue(['location', 'current location', 'city, state', 'city']);
        }

        if (normalizedFieldText.includes('company') || normalizedFieldText.includes('employer')) {
            return this._getEntryValue(['company', 'employer', 'current company']);
        }

        if (normalizedFieldText.includes('title') || normalizedFieldText.includes('role') || normalizedFieldText.includes('position')) {
            return this._getEntryValue(['job title', 'title', 'role', 'current role', 'position']);
        }

        if (normalizedFieldText.includes('experience')) {
            return this._getEntryValue(['years of experience', 'experience', 'experience years'])
                || this._inferYearsOfExperience();
        }

        if (normalizedFieldText.includes('university') || normalizedFieldText.includes('college')) {
            return this._getEntryValue(['university', 'college', 'school']);
        }

        if (normalizedFieldText.includes('degree')) {
            return this._getEntryValue(['degree', 'education']);
        }

        if (normalizedFieldText.includes('preferred name')) {
            return this._getEntryValue(['preferred name', 'nickname']);
        }

        if (normalizedFieldText.includes('pronoun')) {
            return this._getEntryValue(['pronouns', 'pronoun']);
        }

        if (normalizedFieldText.includes('work authorization')
            || normalizedFieldText.includes('authorized to work')
            || normalizedFieldText.includes('legally authorized')) {
            return this._getEntryValue(['work authorization', 'authorized to work', 'legally authorized', 'work permit']);
        }

        if (normalizedFieldText.includes('sponsorship') || normalizedFieldText.includes('visa sponsorship')) {
            return this._getEntryValue(['require sponsorship', 'visa sponsorship', 'sponsorship']);
        }

        if (normalizedFieldText.includes('citizenship')
            || normalizedFieldText.includes('citizen')
            || normalizedFieldText.includes('nationality')) {
            return this._getEntryValue(['citizenship', 'nationality', 'country of citizenship']);
        }

        if (normalizedFieldText.includes('visa')) {
            return this._getEntryValue(['visa status', 'visa']);
        }

        if (normalizedFieldText.includes('relocate')) {
            return this._getEntryValue(['willing to relocate', 'relocation']);
        }

        if (normalizedFieldText.includes('remote')
            || normalizedFieldText.includes('hybrid')
            || normalizedFieldText.includes('onsite')
            || normalizedFieldText.includes('on site')) {
            return this._getEntryValue(['preferred work arrangement', 'work preference', 'work mode', 'work arrangement']);
        }

        if (normalizedFieldText.includes('notice period') || normalizedFieldText.includes('notice')) {
            return this._getEntryValue(['notice period', 'notice']);
        }

        if (normalizedFieldText.includes('expected salary')
            || normalizedFieldText.includes('salary expectation')
            || normalizedFieldText.includes('desired salary')) {
            return this._getEntryValue(['expected salary', 'salary expectation', 'desired salary']);
        }

        if (normalizedFieldText.includes('current salary') || normalizedFieldText.includes('current ctc')) {
            return this._getEntryValue(['current salary', 'current ctc']);
        }

        if (normalizedFieldText.includes('salary') || normalizedFieldText.includes('compensation')) {
            return this._getEntryValue([
                'expected salary',
                'salary expectation',
                'desired salary',
                'current salary',
                'current ctc',
                'salary',
            ]);
        }

        if (field.type === 'number') {
            return this._getEntryValue([
                'years of experience',
                'experience',
                'notice period',
                'expected salary',
                'salary expectation',
                'current salary',
                'salary',
            ]) || this._inferYearsOfExperience();
        }

        return null;
    }

    _resolveDropdownValue(field) {
        const directValue = this._resolveDirectValue(field, this._fieldText(field));
        const options = Array.isArray(field.options) ? field.options : [];

        if (options.length === 0) {
            return directValue;
        }

        if (directValue) {
            const matchedOption = this._findMatchingOption(options, directValue);
            if (matchedOption) return matchedOption;
        }

        const booleanAnswer = this._resolveBooleanAnswer(field.question || field.label);
        if (booleanAnswer !== null) {
            const yesOption = this._findMatchingOption(options, booleanAnswer ? 'yes' : 'no');
            if (yesOption) return yesOption;
        }

        const questionEntryMatch = this._findMatchingOptionFromEntries(options, field.question || field.label);
        if (questionEntryMatch) {
            return questionEntryMatch;
        }

        for (const option of options) {
            if (this._profileMentions(option)) {
                return option;
            }
        }

        return null;
    }

    _resolveDatePlan(field, normalizedFieldText) {
        if (!this._isDateField(field, normalizedFieldText)) {
            return null;
        }

        const dateValue = this._resolveDateValue(field, normalizedFieldText);
        if (!dateValue) {
            return { strategy: 'skip', value: '' };
        }

        return {
            strategy: 'text',
            value: dateValue,
            inputMode: 'type',
        };
    }

    _resolveDateValue(field, normalizedFieldText) {
        const source = this._getDateSourceForField(normalizedFieldText);

        if (!source) return null;

        const parts = this._parseDateParts(source);
        if (!parts) return null;

        if (field.type === 'day') {
            return String(parts.day).padStart(2, '0');
        }

        if (field.type === 'month') {
            if (Array.isArray(field.options) && field.options.length > 0) {
                const monthName = MONTH_NAMES[parts.month - 1];
                return this._findMatchingOption(field.options, monthName) || String(parts.month).padStart(2, '0');
            }
            return String(parts.month).padStart(2, '0');
        }

        if (field.type === 'year') {
            return String(parts.year);
        }

        if (this._looksLikeMonthField(normalizedFieldText)) {
            if (Array.isArray(field.options) && field.options.length > 0) {
                return this._findMatchingOption(field.options, MONTH_NAMES[parts.month - 1])
                    || String(parts.month).padStart(2, '0');
            }
            return String(parts.month).padStart(2, '0');
        }

        if (this._looksLikeDayField(normalizedFieldText)) {
            return String(parts.day).padStart(2, '0');
        }

        if (this._looksLikeYearField(normalizedFieldText)) {
            return String(parts.year);
        }

        if (normalizedFieldText.includes('dd-mm-yyyy')) {
            return `${String(parts.day).padStart(2, '0')}-${String(parts.month).padStart(2, '0')}-${parts.year}`;
        }

        if (normalizedFieldText.includes('mm-dd-yyyy')) {
            return `${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}-${parts.year}`;
        }

        if (normalizedFieldText.includes('yyyy-mm-dd')) {
            return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
        }

        return `${String(parts.month).padStart(2, '0')}/${String(parts.day).padStart(2, '0')}/${parts.year}`;
    }

    _shouldSelectOption(field) {
        const structuredAnswer = this._resolveStructuredChoiceAnswer(field.question || field.label, field.label);
        if (structuredAnswer !== null) {
            return structuredAnswer;
        }

        const booleanAnswer = this._resolveBooleanAnswer(field.question || field.label);
        const optionText = this._normalize(field.label);

        if (booleanAnswer !== null) {
            if (optionText === 'yes') return booleanAnswer;
            if (optionText === 'no') return !booleanAnswer;
        }

        return this._profileMentions(field.label);
    }

    _needsAI(field) {
        const text = this._fieldText(field);
        if (field.type === 'textarea') return true;
        return OPEN_ENDED_PATTERNS.some((pattern) => text.includes(pattern));
    }

    _resolveBooleanAnswer(question) {
        const normalizedQuestion = this._normalize(question);
        for (const entry of this.profileEntries) {
            const label = this._normalize(entry.label);
            const value = this._normalize(entry.value);
            if (!value) continue;

            const matchesQuestion = normalizedQuestion.includes(label) || label.includes(normalizedQuestion);
            if (!matchesQuestion) continue;

            const parsedValue = this._parseBooleanValue(value);
            if (parsedValue !== null) return parsedValue;
        }

        return this._resolveBooleanAliasAnswer(normalizedQuestion);
    }

    _getEntryValue(aliases) {
        for (const alias of aliases) {
            const normalizedAlias = this._normalize(alias);
            const match = this.profileEntries.find((entry) => {
                const label = this._normalize(entry.label);
                return label === normalizedAlias
                    || label.includes(normalizedAlias)
                    || normalizedAlias.includes(label);
            });

            if (match?.value) {
                return match.value;
            }
        }

        return null;
    }

    _findMatchingOptionFromEntries(options, question) {
        const relatedEntries = this._getRelatedEntries(question);
        if (relatedEntries.length === 0) {
            return null;
        }

        for (const entry of relatedEntries) {
            const directOption = this._findMatchingOption(options, entry.value);
            if (directOption) {
                return directOption;
            }

            const mentionedOption = options.find((option) => this._textMentionsOption(entry.value, option));
            if (mentionedOption) {
                return mentionedOption;
            }
        }

        return null;
    }

    _resolveStructuredChoiceAnswer(question, optionLabel) {
        const relatedEntries = this._getRelatedEntries(question);
        if (relatedEntries.length === 0) {
            return this._resolveScaleChoiceAnswer(question, optionLabel);
        }

        const optionMatched = relatedEntries.some((entry) => this._textMentionsOption(entry.value, optionLabel));
        if (optionMatched) {
            return true;
        }

        const scaleAnswer = this._resolveScaleChoiceAnswer(question, optionLabel);
        if (scaleAnswer !== null) {
            return scaleAnswer;
        }

        return false;
    }

    _findMatchingOption(options, target) {
        const normalizedTarget = this._normalize(target);
        return options.find((option) => {
            const normalizedOption = this._normalize(option);
            return normalizedOption === normalizedTarget
                || normalizedOption.includes(normalizedTarget)
                || normalizedTarget.includes(normalizedOption);
        }) || null;
    }

    _textMentionsOption(text, optionLabel) {
        const normalizedText = this._normalize(text);
        const normalizedOption = this._normalize(optionLabel);
        if (!normalizedText || !normalizedOption) {
            return false;
        }

        if (normalizedText.includes(normalizedOption) || normalizedOption.includes(normalizedText)) {
            return true;
        }

        for (const acronym of this._extractAcronyms(optionLabel)) {
            if (normalizedText.includes(acronym)) {
                return true;
            }
        }

        return false;
    }

    _profileMentions(value) {
        return this._textMentionsOption(this.profileText, value);
    }

    _splitFullName() {
        const fullName = this._getEntryValue(['full name', 'name']);
        if (!fullName) {
            return { first: null, last: null };
        }

        const parts = fullName.trim().split(/\s+/);
        return {
            first: parts[0] || null,
            last: parts.length > 1 ? parts[parts.length - 1] : null,
        };
    }

    _parseDateParts(value) {
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) {
            return {
                year: parsed.getFullYear(),
                month: parsed.getMonth() + 1,
                day: parsed.getDate(),
            };
        }

        const match = String(value).match(/(\d{1,4})[\/\-](\d{1,2})[\/\-](\d{1,4})/);
        if (!match) return null;

        const [first, second, third] = match.slice(1).map((part) => Number(part));
        if (String(match[1]).length === 4) {
            return { year: first, month: second, day: third };
        }

        return { day: first, month: second, year: third };
    }

    _getDateSourceForField(normalizedFieldText) {
        if (normalizedFieldText.includes('birth') || normalizedFieldText.includes('dob') || normalizedFieldText.includes('birthday')) {
            return this._getEntryValue(['date of birth', 'dob', 'birth date', 'birthday']);
        }

        if (normalizedFieldText.includes('availability') || normalizedFieldText.includes('start date') || normalizedFieldText.includes('available to start')) {
            return this._getEntryValue(['availability date', 'start date']);
        }

        return this._getEntryValue([
            'date of birth',
            'dob',
            'birth date',
            'birthday',
            'availability date',
            'start date',
        ]);
    }

    _isDateField(field, normalizedFieldText) {
        if (['date', 'day', 'month', 'year'].includes(field.type)) {
            return true;
        }

        if (field.type === 'checkbox' || field.type === 'radio') {
            return false;
        }

        if (normalizedFieldText.includes('date of birth')
            || normalizedFieldText.includes('birth date')
            || normalizedFieldText.includes('birthday')
            || normalizedFieldText.includes('dob')
            || normalizedFieldText.includes('start date')
            || normalizedFieldText.includes('availability date')
            || normalizedFieldText.includes('available to start')) {
            return true;
        }

        return false;
    }

    _looksLikeMonthField(normalizedFieldText) {
        return normalizedFieldText.includes('month');
    }

    _looksLikeDayField(normalizedFieldText) {
        return normalizedFieldText.includes(' day') || normalizedFieldText.startsWith('day ');
    }

    _looksLikeYearField(normalizedFieldText) {
        return normalizedFieldText.includes('year');
    }

    _extractAcronyms(value) {
        return [...String(value || '').matchAll(/\(([A-Za-z0-9+.#-]+)\)/g)]
            .map((match) => match[1].toLowerCase());
    }

    _getRelatedEntries(question) {
        const normalizedQuestion = this._normalize(question);
        if (!normalizedQuestion) {
            return [];
        }

        return this.profileEntries.filter((entry) => this._isRelatedFieldText(normalizedQuestion, entry.label));
    }

    _isRelatedFieldText(question, label) {
        const normalizedLabel = this._normalize(label);
        if (!normalizedLabel) {
            return false;
        }

        if (question.includes(normalizedLabel) || normalizedLabel.includes(question)) {
            return true;
        }

        const questionTokens = this._meaningfulTokens(question);
        const labelTokens = this._meaningfulTokens(normalizedLabel);
        if (questionTokens.length === 0 || labelTokens.length === 0) {
            return false;
        }

        const sharedCount = labelTokens.filter((token) => questionTokens.includes(token)).length;
        return sharedCount >= Math.min(2, labelTokens.length);
    }

    _meaningfulTokens(value) {
        return this._normalize(value)
            .split(' ')
            .filter((token) => token && token.length > 2 && !RELATION_STOP_WORDS.has(token));
    }

    _resolveBooleanAliasAnswer(normalizedQuestion) {
        for (const group of BOOLEAN_FIELD_ALIASES) {
            if (!group.patterns.some((pattern) => normalizedQuestion.includes(pattern))) {
                continue;
            }

            const value = this._getEntryValue(group.aliases);
            const parsedValue = this._parseBooleanValue(value);
            if (parsedValue !== null) {
                return parsedValue;
            }
        }

        return null;
    }

    _parseBooleanValue(value) {
        const normalizedValue = this._normalize(value);
        if (!normalizedValue) {
            return null;
        }

        if (TRUE_WORDS.has(normalizedValue)) return true;
        if (FALSE_WORDS.has(normalizedValue)) return false;
        return null;
    }

    _inferYearsOfExperience() {
        const matches = this.profileText.match(/(\d+)\s*\+?\s*(?:years?|yrs?)/i);
        if (matches) {
            return matches[1];
        }

        return null;
    }

    _findPreferredTech(candidates) {
        for (const candidate of candidates) {
            if (this._profileMentions(candidate)) {
                if (candidate === 'node') {
                    return 'Node.js';
                }

                if (candidate === 'vue') {
                    return 'Vue.js';
                }

                if (candidate === 'javascript') {
                    return 'Vanilla JavaScript/jQuery';
                }

                return candidate;
            }
        }

        return null;
    }

    _resolveScaleChoiceAnswer(question, optionLabel) {
        const normalizedOption = this._normalize(optionLabel);
        if (!/^\d+$/.test(normalizedOption)) {
            return null;
        }

        const normalizedQuestion = this._normalize(question);
        if (!normalizedQuestion.includes('rate')
            && !normalizedQuestion.includes('proficiency')
            && !normalizedQuestion.includes('experience')) {
            return null;
        }

        const matchedSubjectTokens = this._meaningfulTokens(question)
            .flatMap((token) => token.split('/'))
            .filter(Boolean)
            .filter((token) => this.profileText.includes(token));
        if (matchedSubjectTokens.length === 0) {
            return null;
        }

        const years = Number(this._getEntryValue(['years of experience', 'experience', 'experience years']) || 0);
        const targetScore = years > 0
            ? (years >= 6 ? 5 : years >= 3 ? 4 : 3)
            : (matchedSubjectTokens.length >= 2 ? 5 : 4);
        return Number(normalizedOption) === targetScore;
    }

    _fieldText(field) {
        return this._normalize(`${field.label || ''} ${field.question || ''}`);
    }

    _normalize(value) {
        return String(value || '')
            .toLowerCase()
            .replace(/[^a-z0-9+.#/ -]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }
}

module.exports = ProfileValueResolver;
