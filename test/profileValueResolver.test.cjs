const assert = require('node:assert/strict');
const path = require('node:path');

const ProfileValueResolver = require(path.join(
    __dirname,
    '..',
    'src',
    'main',
    'services',
    'formfill',
    'ProfileValueResolver.js'
));

module.exports = [
    {
        name: 'ProfileValueResolver maps direct profile values and open-ended questions correctly',
        run() {
            const resolver = new ProfileValueResolver(
                [
                    { label: 'Full Name', value: 'Feroz Rahil', heading: 'Identity' },
                    { label: 'Email', value: 'feroz@example.com', heading: 'Identity' },
                    { label: 'Date of Birth', value: '1998-05-12', heading: 'Identity' },
                    { label: 'Years of Experience', value: '5', heading: 'Profession' },
                    { label: 'Cloud Platforms', value: 'AWS, Vercel', heading: 'Skills' },
                ],
                'Experienced with AWS, Vercel, React, and Node.js.'
            );

            const emailPlan = resolver.resolve({
                label: 'Email Address',
                question: 'What is your email address?',
                type: 'email',
                options: [],
            });
            const checkboxPlan = resolver.resolve({
                label: 'Amazon Web Services (AWS)',
                question: 'Which cloud platforms are you familiar with?',
                type: 'checkbox',
                options: [],
            });
            const radioPlan = resolver.resolve({
                label: 'Vercel',
                question: 'Which cloud platforms are you familiar with?',
                type: 'radio',
                options: [],
            });
            const datePlan = resolver.resolve({
                label: 'Date of Birth',
                question: 'What is your date of birth?',
                type: 'date',
                options: [],
            });
            const monthPlan = resolver.resolve({
                label: 'Birth Month',
                question: 'Month',
                type: 'month',
                options: ['January', 'February', 'March', 'April', 'May'],
            });
            const questionPlan = resolver.resolve({
                label: 'Project Summary',
                question: 'Please provide a brief summary of a challenging project you completed',
                type: 'textarea',
                options: [],
            });

            assert.equal(emailPlan.strategy, 'text');
            assert.equal(emailPlan.value, 'feroz@example.com');
            assert.equal(checkboxPlan.strategy, 'checkbox');
            assert.equal(checkboxPlan.shouldSelect, true);
            assert.equal(radioPlan.strategy, 'radio');
            assert.equal(radioPlan.shouldSelect, true);
            assert.equal(datePlan.strategy, 'text');
            assert.equal(datePlan.value, '05/12/1998');
            assert.equal(datePlan.inputMode, 'type');
            assert.equal(monthPlan.strategy, 'text');
            assert.equal(monthPlan.value, 'May');
            assert.equal(questionPlan.strategy, 'ai');
        },
    },
    {
        name: 'ProfileValueResolver covers common application fields directly from Brain data',
        run() {
            const resolver = new ProfileValueResolver(
                [
                    { label: 'LinkedIn', value: 'https://linkedin.com/in/feroz', heading: 'Identity' },
                    { label: 'GitHub', value: 'https://github.com/feroz', heading: 'Identity' },
                    { label: 'Work Authorization', value: 'Yes', heading: 'Identity' },
                    { label: 'Require Sponsorship', value: 'No', heading: 'Identity' },
                    { label: 'Notice Period', value: '30', heading: 'Profession' },
                    { label: 'Expected Salary', value: '180000', heading: 'Profession' },
                ],
                'Legally authorized to work and open to relocation.'
            );

            const linkedinPlan = resolver.resolve({
                label: 'LinkedIn Profile',
                question: 'Share your LinkedIn profile',
                type: 'text',
                options: [],
            });
            const authorizationPlan = resolver.resolve({
                label: 'Yes',
                question: 'Are you legally authorized to work in the United States?',
                type: 'radio',
                options: [],
            });
            const sponsorshipPlan = resolver.resolve({
                label: 'No',
                question: 'Will you now or in the future require sponsorship?',
                type: 'radio',
                options: [],
            });
            const noticePlan = resolver.resolve({
                label: 'Notice Period',
                question: 'What is your notice period?',
                type: 'number',
                options: [],
            });
            const salaryPlan = resolver.resolve({
                label: 'Expected Salary',
                question: 'What is your expected salary?',
                type: 'text',
                options: [],
            });
            const portfolioPlan = resolver.resolve({
                label: 'Portfolio/Personal Website URL (Highly Recommended)',
                question: 'Portfolio/Personal Website URL (Highly Recommended)',
                type: 'url',
                options: [],
            });

            assert.equal(linkedinPlan.strategy, 'text');
            assert.equal(linkedinPlan.value, 'https://linkedin.com/in/feroz');
            assert.equal(authorizationPlan.strategy, 'radio');
            assert.equal(authorizationPlan.shouldSelect, true);
            assert.equal(sponsorshipPlan.strategy, 'radio');
            assert.equal(sponsorshipPlan.shouldSelect, true);
            assert.equal(noticePlan.strategy, 'text');
            assert.equal(noticePlan.value, '30');
            assert.equal(salaryPlan.strategy, 'text');
            assert.equal(salaryPlan.value, '180000');
            assert.equal(portfolioPlan.strategy, 'text');
            assert.equal(portfolioPlan.value, 'https://github.com/feroz');
        },
    },
    {
        name: 'ProfileValueResolver handles Google Forms date placeholders and stack preference fields',
        run() {
            const resolver = new ProfileValueResolver(
                [{ label: 'Start Date', value: '2026-04-15', heading: 'Profession' }],
                'Experienced with React, Node.js, Express, Git, GitHub, PostgreSQL, and AWS.'
            );

            const datePlan = resolver.resolve({
                label: 'dd-mm-yyyy',
                question: 'What is your preferred start date?',
                type: 'date',
                options: [],
            });
            const frontendPlan = resolver.resolve({
                label: 'Choose',
                question: 'Which front-end framework/library are you most proficient in?',
                type: 'dropdown',
                options: [],
            });
            const backendPlan = resolver.resolve({
                label: 'Choose',
                question: 'What is your primary back-end programming language/framework?',
                type: 'dropdown',
                options: [],
            });
            const proficiencyPlan = resolver.resolve({
                label: '5',
                question: 'Rate your proficiency with version control (Git/GitHub/GitLab)',
                type: 'radio',
                options: [],
            });

            assert.equal(datePlan.strategy, 'text');
            assert.equal(datePlan.value, '15-04-2026');
            assert.equal(frontendPlan.strategy, 'dropdown');
            assert.equal(frontendPlan.value, 'react');
            assert.equal(backendPlan.strategy, 'dropdown');
            assert.equal(backendPlan.value, 'node.js');
            assert.equal(proficiencyPlan.strategy, 'radio');
            assert.equal(proficiencyPlan.shouldSelect, true);
        },
    },
];
