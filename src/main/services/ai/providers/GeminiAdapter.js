const { GoogleGenerativeAI } = require('@google/generative-ai');

async function executeGemini({ apiKey, model, request, systemPrompt }) {
    const genAI = new GoogleGenerativeAI(apiKey);
    const client = genAI.getGenerativeModel({ model });
    const parts = [
        { text: `${systemPrompt}\n\nTask: ${request.userPrompt}` },
    ];

    for (const image of request.images || []) {
        parts.push({
            inlineData: {
                data: image,
                mimeType: 'image/png',
            },
        });
    }

    const result = await client.generateContent(parts);
    const response = await result.response;

    return {
        text: response.text(),
        usage: response.usageMetadata || result.usageMetadata || null,
    };
}

module.exports = executeGemini;
