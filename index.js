
document.addEventListener('DOMContentLoaded', () => {
    // DOM elements
    const dropArea = document.getElementById('drop-area');
    const fileInput = document.getElementById('file-input');
    const uploadBtn = document.getElementById('upload-btn');
    const fileName = document.getElementById('file-name');
    const chatContainer = document.getElementById('chat-container');

    // Event listeners
    uploadBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);

    // Drag and drop events
    dropArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropArea.classList.add('drag-over');
    });

    dropArea.addEventListener('dragleave', () => {
        dropArea.classList.remove('drag-over');
    });

    dropArea.addEventListener('drop', (e) => {
        e.preventDefault();
        dropArea.classList.remove('drag-over');

        if (e.dataTransfer.files.length) {
            handleFiles(e.dataTransfer.files);
        }
    });

    // Handle file selection from input
    function handleFileSelect(e) {
        if (e.target.files.length) {
            handleFiles(e.target.files);
        }
    }

    // Process the files
    function handleFiles(files) {
        const file = files[0];

        if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
            alert('Please upload a JSON file.');
            return;
        }

        fileName.textContent = `Selected file: ${file.name}`;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                displayChatHistory(data);
            } catch (error) {
                console.error('Error parsing JSON:', error);
                alert('Error parsing the file. Please make sure it is a valid JSON file.');
            }
        };
        reader.readAsText(file);
    }

    // Display chat history
    function displayChatHistory(data) {
        chatContainer.innerHTML = ''; // Clear previous content

        if (!data.requests || !Array.isArray(data.requests) || data.requests.length === 0) {
            chatContainer.innerHTML = '<p>No chat history found in the file.</p>';
            return;
        }

        // Add a summary header
        const summary = document.createElement('div');
        summary.className = 'summary';
        summary.innerHTML = `<h2>Chat History Summary</h2>
                            <p>Total conversations: ${data.requests.length}</p>
                            <p>Data from: ${new Date().toLocaleDateString()}</p>`;
        chatContainer.appendChild(summary);

        // Create conversation containers
        data.requests.forEach(request => {
            if (!request.message) return;

            const requestContainer = document.createElement('div');
            requestContainer.className = 'request-container';

            // Add User Message
            if (request.message && request.message.text) {
                const userMessage = document.createElement('div');
                userMessage.className = 'message message-user';

                const userText = document.createElement('div');
                userText.style.whiteSpace = 'pre-wrap';
                userText.textContent = request.message.text;

                userMessage.appendChild(userText);
                requestContainer.appendChild(userMessage);
            }

            // Add AI Responses
            if (Array.isArray(request.response)) {
                // Filter out any non-text responses
                const textResponses = request.response.filter(resp => {
                    return resp.value && typeof resp.value === 'string' &&
                        (!resp.kind || resp.kind !== 'toolInvocationSerialized');
                });

                textResponses.forEach(resp => {
                    const aiResponse = document.createElement('div');
                    aiResponse.className = 'message message-ai';

                    const responseText = document.createElement('div');
                    responseText.style.whiteSpace = 'pre-wrap';
                    responseText.textContent = resp.value;

                    aiResponse.appendChild(responseText);
                    requestContainer.appendChild(aiResponse);
                });
            }

            // Add timestamp if available
            if (request.timestamp) {
                const timestamp = document.createElement('div');
                timestamp.className = 'timestamp';
                const date = new Date(request.timestamp);
                timestamp.textContent = date.toLocaleString();
                requestContainer.appendChild(timestamp);
            }

            chatContainer.appendChild(requestContainer);
        });
    }

    // Handle code blocks
    function detectAndFormatCodeBlocks(text) {
        // This is a simple approach - in a real app, you might want to use a Markdown parser
        const formatted = text.replace(/```([^`]+)```/g, '<pre><code>$1</code></pre>');
        return formatted;
    }
});