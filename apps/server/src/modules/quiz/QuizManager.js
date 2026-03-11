const Question = require('../../models/Question');
const Logger = require('../../utils/Logger');
const { WORLD_SIZE } = require('../../config/constants');

class QuizManager {
    constructor(io, container, topic, opts = {}) {
        this.io = io;
        this.container = container;
        this.topic = topic; // 'math' or 'english'
        this.lockedSource = opts.lockedSource || false;
        this.ownerUserId = opts.ownerUserId || null;
        this.isCustom = !!opts.isCustom;
        this.roomCode = opts.roomCode || null;

        // Defaults
        this.currentQuestion = null;
        this.quizSource = 'system'; // 'system' | 'user'
        this.activeUserQuiz = null; // {questions, _id, category}
        this.activeUserId = null;

        // If a user quiz is provided (custom room), keep it as the active source
        if (opts.userQuiz) {
            this.quizSource = 'user';
            this.activeUserQuiz = opts.userQuiz;
            this.activeUserId = this.ownerUserId;
        }
        this.roundDuration = 4 * 60 * 1000; // 4 minutes
        this.roundEndTime = 0;
        this.isActive = false;

        // Per-Question Timer
        this.questionDuration = 30 * 1000; // 30 seconds per question
        this.questionEndTime = 0;
        this.questionTimer = null;

        // Settings for spawning
        this.answerFoodCount = 5; // How many food items carry answers
    }

    get foodManager() {
        return this.container.get('foodManager');
    }
    get playerManager() {
        return this.container.get('playerManager');
    }

    async startRound() {
        this.isActive = true;
        const gameServer = this.container.has('gameServer') ? this.container.get('gameServer') : null;
        if (gameServer) gameServer.matchStarted = true;
        this.roundEndTime = Date.now() + this.roundDuration;

        // Reset Player State
        if (this.playerManager) {
            this.playerManager.resetScores();
        }

        // Start Cleanup Timer (5s interval)
        if (this.cleanupTimer) clearInterval(this.cleanupTimer);
        this.cleanupTimer = setInterval(() => this.cleanupJunkFood(), 5000);

        // Broadcast Start
        this.io.emit('roundStart', { endTime: this.roundEndTime, topic: this.topic });

        // Initial Question
        await this.nextQuestion();
    }

    /**
     * Switch quiz source at runtime.
     * @param {Object} opts
     * @param {'system'|'user'} opts.source
     * @param {Object|null} opts.userQuiz
     * @param {string|null} opts.ownerUserId
     */
    setQuizSource({ source = 'system', userQuiz = null, ownerUserId = null } = {}) {
        if (this.lockedSource) return;
        if (source === 'user' && userQuiz && Array.isArray(userQuiz.questions) && userQuiz.questions.length > 0) {
            this.quizSource = 'user';
            this.activeUserQuiz = userQuiz;
            this.activeUserId = ownerUserId || null;
            // Sync topic just in case
            this.topic = userQuiz.category || this.topic;
            Logger.info('QuizManager', `Switched to USER quiz for ${this.topic}. Owner=${this.activeUserId || 'unknown'}`);
        } else {
            this.quizSource = 'system';
            this.activeUserQuiz = null;
            this.activeUserId = null;
            Logger.info('QuizManager', `Switched to SYSTEM quiz for ${this.topic}`);
        }

        // Restart question immediately to reflect source change
        this.nextQuestion(true);
        this.io.emit('quizSourceChanged', {
            source: this.quizSource === 'user' ? 'USER' : 'SYSTEM',
            ownerUserId: this.activeUserId || null
        });
    }

    clearUserQuizIfOwner(userId) {
        if (this.activeUserId && this.activeUserId.toString() === userId.toString()) {
            this.setQuizSource({ source: 'system' });
        }
    }

    async getNextQuestionData() {
        if (this.quizSource === 'user' && (!this.activeUserQuiz || !Array.isArray(this.activeUserQuiz.questions) || this.activeUserQuiz.questions.length === 0)) {
            Logger.warn('QuizManager', 'Active user quiz missing or empty. Reverting to system.');
            this.quizSource = 'system';
            this.activeUserQuiz = null;
            this.activeUserId = null;
        }

        if (this.quizSource === 'user' && this.activeUserQuiz && Array.isArray(this.activeUserQuiz.questions)) {
            const list = this.activeUserQuiz.questions;
            if (list.length > 0) {
                const idx = Math.floor(Math.random() * list.length);
                const q = list[idx];
                // Transform to QuizManager internal shape
                const correct = q.answers.find((a) => a.isCorrect);
                const wrong = q.answers.filter((a) => !a.isCorrect).map((a) => a.text);

                return {
                    _id: `user-${this.activeUserQuiz._id || 'quiz'}-${idx}-${Date.now()}`,
                    questionText: q.question,
                    difficulty: 1,
                    correctAnswer: correct ? correct.text : '',
                    wrongAnswers: wrong,
                    source: 'user',
                };
            }
        }

        // Default: system questions
        const questions = await Question.aggregate([
            { $match: { topic: this.topic } },
            { $sample: { size: 1 } },
        ]);
        if (questions.length > 0) {
            return { ...questions[0], source: 'system' };
        }
        return null;
    }

