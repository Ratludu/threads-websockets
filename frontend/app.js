const API_URL = 'http://localhost:8000';
const WS_URL = 'ws://localhost:8000';

let currentThread = null;
let websocket = null;
let jwtToken = localStorage.getItem('jwt_token');
let currentUser = localStorage.getItem('current_user');
let commentsById = new Map(); // Track comments for efficient updates

// DOM Elements
const authSection = document.getElementById('auth-section');
const appSection = document.getElementById('app-section');
const authUsername = document.getElementById('auth-username');
const authPassword = document.getElementById('auth-password');
const loginBtn = document.getElementById('login-btn');
const registerBtn = document.getElementById('register-btn');
const logoutBtn = document.getElementById('logout-btn');
const authError = document.getElementById('auth-error');
const currentUserDisplay = document.getElementById('current-user');
const threadSelect = document.getElementById('thread-select');
const statusIndicator = document.getElementById('status');
const mainContent = document.getElementById('main-content');
const commentsContainer = document.getElementById('comments-container');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const refreshBtn = document.getElementById('refresh-btn');

// Initialize
checkAuthStatus();

// Event Listeners
loginBtn.addEventListener('click', handleLogin);
registerBtn.addEventListener('click', handleRegister);
logoutBtn.addEventListener('click', handleLogout);
authPassword.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        handleLogin();
    }
});
threadSelect.addEventListener('change', handleThreadChange);
sendBtn.addEventListener('click', sendComment);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
        sendComment();
    }
});
refreshBtn.addEventListener('click', () => {
    if (currentThread) {
        loadComments(currentThread);
    }
});

// Auth Functions
function checkAuthStatus() {
    if (jwtToken && currentUser) {
        showApp();
    } else {
        showAuth();
    }
}

function showAuth() {
    authSection.style.display = 'block';
    appSection.style.display = 'none';
    authError.style.display = 'none';
    authUsername.value = '';
    authPassword.value = '';
}

function showApp() {
    authSection.style.display = 'none';
    appSection.style.display = 'block';
    currentUserDisplay.textContent = currentUser;
}

function showAuthError(message) {
    authError.textContent = message;
    authError.style.display = 'block';
}

async function handleLogin() {
    const username = authUsername.value.trim();
    const password = authPassword.value.trim();

    if (!username || !password) {
        showAuthError('Please enter both username and password');
        return;
    }

    loginBtn.disabled = true;
    registerBtn.disabled = true;
    authError.style.display = 'none';

    try {
        const response = await fetch(`${API_URL}/auth/login/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Login failed');
        }

        const data = await response.json();
        jwtToken = data.access_token;
        currentUser = username;
        
        localStorage.setItem('jwt_token', jwtToken);
        localStorage.setItem('current_user', currentUser);
        
        showApp();
    } catch (error) {
        console.error('Login error:', error);
        showAuthError(error.message || 'Login failed. Please try again.');
    } finally {
        loginBtn.disabled = false;
        registerBtn.disabled = false;
    }
}

async function handleRegister() {
    const username = authUsername.value.trim();
    const password = authPassword.value.trim();

    if (!username || !password) {
        showAuthError('Please enter both username and password');
        return;
    }

    if (username.length < 3) {
        showAuthError('Username must be at least 3 characters');
        return;
    }

    if (password.length < 6) {
        showAuthError('Password must be at least 6 characters');
        return;
    }

    loginBtn.disabled = true;
    registerBtn.disabled = true;
    authError.style.display = 'none';

    try {
        const response = await fetch(`${API_URL}/auth/register/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Registration failed');
        }

        // Auto-login after registration
        await handleLogin();
    } catch (error) {
        console.error('Registration error:', error);
        showAuthError(error.message || 'Registration failed. Please try again.');
        loginBtn.disabled = false;
        registerBtn.disabled = false;
    }
}

function handleLogout() {
    if (websocket) {
        websocket.close();
    }
    
    jwtToken = null;
    currentUser = null;
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('current_user');
    
    threadSelect.value = '';
    mainContent.style.display = 'none';
    commentsById.clear();
    
    showAuth();
}

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
        const response = await fetch(`${API_URL}/threads/${threadId}/comments/`, {
            headers: {
                'Authorization': `Bearer ${jwtToken}`,
            },
        });
        
        if (response.status === 401) {
            handleLogout();
            throw new Error('Session expired. Please login again.');
        }
        
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
    
    websocket = new WebSocket(`${WS_URL}/ws/${threadId}/comments/?token=${jwtToken}`);
    
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
    
    websocket.onclose = (event) => {
        console.log('WebSocket disconnected');
        updateStatus('disconnected');
        
        // If closed with auth error, logout user
        if (event.code === 1008) {
            handleLogout();
            alert('Authentication failed. Please login again.');
        }
    };
}

// Send Comment
async function sendComment() {
    const content = messageInput.value.trim();

    if (!content || !currentThread) {
        return;
    }

    sendBtn.disabled = true;

    try {
        const response = await fetch(`${API_URL}/threads/${currentThread}/comments/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${jwtToken}`,
            },
            body: JSON.stringify({
                author: currentUser,
                content,
            }),
        });

        if (response.status === 401) {
            handleLogout();
            throw new Error('Session expired. Please login again.');
        }

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
            headers: {
                'Authorization': `Bearer ${jwtToken}`,
            },
        });

        if (response.status === 401) {
            handleLogout();
            throw new Error('Session expired. Please login again.');
        }

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