/**
 * Client-side helper to request AI parsing/normalization if backend supports it.
 * Falls back to server-side parse endpoint when AI unavailable.
 */
import { CONFIG } from '../../config/AppConfig';
import { Logger } from '../../utils/Logger';

export class QuizAiParserService {
    async parse({ rawText, category }) {
        try {
            const res = await fetch(`${CONFIG.SERVER_URL}/api/user-quiz/ai-parse`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: this._authHeader(),
                },
                credentials: 'include',
                body: JSON.stringify({ rawText, category }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.message || 'AI parse failed');
            return data;
        } catch (e) {
            Logger.error('QuizAiParserService', 'AI parse failed, falling back', e);
            throw e;
        }
    }

    _authHeader() {
        const token = localStorage.getItem('token');
        return token ? `Bearer ${token}` : undefined;
    }
}

export const quizAiParserService = new QuizAiParserService();
