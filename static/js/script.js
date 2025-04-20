// DOM elements
const chatBox = document.getElementById('chat-box');
const contentArea = document.getElementById('content-area');
const faqContent = document.getElementById('faq-content');
const productsContent = document.getElementById('products-content');
const uploadContent = document.getElementById('upload-content');
const messageInput = document.querySelector('.message-input');
const sendButton = document.querySelector('.send-button');
const faqButton = document.getElementById('faq-button');
const productsButton = document.getElementById('products-button');
const uploadButton = document.getElementById('upload-button');

// State
let isProcessingMessage = false;
let currentView = 'chat'; // chat, faq, products, upload

// Event listeners
sendButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        sendMessage();
    }
});
faqButton.addEventListener('click', showFAQs);
productsButton.addEventListener('click', showProductInfo);
uploadButton.addEventListener('click', showUploadForm);

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

// Function to switch views
function switchView(viewName) {
    // Hide all content sections
    faqContent.classList.remove('active');
    productsContent.classList.remove('active');
    uploadContent.classList.remove('active');
    
    if (viewName === 'chat') {
        // Show chat, hide content area
        chatBox.style.display = 'flex';
        contentArea.style.display = 'none';
    } else {
        // Hide chat, show content area
        chatBox.style.display = 'none';
        contentArea.style.display = 'block';
        
        // Show the specific content section
        if (viewName === 'faq') {
            faqContent.classList.add('active');
        } else if (viewName === 'products') {
            productsContent.classList.add('active');
        } else if (viewName === 'upload') {
            uploadContent.classList.add('active');
        }
    }
    
    currentView = viewName;
}

// Function to send a message
async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message || isProcessingMessage) return;
    
    // If in another view, switch back to chat
    if (currentView !== 'chat') {
        switchView('chat');
    }
    
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
    switchView('faq');
    
    try {
        // Show loading state
        faqContent.innerHTML = '<div class="loading-indicator">Loading FAQs...</div>';
        
        const response = await fetch('/get_faqs');
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        
        const data = await response.json();
        
        faqContent.innerHTML = '<h2>Frequently Asked Questions</h2>';
        
        if (data.faqs && data.faqs.length > 0) {
            data.faqs.forEach((faq, index) => {
                const faqElement = document.createElement('div');
                faqElement.className = 'faq-item';
                faqElement.innerHTML = `
                    <div class="faq-question">${index + 1}. ${faq.question}</div>
                    <div class="faq-answer">${faq.answer}</div>
                `;
                faqContent.appendChild(faqElement);
            });
        } else {
            const noFaqsElement = document.createElement('div');
            noFaqsElement.className = 'info-message';
            noFaqsElement.textContent = "No FAQs available yet. Upload business documents to generate FAQs.";
            faqContent.appendChild(noFaqsElement);
        }
    } catch (error) {
        console.error('Error fetching FAQs:', error);
        faqContent.innerHTML = '<div class="info-message">Sorry, I couldn\'t retrieve the FAQs at this time.</div>';
    }
}

// Function to show product information
async function showProductInfo() {
    switchView('products');
    
    try {
        // Show loading state
        productsContent.innerHTML = '<div class="loading-indicator">Loading Product Information...</div>';
        
        const response = await fetch('/get_products');
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        
        const data = await response.json();
        
        productsContent.innerHTML = '<h2>Product Information</h2>';
        
        if (data.products && data.products.length > 0) {
            const productsList = document.createElement('div');
            productsList.className = 'products-list';
            
            data.products.forEach(product => {
                const productItem = document.createElement('div');
                productItem.className = 'faq-item'; // Reusing the styling
                productItem.innerHTML = `
                    <div class="faq-question">${product.name}</div>
                    <div class="faq-answer">
                        <p>${product.description}</p>
                        <p><strong>Price:</strong> ${product.price}</p>
                    </div>
                `;
                productsList.appendChild(productItem);
            });
            
            productsContent.appendChild(productsList);
        } else {
            const noProductsElement = document.createElement('div');
            noProductsElement.className = 'info-message';
            noProductsElement.innerHTML = `
                <p>No product information available yet.</p>
                <p>To view product information, please upload your product catalog using the "Upload Doc" button.</p>
                <p>Once uploaded, I'll be able to display specific information about your products.</p>
            `;
            productsContent.appendChild(noProductsElement);
        }
    } catch (error) {
        console.error('Error fetching products:', error);
        productsContent.innerHTML = '<div class="info-message">Sorry, I couldn\'t retrieve the product information at this time.</div>';
    }
}

// Function to show upload form
function showUploadForm() {
    switchView('upload');
    
    const uploadFormHTML = `
        <div class="upload-form-container">
            <h2>Upload Business Documents</h2>
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
    
    uploadContent.innerHTML = uploadFormHTML;
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
            
            // Update the upload form with success message
            uploadContent.innerHTML = `
                <div class="info-message success">
                    <h3>Upload Successful!</h3>
                    <p>I've updated the business information for ${data.business_name}.</p>
                    <p>Your document is being processed to better understand your business. This may take a moment.</p>
                    <p>You can view FAQs by clicking the FAQ button once processing is complete.</p>
                </div>
            `;
            
            // Switch to chat view after delay
            setTimeout(() => {
                switchView('chat');
                addMessage(`Upload successful! I've updated the business information for ${data.business_name}.`, 'ai');
                addMessage("I'm processing your document to better understand your business. This may take a moment. You can view FAQs by clicking the FAQ button once processing is complete.", 'ai');
            }, 2000);
            
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
        
        uploadContent.innerHTML = `
            <div class="info-message error">
                <h3>Upload Failed</h3>
                <p>Sorry, there was an error uploading your file: ${error.message}</p>
                <p>Please try again.</p>
                <button onclick="showUploadForm()" class="upload-submit-btn">Try Again</button>
            </div>
        `;
        
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