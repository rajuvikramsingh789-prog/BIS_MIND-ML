/* Know Your BIS - API Client Module */

const API_BASE = '/api';

class APIClient {
    static async request(endpoint, options = {}) {
        const url = `${API_BASE}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        try {
            const response = await fetch(url, config);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || `HTTP error! Status: ${response.status}`);
            }
            return data;
        } catch (err) {
            console.error(`API Error on [${endpoint}]:`, err.message);
            throw err;
        }
    }

    // Health
    static async checkHealth() {
        return this.request('/health');
    }

    // Chat
    static async sendMessage({ message, conversationId }) {
        return this.request('/chat', {
            method: 'POST',
            body: JSON.stringify({ message, conversationId })
        });
    }

    static async getChatHistory(conversationId) {
        return this.request(`/chat/${conversationId}`);
    }

    static async clearChat(conversationId) {
        return this.request(`/chat/${conversationId}`, {
            method: 'DELETE'
        });
    }

    // Product Standard Recommender
    static async recommendStandard(productDescription) {
        return this.request('/recommend-standard', {
            method: 'POST',
            body: JSON.stringify({ productDescription })
        });
    }

    // Standards Search & Catalog
    static async searchStandards(query, category = 'All') {
        const params = new URLSearchParams();
        if (query) params.append('q', query);
        if (category && category !== 'All') params.append('category', category);
        return this.request(`/search?${params.toString()}`);
    }

    static async getStandardDetails(idOrNumber) {
        return this.request(`/standards/${encodeURIComponent(idOrNumber)}`);
    }

    // Services
    static async getServices() {
        return this.request('/services');
    }

    static async getServiceDetails(id) {
        return this.request(`/services/${id}`);
    }

    // Feedback
    static async submitFeedback({ messageId, queryText, rating, comments }) {
        return this.request('/feedback', {
            method: 'POST',
            body: JSON.stringify({ messageId, queryText, rating, comments })
        });
    }
}

window.APIClient = APIClient;
