async function executeOllama({ model, request, systemPrompt }) {
    const ollama = require('ollama').default;
    const response = await ollama.generate({
        model,
        prompt: `Instruction: ${systemPrompt}\n\nTask: ${request.userPrompt}`,
        images: request.images || [],
        stream: false,
    });

    return {
        text: response.response,
        usage: {
            prompt_eval_count: response.prompt_eval_count,
            eval_count: response.eval_count,
        },
    };
}

module.exports = executeOllama;
