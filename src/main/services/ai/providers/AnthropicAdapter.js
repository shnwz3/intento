const axios = require('axios');

async function executeAnthropic({ provider, apiKey, model, request, aiConfig, systemPrompt }) {
    const content = [
        { type: 'text', text: request.userPrompt },
    ];

    for (const image of request.images || []) {
        content.push({
            type: 'image',
            source: {
                type: 'base64',
                media_type: 'image/png',
                data: image,
            },
        });
    }

    const response = await axios.post(`${provider.baseURL}/messages`, {
        model,
        max_tokens: aiConfig.model_params?.max_tokens || 500,
        temperature: aiConfig.model_params?.temperature ?? 0.7,
        system: systemPrompt,
        messages: [
            {
                role: 'user',
                content,
            },
        ],
    }, {
        headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
        },
        timeout: 15000,
    });

    const textBlocks = Array.isArray(response.data?.content)
        ? response.data.content
            .filter((item) => item?.type === 'text' && typeof item.text === 'string')
            .map((item) => item.text)
        : [];

    return {
        text: textBlocks.join('\n').trim(),
        usage: response.data?.usage || null,
    };
}

module.exports = executeAnthropic;
