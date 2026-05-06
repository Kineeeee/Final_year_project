const express = require('express');
const Logger = require('../../utils/Logger');
const { callLlmChat } = require('../quiz/LlmClient');

const router = express.Router();

const SYSTEM_PROMPT = [
    'You are a friendly in-game chatbot for Snake Study.',
    'Keep responses concise, practical, and safe.',
    'If asked about gameplay, provide tips that match quiz/survival/shooting modes.',
    'Do NOT use Markdown formatting (like **bold** or *italic*). Use plain text only.',
    'Answer exactly what is asked. Do not be verbose and do NOT ask any follow-up questions back to the user.',
].join(' ');

function extractReply(content = '') {
    const raw = (content || '').toString().trim();
    if (!raw) return '';

    const unwrapped = unwrapJsonLike(raw);
    if (unwrapped) {
        return unwrapped;
    }

    return raw;
}

function unwrapJsonLike(raw) {
    const direct = parseKnownReplyShape(raw);
    if (direct) return direct;

    const match = raw.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (!match) return '';

    return parseKnownReplyShape(match[0]);
}

function parseKnownReplyShape(text) {
    try {
        const parsed = JSON.parse(text);
        return pickReplyText(parsed);
    } catch {
        return '';
    }
}

function pickReplyText(parsed, depth = 0) {
    if (depth > 2 || parsed == null) return '';

    if (typeof parsed === 'string') {
        const str = parsed.trim();
        if (!str) return '';
        // Handle nested JSON string payloads.
        const nested = parseKnownReplyShape(str);
        return nested || str;
    }

    if (typeof parsed !== 'object') return '';

    const candidates = [parsed.reply, parsed.response, parsed.message, parsed.text];
    for (const candidate of candidates) {
        const value = pickReplyText(candidate, depth + 1);
        if (value) return value;
    }

    return '';
}

function sanitizeHistory(history) {
    if (!Array.isArray(history)) return [];

    const cleaned = history
        .slice(-10)
        .map((m) => {
            const role = m?.role === 'assistant' ? 'assistant' : 'user';
            const content = (m?.content || '').toString().trim().slice(0, 1200);
            return { role, content };
        })
        .filter((m) => m.content.length > 0);

    // Some local LLM prompt templates require strict user/assistant alternation
    // and may reject histories starting with assistant.
    while (cleaned.length > 0 && cleaned[0].role !== 'user') {
        cleaned.shift();
    }

    const normalized = [];
    for (const msg of cleaned) {
        const prev = normalized[normalized.length - 1];
        if (!prev || prev.role !== msg.role) {
            normalized.push(msg);
        }
    }

    return normalized;
}

router.post('/ask', async (req, res) => {
    const message = (req.body?.message || '').toString().trim();
    const history = sanitizeHistory(req.body?.history);

    if (!message) {
        return res.status(400).json({ message: 'Tin nhan khong duoc de trong' });
    }
    if (message.length > 1600) {
        return res.status(400).json({ message: 'Tin nhan qua dai (toi da 1600 ky tu)' });
    }

    try {
        const userMessage = history.length === 0
            ? `${SYSTEM_PROMPT}\n\nUser question: ${message}`
            : message;

        const messages = [...history, { role: 'user', content: userMessage }];

        const { content } = await callLlmChat(messages, {
            temperature: 0.4,
            maxTokens: 420,
            timeoutMs: 60000,
        });

        const reply = extractReply(content);
        if (!reply) {
            return res.status(502).json({ message: 'Chatbot khong tra ve noi dung hop le.' });
        }

        return res.json({ reply });
    } catch (err) {
        Logger.error('Chatbot', 'LLM chat error', err);
        return res.status(502).json({ message: 'Chatbot tam thoi khong kha dung. Vui long thu lai.' });
    }
});

module.exports = router;
