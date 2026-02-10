import { create } from 'zustand';

/**
 * Intento App Store - Central state management
 * Uses Zustand for lightweight, hook-based state
 */
const useIntentoStore = create((set, get) => ({
    // ============ VISION STATE ============
    screenshot: null,
    isAnalyzing: false,
    lastResponse: '',
    error: null,

    setScreenshot: (screenshot) => set({ screenshot, error: null }),
    setAnalyzing: (isAnalyzing) => set({ isAnalyzing }),
    setResponse: (lastResponse) => set({ lastResponse, isAnalyzing: false }),
    setError: (error) => set({ error, isAnalyzing: false }),

    // ============ BRAIN STATE ============
    hasBrain: false,
    brainStatus: 'inactive', // 'inactive' | 'active' | 'loading'

    setBrainActive: () => set({ hasBrain: true, brainStatus: 'active' }),
    setBrainLoading: () => set({ brainStatus: 'loading' }),

    // ============ UI STATE ============
    currentMode: 'intelligence', // 'intelligence' | 'direct_text' | 'field_fill'
    isTyping: false,

    setMode: (currentMode) => set({ currentMode }),
    setTyping: (isTyping) => set({ isTyping }),

    // ============ ACTIONS ============
    /**
     * Full capture → analyze → type flow
     */
    captureAndAnalyze: async (prompt = '') => {
        const { setScreenshot, setAnalyzing, setResponse, setError } = get();

        try {
            // 1. Capture
            const capture = await window.intentoAPI.captureScreen();
            if (!capture.success) {
                setError(capture.error);
                return;
            }
            setScreenshot(capture.base64);

            // 2. Analyze
            setAnalyzing(true);
            const result = await window.intentoAPI.analyze('', prompt);

            if (result.success) {
                setResponse(result.response);
            } else {
                setError(result.error);
            }
        } catch (err) {
            setError(err.message);
        }
    },

    /**
     * Type last response at cursor
     */
    typeResponse: async (countdown = 5) => {
        const { lastResponse, setTyping } = get();
        if (!lastResponse) return;

        setTyping(true);
        await window.intentoAPI.typeAtCursor(lastResponse, countdown);
        setTyping(false);
    },

    /**
     * Reset state
     */
    reset: () =>
        set({
            screenshot: null,
            isAnalyzing: false,
            lastResponse: '',
            error: null,
            isTyping: false,
        }),
}));

export default useIntentoStore;
