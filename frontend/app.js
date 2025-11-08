const API_URL = 'http://localhost:8000';
const WS_URL = 'ws://localhost:8000';

let currentThread = null;
let websocket = null;
let author = localStorage.getItem('author') || '';

// DOM Elements
const threadSelect = document.getElementById('thread-select');
const statusIndicator = document.getElementById('status');
const mainContent = document.getElementById('main-content');
const commentsContainer = document.getElementById('comments-container');
const authorInput = document.getElementById('author-input');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const refreshBtn = document.getElementById('refresh-btn');

// Initialize
authorInput.value = author;

// Event Listeners
threadSelect.addEventListener('change', handleThreadChange);
sendBtn.addEventListener('click', sendComment);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
        sendComment();
    }
});
authorInput.addEventListener('input', (e) => {
    author = e.target.value;
    localStorage.setItem('author', author);
});
refreshBtn.addEventListener('click', () => {
    if (currentThread) {
        loadComments(currentThread);
    }
});

// Thread Selection Handler
async function handleThreadChange(e) {
    const threadId = e.target.value;
    
    if (!threadId) {
        mainContent.style.display = 'none';
        if (websocket) {
            websocket.close();
        }
        return;
    }

    currentThread = threadId;
    mainContent.style.display = 'flex';
    
    // Load existing comments
    await loadComments(threadId);
    
    // Connect to WebSocket
    connectWebSocket(threadId);
}

// Load Comments from API
async function loadComments(threadId) {
    commentsContainer.innerHTML = '<div class="loading">Loading comments...</div>';
    
    try {
        const response = await fetch(`${API_URL}/threads/${threadId}/comments/`);
        
        if (!response.ok) {
            throw new Error('Failed to load comments');
        }
        
        const comments = await response.json();
        
        if (comments.length === 0) {
            commentsContainer.innerHTML = '<div class="empty-state">No comments yet. Be the first to comment!</div>';
        } else {
            displayComments(comments.reverse());
        }
    } catch (error) {
        console.error('Error loading comments:', error);
        commentsContainer.innerHTML = '<div class="empty-state">Error loading comments. Please try again.</div>';
    }
}

// Display Comments
function displayComments(comments) {
    commentsContainer.innerHTML = '';
    comments.forEach(comment => {
        addCommentToDOM(comment);
    });
    scrollToBottom();
}

// Add Single Comment to DOM
function addCommentToDOM(comment) {
    const commentEl = document.createElement('div');
    commentEl.className = 'comment';
    
    const timestamp = new Date(comment.timestamp);
    const timeStr = timestamp.toLocaleString();
    
    commentEl.innerHTML = `
        <div class="comment-header">
            <span class="comment-author">${escapeHtml(comment.author)}</span>
            <span class="comment-time">${timeStr}</span>
        </div>
        <div class="comment-content">${escapeHtml(comment.content)}</div>
    `;
    
    commentsContainer.appendChild(commentEl);
}

// WebSocket Connection
function connectWebSocket(threadId) {
    if (websocket) {
        websocket.close();
    }
    
    updateStatus('connecting');
    
    websocket = new WebSocket(`${WS_URL}/ws/${threadId}/comments/`);
    
    websocket.onopen = () => {
        console.log('WebSocket connected');
        updateStatus('connected');
    };
    
    websocket.onmessage = (event) => {
        const comment = JSON.parse(event.data);
        console.log('Received comment:', comment);
        
        // Add new comment to DOM
        addCommentToDOM(comment);
        scrollToBottom();
    };
    
    websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
        updateStatus('error');
    };
    
    websocket.onclose = () => {
        console.log('WebSocket disconnected');
        updateStatus('disconnected');
    };
}

// Send Comment
async function sendComment() {
    const content = messageInput.value.trim();
    const authorName = authorInput.value.trim() || 'Anonymous';
    
    if (!content || !currentThread) {
        return;
    }
    
    sendBtn.disabled = true;
    
    try {
        const response = await fetch(`${API_URL}/threads/${currentThread}/comments/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                author: authorName,
                content: content,
            }),
        });
        
        if (!response.ok) {
            throw new Error('Failed to send comment');
        }
        
        // Clear input
        messageInput.value = '';
        messageInput.focus();
        
    } catch (error) {
        console.error('Error sending comment:', error);
        alert('Failed to send comment. Please try again.');
    } finally {
        sendBtn.disabled = false;
    }
}

// Update Connection Status
function updateStatus(status) {
    const statusMap = {
        disconnected: '⚪ Disconnected',
        connecting: '🟡 Connecting...',
        connected: '🟢 Connected',
        error: '🔴 Error'
    };
    
    statusIndicator.textContent = statusMap[status] || statusMap.disconnected;
}

// Utility Functions
function scrollToBottom() {
    commentsContainer.scrollTop = commentsContainer.scrollHeight;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (websocket) {
        websocket.close();
    }
});