    async nextQuestion(force = false) {
        if (!this.isActive) return;

        if (this.isTransitioning && !force) return;
        this.isTransitioning = true;

        if (this.questionTimer) {
            clearTimeout(this.questionTimer);
            this.questionTimer = null;
        }

        try {
            this.clearQuizFood();

            this.currentQuestion = await this.getNextQuestionData();

            if (!this.currentQuestion) {
                this.currentQuestion = {
                    _id: 'fallback-' + Date.now(),
                    questionText: `(fallback) 2 + 2?`,
                    difficulty: 1,
                    correctAnswer: '4',
                    wrongAnswers: ['3', '5', '22'],
                    source: 'system',
                };
            }
            // Ensure ID exists
            if (!this.currentQuestion._id) this.currentQuestion._id = 'q-' + Date.now();

            this.questionEndTime = Date.now() + this.questionDuration;
            this.broadcastQuestion();
            this.spawnAnswerFoods();

            // Strict 30s Timer
            this.questionTimer = setTimeout(() => {
                Logger.info('QuizManager', `Question timeout. Moving to next question.`);
                this.nextQuestion();
            }, this.questionDuration);
        } catch (e) {
            Logger.error('QuizManager', 'Error fetching question:', e);
        } finally {
            setTimeout(() => {
                this.isTransitioning = false;
            }, 500);
        }
    }

    broadcastQuestion() {
        if (this.currentQuestion) {
            this.io.emit('newQuestion', {
                text: this.currentQuestion.questionText,
                difficulty: this.currentQuestion.difficulty,
                endTime: this.questionEndTime,
            });
        }
    }

    clearQuizFood() {
        const allFood = this.foodManager.getAllFood();
        const idsToRemove = [];
        Object.keys(allFood).forEach((id) => {
            if (allFood[id].type === 'text') {
                this.foodManager.removeFood(id);
                idsToRemove.push(id);
            }
        });
        if (idsToRemove.length > 0) {
            this.io.emit('clearQuizFood', idsToRemove);
        }
    }

    spawnAnswerFoods() {
        if (!this.currentQuestion) return;
        if (!this.currentQuestion.correctAnswer || !this.currentQuestion.wrongAnswers || this.currentQuestion.wrongAnswers.length === 0) {
            Logger.warn('QuizManager', 'Invalid question payload, skipping spawn');
            return;
        }
        const spawnedPositions = [];
        const spawnedFoodBatch = [];
        const TOTAL = 300;
        const CORRECT_COUNT = Math.floor(TOTAL / 4); // 1/4 correct
        const WRONG_COUNT = TOTAL - CORRECT_COUNT;
        const qId = this.currentQuestion._id.toString(); // Bind food to this version of question

        const batches = [];
        const batchSize = 50;
        let pendingCorrect = CORRECT_COUNT;
        let pendingWrong = WRONG_COUNT;

        while (pendingCorrect > 0 || pendingWrong > 0) {
            const batch = [];
            for (let i = 0; i < batchSize && (pendingCorrect > 0 || pendingWrong > 0); i++) {
                const useCorrect = pendingCorrect > 0 && (pendingWrong === 0 || i % 4 === 0);
                if (useCorrect) {
                    const food = this.spawnTextFoodNear(
                        Math.random() * WORLD_SIZE,
                        Math.random() * WORLD_SIZE,
                        this.currentQuestion.correctAnswer,
                        true,
                        spawnedPositions,
                        2000,
                        qId
                    );
                    if (food) batch.push(food);
                    pendingCorrect--;
                } else if (pendingWrong > 0) {
                    const wrongList = this.currentQuestion.wrongAnswers;
                    const wrongAns = wrongList[Math.floor(Math.random() * wrongList.length)];
                    const food = this.spawnTextFoodNear(
                        Math.random() * WORLD_SIZE,
                        Math.random() * WORLD_SIZE,
                        wrongAns,
                        false,
                        spawnedPositions,
                        2000,
                        qId
                    );
                    if (food) batch.push(food);
                    pendingWrong--;
                }
            }
            if (batch.length) batches.push(batch);
        }

        // Emit batches spaced by 1s to reduce spikes
        batches.forEach((batch, idx) => {
            setTimeout(() => this.io.emit('batchFood', batch), idx * 1000);
        });
    }

