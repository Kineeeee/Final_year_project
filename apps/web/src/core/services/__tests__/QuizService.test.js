import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QuizService } from '../QuizService';
import { CONFIG } from '../../config/AppConfig';

// Mock Config and Logger
vi.mock('../../config/AppConfig', () => ({
    CONFIG: { SERVER_URL: 'http://localhost:3000' }
}));

vi.mock('../../utils/Logger', () => ({
    Logger: {
        info: vi.fn(),
        error: vi.fn()
    }
}));

// Mock fetch
global.fetch = vi.fn();

describe('QuizService', () => {
    let service;

    beforeEach(() => {
        service = new QuizService();
        fetch.mockClear();
    });

    it('should initialize with empty questions', () => {
        expect(service.questions).toEqual([]);
        expect(service.currentTopic).toBe('math');
    });

    it('should fetch questions successfully', async () => {
        const mockQuestions = [
            { id: 1, questionText: '1+1?', correctAnswer: '2', wrongAnswers: ['3', '4'] }
        ];

        fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mockQuestions
        });

        const result = await service.fetchQuestions('english');

        expect(fetch).toHaveBeenCalledWith('http://localhost:3000/api/questions?topic=english');
        expect(service.questions).toEqual(mockQuestions);
        expect(service.currentTopic).toBe('english');
        expect(result).toEqual(mockQuestions);
    });

    it('should handle fetch errors gracefully', async () => {
        fetch.mockResolvedValueOnce({ ok: false });

        const result = await service.fetchQuestions();

        expect(service.questions).toEqual([]); // Should be empty
        expect(result).toEqual([]);
    });

    it('should return a random question', () => {
        service.questions = [{ id: 1 }, { id: 2 }, { id: 3 }];
        const q = service.getRandomQuestion();
        expect(q).toBeDefined();
        expect(service.questions).toContain(q);
    });

    it('should return null if no questions available', () => {
        service.questions = [];
        expect(service.getRandomQuestion()).toBeNull();
    });
});
