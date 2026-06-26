// 1. CONFIGURATION: Your Live Cloudflare Worker Proxy Endpoint is added here!
const WORKER_URL = "https://calm-rice-33af.flipdecorx.workers.dev";

// 2. HTML ELEMENT SELECTORS (Grabbing all buttons and inputs)
const sidebar = document.getElementById('sidebar');
const globalMenuToggle = document.getElementById('globalMenuToggle');
const plusMenuBtn = document.getElementById('plusMenuBtn');
const uploadPopupMenu = document.getElementById('uploadPopupMenu');
const sendMsgBtn = document.getElementById('sendMsgBtn');
const chatInputField = document.getElementById('chatInputField');
const chatDisplay = document.getElementById('chatDisplay');
const welcomeScreen = document.getElementById('welcomeScreen');
const micBtn = document.getElementById('micBtn');

// 3. SIDEBAR TOGGLE MECHANICS (☰ Menu Button Functionality)
globalMenuToggle.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevents the document click event from firing instantly
    sidebar.classList.toggle('collapsed');
    document.body.classList.toggle('sidebar-open');
});

// Close mobile sidebar overlay when clicking anywhere outside of it
document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768) {
        if (!sidebar.contains(e.target) && !globalMenuToggle.contains(e.target)) {
            sidebar.classList.add('collapsed');
            document.body.classList.remove('sidebar-open');
        }
    }
});

// 4. PLUS UPLOAD MENU MECHANICS (➕ Plus Button Functionality)
plusMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    uploadPopupMenu.classList.toggle('show');
});

// Close the upload menu if the user clicks anywhere else on the screen
document.addEventListener('click', (e) => {
    if (!uploadPopupMenu.contains(e.target) && !plusMenuBtn.contains(e.target)) {
        uploadPopupMenu.classList.remove('show');
    }
});

// Handle individual upload option clicks (Camera, Image, File)
document.querySelectorAll('.upload-option').forEach(option => {
    option.addEventListener('click', () => {
        const type = option.getAttribute('data-upload');
        uploadPopupMenu.classList.remove('show');
        hideWelcome();
        appendMessage(`System Tracking: Initialized context parser for [${type}].`, 'assistant');
    });
});

// 5. SIDEBAR ITEM NAVIGATION (Updating active canvas views)
document.querySelectorAll('.menu-items li').forEach(item => {
    item.addEventListener('click', () => {
        const category = item.getAttribute('data-category');
        document.getElementById('dynamicTitle').innerText = `ChatNova AI — ${category}`;
        hideWelcome();
        appendMessage(`Switched contextual layer to **${category}** canvas.`, 'assistant');
        
        // Auto-hide menu overlay on mobile screens after picking an option
        if (window.innerWidth <= 768) {
            sidebar.classList.add('collapsed');
            document.body.classList.remove('sidebar-open');
        }
    });
});

// 6. MAIN CHAT & WORKER API CONNECTION (➤ Send Button Engine)
async function executeUserSend() {
    const queryText = chatInputField.value.trim();
    if (!queryText) return; // Ignore if the input box is empty

    hideWelcome();
    appendMessage(queryText, 'user'); // Display user message immediately
    chatInputField.value = ''; // Clear the input field right away

    // Create a temporary "typing..." loading bubble
    const typingBubble = document.createElement('div');
    typingBubble.classList.add('message', 'assistant');
    typingBubble.innerText = "ChatNova is formulating an answer...";
    chatDisplay.appendChild(typingBubble);
    chatDisplay.scrollTop = chatDisplay.scrollHeight;

    try {
        // Dispatch data payload directly to your Cloudflare Worker proxy
        const response = await fetch(WORKER_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ prompt: queryText })
        });

        const data = await response.json();
        typingBubble.remove(); // Remove the loading bubble
        
        if (data.reply) {
            appendMessage(data.reply, 'assistant'); // Display AI response
        } else if (data.error) {
            appendMessage(`System Exception: ${data.error}`, 'assistant');
        } else {
            appendMessage("Received unstructured data stream from core framework.", 'assistant');
        }

    } catch (error) {
        typingBubble.remove(); // Remove loading bubble on failure
        appendMessage(`Network Fault: Please check your Worker URL. Details: ${error.message}`, 'assistant');
    }
}

// Helper to render message bubbles and process clean markdown formatting
function appendMessage(text, sender) {
    const msgBubble = document.createElement('div');
    msgBubble.classList.add('message', sender);
    
    // Basic formatting conversion: replaces breaks (\n) with HTML tags and bolds **text**
    let formattedText = text
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'); 
        
    msgBubble.innerHTML = formattedText;
    
    chatDisplay.appendChild(msgBubble);
    chatDisplay.scrollTop = chatDisplay.scrollHeight; // Force auto-scroll to the bottom
}

// Clear away initial greeting block 
function hideWelcome() {
    if (welcomeScreen) welcomeScreen.style.display = 'none';
}

// 7. GLOBAL CONTROL BINDINGS (Linking events to buttons and keyboard)
sendMsgBtn.addEventListener('click', executeUserSend);

chatInputField.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        executeUserSend();
    }
});

micBtn.addEventListener('click', () => {
    hideWelcome();
    appendMessage("<em>Audio stream listener active. Speak into device microphone...</em>", 'assistant');
});