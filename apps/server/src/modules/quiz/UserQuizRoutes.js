const express = require('express');
const multer = require('multer');
const mammoth = require('mammoth');

const requireAuth = require('../auth/http/RequireAuthMiddleware');
const UserQuiz = require('../../models/UserQuiz');
const Logger = require('../../utils/Logger');
const { parseTextToQuiz } = require('./QuizParser');
const { validateQuiz, CATEGORY_ENUM } = require('./QuizValidator');
const { callAiParser } = require('./LlmClient');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

function normalizeCategory(raw) {
    return (raw || '').toLowerCase();
}

function countBlocks(text = '') {
    return 0; // no limit enforced
}

function normalizeQuestions(rawQuestions = []) {
    return (rawQuestions || []).map((q) => {
        const answers = Array.isArray(q?.answers) ? q.answers.slice(0, 4) : [];
        while (answers.length < 4) {
            answers.push({ text: '', isCorrect: false });
        }
        // Ensure booleans and at most 1 correct
        let foundCorrect = false;
        const sanitizedAnswers = answers.map((a) => {
            const isCorrect = !!a?.isCorrect && !foundCorrect;
            if (isCorrect) foundCorrect = true;
            return {
                text: (a?.text || '').toString().trim(),
                isCorrect,
            };
        });
        // If none marked correct, default first non-empty to correct to satisfy schema/validator
        if (!foundCorrect && sanitizedAnswers.length > 0) {
            sanitizedAnswers[0].isCorrect = true;
        }
        return {
            question: (q?.question || '').toString().trim(),
            answers: sanitizedAnswers,
        };
    });
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

    try {
        const aiResult = await callAiParser(rawText, normalizedCategory);
        return res.json(aiResult);
    } catch (e) {
        Logger.warn('UserQuiz', 'AI parse failed, fallback parser in use', e.message);
        const { questions, errors } = parseTextToQuiz(rawText, normalizedCategory);
        const notice = 'AI không khả dụng, đã dùng parser nội bộ. Vui lòng kiểm tra preview trước khi lưu.';
        return res.json({ questions, errors, notice });
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
        if (!rawText.trim()) {
            return res.status(400).json({ message: 'File trống hoặc không đọc được nội dung' });
        }
        try {
            const aiResult = await callAiParser(rawText, category);
            return res.json(aiResult);
        } catch (e) {
            Logger.warn('UserQuiz', 'DOCX AI parse failed, fallback parser in use', e.message);
            const { questions, errors } = parseTextToQuiz(rawText, category);
            const notice = 'AI không khả dụng, đã dùng parser nội bộ. Vui lòng kiểm tra preview trước khi lưu.';
            return res.json({ questions, errors, notice });
        }
    } catch (err) {
        Logger.error('UserQuiz', 'DOCX parse error', err);
        return res.status(500).json({ message: 'Lỗi đọc file docx' });
    }
});

router.post('/save', requireAuth, async (req, res) => {
    try {
        const category = normalizeCategory(req.body.category);
        const questions = normalizeQuestions(req.body.questions || []);
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
        if (err?.name === 'ValidationError' || err?.name === 'CastError') {
            return res.status(400).json({ message: err.message });
        }
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
