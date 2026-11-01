/* Know Your BIS - AI Assistant Chatbot Logic */

document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('chat-messages')) return;

    initChatbot();
});

let currentConversationId = localStorage.getItem('current_conversation_id') || null;

function initChatbot() {
    const sendBtn = document.getElementById('chat-send-btn');
    const inputArea = document.getElementById('chat-input');
    const newChatBtn = document.getElementById('new-chat-btn');
    const clearChatBtn = document.getElementById('clear-chat-btn');

    if (sendBtn && inputArea) {
        sendBtn.addEventListener('click', handleUserSendMessage);
        inputArea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleUserSendMessage();
            }
        });
    }

    if (newChatBtn) {
        newChatBtn.addEventListener('click', startNewChatSession);
    }

    if (clearChatBtn) {
        clearChatBtn.addEventListener('click', clearCurrentChat);
    }

    // Load existing history if available
    if (currentConversationId) {
        loadConversationHistory(currentConversationId);
    } else {
        startNewChatSession();
    }
}

async function startNewChatSession() {
    currentConversationId = `conv_${Date.now()}`;
    localStorage.setItem('current_conversation_id', currentConversationId);

    const messagesContainer = document.getElementById('chat-messages');
    messagesContainer.innerHTML = '';

    // Initial Welcome Message
    appendAssistantMessage({
        answer: `Namaste! I am **Know Your BIS**, your AI-powered guide for Bureau of Indian Standards compliance, IS numbers, Quality Control Orders (QCOs), and certification schemes.\n\nHow may I assist your business or technical research today?`,
        confidenceScore: 1.0,
        citations: [],
        followUpQuestions: [
            "Is IS 1786 mandatory for TMT steel bars?",
            "What are the testing requirements for packaged drinking water under IS 14543?",
            "How does Gold Hallmarking with 6-digit HUID work?"
        ]
    });

    updateHistorySidebar();
}

async function loadConversationHistory(convId) {
    try {
        const historyData = await APIClient.getChatHistory(convId);
        const messagesContainer = document.getElementById('chat-messages');
        messagesContainer.innerHTML = '';

        if (historyData && historyData.messages) {
            historyData.messages.forEach(msg => {
                if (msg.sender === 'user') {
                    appendUserMessage(msg.content);
                } else {
                    appendAssistantMessage({
                        messageId: msg.id,
                        answer: msg.content,
                        confidenceScore: msg.confidenceScore,
                        citations: msg.citations,
                        followUpQuestions: msg.followUpQuestions
                    });
                }
            });
        }
    } catch (err) {
        startNewChatSession();
    }
}

async function handleUserSendMessage() {
    const inputArea = document.getElementById('chat-input');
    const query = inputArea.value.trim();
    if (!query) return;

    // Clear input
    inputArea.value = '';

    // Append User Message
    appendUserMessage(query);

    // Show Typing Indicator
    showTypingIndicator();

    try {
        const response = await APIClient.sendMessage({
            message: query,
            conversationId: currentConversationId
        });

        removeTypingIndicator();

        if (response.conversationId) {
            currentConversationId = response.conversationId;
            localStorage.setItem('current_conversation_id', currentConversationId);
        }

        appendAssistantMessage(response);
        updateHistorySidebar();

    } catch (err) {
        removeTypingIndicator();
        appendAssistantMessage({
            answer: `❌ Sorry, an error occurred while querying the BIS knowledge base: ${err.message}. Please try again.`,
            confidenceScore: 0,
            citations: [],
            followUpQuestions: []
        });
    }
}

