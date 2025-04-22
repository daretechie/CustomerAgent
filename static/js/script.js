// --- DOM Elements ---
const chatBox = document.getElementById('chat-box');
const contentArea = document.getElementById('content-area');
const faqContent = document.getElementById('faq-content');
const productsContent = document.getElementById('products-content');
const uploadContent = document.getElementById('upload-content');
const messageInput = document.getElementById('message-input'); // Use ID for consistency
const sendButton = document.getElementById('send-button'); // Use ID for consistency
const faqButton = document.getElementById('faq-button');
const productsButton = document.getElementById('products-button');
const uploadButton = document.getElementById('upload-button');
const businessNameDisplay = document.getElementById('dynamic-business-name');
const addInfoPrompt = document.getElementById('add-info-prompt');
const uploadStatus = document.getElementById('uploadStatus');
const chatHeaderTitle = document.getElementById('chat-header-title');
const navigationButtons = document.querySelectorAll('.nav-button'); // Get all nav buttons

// --- State ---
let isProcessingMessage = false;
let currentBusinessName = null; // Store fetched business name
let currentSidebarView = null; // Track active sidebar view (faq, products, upload)

// --- Initialization ---
window.onload = async function() {
    await checkInitialBusinessStatus(); // Check for existing data on load

    // Event listener for dynamic upload form submission
    document.addEventListener('submit', function(e) {
        if (e.target.id === 'fileUploadForm') {
            e.preventDefault(); // Prevent default form submission
            handleFileUpload(e.target); // Pass the form element
        }
    });

    // Event listener for dynamic "Try Again" button in upload error message
    document.addEventListener('click', function(e) {
        if (e.target.id === 'upload-try-again-button') {
            showUploadForm();
        }
    });
};

// --- Event Listeners ---
sendButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) { // Send on Enter, allow Shift+Enter for newline if it were a textarea
        e.preventDefault(); // Prevent default Enter behavior (like newline)
        sendMessage();
    }
});

faqButton.addEventListener('click', () => showSidebarContent('faq', fetchFAQs));
productsButton.addEventListener('click', () => showSidebarContent('products', fetchProductInfo));
uploadButton.addEventListener('click', () => showSidebarContent('upload', displayUploadForm));

// --- Core Functions ---

// Check backend for business info on load
async function checkInitialBusinessStatus() {
    try {
        // *** NEW BACKEND ENDPOINT REQUIRED: /get_business_info ***
        const response = await fetch('/get_business_info'); // Replace with your actual endpoint
        if (!response.ok) {
            // If endpoint doesn't exist or fails, assume no data
            console.warn('Could not fetch initial business info. Status:', response.status);
            displayInitialPrompt();
            return;
        }
        const data = await response.json();

        if (data && data.business_name) {
            currentBusinessName = data.business_name;
            updateUIAfterUpload(currentBusinessName); // Update UI elements
            displayBusinessSpecificGreeting(currentBusinessName); // Display greeting
        } else {
            displayInitialPrompt(); // No business name found
        }
    } catch (error) {
        console.error('Error checking initial business status:', error);
        displayInitialPrompt(); // Assume no data on error
        // Optionally show a more specific error message in chat
        addMessage("I couldn't check the business status right now. Please try uploading documents if you haven't already.", 'ai');
    }
}

// Display initial prompt if no business data is loaded
function displayInitialPrompt() {
    businessNameDisplay.textContent = 'Business Info';
    chatHeaderTitle.textContent = 'AI Customer Support';
    addInfoPrompt.style.display = 'block'; // Show prompt in sidebar
    addMessage("Welcome! Please upload your business documents using the 'Upload Doc' button so I can assist you better.", 'ai');
}

// Display the AI greeting using the business name
function displayBusinessSpecificGreeting(businessName) {
    const agentName = `${businessName} AI Agent`; // Or customize as needed
    chatHeaderTitle.textContent = agentName; // Update chat header
    addMessage(`Hi there! I'm the AI support agent for ${businessName}. How can I help you today?`, 'ai');
}

