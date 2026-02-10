const Logger = require('../../utils/Logger');
const { QUIZ_PARSE_PROMPT } = require('./QuizParser');

const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const OPENAI_BASE_URL = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');

function buildPrompt(rawText, category) {
    const categoryToken = (category || '').toUpperCase();
    return QUIZ_PARSE_PROMPT.replace(/{{CATEGORY}}/g, categoryToken).replace('{{RAW_TEXT}}', rawText || '');
}

async function callAiParser(rawText, category) {
    Logger.info('AIParser', `AI parse requested for category=${category}, length=${(rawText || '').length}`);

    if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY not set');
    }
    if (typeof fetch !== 'function') {
        throw new Error('fetch is not available in this runtime');
    }

    const prompt = buildPrompt(rawText, category);
    const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
            model: OPENAI_MODEL,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0,
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
        throw new Error('AI response is not valid JSON');
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
