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
            const options = { credentials: 'include', headers: {} };
            if (source === 'USER') {
                url = `${CONFIG.SERVER_URL}/api/user-quiz/play?category=${topic}`;
                const token = localStorage.getItem('token');
                if (token) {
                    options.headers.Authorization = `Bearer ${token}`;
                }
            } else {
                url = `${CONFIG.SERVER_URL}/api/questions?topic=${topic}`;
            }
            Logger.info('QuizService', `Fetching questions from ${url}`);

            const response = await fetch(url, options);
            if (!response.ok) {
                throw new Error(`Failed to fetch questions (${response.status})`);
            }

            const raw = await response.json();
            this.questions = this.normalizeQuestions(raw, source);
            Logger.info('QuizService', `Fetched ${this.questions.length} questions`);
            return this.questions;
        } catch (error) {
            Logger.error('QuizService', `Error fetching questions (source=${source})`, error);
            // Fallback to SYSTEM if USER fetch fails
            if (source === 'USER') {
                Logger.warn('QuizService', 'Falling back to SYSTEM questions');
                return this.fetchQuestions(topic, 'SYSTEM');
            }
            return [];
        }
    }

    normalizeQuestions(raw, source) {
        if (!Array.isArray(raw)) return [];
        // Server SYSTEM format already matches: { questionText, correctAnswer, wrongAnswers }
        if (source === 'SYSTEM') return raw;

        // USER format: { question: string, answers: [{text,isCorrect}] }
        return raw.map((q) => {
            const answers = Array.isArray(q.answers) ? q.answers : [];
            const correct = answers.find((a) => a.isCorrect) || answers[0] || { text: '' };
            const wrongs = answers.filter((a) => !a.isCorrect).map((a) => a.text);
            // ensure 3 wrongs by padding blanks
            while (wrongs.length < 3) wrongs.push('');
            return {
                questionText: q.question || '',
                correctAnswer: correct.text || '',
                wrongAnswers: wrongs.slice(0, 3),
            };
        });
    }

    getRandomQuestion() {
        if (this.questions.length === 0) return null;
        const randomIndex = Math.floor(Math.random() * this.questions.length);
        return this.questions[randomIndex];
    }
}

export const quizService = new QuizService();
