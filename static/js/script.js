// DOM elements
const chatBox = document.getElementById('chat-box');
const messageInput = document.querySelector('.message-input');
const sendButton = document.querySelector('.send-button');
const faqButton = document.querySelector('.nav-button:nth-child(1)');
const productsButton = document.querySelector('.nav-button:nth-child(2)');
const uploadButton = document.querySelector('.nav-button.upload');

// State
let isProcessingMessage = false;

// Event listeners
sendButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        sendMessage();
    }
});
faqButton.addEventListener('click', showFAQs);
uploadButton.addEventListener('click', showUploadForm);
productsButton.addEventListener('click', showProductInfo);

// Add welcome message from AI
function addWelcomeMessage() {
    addMessage("Hi there.<br>I am FashBot the support agent for this store.<br><br>How can I help?", 'ai');
}

// Call when page loads
window.onload = function() {
    addWelcomeMessage();
    
    // Handle file upload form events when present
    document.addEventListener('submit', function(e) {
        if (e.target.id === 'fileUploadForm') {
            e.preventDefault();
            handleFileUpload(e);
        }
    });
    
    // Add loading indicator for file uploads
    const uploadStatus = document.createElement('div');
    uploadStatus.id = 'uploadStatus';
    uploadStatus.className = 'upload-status';
    document.body.appendChild(uploadStatus);
};

// Function to send a message
async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message || isProcessingMessage) return;
    
    // Show that we're processing
    isProcessingMessage = true;
    sendButton.disabled = true;
    
    // Add user message to UI immediately
    addMessage(message, 'user');
    messageInput.value = '';
    
    // Show typing indicator
    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'typing-indicator ai-message';
    typingIndicator.innerHTML = '<span></span><span></span><span></span>';
    chatBox.appendChild(typingIndicator);
    chatBox.scrollTop = chatBox.scrollHeight;
    
    try {
        // Send the message to the backend
        const response = await fetch('/send_message', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message: message }),
        });
        
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        
        const data = await response.json();
        
        // Remove typing indicator
        chatBox.removeChild(typingIndicator);
        
        // Add AI response
        addMessage(data.response, 'ai');
    } catch (error) {
        console.error('Error:', error);
        
        // Remove typing indicator
        if (typingIndicator.parentNode === chatBox) {
            chatBox.removeChild(typingIndicator);
        }
        
        // Show error message
        addMessage("Sorry, I'm having trouble connecting right now. Please try again later.", 'ai');
    } finally {
        // Reset state
        isProcessingMessage = false;
        sendButton.disabled = false;
    }
}

// Function to add a message to the chat
function addMessage(text, sender) {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${sender}-message`;
    messageElement.innerHTML = text;
    chatBox.appendChild(messageElement);
    chatBox.scrollTop = chatBox.scrollHeight;
}

// Function to show FAQs
async function showFAQs() {
    try {
        // Show loading state
        chatBox.innerHTML = '<div class="loading-indicator">Loading FAQs...</div>';
        
        const response = await fetch('/get_faqs');
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        
        const data = await response.json();
        
        chatBox.innerHTML = ''; // Clear chat
        addMessage("Here are our most frequently asked questions:", 'ai');
        
        if (data.faqs && data.faqs.length > 0) {
            data.faqs.forEach((faq, index) => {
                const faqElement = document.createElement('div');
                faqElement.className = 'faq-item';
                faqElement.innerHTML = `<strong>${index + 1}. ${faq.question}</strong><br>${faq.answer}`;
                chatBox.appendChild(faqElement);
            });
        } else {
            const noFaqsElement = document.createElement('div');
            noFaqsElement.className = 'info-message';
            noFaqsElement.textContent = "No FAQs available yet. Upload business documents to generate FAQs.";
            chatBox.appendChild(noFaqsElement);
        }
        
        addMessage("Do you have any other questions I can help with?", 'ai');
    } catch (error) {
        console.error('Error fetching FAQs:', error);
        chatBox.innerHTML = '';
        addMessage("Sorry, I couldn't retrieve the FAQs at this time.", 'ai');
    }
}

// Function to show product information
function showProductInfo() {
    chatBox.innerHTML = ''; // Clear chat
    
    const productInfoElement = document.createElement('div');
    productInfoElement.className = 'info-message';
    productInfoElement.innerHTML = `
        <h3>Product Information</h3>
        <p>To view product information, please upload your product catalog using the "Upload Doc" button.</p>
        <p>Once uploaded, I'll be able to answer specific questions about your products.</p>
    `;
    chatBox.appendChild(productInfoElement);
    
    addMessage("Is there anything specific you'd like to know about your products?", 'ai');
}

// Function to show upload form
function showUploadForm() {
    chatBox.innerHTML = ''; // Clear chat
    
    const uploadFormHTML = `
        <div class="upload-form-container">
            <h3>Upload Business Documents</h3>
            <p>Upload your business documents to enhance my knowledge about your business and products.</p>
            <form id="fileUploadForm" enctype="multipart/form-data">
                <div class="form-group">
                    <label for="businessName">Business Name:</label>
                    <input type="text" id="businessName" name="business_name" required 
                           placeholder="Enter your business name">
                </div>
                <div class="form-group">
                    <label for="documentFile">Upload Document:</label>
                    <input type="file" id="documentFile" name="file" required>
                    <small>Supported formats: PDF, DOC, DOCX, TXT (Max 16MB)</small>
                </div>
                <button type="submit" class="upload-submit-btn">Upload</button>
            </form>
        </div>
    `;
    
    const formContainer = document.createElement('div');
    formContainer.className = 'upload-area';
    formContainer.innerHTML = uploadFormHTML;
    chatBox.appendChild(formContainer);
}

// Function to handle file upload
async function handleFileUpload(e) {
    e.preventDefault();
    
    const uploadStatus = document.getElementById('uploadStatus');
    uploadStatus.textContent = 'Uploading...';
    uploadStatus.style.display = 'block';
    
    const form = e.target;
    const formData = new FormData(form);
    
    try {
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error('Upload failed');
        }
        
        const data = await response.json();
        
        if (data.success) {
            uploadStatus.textContent = 'Upload successful!';
            uploadStatus.className = 'upload-status success';
            
            // Update the business name in the UI
            document.getElementById('dynamic-business-name').textContent = data.business_name;
            
            // Clear chat and add success message
            chatBox.innerHTML = '';
            addMessage(`Upload successful! I've updated the business information for ${data.business_name}.`, 'ai');
            addMessage("I'm processing your document to better understand your business. This may take a moment. You can view FAQs by clicking the FAQ button once processing is complete.", 'ai');
            
            // Hide status after delay
            setTimeout(() => {
                uploadStatus.style.display = 'none';
            }, 3000);
        } else {
            throw new Error(data.message);
        }
    } catch (error) {
        console.error('Error:', error);
        uploadStatus.textContent = `Upload failed: ${error.message}`;
        uploadStatus.className = 'upload-status error';
        
        addMessage(`Sorry, there was an error uploading your file: ${error.message}. Please try again.`, 'ai');
        
        // Hide status after delay
        setTimeout(() => {
            uploadStatus.style.display = 'none';
        }, 3000);
    }
}

// Function to handle errors gracefully
function handleError(message) {
    console.error(message);
    addMessage("I'm experiencing a technical issue. Please try again in a moment.", 'ai');
}

// Global error handler
window.addEventListener('error', function(e) {
    handleError(e.message);
});