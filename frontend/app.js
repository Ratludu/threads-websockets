const API_URL = 'http://localhost:8000';
const WS_URL = 'ws://localhost:8000';

let currentThread = null;
let websocket = null;
let author = localStorage.getItem('author') || '';
let commentsById = new Map(); // Track comments for efficient updates

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
        displayComments((comments ?? []).reverse());
    } catch (error) {
        console.error('Error loading comments:', error);
        commentsById.clear();
        commentsContainer.innerHTML = '<div class="empty-state">Error loading comments. Please try again.</div>';
    }
}

// Display Comments
function displayComments(comments) {
    commentsContainer.innerHTML = '';
    commentsById.clear();

    if (!comments || comments.length === 0) {
        commentsContainer.innerHTML = '<div class="empty-state">No comments yet. Be the first to comment!</div>';
        return;
    }

    comments.forEach(comment => {
        addCommentToDOM(comment, { scroll: false });
    });

    scrollToBottom();
}

// Add or update a single comment in the DOM
function addCommentToDOM(comment, options = {}) {
    if (!comment || !comment.comment_id) {
        return;
    }

    const { scroll = true } = options;

    const emptyState = commentsContainer.firstElementChild;
    if (emptyState && emptyState.classList.contains('empty-state')) {
        commentsContainer.innerHTML = '';
    }

    const timestampText = formatTimestamp(comment.timestamp);
    const authorText = (comment.author || 'Anonymous').trim() || 'Anonymous';
    const contentText = comment.content ?? '';

    let commentEl = document.querySelector(`[data-comment-id="${comment.comment_id}"]`);
    let justCreated = false;

    if (!commentEl) {
        commentEl = document.createElement('div');
        commentEl.className = 'comment';
        commentEl.setAttribute('data-comment-id', comment.comment_id);

        const header = document.createElement('div');
        header.className = 'comment-header';

        const authorSpan = document.createElement('span');
        authorSpan.className = 'comment-author';

        const meta = document.createElement('div');
        meta.className = 'comment-meta';

        const timeSpan = document.createElement('span');
        timeSpan.className = 'comment-time';

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'delete-btn';
        deleteBtn.title = 'Delete comment';
        deleteBtn.textContent = '🗑️';
        deleteBtn.addEventListener('click', () => deleteComment(comment.comment_id));

        meta.append(timeSpan, deleteBtn);
        header.append(authorSpan, meta);

        const contentDiv = document.createElement('div');
        contentDiv.className = 'comment-content';

        commentEl.append(header, contentDiv);
        commentsContainer.appendChild(commentEl);
        justCreated = true;
    }

    const authorSpan = commentEl.querySelector('.comment-author');
    const timeSpan = commentEl.querySelector('.comment-time');
    const contentDiv = commentEl.querySelector('.comment-content');

    if (authorSpan) authorSpan.textContent = authorText;
    if (timeSpan) timeSpan.textContent = timestampText;
    if (contentDiv) contentDiv.textContent = contentText;

    commentsById.set(comment.comment_id, {
        ...comment,
        author: authorText,
        content: contentText,
    });

    if (justCreated && scroll) {
        scrollToBottom();
    }
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
        const data = JSON.parse(event.data);
        console.log('Received WebSocket data:', data);

        if (data.type === 'new_comment' && data.comment) {
            addCommentToDOM(data.comment);
        } else if (data.type === 'delete_comment' && data.comment?.comment_id) {
            removeCommentFromDOM(data.comment.comment_id);
        }
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
                content,
            }),
        });

        if (!response.ok) {
            throw new Error('Failed to send comment');
        }

        const createdComment = await response.json();
        addCommentToDOM(createdComment);

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

// Delete Comment
async function deleteComment(commentId) {
    if (!currentThread || !commentId) {
        return;
    }

    const existingComment = commentsById.get(commentId);
    if (!existingComment) {
        return;
    }

    removeCommentFromDOM(commentId);

    try {
        const response = await fetch(`${API_URL}/threads/${currentThread}/comments/${commentId}/`, {
            method: 'DELETE',
        });

        if (!response.ok) {
            throw new Error('Failed to delete comment');
        }

    } catch (error) {
        console.error('Error deleting comment:', error);
        alert('Failed to delete comment. Please try again.');
        addCommentToDOM(existingComment, { scroll: false });
    }
}

// Remove Comment from DOM and state
function removeCommentFromDOM(commentId) {
    if (!commentId) {
        return;
    }

    commentsById.delete(commentId);

    const commentEl = document.querySelector(`[data-comment-id="${commentId}"]`);
    if (commentEl) {
        commentEl.remove();
    }

    if (commentsById.size === 0) {
        commentsContainer.innerHTML = '<div class="empty-state">No comments yet. Be the first to comment!</div>';
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

function formatTimestamp(value) {
    if (!value) {
        return '';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleString();
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (websocket) {
        websocket.close();
    }
});