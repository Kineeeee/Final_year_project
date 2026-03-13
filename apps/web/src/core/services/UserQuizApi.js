import { CONFIG } from '../../config/AppConfig';
import { Logger } from '../../utils/Logger';

const BASE_URL = `${CONFIG.SERVER_URL}/api/user-quiz`;

function authHeaders() {
    const token = localStorage.getItem('token');
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
}

async function request(path, { method = 'GET', body, isForm = false } = {}) {
    const options = {
        method,
        credentials: 'include',
        headers: { ...authHeaders() },
    };

    if (body && !isForm) {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
    }
    if (isForm) {
        options.body = body;
    }

    const res = await fetch(`${BASE_URL}${path}`, options);
    let data = null;
    try {
        data = await res.json();
    } catch (e) {
        Logger.error('UserQuizApi', 'Failed to parse response', e);
    }
    if (!res.ok) {
        const message = data?.message || 'Request failed';
        throw new Error(message);
    }
    return data;
}

export const userQuizApi = {
    getStatus(category) {
        return request(`/status?category=${category}`);
    },
    parseText(category, rawText) {
        return request('/parse', { method: 'POST', body: { category, rawText } });
    },
    uploadDocx(category, file) {
        const form = new FormData();
        form.append('category', category);
        form.append('file', file);
        return request('/upload', { method: 'POST', body: form, isForm: true });
    },
    getQuiz(category) {
        return request(`/play?category=${category}`);
    },
    saveQuiz(category, questions) {
        return request('/save', { method: 'POST', body: { category, questions } });
    },
    setQuizSource(category, quizSource) {
        return request('/source', { method: 'POST', body: { category, quizSource } });
    },
};
