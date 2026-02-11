const Logger = require('../../utils/Logger');
const { QUIZ_PARSE_PROMPT } = require('./QuizParser');

// Naming made provider-agnostic; still accept legacy OPENAI_* envs
const LLM_MODEL = process.env.LLM_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini';
const LLM_BASE_URL = (process.env.LLM_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
const LLM_API_KEY = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY;

function buildPrompt(rawText, category) {
    const categoryToken = (category || '').toUpperCase();
    return QUIZ_PARSE_PROMPT.replace(/{{CATEGORY}}/g, categoryToken).replace('{{RAW_TEXT}}', rawText || '');
}

async function callAiParser(rawText, category) {
    Logger.info('AIParser', `AI parse requested for category=${category}, length=${(rawText || '').length}`);

    if (!LLM_API_KEY) {
        throw new Error('LLM_API_KEY/OPENAI_API_KEY not set');
    }
    if (typeof fetch !== 'function') {
        throw new Error('fetch is not available in this runtime');
    }

    const prompt = buildPrompt(rawText, category);
    const response = await fetch(`${LLM_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${LLM_API_KEY}`,
        },
        body: JSON.stringify({
            model: LLM_MODEL,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0,
            response_format: {
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
        }),
    });

    if (!response.ok) {
        const errorText = await safeReadText(response);
        throw new Error(`LLM request failed: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ''}`);
    }

    const body = await response.json();
    const content = body.choices?.[0]?.message?.content;
    if (!content) {
        throw new Error('Empty AI response');
    }

    let parsed;
    try {
        parsed = JSON.parse(content);
    } catch (err) {
        // Try to extract JSON substring to be resilient to stray text
        const match = content.match(/[\[{].*[\]}]/s);
        if (match) {
            try {
                parsed = JSON.parse(match[0]);
            } catch (e2) {
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

async function safeReadText(response) {
    try {
        return await response.text();
    } catch (err) {
        return '';
    }
}

module.exports = { callAiParser };
