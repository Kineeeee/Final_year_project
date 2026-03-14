import { CONFIG } from '../../config/AppConfig';

function getBaseUrl() {
    return `${CONFIG.SERVER_URL}/api/chatbot`;
}

class ChatbotApi {
    async ask(message, history = []) {
        const token = localStorage.getItem('token');
        const headers = {
            'Content-Type': 'application/json',
        };

        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }

        const res = await fetch(`${getBaseUrl()}/ask`, {
            method: 'POST',
            credentials: 'include',
            headers,
            body: JSON.stringify({ message, history }),
        });

        let data = null;
        try {
            data = await res.json();
        } catch {
            data = null;
        }

        if (!res.ok) {
            throw new Error(data?.message || 'Chatbot request failed');
        }

        return data;
    }
}

export const chatbotApi = new ChatbotApi();
