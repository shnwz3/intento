class FormAutomationCancelledError extends Error {
    constructor() {
        super('Form automation cancelled by user');
        this.name = 'FormAutomationCancelledError';
    }
}

class FormAutomationService {
    constructor(screenshotService, formFillerService, typingService, options = {}) {
        this.screenshot = screenshotService;
        this.formFiller = formFillerService;
        this.typing = typingService;
        this.maxPasses = Number.isInteger(options.maxPasses) ? options.maxPasses : 12;
        this.capturePauseMs = Number.isFinite(options.capturePauseMs) ? options.capturePauseMs : 700;
        this.scrollPauseMs = Number.isFinite(options.scrollPauseMs) ? options.scrollPauseMs : 900;
        this.maxScrollRecoveries = Number.isInteger(options.maxScrollRecoveries) ? options.maxScrollRecoveries : 3;
        this._sleep = options.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
        this._cancelled = false;
    }

    cancel() {
        console.log('Form automation cancellation requested');
        this._cancelled = true;
        this.typing.cancel();
    }

    async run({ onStatus, initialState } = {}) {
        this._cancelled = false;

        let totalFilled = 0;
        let totalSkipped = 0;
        let lastSignature = '';
        let repeatedPasses = 0;
        let brainFilledCount = 0;
        let aiFilledCount = 0;
        let selectedChoiceCount = 0;
        let scrollRecoveryCount = 0;
        let nextState = initialState || null;
        const completedFieldKeys = new Set();
        const reviewLabels = [];

        for (let passIndex = 0; passIndex < this.maxPasses; passIndex += 1) {
            this._throwIfCancelled();
            this._status(passIndex === 0 ? 'Reading visible fields...' : 'Reading next fields...', onStatus);

            const minimumFields = passIndex === 0 ? 2 : 1;
            const state = nextState || await this._inspectCurrentState(minimumFields);
            nextState = null;

            if (passIndex === 0 && !state.isForm) {
                throw new Error('No form detected. Focus the first text input before starting.');
            }

            const signature = this._buildSignature(state.fields, state.submitVisible, state.submitLabel);
            repeatedPasses = signature === lastSignature ? repeatedPasses + 1 : 0;
            lastSignature = signature;

            if (state.fields.length === 0) {
                if (state.submitVisible) {
                    return {
                        success: true,
                        fieldCount: totalFilled,
                        skippedCount: totalSkipped,
                        brainFilledCount,
                        aiFilledCount,
                        selectedChoiceCount,
                        scrollRecoveryCount,
                        reviewLabels,
                        stoppedReason: 'submit_visible',
                        submitLabel: state.submitLabel,
                        passCount: passIndex + 1,
                    };
                }

                if (scrollRecoveryCount < this.maxScrollRecoveries) {
                    scrollRecoveryCount += 1;
                    await this._revealNextSection(onStatus);
                    continue;
                }

                if (repeatedPasses >= 1) {
                    return {
                        success: true,
                        fieldCount: totalFilled,
                        skippedCount: totalSkipped,
                        brainFilledCount,
                        aiFilledCount,
                        selectedChoiceCount,
                        scrollRecoveryCount,
                        reviewLabels,
                        stoppedReason: 'no_more_inputs',
                        submitLabel: null,
                        passCount: passIndex + 1,
                    };
                }

                await this._advanceToNextField(onStatus);
                continue;
            }

            this._status(`Planning ${state.fields.length} answers...`, onStatus);
            const fillPlan = await this.formFiller.generateFillValues(state.fields);
            let processedNewField = false;

            for (let fieldIndex = 0; fieldIndex < fillPlan.length; fieldIndex += 1) {
                const field = fillPlan[fieldIndex];
                const fieldKey = this._buildFieldKey(field);
                this._throwIfCancelled();

                if (completedFieldKeys.has(fieldKey)) {
                    const isLastFieldInPass = fieldIndex === fillPlan.length - 1;
                    const shouldAdvance = !isLastFieldInPass || !state.submitVisible;
                    if (shouldAdvance) {
                        await this._advanceToNextField(onStatus);
                    }
                    continue;
                }

                processedNewField = true;
                this._status(`Filling ${field.label}...`, onStatus);

                if (field.strategy === 'checkbox') {
                    if (field.shouldSelect && !field.checked) {
                        await this.typing.pressKey('space');
                        totalFilled += 1;
                        selectedChoiceCount += 1;
                    }
                } else if (field.strategy === 'radio') {
                    if (field.shouldSelect && !field.checked) {
                        await this.typing.pressKey('space');
                        totalFilled += 1;
                        selectedChoiceCount += 1;
                    }
                } else if (field.strategy === 'dropdown' && field.value && String(field.value).trim()) {
                    const usedDropdownSelector = typeof this.typing.selectDropdownValue === 'function';
                    const selectResult = usedDropdownSelector
                        ? await this.typing.selectDropdownValue(field.value)
                        : await this.typing.fillFieldValue(field.value, { mode: 'type' });

                    if (!selectResult.success) {
                        if (selectResult.code === 'TYPE_CANCELLED') {
                            throw new FormAutomationCancelledError();
                        }

                        if (selectResult.code === 'EMPTY_TEXT') {
                            totalSkipped += 1;
                            this._addReviewLabel(reviewLabels, field.label);
                        } else {
                            throw new Error(selectResult.message || `Failed to fill ${field.label}.`);
                        }
                    } else {
                        totalFilled += 1;
                        if (field.source === 'ai') {
                            aiFilledCount += 1;
                        } else {
                            brainFilledCount += 1;
                        }

                        if (!usedDropdownSelector) {
                            await this.typing.pressKey('enter');
                        }
                    }
                } else if (field.value && String(field.value).trim()) {
                    const typeResult = await this.typing.fillFieldValue(field.value, {
                        mode: field.inputMode,
                    });
                    if (!typeResult.success) {
                        if (typeResult.code === 'TYPE_CANCELLED') {
                            throw new FormAutomationCancelledError();
                        }

                        if (typeResult.code === 'EMPTY_TEXT') {
                            totalSkipped += 1;
                            this._addReviewLabel(reviewLabels, field.label);
                        } else {
                            throw new Error(typeResult.message || `Failed to fill ${field.label}.`);
                        }
                    } else {
                        totalFilled += 1;
                        if (field.source === 'ai') {
                            aiFilledCount += 1;
                        } else {
                            brainFilledCount += 1;
                        }
                    }
                } else if (field.strategy === 'skip') {
                    totalSkipped += 1;
                    this._addReviewLabel(reviewLabels, field.label);
                } else {
                    totalSkipped += 1;
                    this._addReviewLabel(reviewLabels, field.label);
                }

                completedFieldKeys.add(fieldKey);

                const isLastFieldInPass = fieldIndex === fillPlan.length - 1;
                const shouldAdvance = !isLastFieldInPass || !state.submitVisible;
                if (shouldAdvance) {
                    await this._advanceToNextField(onStatus);
                }
            }

            if (state.submitVisible) {
                return {
                    success: true,
                    fieldCount: totalFilled,
                    skippedCount: totalSkipped,
                    brainFilledCount,
                    aiFilledCount,
                    selectedChoiceCount,
                    scrollRecoveryCount,
                    reviewLabels,
                    stoppedReason: 'submit_visible',
                    submitLabel: state.submitLabel,
                    passCount: passIndex + 1,
                };
            }

            if (!processedNewField) {
                if (scrollRecoveryCount < this.maxScrollRecoveries) {
                    scrollRecoveryCount += 1;
                    await this._revealNextSection(onStatus);
                    continue;
                }

                return {
                    success: true,
                    fieldCount: totalFilled,
                    skippedCount: totalSkipped,
                    brainFilledCount,
                    aiFilledCount,
                    selectedChoiceCount,
                    scrollRecoveryCount,
                    reviewLabels,
                    stoppedReason: 'no_more_inputs',
                    submitLabel: null,
                    passCount: passIndex + 1,
                };
            }
        }

        return {
            success: true,
            fieldCount: totalFilled,
            skippedCount: totalSkipped,
            brainFilledCount,
            aiFilledCount,
            selectedChoiceCount,
            scrollRecoveryCount,
            reviewLabels,
            stoppedReason: 'max_passes',
            submitLabel: null,
            passCount: this.maxPasses,
        };
    }

