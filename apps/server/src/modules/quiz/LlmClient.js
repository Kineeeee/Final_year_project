const { GoogleGenerativeAI } = require('@google/generative-ai');
const Logger = require('../../utils/Logger');
const { QUIZ_PARSE_PROMPT } = require('./QuizParser');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.LLM_API_KEY;

let geminiClient;

function getGeminiModel() {
    if (!GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is not set');
    }

    if (!geminiClient) {
        geminiClient = new GoogleGenerativeAI(GEMINI_API_KEY);
    }

    return geminiClient.getGenerativeModel({ model: GEMINI_MODEL });
}

function normalizeMessageContent(content) {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
        return content
            .map((part) => {
                if (typeof part === 'string') return part;
                if (part && typeof part.text === 'string') return part.text;
                return '';
            })
            .filter(Boolean)
            .join('\n');
    }
    return '';
}

function messagesToPrompt(messages = []) {
    return (messages || [])
        .map((msg) => {
            const role = msg?.role === 'assistant' ? 'ASSISTANT' : msg?.role === 'system' ? 'SYSTEM' : 'USER';
            const text = normalizeMessageContent(msg?.content);
            return `${role}: ${text}`.trim();
        })
        .filter(Boolean)
        .join('\n\n');
}

function withTimeout(promise, timeoutMs) {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
        return promise;
    }

    return Promise.race([
        promise,
        new Promise((_, reject) => {
            setTimeout(() => reject(new Error(`Gemini request timed out after ${timeoutMs}ms`)), timeoutMs);
        }),
    ]);
}

async function callLlmChat(messages, options = {}) {
    const {
        temperature = 0,
        responseFormat,
        maxTokens,
        timeoutMs = 20000,
    } = options;

    const model = getGeminiModel();
    const basePrompt = messagesToPrompt(messages);
    let prompt = basePrompt;

    if (responseFormat?.type === 'json_schema') {
        // Gemini may return markdown fences; force plain JSON response in prompt.
        prompt = `${basePrompt}\n\nReturn ONLY valid JSON. Do not include markdown fences or explanation text.`;
    }

    const generationConfig = {
        temperature,
    };

    if (typeof maxTokens === 'number' && Number.isFinite(maxTokens)) {
        generationConfig.maxOutputTokens = maxTokens;
    }

    const payload = await withTimeout(
        model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig,
        }),
        timeoutMs
    );

    const content = payload?.response?.text?.();
    if (!content) {
        throw new Error('Empty AI response');
    }

    return { content, payload };
}

function buildPrompt(rawText, category) {
    const categoryToken = (category || '').toUpperCase();
    return QUIZ_PARSE_PROMPT.replace(/{{CATEGORY}}/g, categoryToken).replace('{{RAW_TEXT}}', rawText || '');
}

async function callAiParser(rawText, category) {
    Logger.info('AIParser', `AI parse requested for category=${category}, length=${(rawText || '').length}`);

    const prompt = buildPrompt(rawText, category);
    const { content } = await callLlmChat(
        [{ role: 'user', content: prompt }],
        {
            temperature: 0,
            responseFormat: {
                type: 'json_schema',
                json_schema: {
                    name: 'quiz_questions',
                    schema: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                question: { type: 'string' },
                                answers: {
                                    type: 'array',
                                    minItems: 2,
                                    maxItems: 8,
                                    items: {
                                        type: 'object',
                                        properties: {
                                            text: { type: 'string' },
                                            isCorrect: { type: 'boolean' },
                                        },
                                        required: ['text', 'isCorrect'],
                                        additionalProperties: false,
                                    },
                                },
                            },
                            required: ['question', 'answers'],
                            additionalProperties: false,
                        },
                        minItems: 1,
                    },
                },
            },
        }
    );

    let parsed;
    try {
        parsed = JSON.parse(content);
    } catch {
        // Try to extract JSON substring to be resilient to stray text
        const match = content.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
        if (match) {
            try {
                parsed = JSON.parse(match[0]);
            } catch {
                throw new Error('AI response is not valid JSON');
            }
        } else {
            throw new Error('AI response is not valid JSON');
        }
    }

    if (Array.isArray(parsed)) {
        return { questions: parsed, errors: [] };
    }

    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.errors)) {
        return { questions: [], errors: parsed.errors };
    }

    throw new Error('AI response malformed');
}

module.exports = { callAiParser, callLlmChat };