// Add a message to the chat interface
function addMessage(text, sender) {
    const messageElement = document.createElement('div');
    // Sanitize text before setting innerHTML if it might contain user-generated HTML
    // For simplicity here, assuming backend sanitizes or text is safe.
    messageElement.innerHTML = text.replace(/\n/g, '<br>'); // Replace newlines with <br>
    messageElement.className = `message ${sender}-message`;
    chatBox.appendChild(messageElement);
    // Scroll to the bottom
    chatBox.scrollTop = chatBox.scrollHeight;
}

// Send message to backend and display response
async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message || isProcessingMessage || !currentBusinessName) {
        // Don't send if processing, empty, or business name not set yet
        if (!currentBusinessName && message) {
            addMessage("Please upload your business documents first using the 'Upload Doc' button.", 'ai');
        }
        return;
    }

    isProcessingMessage = true;
    sendButton.disabled = true;
    messageInput.disabled = true;

    addMessage(message, 'user'); // Display user message
    messageInput.value = ''; // Clear input

    // Show typing indicator
    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'message ai-message typing-indicator'; // Style as AI message bubble
    typingIndicator.innerHTML = '<span></span><span></span><span></span>';
    chatBox.appendChild(typingIndicator);
    chatBox.scrollTop = chatBox.scrollHeight;

    try {
        const response = await fetch('/send_message', { // Ensure this endpoint exists
            method: 'POST',
            headers: { 'Content-Type': 'application/json', },
            body: JSON.stringify({ message: message }),
        });

        chatBox.removeChild(typingIndicator); // Remove indicator regardless of response status

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({})); // Try to get error details
            throw new Error(errorData.error || `Network response was not ok (${response.status})`);
        }

        const data = await response.json();
        addMessage(data.response, 'ai'); // Display AI response

    } catch (error) {
        console.error('Error sending message:', error);
        // Remove indicator again in case it wasn't removed before error
        if (typingIndicator.parentNode === chatBox) {
             chatBox.removeChild(typingIndicator);
        }
        addMessage(`Sorry, I encountered an error: ${error.message}. Please try again later.`, 'ai');
    } finally {
        isProcessingMessage = false;
        sendButton.disabled = false;
        messageInput.disabled = false;
        messageInput.focus(); // Refocus input field
    }
}

// --- Sidebar Content Management ---

// Generic function to show sidebar content
async function showSidebarContent(viewName, fetchFunction) {
    // Highlight active button, unhighlight others
    navigationButtons.forEach(btn => btn.classList.remove('active'));
    document.getElementById(`${viewName}-button`)?.classList.add('active');

    // If clicking the currently active view button, hide the content area
    if (currentSidebarView === viewName) {
        contentArea.classList.remove('active');
        currentSidebarView = null;
        navigationButtons.forEach(btn => btn.classList.remove('active')); // Unhighlight all
        return;
    }

    currentSidebarView = viewName; // Set the new view

    // Hide all specific content sections first
    faqContent.classList.remove('active');
    productsContent.classList.remove('active');
    uploadContent.classList.remove('active');

    // Show the main content area
    contentArea.classList.add('active');

    // Show the target section and load its content
    const targetContentElement = document.getElementById(`${viewName}-content`);
    if (targetContentElement) {
        targetContentElement.classList.add('active');
        targetContentElement.innerHTML = '<div class="loading-indicator">Loading...</div>'; // Show loading state
        try {
            await fetchFunction(targetContentElement); // Call the specific function to populate
        } catch (error) {
             console.error(`Error loading ${viewName}:`, error);
             targetContentElement.innerHTML = `<div class="info-message error">Could not load ${viewName}.</div>`;
        }
    }
}

