class AITraceLogger {
    constructor(options = {}) {
        this.maxEntries = Number.isInteger(options.maxEntries) ? options.maxEntries : 250;
        this.entries = [];
        this.isDev = options.isDev ?? process.env.NODE_ENV !== 'production';
    }

    record(trace) {
        const entry = {
            taskKind: trace.taskKind,
            provider: trace.provider,
            model: trace.model,
            latencyMs: Math.max(0, Math.round(Number(trace.latencyMs) || 0)),
            tokensUsed: Number.isFinite(trace.tokensUsed) ? trace.tokensUsed : undefined,
            retryCount: Math.max(0, Math.floor(Number(trace.retryCount) || 0)),
            fallbackUsed: Boolean(trace.fallbackUsed),
            success: Boolean(trace.success),
            failureReason: trace.failureReason ? String(trace.failureReason) : undefined,
            timestamp: Number.isFinite(trace.timestamp) ? trace.timestamp : Date.now(),
        };

        this.entries.push(entry);
        if (this.entries.length > this.maxEntries) {
            this.entries.splice(0, this.entries.length - this.maxEntries);
        }

        if (this.isDev) {
            this._logToConsole(entry);
        }

        return entry;
    }

    getRecent(limit = 50) {
        const normalizedLimit = Math.max(1, Math.floor(Number(limit) || 50));
        return this.entries.slice(-normalizedLimit).reverse();
    }

    _logToConsole(entry) {
        const status = entry.success ? 'OK' : 'FAIL';
        const fallback = entry.fallbackUsed ? ' fallback' : '';
        const retry = entry.retryCount > 0 ? ` retry=${entry.retryCount}` : '';
        const tokens = Number.isFinite(entry.tokensUsed) ? ` tokens=${entry.tokensUsed}` : '';
        const reason = entry.failureReason ? ` reason=${entry.failureReason}` : '';

        console.log(
            `[AITrace] ${status} task=${entry.taskKind} provider=${entry.provider} model=${entry.model} latency=${entry.latencyMs}ms${tokens}${retry}${fallback}${reason}`
        );
    }
}

module.exports = AITraceLogger;
