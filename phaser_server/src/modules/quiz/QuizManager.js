const Question = require('../../models/Question');
const Logger = require('../../utils/Logger');
const { WORLD_SIZE } = require('../../config/constants');

class QuizManager {
    constructor(io, container, topic) {
        this.io = io;
        this.container = container;
        this.topic = topic; // 'math' or 'english'

        this.currentQuestion = null;
        this.roundDuration = 5 * 60 * 1000; // 5 minutes
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

    async nextQuestion() {
        if (!this.isActive) return;

        if (this.isTransitioning) return;
        this.isTransitioning = true;

        if (this.questionTimer) {
            clearTimeout(this.questionTimer);
            this.questionTimer = null;
        }

        try {
            this.clearQuizFood();

            const questions = await Question.aggregate([
                { $match: { topic: this.topic } },
                { $sample: { size: 1 } },
            ]);

            if (questions.length > 0) {
                this.currentQuestion = questions[0];
            } else {
                this.currentQuestion = {
                    _id: 'fallback-' + Date.now(),
                    questionText: `(fallback) 2 + 2?`,
                    difficulty: 1,
                    correctAnswer: '4',
                    wrongAnswers: ['3', '5', '22'],
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
        const spawnedPositions = [];
        const spawnedFoodBatch = [];
        const CORRECT_COUNT = 50;
        const WRONG_COUNT = 150;
        const qId = this.currentQuestion._id.toString(); // Bind food to this version of question

        // 1. Correct Answers
        for (let i = 0; i < CORRECT_COUNT; i++) {
            const food = this.spawnTextFoodNear(
                Math.random() * WORLD_SIZE,
                Math.random() * WORLD_SIZE,
                this.currentQuestion.correctAnswer,
                true,
                spawnedPositions,
                2000,
                qId
            );
            if (food) spawnedFoodBatch.push(food);
        }

        // 2. Wrong Answers
        const wrongList = this.currentQuestion.wrongAnswers;
        for (let i = 0; i < WRONG_COUNT; i++) {
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
            if (food) spawnedFoodBatch.push(food);
        }

        this.io.emit('batchFood', spawnedFoodBatch);
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
        this.isActive = true; // Wait for kill? No, inactive.
        this.isActive = false;

        if (this.questionTimer) clearTimeout(this.questionTimer);
        if (this.cleanupTimer) clearInterval(this.cleanupTimer);

        this.currentQuestion = null;

        // Find winner BEFORE killing everyone
        const players = this.playerManager.getAllPlayers();
        let winner = null;
        let maxScore = -1;

        Object.values(players).forEach((p) => {
            if (p.score > maxScore) {
                maxScore = p.score;
                winner = p;
            }
        });

        this.io.emit('roundEnd', {
            winner: winner ? { name: winner.name, score: winner.score, color: winner.color } : null,
        });

        // FORCE KILL ALL PLAYERS
        if (this.playerManager) {
            this.playerManager.killAllPlayers();
        }

        // Auto Restart
        setTimeout(() => this.startRound(), 10000);
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