// Fetch and display FAQs
async function fetchFAQs(element) {
    // Ensure this backend endpoint exists
    const response = await fetch('/get_faqs');
    if (!response.ok) throw new Error('Network response was not ok');
    const data = await response.json();

    element.innerHTML = '<h2>Frequently Asked Questions</h2>'; // Clear loading

    if (data.faqs && data.faqs.length > 0) {
        data.faqs.forEach((faq, index) => {
            const faqElement = document.createElement('div');
            faqElement.className = 'faq-item';
            // Basic sanitization (replace with a proper library if needed)
            const safeQuestion = faq.question.replace(/</g, "<").replace(/>/g, ">");
            const safeAnswer = faq.answer.replace(/</g, "<").replace(/>/g, ">").replace(/\n/g, '<br>');
            faqElement.innerHTML = `
                <div class="faq-question">${index + 1}. ${safeQuestion}</div>
                <div class="faq-answer">${safeAnswer}</div>
            `;
            element.appendChild(faqElement);
        });
    } else {
        element.appendChild(createMessageElement("No FAQs available. Upload documents or check back later.", "info"));
    }
}

// Fetch and display Product Info
async function fetchProductInfo(element) {
    // Ensure this backend endpoint exists
    const response = await fetch('/get_products');
    if (!response.ok) throw new Error('Network response was not ok');
    const data = await response.json();

    element.innerHTML = '<h2>Product Information</h2>'; // Clear loading

    if (data.products && data.products.length > 0) {
        const productsList = document.createElement('div');
        productsList.className = 'products-list';
        data.products.forEach(product => {
            const productItem = document.createElement('div');
            productItem.className = 'faq-item'; // Reuse styling
            // Basic sanitization
            const safeName = product.name.replace(/</g, "<").replace(/>/g, ">");
            const safeDesc = product.description.replace(/</g, "<").replace(/>/g, ">").replace(/\n/g, '<br>');
            const safePrice = product.price.toString().replace(/</g, "<").replace(/>/g, ">");
            productItem.innerHTML = `
                <div class="faq-question">${safeName}</div>
                <div class="faq-answer">
                    <p>${safeDesc}</p>
                    <p><strong>Price:</strong> ${safePrice}</p>
                </div>
            `;
            productsList.appendChild(productItem);
        });
        element.appendChild(productsList);
    } else {
        element.appendChild(createMessageElement(
            "No product information available. Upload a product catalog via 'Upload Doc'.",
            "info"
        ));
    }
}

// Display the upload form
function displayUploadForm(element) {
    // Get the current business name for the input field, if available
    const existingName = currentBusinessName || '';

    const uploadFormHTML = `
        <h2>Upload Business Documents</h2>
        <p>Upload documents (PDF, DOCX, TXT) to enhance my knowledge about your business and products (Max 16MB).</p>
        <form id="fileUploadForm" enctype="multipart/form-data">
            <div class="form-group">
                <label for="businessNameInput">Business Name:</label>
                <input type="text" id="businessNameInput" name="business_name" required
                       placeholder="Enter your business name" value="${existingName.replace(/"/g, '"')}">
            </div>
            <div class="form-group">
                <label for="documentFile">Select Document:</label>
                <input type="file" id="documentFile" name="file" required accept=".pdf,.doc,.docx,.txt">
                <small>Supported: PDF, DOC, DOCX, TXT (Max 16MB)</small>
            </div>
            <button type="submit" class="upload-submit-btn">Upload Document</button>
        </form>
    `;
    element.innerHTML = uploadFormHTML;
}