function appendUserMessage(text) {
    const messagesContainer = document.getElementById('chat-messages');
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message-bubble user';
    msgDiv.textContent = text;
    messagesContainer.appendChild(msgDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function appendAssistantMessage({ messageId, answer, confidenceScore, citations, followUpQuestions }) {
    const messagesContainer = document.getElementById('chat-messages');
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message-bubble assistant';

    let html = '';

    // Confidence meter
    if (confidenceScore !== undefined && confidenceScore !== null && confidenceScore > 0) {
        const percent = Math.round(confidenceScore * 100);
        html += `
            <div class="confidence-meter">
                <span>Confidence: <strong>${percent}%</strong></span>
                <div class="confidence-bar">
                    <div class="confidence-fill" style="width: ${percent}%"></div>
                </div>
            </div>
        `;
    }

    // Parsed Markdown Answer
    html += `<div class="markdown-body">${parseSimpleMarkdown(answer)}</div>`;

    // Citations Drawer
    if (citations && citations.length > 0) {
        html += `<div class="citations-box"><strong>📚 Verified Sources & Citations:</strong><br>`;
        citations.forEach(c => {
            html += `<a href="${c.url}" target="_blank" class="citation-chip">📌 ${c.isNumber} ${c.clause ? '(' + c.clause + ')' : ''}</a>`;
        });
        html += `</div>`;
    }

    // Follow up questions
    if (followUpQuestions && followUpQuestions.length > 0) {
        html += `<div style="margin-top: 1rem; font-size: 0.85rem; font-weight: 600; color: var(--text-muted);">Suggested Follow-up Questions:</div>`;
        html += `<div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.4rem;">`;
        followUpQuestions.forEach(q => {
            html += `<button class="quick-tag follow-up-btn" style="color: var(--primary-color); border-color: var(--primary-color); background: transparent;">${q}</button>`;
        });
        html += `</div>`;
    }

    // Feedback Buttons (Thumbs Up / Down)
    if (messageId) {
        html += `
            <div style="margin-top: 0.75rem; display: flex; align-items: center; gap: 0.75rem; font-size: 0.8rem; color: var(--text-muted);">
                <span>Was this response helpful?</span>
                <button class="feedback-btn" data-id="${messageId}" data-rating="1" style="background: none; border: none; cursor: pointer; font-size: 1rem;">👍</button>
                <button class="feedback-btn" data-id="${messageId}" data-rating="-1" style="background: none; border: none; cursor: pointer; font-size: 1rem;">👎</button>
            </div>
        `;
    }

    msgDiv.innerHTML = html;
    messagesContainer.appendChild(msgDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Attach listener to follow-up buttons
    msgDiv.querySelectorAll('.follow-up-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById('chat-input').value = btn.textContent;
            handleUserSendMessage();
        });
    });

    // Attach listener to feedback buttons
    msgDiv.querySelectorAll('.feedback-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const rating = parseInt(btn.getAttribute('data-rating'));
            const id = btn.getAttribute('data-id');
            await APIClient.submitFeedback({ messageId: id, rating });
            btn.parentElement.innerHTML = '✨ <em>Thank you for your feedback!</em>';
        });
    });
}

function showTypingIndicator() {
    const messagesContainer = document.getElementById('chat-messages');
    const indicator = document.createElement('div');
    indicator.id = 'typing-indicator-box';
    indicator.className = 'message-bubble assistant';
    indicator.innerHTML = `
        <div class="typing-indicator">
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <span style="font-size: 0.85rem; color: var(--text-muted); margin-left: 0.5rem;">Analyzing official BIS evidence...</span>
        </div>
    `;
    messagesContainer.appendChild(indicator);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function removeTypingIndicator() {
    const box = document.getElementById('typing-indicator-box');
    if (box) box.remove();
}

async function clearCurrentChat() {
    if (currentConversationId) {
        await APIClient.clearChat(currentConversationId);
    }
    startNewChatSession();
}

function updateHistorySidebar() {
    const historyList = document.getElementById('history-list');
    if (!historyList) return;

    let history = JSON.parse(localStorage.getItem('chat_sessions_history') || '[]');
    
    // Add current session if not present
    if (currentConversationId && !history.some(h => h.id === currentConversationId)) {
        history.unshift({ id: currentConversationId, title: 'Current Session', date: new Date().toLocaleTimeString() });
    }

    historyList.innerHTML = '';
    history.forEach(item => {
        const div = document.createElement('div');
        div.className = `history-item ${item.id === currentConversationId ? 'active' : ''}`;
        div.textContent = `💬 ${item.title || 'Chat Session'}`;
        div.addEventListener('click', () => {
            currentConversationId = item.id;
            localStorage.setItem('current_conversation_id', currentConversationId);
            loadConversationHistory(currentConversationId);
            updateHistorySidebar();
        });
        historyList.appendChild(div);
    });

    localStorage.setItem('chat_sessions_history', JSON.stringify(history.slice(0, 15)));
}

// Markdown Parser Helper
function parseSimpleMarkdown(text) {
    if (!text) return '';
    let parsed = text;

    // Convert HTML characters safely
    parsed = parsed.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    // Headers
    parsed = parsed.replace(/^#### (.*$)/gim, '<h4>$1</h4>');
    parsed = parsed.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    parsed = parsed.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    parsed = parsed.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    // Bold & Italic
    parsed = parsed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    parsed = parsed.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // GitHub Alerts
    parsed = parsed.replace(/&gt;\s*\[!IMPORTANT\]\n&gt;\s*(.*)/gi, '<div style="background-color: #fee2e2; border-left: 4px solid #ef4444; padding: 0.75rem; margin: 0.5rem 0; border-radius: 4px; color: #991b1b;"><strong>IMPORTANT:</strong> $1</div>');
    parsed = parsed.replace(/&gt;\s*\[!NOTE\]\n&gt;\s*(.*)/gi, '<div style="background-color: #e0f2fe; border-left: 4px solid #0284c7; padding: 0.75rem; margin: 0.5rem 0; border-radius: 4px; color: #075985;"><strong>NOTE:</strong> $1</div>');

    // Links [Text](URL)
    parsed = parsed.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

    // Unordered Lists
    parsed = parsed.replace(/^\s*-\s+(.*$)/gim, '<li>$1</li>');
    parsed = parsed.replace(/(<li>.*<\/li>)/sim, '<ul>$1</ul>');

    // Line breaks
    parsed = parsed.replace(/\n\n/g, '<br><br>');

    return parsed;
}
