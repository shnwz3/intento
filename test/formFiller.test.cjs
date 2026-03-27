const assert = require('node:assert/strict');
const path = require('node:path');

const { loadWithMocks } = require('./helpers/loadWithMocks.cjs');

function loadFormFillerService(promptOverrides = {}) {
    return loadWithMocks(path.join(__dirname, '..', 'src', 'main', 'services', 'formfill', 'FormFillerService.js'), {
        '../../prompts/PromptService': {
            getFormScenePrompt: () => 'scene-prompt',
            getFormFillPrompt: (fields) => fields.map((field) => field.label).join(' | '),
            getFormChoicePrompt: (groups) => groups.map((group) => group.question).join(' | '),
            ...promptOverrides,
        },
    });
}

module.exports = [
    {
        name: 'FormFillerService inspects visible form state and filters to empty fields',
        async run() {
            const FormFillerService = loadFormFillerService();
            const vision = {
                async analyze(_base64, _selection, prompt) {
                    assert.equal(prompt, 'scene-prompt');
                    return {
                        success: true,
                        response: `\`\`\`json
{"fields":[{"label":"Full Name","question":"What is your full name?","type":"text","hasValue":false},{"label":"Email","question":"Email address","type":"email","hasValue":true}],"submitVisible":true,"submitLabel":"Submit"}
\`\`\``,
                    };
                },
            };

            const service = new FormFillerService(vision, {
                hasContext: () => true,
                getContext: () => '[brain]',
            });

            const result = await service.inspectFormState('image-data', { minimumFields: 1 });

            assert.equal(result.isForm, true);
            assert.equal(result.fields.length, 1);
            assert.equal(result.fields[0].label, 'Full Name');
            assert.equal(result.fields[0].question, 'What is your full name?');
            assert.equal(result.allFields.length, 2);
            assert.equal(result.submitVisible, true);
            assert.equal(result.submitLabel, 'Submit');
        },
    },
    {
        name: 'FormFillerService repairs malformed numeric JSON and skips unsupported option rows',
        async run() {
            const FormFillerService = loadFormFillerService();
            const vision = {
                async analyze() {
                    return {
                        success: true,
                        response: '{"fields":[{"label":"Rate your proficiency with Git","question":"Rate your proficiency with Git","type":"dropdown","hasValue":false},{"label":"Amazon Web Services (AWS)","question":"Which cloud platforms are you familiar with?","type":"other","hasValue":false},{"label":"Project summary","question":"Please provide a brief summary of a recent project","type":"textarea","hasValue":false}],"submitVisible":false,"submitLabel":null}',
                    };
                },
            };

            const service = new FormFillerService(vision, {
                hasContext: () => true,
                getContext: () => '[brain]',
            });

            const result = await service.inspectFormState('image-data', { minimumFields: 1 });

            assert.equal(result.isForm, true);
            assert.equal(result.allFields.length, 3);
            assert.equal(result.fields.length, 2);
            assert.deepEqual(
                result.fields.map((field) => field.label),
                ['Rate your proficiency with Git', 'Project summary']
            );
            assert.equal(result.fields[1].question, 'Please provide a brief summary of a recent project');
        },
    },
    {
        name: 'FormFillerService uses Brain data directly and only sends unresolved question fields to AI',
        async run() {
            const FormFillerService = loadFormFillerService();
            const prompts = [];
            const vision = {
                async analyzeTextOnly(prompt) {
                    prompts.push(prompt);
                    return {
                        success: true,
                        response: '["I recently led a full-stack project that improved reliability and deployment speed."]',
                    };
                },
            };

            const service = new FormFillerService(vision, {
                hasContext: () => true,
                getContext: () => '[brain]',
                getFilledProfileEntries: () => [
                    { label: 'Email', value: 'feroz@example.com', heading: 'Identity' },
                ],
                getProfileText: () => 'Experienced with AWS, React, and Node.js.',
            });

            const plans = await service.generateFillValues([
                { label: 'Email Address', question: 'What is your email address?', type: 'email', options: [] },
                { label: 'Amazon Web Services (AWS)', question: 'Which cloud platforms are you familiar with?', type: 'checkbox', options: [] },
                { label: 'Project Summary', question: 'Please provide a brief summary of a recent project', type: 'textarea', options: [] },
            ]);

            assert.equal(prompts.length, 1);
            assert.equal(prompts[0].includes('Email Address'), false);
            assert.equal(prompts[0].includes('Amazon Web Services'), false);
            assert.equal(prompts[0].includes('Project Summary'), true);

            assert.equal(plans[0].strategy, 'text');
            assert.equal(plans[0].value, 'feroz@example.com');
            assert.equal(plans[1].strategy, 'checkbox');
            assert.equal(plans[1].shouldSelect, true);
            assert.equal(plans[2].strategy, 'text');
            assert.equal(plans[2].value.includes('full-stack project'), true);
        },
    },
    {
        name: 'FormFillerService falls back to AI for unresolved text, date, and dropdown fields',
        async run() {
            const FormFillerService = loadFormFillerService({
                getFormFillPrompt: (fields) => fields.map((field) => field.question || field.label).join(' | '),
            });
            const prompts = [];
            const vision = {
                async analyzeTextOnly(prompt) {
                    prompts.push(prompt);
                    return {
                        success: true,
                        response: '["15-04-2026","180000","Node.js"]',
                    };
                },
            };

            const service = new FormFillerService(vision, {
                hasContext: () => true,
                getContext: () => '[brain]',
                getFilledProfileEntries: () => [],
                getProfileText: () => 'Experienced with backend APIs, modern web apps, and deployment workflows.',
            });

            const plans = await service.generateFillValues([
                { label: 'dd-mm-yyyy', question: 'What is your preferred start date?', type: 'date', options: [] },
                { label: 'Expected Annual Salary (in local currency)', question: 'Expected Annual Salary (in local currency)', type: 'number', options: [] },
                { label: 'Choose', question: 'What is your primary back-end programming language/framework?', type: 'dropdown', options: [] },
            ]);

            assert.equal(prompts.length, 1);
            assert.equal(plans[0].strategy, 'text');
            assert.equal(plans[0].value, '15-04-2026');
            assert.equal(plans[0].inputMode, 'type');
            assert.equal(plans[1].strategy, 'text');
            assert.equal(plans[1].value, '180000');
            assert.equal(plans[2].strategy, 'dropdown');
            assert.equal(plans[2].value, 'Node.js');
        },
    },
    {
        name: 'FormFillerService uses AI to choose checkbox options when Brain match is ambiguous',
        async run() {
            const FormFillerService = loadFormFillerService();
            const prompts = [];
            const vision = {
                async analyzeTextOnly(prompt) {
                    prompts.push(prompt);
                    return {
                        success: true,
                        response: '[["Amazon Web Services (AWS)"]]',
                    };
                },
            };

            const service = new FormFillerService(vision, {
                hasContext: () => true,
                getContext: () => '[brain]',
                getFilledProfileEntries: () => [],
                getProfileText: () => 'Built deployment pipelines and cloud infrastructure for production web apps.',
            });

            const plans = await service.generateFillValues([
                { label: 'Amazon Web Services (AWS)', question: 'Which cloud platforms (if any) are you familiar with for deployment?', type: 'checkbox', options: [] },
                { label: 'Microsoft Azure', question: 'Which cloud platforms (if any) are you familiar with for deployment?', type: 'checkbox', options: [] },
            ]);

            assert.equal(prompts.length, 1);
            assert.equal(plans[0].strategy, 'checkbox');
            assert.equal(plans[0].shouldSelect, true);
            assert.equal(plans[0].source, 'ai');
            assert.equal(plans[1].shouldSelect, false);
        },
    },
    {
        name: 'FormFillerService summarizes visible fields for form autofill preflight',
        run() {
            const FormFillerService = loadFormFillerService();
            const service = new FormFillerService({}, {
                getFilledProfileEntries: () => [
                    { label: 'Email', value: 'feroz@example.com', heading: 'Identity' },
                ],
                getProfileText: () => 'Experienced with AWS and Node.js.',
                getContext: () => '[brain]',
            });

            const result = service.planVisibleFields([
                { label: 'Email Address', question: 'What is your email address?', type: 'email', options: [] },
                { label: 'Amazon Web Services (AWS)', question: 'Which cloud platforms are you familiar with?', type: 'checkbox', options: [] },
                { label: 'Project Summary', question: 'Please provide a brief summary of a recent project', type: 'textarea', options: [] },
                { label: 'Favorite Color', question: 'Favorite Color', type: 'text', options: [] },
            ]);

            assert.equal(result.summary.totalCount, 4);
            assert.equal(result.summary.directCount, 2);
            assert.equal(result.summary.aiCount, 1);
            assert.equal(result.summary.reviewCount, 1);
            assert.equal(result.summary.typeCounts.email, 1);
            assert.equal(result.summary.typeCounts.checkbox, 1);
            assert.equal(result.summary.typeCounts.textarea, 1);
            assert.equal(result.summary.typeCounts.text, 1);
        },
    },
    {
        name: 'FormFillerService normalizes Google Forms style controls from generic detections',
        async run() {
            const FormFillerService = loadFormFillerService();
            const vision = {
                async analyze() {
                    return {
                        success: true,
                        response: '{"fields":[{"label":"Choose","question":"What is your primary back-end programming language/framework?","type":"other","hasValue":false},{"label":"React","question":"Which front-end framework/library are you most proficient in?","type":"other","hasValue":false},{"label":"dd-mm-yyyy","question":"What is your preferred start date?","type":"other","hasValue":false},{"label":"PostgreSQL","question":"Select all database technologies you have experience with:","type":"other","hasValue":false}],"submitVisible":false,"submitLabel":null}',
                    };
                },
            };

            const service = new FormFillerService(vision, {
                hasContext: () => true,
                getContext: () => '[brain]',
            });

            const result = await service.inspectFormState('image-data', { minimumFields: 1 });

            assert.deepEqual(
                result.fields.map((field) => field.type),
                ['dropdown', 'radio', 'date', 'checkbox']
            );
        },
    },
];