// Handle the actual file upload process
async function handleFileUpload(formElement) {
    const submitButton = formElement.querySelector('button[type="submit"]');
    const fileInput = formElement.querySelector('#documentFile');
    const businessNameInput = formElement.querySelector('#businessNameInput');

    if (!fileInput.files || fileInput.files.length === 0) {
        showUploadStatus('Please select a file to upload.', 'error', 3000);
        return;
    }
     if (!businessNameInput.value.trim()) {
        showUploadStatus('Please enter a business name.', 'error', 3000);
        return;
    }

    showUploadStatus('Uploading...', 'info'); // Persistent 'info' style for uploading
    submitButton.disabled = true;
    submitButton.textContent = 'Uploading...';

    const formData = new FormData(formElement);

    try {
        // Ensure this backend endpoint exists
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
            // Headers are automatically set by FormData
        });

        const data = await response.json(); // Try to parse JSON regardless of status

        if (!response.ok) {
            throw new Error(data.message || `Upload failed with status ${response.status}`);
        }

        if (data.success) {
            currentBusinessName = data.business_name; // Update global state
            showUploadStatus('Upload successful!', 'success', 3000);

            // Update UI elements immediately
            updateUIAfterUpload(currentBusinessName);

            // Display success message within the upload content area
            uploadContent.innerHTML = `
                <div class="info-message success">
                    <h3>Upload Successful!</h3>
                    <p>Document for <strong>${currentBusinessName.replace(/</g, "<")}</strong> received.</p>
                    <p>I'm processing it now to update my knowledge. This may take a few moments.</p>
                </div>`;

            // Add message to chat *after* greeting (if it's the first upload)
            if (!chatBox.querySelector('.ai-message')) { // Check if greeting already happened
                displayBusinessSpecificGreeting(currentBusinessName);
            }
             addMessage("I've received your document and I'm processing it now. Ask me questions once I'm ready!", 'ai');


            // Optional: Clear the sidebar focus after successful upload
            // setTimeout(() => {
            //     contentArea.classList.remove('active');
            //     currentSidebarView = null;
            //     navigationButtons.forEach(btn => btn.classList.remove('active'));
            // }, 2500); // Delay slightly longer than status message


        } else {
            // Handle cases where response is ok, but success: false
            throw new Error(data.message || 'Upload failed. Please check the file and try again.');
        }

    } catch (error) {
        console.error('Upload error:', error);
        showUploadStatus(`Upload failed: ${error.message}`, 'error', 5000); // Show error longer

        // Display error in the upload content area with a retry button
        uploadContent.innerHTML = `
            <div class="info-message error">
                <h3>Upload Failed</h3>
                <p>${error.message.replace(/</g, "<")}</p>
                <p>Please check the file (format/size) and ensure the business name is entered.</p>
                <button id="upload-try-again-button" class="upload-submit-btn">Try Again</button>
            </div>
        `;
    } finally {
        // Re-enable button even if the form is replaced (only relevant if error didn't replace form)
        if (submitButton) {
             submitButton.disabled = false;
             submitButton.textContent = 'Upload Document';
        }
        hideUploadStatus(0); // Clear persistent 'Uploading...' message if success/error didn't override
    }
}

// --- UI Update Helpers ---

// Updates Business Name, Header, and hides initial prompts
function updateUIAfterUpload(name) {
    businessNameDisplay.textContent = name;
    chatHeaderTitle.textContent = `${name} AI Agent`;
    addInfoPrompt.style.display = 'none'; // Hide "upload documents" prompt
}

// Helper to create standard info/error/success message elements
function createMessageElement(message, type = "info") { // type = 'info', 'error', 'success'
    const element = document.createElement('div');
    element.className = `info-message ${type}`;
    element.textContent = message;
    return element;
}

// --- Upload Status Indicator Functions ---
let uploadStatusTimeout;

function showUploadStatus(message, type = 'info', duration = 0) {
    clearTimeout(uploadStatusTimeout); // Clear any existing timeout
    uploadStatus.textContent = message;
    uploadStatus.className = `upload-status ${type}`; // Apply type class (info, success, error)
    uploadStatus.style.display = 'block';

    if (duration > 0) {
        uploadStatusTimeout = setTimeout(() => {
            hideUploadStatus();
        }, duration);
    }
}

function hideUploadStatus(delay = 200) { // Slight delay for fade-out transition if added
    clearTimeout(uploadStatusTimeout);
    // Add fade-out effect later if desired
     if(uploadStatus.textContent !== 'Uploading...') { // Don't hide if it's the persistent 'Uploading...'
        setTimeout(() => {
             uploadStatus.style.display = 'none';
             uploadStatus.className = 'upload-status'; // Reset class
        }, delay)
     }

}