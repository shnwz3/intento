const OpenAI = require('openai');

async function executeOpenAICompatible({ provider, apiKey, model, request, taskProfile, aiConfig, systemPrompt }) {
    const clientOptions = {
        apiKey,
        baseURL: provider.baseURL,
    };

    if (provider.extraHeaders) {
        clientOptions.defaultHeaders = provider.extraHeaders;
    }

    const client = new OpenAI(clientOptions);
    const content = [
        { type: 'text', text: request.userPrompt },
    ];

    for (const image of request.images || []) {
        const imageUrl = { url: `data:image/png;base64,${image}` };
        if (provider.supportsImageDetail) {
            imageUrl.detail = taskProfile.imageDetail;
        }

        content.push({
            type: 'image_url',
            image_url: imageUrl,
        });
    }

    const response = await client.chat.completions.create({
        model,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content },
        ],
        max_tokens: aiConfig.model_params?.max_tokens || 500,
        temperature: aiConfig.model_params?.temperature ?? 0.7,
    });

    return {
        text: response.choices?.[0]?.message?.content || '',
        usage: response.usage || null,
    };
}

module.exports = executeOpenAICompatible;
