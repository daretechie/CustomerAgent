
// Basic JavaScript for potential future use (e.g., sending messages)
document.querySelector('.send-button').addEventListener('click', function() {
    const input = document.querySelector('.message-input');
    const message = input.value.trim();

    if (message) {
        // Here you would typically send the message to your backend
        console.log("Sending message:", message);
        input.value = ''; // Clear the input field
        // You would then add the message to the chat-box div
        // Example: addMessage(message, 'user');
    }
});

// Function to add a message to the chat box (example)
function addMessage(text, sender) {
    const chatBox = document.getElementById('chat-box');
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', sender); // Add classes for styling (e.g., 'user', 'ai')
    messageElement.textContent = text;
    chatBox.appendChild(messageElement);
    chatBox.scrollTop = chatBox.scrollHeight; // Auto-scroll to the latest message
}

// Example of how you might dynamically set the business name with JS after the page loads
// In a real Flask app, this is better done server-side using Jinja2 as shown in index.html
// window.onload = function() {
//     const businessNameElement = document.getElementById('dynamic-business-name');
//     // Replace 'Your Dynamic Business Name' with the actual name if needed via JS
//     // businessNameElement.textContent = 'Your Dynamic Business Name Loaded with JS';
// };
