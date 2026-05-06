const Logger = require('../../utils/Logger');
const { QUIZ_PARSE_PROMPT } = require('./QuizParser');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.LLM_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || process.env.LLM_MODEL || 'models/gemini-3-flash-preview';
const GEMINI_API_VERSION = process.env.GEMINI_API_VERSION || 'v1beta';
const GEMINI_API_BASE = (process.env.GEMINI_API_BASE || process.env.GEMINI_API_BASE_URL || 'https://generativelanguage.googleapis.com').replace(/\/$/, '');

function getGeminiModelPath() {
    const model = (GEMINI_MODEL || '').trim();
    if (!model) {
        throw new Error('GEMINI_MODEL is not set');
    }
    return model.startsWith('models/') ? model : `models/${model}`;
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

    if (!GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is not set');
    }

    const modelPath = getGeminiModelPath();
    const basePrompt = messagesToPrompt(messages);
    let prompt = basePrompt;


    const generationConfig = {
        temperature,
    };

        // Keep JSON-shape control in prompt text for maximum compatibility across v1 models.
        if (responseFormat?.type === 'json_schema') {
            // Gemini may return markdown fences; force plain JSON response in prompt.
            prompt = `${basePrompt}\n\nReturn ONLY valid JSON. Do not include markdown fences or explanation text.`;
        }

    if (typeof maxTokens === 'number' && Number.isFinite(maxTokens)) {
        generationConfig.maxOutputTokens = maxTokens;
    }

    const query = new URLSearchParams({ key: GEMINI_API_KEY }).toString();
    const url = `${GEMINI_API_BASE}/${GEMINI_API_VERSION}/${modelPath}:generateContent?${query}`;

    const response = await withTimeout(
        fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig,
            }),
            signal: AbortSignal.timeout(timeoutMs),
        }),
        timeoutMs
    );

    if (!response.ok) {
        const errorText = await safeReadText(response);
        throw new Error(`Gemini request failed: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ''}`);
    }

    const payload = await response.json();
    const content = payload?.candidates?.[0]?.content?.parts?.map((p) => p?.text || '').join('') || '';
    if (!content) {
        throw new Error('Empty AI response');
    }

    return { content, payload };
}

async function safeReadText(response) {
    try {
        return await response.text();
    } catch {
        return '';
    }
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
