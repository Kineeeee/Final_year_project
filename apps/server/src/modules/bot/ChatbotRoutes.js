const express = require('express');
const Logger = require('../../utils/Logger');
const { callLlmChat } = require('../quiz/LlmClient');

const router = express.Router();

const SYSTEM_PROMPT = [
    'You are a friendly in-game chatbot for Snake Study.',
    'Answer in Vietnamese unless the user explicitly asks another language.',
    'Keep responses concise, practical, and safe.',
    'If asked about gameplay, provide tips that match quiz/survival/shooting modes.',
].join(' ');

function extractReply(content = '') {
    const raw = (content || '').toString().trim();
    if (!raw) return '';

    try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.reply === 'string') {
            return parsed.reply.trim();
        }
    } catch {
        const match = raw.match(/(\{[\s\S]*\})/);
        if (match) {
            try {
                const parsed = JSON.parse(match[0]);
                if (parsed && typeof parsed.reply === 'string') {
                    return parsed.reply.trim();
                }
            } catch {
                // fall through to raw text
            }
        }
    }

    return raw;
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
            responseFormat: {
                type: 'json_schema',
                json_schema: {
                    name: 'chatbot_reply',
                    schema: {
                        type: 'object',
                        properties: {
                            reply: { type: 'string' },
                        },
                        required: ['reply'],
                        additionalProperties: false,
                    },
                },
            },
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
