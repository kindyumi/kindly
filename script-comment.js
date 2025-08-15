// DOM Elements
const guestbookForm = document.getElementById('guestbookForm');
const messagesContainer = document.getElementById('messagesContainer');
const totalMessagesSpan = document.getElementById('totalMessages');

// State
let selectedEmoji = '❤️'; // Default emoji
let messages = [];

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    setupEmojiSelector();
    loadMessages();
});

// Setup Emoji Selector
function setupEmojiSelector() {
    const emojiButtons = document.querySelectorAll('.emoji-btn');
    
    // Set default selected emoji
    document.querySelector('.emoji-btn[data-emoji="❤️"]').classList.add('selected');
    
    emojiButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Remove selected class from all buttons
            emojiButtons.forEach(btn => btn.classList.remove('selected'));
            
            // Add selected class to clicked button
            this.classList.add('selected');
            
            // Update selected emoji
            selectedEmoji = this.dataset.emoji;
        });
    });
}

// Form submission handler
guestbookForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const submitBtn = document.querySelector('.submit-btn');
    const originalText = submitBtn.innerHTML;
    
    try {
        // Disable submit button
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
        
        // Get form data
        const name = document.getElementById('name').value.trim();
        const message = document.getElementById('message').value.trim();
        
        // Validate form
        if (!name || !message) {
            throw new Error('Name and message are required');
        }
        
        // Send to Netlify Function
        const response = await fetch('/.netlify/functions/add-message', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: name,
                message: message,
                emoji: selectedEmoji
            })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || 'Failed to send message');
        }
        
        // Success feedback
        showNotification('Note sent successfully! 💕', 'success');
        
        // Reset form
        guestbookForm.reset();
        
        // Reset emoji selection to default
        document.querySelectorAll('.emoji-btn').forEach(btn => btn.classList.remove('selected'));
        document.querySelector('.emoji-btn[data-emoji="❤️"]').classList.add('selected');
        selectedEmoji = '❤️';
        
        // Reload messages
        await loadMessages();
        
    } catch (error) {
        console.error('Error sending message:', error);
        showNotification('Failed to send note: ' + error.message, 'error');
    } finally {
        // Re-enable submit button
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
});

// Load messages from Netlify Function
async function loadMessages() {
    try {
        const response = await fetch('/.netlify/functions/get-messages');
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || 'Failed to load messages');
        }
        
        messages = result.data || [];
        displayMessages(messages);
        updateStats();
        
    } catch (error) {
        console.error('Error loading messages:', error);
        showNotification('Failed to load messages: ' + error.message, 'error');
    }
}

// Display messages in the container
function displayMessages(messages) {
    if (messages.length === 0) {
        messagesContainer.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; color: rgba(255,255,255,0.7); font-style: italic;">
                <i class="fas fa-heart" style="font-size: 48px; margin-bottom: 20px; opacity: 0.5;"></i>
                <p style="font-size: 18px;">No notes yet...</p>
                <p style="font-size: 14px;">Be the first to leave a sweet message! 💝</p>
            </div>
        `;
        return;
    }
    
    const messagesHTML = messages.map((msg, index) => {
        const messageClass = Math.random() > 0.5 ? 'polaroid-effect' : 'message-card';
        const animationDelay = index * 0.1;
        
        return `
            <div class="${messageClass}" style="animation-delay: ${animationDelay}s; opacity: 0; animation: fadeInUp 0.6s ease forwards;">
                <div class="message-header">
                    <div class="message-author">${escapeHtml(msg.name)}</div>
                    <div class="message-emoji">${msg.emoji || '❤️'}</div>
                </div>
                <div class="message-text">${escapeHtml(msg.message)}</div>
                <div class="message-footer">
                    <div class="message-date">${formatDate(msg.created_at)}</div>
                </div>
            </div>
        `;
    }).join('');
    
    messagesContainer.innerHTML = messagesHTML;
}

// Update statistics
function updateStats() {
    totalMessagesSpan.textContent = messages.length;
    
    // Add some animation
    totalMessagesSpan.style.transform = 'scale(1.2)';
    setTimeout(() => {
        totalMessagesSpan.style.transform = 'scale(1)';
    }, 200);
}

// Utility Functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now - date;
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInMinutes < 1) {
        return 'Just now';
    } else if (diffInMinutes < 60) {
        return `${diffInMinutes}m ago`;
    } else if (diffInHours < 24) {
        return `${diffInHours}h ago`;
    } else if (diffInDays < 7) {
        return `${diffInDays}d ago`;
    } else {
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
        });
    }
}

function showNotification(message, type = 'success') {
    // Remove existing notifications
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div style="
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? 'linear-gradient(135deg, #4CAF50, #45a049)' : 'linear-gradient(135deg, #f44336, #da190b)'};
            color: white;
            padding: 15px 25px;
            border-radius: 10px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            z-index: 1000;
            font-weight: bold;
            max-width: 300px;
            animation: slideInRight 0.5s ease;
        ">
            ${message}
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        if (notification) {
            notification.style.animation = 'slideOutRight 0.5s ease';
            setTimeout(() => notification.remove(), 500);
        }
    }, 3000);
}