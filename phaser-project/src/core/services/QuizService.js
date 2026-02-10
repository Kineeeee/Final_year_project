import { Logger } from '../../utils/Logger';
import { CONFIG } from '../../config/constants';

export class QuizService {
    constructor() {
        this.questions = [];
        this.currentTopic = 'math'; // Default
        this.source = 'SYSTEM';
    }

    async fetchQuestions(topic = 'math', source = 'SYSTEM') {
        try {
            this.currentTopic = topic;
            this.source = source;
            let url;
            if (source === 'USER') {
                url = `${CONFIG.SERVER_URL}/api/user-quiz/play?category=${topic}`;
            } else {
                url = `${CONFIG.SERVER_URL}/api/questions?topic=${topic}`;
            }
            Logger.info('QuizService', `Fetching questions from ${url}`);

            const response = await fetch(url);
            if (!response.ok) throw new Error('Failed to fetch questions');

            this.questions = await response.json();
            Logger.info('QuizService', `Fetched ${this.questions.length} questions`);
            return this.questions;
        } catch (error) {
            Logger.error('QuizService', 'Error fetching questions', error);
            return [];
        }
    }

    getRandomQuestion() {
        if (this.questions.length === 0) return null;
        const randomIndex = Math.floor(Math.random() * this.questions.length);
        return this.questions[randomIndex];
    }
}

export const quizService = new QuizService();
