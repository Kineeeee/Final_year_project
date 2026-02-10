const express = require('express');
const multer = require('multer');
const mammoth = require('mammoth');

const requireAuth = require('../auth/http/requireAuth');
const UserQuiz = require('../../models/UserQuiz');
const Logger = require('../../utils/Logger');
const { parseTextToQuiz } = require('./QuizParser');
const { validateQuiz, CATEGORY_ENUM } = require('./QuizValidator');
const { callAiParser } = require('./aiParserAdapter');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

function normalizeCategory(raw) {
    return (raw || '').toLowerCase();
}

function buildStatusResponse(quizDoc, category) {
    if (!quizDoc) {
        return {
            hasQuiz: false,
            isValid: false,
            userQuizStatus: 'NONE',
            category,
        };
    }
    return {
        hasQuiz: true,
        isValid: !!quizDoc.isValid,
        userQuizStatus: quizDoc.isValid ? 'VALID' : 'INVALID',
        lastUpdated: quizDoc.updatedAt,
        errors: quizDoc.parseErrors || [],
        category,
    };
}

async function getUserQuiz(userId, category) {
    return UserQuiz.findOne({ userId, category });
}

router.get('/status', requireAuth, async (req, res) => {
    try {
        const category = normalizeCategory(req.query.category);
        if (!CATEGORY_ENUM.includes(category)) {
            return res.status(400).json({ message: 'Category không hợp lệ' });
        }
        const quiz = await getUserQuiz(req.user.userId, category);
        return res.json(buildStatusResponse(quiz, category));
    } catch (err) {
        Logger.error('UserQuiz', 'Status error', err);
        return res.status(500).json({ message: 'Server error' });
    }
});

// GET play (return questions for valid user quiz)
router.get('/play', requireAuth, async (req, res) => {
    try {
        const category = normalizeCategory(req.query.category);
        if (!CATEGORY_ENUM.includes(category)) {
            return res.status(400).json({ message: 'Category không hợp lệ' });
        }
        const quiz = await getUserQuiz(req.user.userId, category);
        if (!quiz || !quiz.isValid) {
            return res.status(400).json({ message: 'Bạn chưa có đề hợp lệ cho category này' });
        }
        return res.json(quiz.questions || []);
    } catch (err) {
        Logger.error('UserQuiz', 'Play fetch error', err);
        return res.status(500).json({ message: 'Server error' });
    }
});

router.post('/parse', requireAuth, async (req, res) => {
    const { rawText, category } = req.body || {};
    const normalizedCategory = normalizeCategory(category);
    if (!CATEGORY_ENUM.includes(normalizedCategory)) {
        return res.status(400).json({ message: 'Category không hợp lệ' });
    }

    // Try AI parse first; fallback to local parse
    try {
        const aiResult = await callAiParser(rawText, normalizedCategory);
        return res.json(aiResult);
    } catch (e) {
        Logger.warn('UserQuiz', 'AI parse failed, falling back', e.message);
        const { questions, errors } = parseTextToQuiz(rawText, normalizedCategory);
        const message = !process.env.OPENAI_API_KEY ? 'AI parser chưa được cấu hình, dùng parser thường.' : 'AI parser lỗi, dùng parser thường.';
        return res.json({ questions, errors, notice: message });
    }
});

router.post('/upload', requireAuth, upload.single('file'), async (req, res) => {
    const category = normalizeCategory(req.body.category || req.query.category);
    if (!CATEGORY_ENUM.includes(category)) {
        return res.status(400).json({ message: 'Category không hợp lệ' });
    }

    if (!req.file) {
        return res.status(400).json({ message: 'Thiếu file .docx' });
    }
    if (!req.file.originalname.toLowerCase().endsWith('.docx')) {
        return res.status(400).json({ message: 'Chỉ hỗ trợ file .docx' });
    }

    try {
        const result = await mammoth.extractRawText({ buffer: req.file.buffer });
        const rawText = result.value || '';
        const { questions, errors } = parseTextToQuiz(rawText, category);
        return res.json({ questions, errors });
    } catch (err) {
        Logger.error('UserQuiz', 'DOCX parse error', err);
        return res.status(500).json({ message: 'Lỗi đọc file docx' });
    }
});

router.post('/save', requireAuth, async (req, res) => {
    try {
        const category = normalizeCategory(req.body.category);
        const questions = req.body.questions || [];
        if (!CATEGORY_ENUM.includes(category)) {
            return res.status(400).json({ message: 'Category không hợp lệ' });
        }

        const validation = validateQuiz({ questions, category });
        const isValid = validation.isValid;

        const update = {
            userId: req.user.userId,
            category,
            questions,
            isValid,
            parseErrors: isValid ? [] : validation.errors,
        };

        const quiz = await UserQuiz.findOneAndUpdate(
            { userId: req.user.userId, category },
            update,
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        // If the currently active live quiz belongs to this user and becomes invalid, revert source
        const gameServers = req.app.locals.gameServers || {};
        const serverKey = category === 'math' ? 'math' : 'english';
        const quizManager = gameServers[serverKey]?.quizManager;
        if (quizManager && (!isValid && quizManager.activeUserId && quizManager.activeUserId.toString() === req.user.userId.toString())) {
            quizManager.setQuizSource({ source: 'system' });
        }

        return res.json({
            isValid,
            errors: validation.errors || [],
            quiz,
            userQuizStatus: isValid ? 'VALID' : 'INVALID',
        });
    } catch (err) {
        Logger.error('UserQuiz', 'Save error', err);
        return res.status(500).json({ message: 'Server error' });
    }
});

router.post('/source', requireAuth, async (req, res) => {
    const category = normalizeCategory(req.body.category);
    const quizSource = (req.body.quizSource || '').toUpperCase();
    if (!CATEGORY_ENUM.includes(category)) {
        return res.status(400).json({ message: 'Category không hợp lệ' });
    }
    if (!['SYSTEM', 'USER'].includes(quizSource)) {
        return res.status(400).json({ message: 'quizSource phải là SYSTEM hoặc USER' });
    }

    try {
        let activeQuizDoc = null;
        if (quizSource === 'USER') {
            activeQuizDoc = await getUserQuiz(req.user.userId, category);
            if (!activeQuizDoc || !activeQuizDoc.isValid) {
                return res.status(400).json({ message: 'Quiz cá nhân không hợp lệ cho category này' });
            }
        }

        // Switch live quiz source if game server exists
        const gameServers = req.app.locals.gameServers || {};
        const serverKey = category === 'math' ? 'math' : 'english';
        const gameServer = gameServers[serverKey];
        if (gameServer && gameServer.quizManager && typeof gameServer.quizManager.setQuizSource === 'function') {
            gameServer.quizManager.setQuizSource({
                source: quizSource === 'USER' ? 'user' : 'system',
                userQuiz: activeQuizDoc,
                ownerUserId: req.user.userId,
            });
        }

        return res.json({
            quizModeState: {
                category: category.toUpperCase(),
                quizSource,
                userQuizStatus: activeQuizDoc ? 'VALID' : 'NONE',
            },
        });
    } catch (err) {
        Logger.error('UserQuiz', 'Switch source error', err);
        return res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