    async _advanceToNextField(onStatus) {
        this._throwIfCancelled();
        this._status('Moving to next field...', onStatus);
        await this.typing.pressKey('tab');
        await this._sleep(this.capturePauseMs);
    }

    async _capture() {
        const result = await this.screenshot.capture();
        if (!result.success) {
            throw new Error(result.message || result.error || 'Intento could not access the current view.');
        }
        return result.data;
    }

    async _inspectCurrentState(minimumFields) {
        const capture = await this._capture();
        return this.formFiller.inspectFormState(capture.base64, { minimumFields });
    }

    async _revealNextSection(onStatus) {
        this._throwIfCancelled();
        this._status('Scrolling for more fields...', onStatus);

        if (typeof this.typing.scrollVertical === 'function') {
            await this.typing.scrollVertical();
        } else {
            await this.typing.pressKey('pagedown');
        }

        await this._sleep(this.scrollPauseMs);
    }

    _status(message, onStatus) {
        if (typeof onStatus === 'function') {
            onStatus(message);
        }
    }

    _buildSignature(fields, submitVisible, submitLabel) {
        const fieldSignature = (fields || [])
            .map((field) => `${String(field.label || '').trim().toLowerCase()}|${String(field.type || '').trim().toLowerCase()}`)
            .sort()
            .join('||');

        return `${fieldSignature}::${submitVisible ? 'submit' : 'nosubmit'}::${String(submitLabel || '').trim().toLowerCase()}`;
    }

    _buildFieldKey(field) {
        return [
            String(field.question || '').trim().toLowerCase(),
            String(field.label || '').trim().toLowerCase(),
            String(field.type || '').trim().toLowerCase(),
        ].join('::');
    }

    _addReviewLabel(reviewLabels, label) {
        const normalizedLabel = String(label || '').trim();
        if (!normalizedLabel || reviewLabels.includes(normalizedLabel)) {
            return;
        }

        reviewLabels.push(normalizedLabel);
    }

    _throwIfCancelled() {
        if (this._cancelled) {
            throw new FormAutomationCancelledError();
        }
    }
}

module.exports = FormAutomationService;