    spawnTextFoodNear(
        centerX,
        centerY,
        text,
        isCorrect,
        spawnedPositions,
        searchRadius = 400,
        questionId
    ) {
        let x,
            y,
            isValid = false;
        let attempts = 0;
        const minDistance = 60;

        while (!isValid && attempts < 20) {
            const radius = Math.random() * searchRadius;
            const angle = Math.random() * Math.PI * 2;
            x = centerX + Math.cos(angle) * radius;
            y = centerY + Math.sin(angle) * radius;
            x = Math.max(50, Math.min(x, WORLD_SIZE - 50));
            y = Math.max(50, Math.min(y, WORLD_SIZE - 50));

            isValid = true;
            for (const pos of spawnedPositions) {
                const dx = x - pos.x;
                const dy = y - pos.y;
                if (dx * dx + dy * dy < minDistance * minDistance) {
                    isValid = false;
                    break;
                }
            }
            attempts++;
        }

        if (isValid || attempts >= 20) {
            spawnedPositions.push({ x, y });
            const food = this.foodManager.spawnFood(
                x,
                y,
                isCorrect ? 0x00ff00 : 0xff0000,
                'text',
                isCorrect ? 50 : 10,
                {
                    text: text,
                    isCorrect: isCorrect,
                    isQuizFood: true,
                    questionId: questionId, // Metadata
                },
                false
            );
            return food;
        }
        return null;
    }

    checkAnswer(food) {
        if (!food.data || !food.data.isQuizFood) return null;

        // VALIDATION: Check if this food belongs to current question
        // If question changed, old food is invalid (even if client hasn't deleted it yet)
        if (!this.currentQuestion || !this.currentQuestion._id) return null;
        if (food.data.questionId !== this.currentQuestion._id.toString()) {
            Logger.warn('QuizManager', 'Player ate outdated answer. Ignoring.');
            return null;
        }

        if (food.data.isCorrect) {
            // Correct -> +50 Score (Scoring updated from 100)
            return { correct: true, reward: 50 };
            // NOTE: REMOVED setTimeout nextQuestion. Strict 30s timer rules.
        } else {
            // Wrong -> -30 Score (Penalty updated from 20)
            return { correct: false, penalty: 30 };
        }
    }

    update() {
        if (this.isActive && Date.now() > this.roundEndTime) {
            this.endRound();
        }
    }

    endRound() {
        this.isActive = false;
        const gameServer = this.container.has('gameServer') ? this.container.get('gameServer') : null;
        if (gameServer) gameServer.matchStarted = false;

        if (this.questionTimer) clearTimeout(this.questionTimer);
        if (this.cleanupTimer) clearInterval(this.cleanupTimer);

        this.currentQuestion = null;

        // Determine winner: most correct answers, tie-break by score then name
        const players = this.playerManager.getAllPlayers();
        let winner = null;
        const asArray = Object.values(players);
        asArray.forEach((p) => {
            const c = p.correctAnswers || 0;
            if (!winner ||
                c > (winner.correctAnswers || 0) ||
                (c === (winner.correctAnswers || 0) && (p.score || 0) > (winner.score || 0)) ||
                (c === (winner.correctAnswers || 0) && (p.score || 0) === (winner.score || 0) && (p.name || '') < (winner.name || ''))
            ) {
                winner = p;
            }
        });

        const results = asArray.map((p) => ({
            id: p.id,
            name: p.name,
            questionsSolved: p.correctAnswers || 0,
            score: p.score || 0,
        })).sort((a, b) => b.questionsSolved - a.questionsSolved || b.score - a.score);

        this.io.emit('result', {
            winner: winner
                ? {
                      id: winner.id,
                      name: winner.name,
                      questionsSolved: winner.correctAnswers || 0,
                      score: winner.score || 0,
                  }
                : null,
            players: results,
            mode: this.isCustom ? 'custom' : 'quiz',
        });

        // FORCE KILL ALL PLAYERS (custom only, public arena keeps players for next round)
        if (this.isCustom && this.playerManager) {
            this.playerManager.killAllPlayers();
        }

        if (this.isCustom) {
            // Close room after short delay so clients can see result
            setTimeout(() => {
                if (gameServer) gameServer.destroy();
                this.io.emit('room_closed');
                if (this.roomCode) {
                    try {
                        const RoomRegistry = require('../room/RoomRegistry');
                        RoomRegistry.closeRoom(this.roomCode, 'round_end');
                    } catch (err) {
                        Logger.error('QuizManager', 'Failed to close custom room after endRound', err);
                    }
                }
            }, 1500);
        } else {
            // Public arena: restart next round
            setTimeout(() => {
                this.startRound();
            }, 3000);
        }
    }

    cleanupJunkFood() {
        if (!this.isActive) return;

        const allFood = this.foodManager.getAllFood();
        const idsToRemove = [];

        // Collect non-text food (Regular, Coins, etc.)
        // EXCEPTION: Keep a minimum amount of coins?
        // User said: "remove all food except answer".
        // Let's stick to strict removal to ensure performance.

        Object.keys(allFood).forEach((id) => {
            if (allFood[id].type !== 'text') {
                this.foodManager.removeFood(id, false); // Silent remove
                idsToRemove.push(id);
            }
        });

        if (idsToRemove.length > 0) {
            this.io.emit('batchRemove', idsToRemove);
            Logger.debug('QuizManager', `Cleaned up ${idsToRemove.length} junk items.`);
        }
    }
}

module.exports = QuizManager;
