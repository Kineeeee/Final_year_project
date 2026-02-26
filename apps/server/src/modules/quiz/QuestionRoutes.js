const express = require('express');
const router = express.Router();
const Question = require('../../models/Question');
const Logger = require('../../utils/Logger');

// GET all questions
router.get('/', async (req, res) => {
    try {
        const { topic } = req.query;
        let query = {};
        if (topic) query.topic = topic;

        const questions = await Question.find(query).sort({ createdAt: -1 });
        res.json(questions);
    } catch (err) {
        Logger.error('API', 'Error fetching questions', err);
        res.status(500).json({ message: err.message });
    }
});

// POST new question
router.post('/', async (req, res) => {
    const question = new Question({
        topic: req.body.topic,
        difficulty: req.body.difficulty,
        questionText: req.body.questionText,
        correctAnswer: req.body.correctAnswer,
        wrongAnswers: req.body.wrongAnswers,
    });

    try {
        const newQuestion = await question.save();
        Logger.info('API', `Created new question: ${newQuestion.questionText}`);
        res.status(201).json(newQuestion);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// DELETE question
router.delete('/:id', async (req, res) => {
    try {
        await Question.findByIdAndDelete(req.params.id);
        res.json({ message: 'Deleted Question' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
