const Logger = require('../../../utils/Logger');

class QuizFoodHandler {
    constructor(container) {
        this.container = container;
    }

    get quizManager() {
        if (this.container.has('quizManager')) {
            return this.container.get('quizManager');
        }
        return null;
    }

    get io() { return this.container.get('io'); }

    async consume(player, food) {
        // Quiz Logic
        // Effect: Check Answer, Update Score (Reward/Penalty)

        if (!this.quizManager) {
            // Fallback if no quiz manager (shouldn't happen for 'text' food)
            return { eaten: true, shouldRespawn: true, type: food.type };
        }

        const result = this.quizManager.checkAnswer(food);
        if (result) {
            if (result.correct) {
                player.score += result.reward; // Big Bonus
            } else {
                player.score = Math.max(0, player.score - result.penalty); // Penalty
            }

            // Emit Result for Visual Feedback
            if (this.io) {
                this.io.emit('answerResult', {
                    playerId: player.playerId,
                    correct: result.correct,
                    scoreChange: result.correct ? result.reward : -result.penalty,
                    x: player.x,
                    y: player.y
                });
            }
        }

        // Return result
        // Current logic says non-coin food spawns new food. 
        // We preserve this behavior for now.
        return {
            eaten: true,
            shouldRespawn: true,
            score: player.score,
            type: food.type
        };
    }
}

module.exports = QuizFoodHandler;
