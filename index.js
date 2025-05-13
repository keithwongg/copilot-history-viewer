
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

                if (textResponses.length > 0) {
                    // Process code blocks in the responses
                    const processedResponses = processCodeBlocks(request.response);

                    if (processedResponses.length > 0) {
                        // Create a single AI response bubble
                        const aiResponse = document.createElement('div');
                        aiResponse.className = 'message message-ai';

                        // Check if this response contains code edits and add a special class
                        const hasCodeEdits = request.response.some(resp => resp.kind === 'textEditGroup');
                        if (hasCodeEdits) {
                            aiResponse.classList.add('has-code-edits');
                        }

                        // Add all processed content
                        processedResponses.forEach(content => {
                            aiResponse.appendChild(content);
                        });

                        requestContainer.appendChild(aiResponse);
                    }
                }
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

    // Format inline code blocks within text
    function formatInlineCodeBlocks(text) {
        // This pattern matches both multi-line and inline code blocks
        // For inline code blocks (single backticks): `code`
        // For code blocks (triple backticks): ```code```
        return text
            .replace(/```([^`]+)```/g, '<pre class="code-inline-block">$1</pre>')
            .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
    }

    // Utility function to extract the file name from a path
    function getDisplayFileName(path) {
        if (!path) return 'Unknown file';

        // Try to get the last 2-3 segments of the path for better context
        const segments = path.split('/').filter(s => s.trim() !== '');

        if (segments.length <= 1) {
            return segments[0] || 'Unknown file';
        } else if (segments.length === 2) {
            return segments.join('/');
        } else {
            // Get the last 3 segments for better context
            return segments.slice(-3).join('/');
        }
    }

    // Handle code blocks and edits
    function processCodeBlocks(responses) {
        const processedContents = [];
        let inCodeBlock = false;
        let codeBlockInfo = null;
        let currentText = '';

        // Process each response item
        for (let i = 0; i < responses.length; i++) {
            const resp = responses[i];

            // Handle text content
            if (resp.value && typeof resp.value === 'string') {
                // Check if this is a code block marker
                if (resp.value.trim() === "\n```\n" || resp.value.trim() === "```") {
                    if (!inCodeBlock) {
                        // Start of code block
                        inCodeBlock = true;

                        // Add any text accumulated before code block
                        if (currentText.trim()) {
                            const textDiv = document.createElement('div');
                            textDiv.style.whiteSpace = 'pre-wrap';
                            textDiv.textContent = currentText;
                            processedContents.push(textDiv);
                            currentText = '';
                        }

                        // Look ahead to see if the next items are codeblock related
                        if (i + 1 < responses.length && responses[i + 1].kind === 'codeblockUri') {
                            codeBlockInfo = {
                                uri: responses[i + 1].uri,
                                isEdit: responses[i + 1].isEdit
                            };
                            i++; // Skip the codeblockUri in next iteration
                        }
                    } else {
                        // End of code block
                        inCodeBlock = false;
                        codeBlockInfo = null;
                    }
                    continue;
                }

                // Check for inline code blocks (```code```)
                if (!inCodeBlock && resp.value.includes("```")) {
                    // Process the inline code blocks without interrupting the flow
                    const processedText = formatInlineCodeBlocks(resp.value);
                    const textDiv = document.createElement('div');
                    textDiv.style.whiteSpace = 'pre-wrap';
                    textDiv.innerHTML = processedText; // Use innerHTML for formatted content
                    processedContents.push(textDiv);
                    continue;
                }

                if (inCodeBlock) {
                    // We're in a code block, collect the text
                    currentText += resp.value;
                } else {
                    // Regular text
                    currentText += resp.value + ' ';
                }
            }

            // Handle code edits
            else if (resp.kind === 'textEditGroup' && inCodeBlock) {
                // This is an edit to be displayed in the code block
                const codeBlockDiv = document.createElement('div');
                codeBlockDiv.className = 'code-edit-block';

                // Code block header
                const filePathDiv = document.createElement('div');
                filePathDiv.className = 'code-edit-header';
                const path = resp.uri ? resp.uri.path || resp.uri.fsPath : 'Unknown file';
                const fileName = getDisplayFileName(path);
                filePathDiv.textContent = `File: ${fileName}`;
                codeBlockDiv.appendChild(filePathDiv);

                // Process edits
                if (resp.edits && resp.edits.length > 0) {
                    // Check if there are actual edits to display
                    let hasContent = false;
                    resp.edits.forEach(editGroup => {
                        if (editGroup && editGroup.length > 0) {
                            editGroup.forEach(edit => {
                                if (edit.text) {
                                    hasContent = true;
                                    const codeContent = document.createElement('pre');
                                    codeContent.className = 'code-content';
                                    codeContent.textContent = edit.text;
                                    codeBlockDiv.appendChild(codeContent);

                                    // Line range info if available
                                    if (edit.range) {
                                        const rangeInfo = document.createElement('div');
                                        rangeInfo.className = 'line-range-info';
                                        rangeInfo.textContent = `Lines ${edit.range.startLineNumber}-${edit.range.endLineNumber}`;
                                        codeBlockDiv.appendChild(rangeInfo);
                                    }
                                }
                            });
                        }
                    });

                    if (!hasContent) {
                        const noContent = document.createElement('div');
                        noContent.className = 'code-content no-content';
                        noContent.textContent = '(No visible text edits in this change)';
                        codeBlockDiv.appendChild(noContent);
                    }
                }

                processedContents.push(codeBlockDiv);
                inCodeBlock = false; // Reset after handling edit
                currentText = '';
            }
        }

        // Add any remaining text
        if (currentText.trim()) {
            const textDiv = document.createElement('div');
            textDiv.style.whiteSpace = 'pre-wrap';
            textDiv.textContent = currentText;
            processedContents.push(textDiv);
        }

        return processedContents;
    }
});