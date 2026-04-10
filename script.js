(function() {
    // Ambil konfigurasi dari global
    const CONFIG = window.LUMINA_CONFIG || {};
    const IMGBB_API_KEY = CONFIG.IMGBB_API_KEY || '';
    const REMOVE_BG_API = CONFIG.REMOVE_BG_API || '';

    // DOM Elements
    const fileInput = document.getElementById('fileInput');
    const dropZone = document.getElementById('dropZone');
    const originalPreview = document.getElementById('originalPreview');
    const resultPreview = document.getElementById('resultPreview');
    const processBtn = document.getElementById('processBtn');
    const statusMsg = document.getElementById('statusMsg');
    const statusText = document.getElementById('statusText');
    const urlBadge = document.getElementById('urlBadge');
    const urlText = document.getElementById('urlText');
    const uploadStatus = document.getElementById('uploadStatus');
    const uploadStatusText = document.getElementById('uploadStatusText');
    const processStatus = document.getElementById('processStatus');
    const processStatusText = document.getElementById('processStatusText');
    const downloadSection = document.getElementById('downloadSection');
    const downloadLink = document.getElementById('downloadLink');

    // State
    let selectedFile = null;
    let publicImageUrl = null;
    let resultBlobUrl = null;
    let isProcessing = false;

    // Update status upload
    function setUploadStatus(status, message) {
        uploadStatus.className = 'card-status';
        switch(status) {
            case 'ready':
                uploadStatus.classList.add('status-ready');
                uploadStatus.innerHTML = '<i class="fas fa-circle"></i><span>Ready</span>';
                break;
            case 'uploading':
                uploadStatus.classList.add('status-uploading');
                uploadStatus.innerHTML = '<i class="fas fa-spinner fa-pulse"></i><span>Uploading</span>';
                break;
            case 'error':
                uploadStatus.classList.add('status-error');
                uploadStatus.innerHTML = '<i class="fas fa-circle"></i><span>Error</span>';
                break;
        }
        if (message) uploadStatusText.textContent = message;
    }

    // Update status proses
    function setProcessStatus(status, message) {
        processStatus.className = 'card-status';
        switch(status) {
            case 'standby':
                processStatus.classList.add('status-standby');
                processStatus.innerHTML = '<i class="fas fa-circle"></i><span>Standby</span>';
                break;
            case 'processing':
                processStatus.classList.add('status-processing');
                processStatus.innerHTML = '<i class="fas fa-spinner fa-pulse"></i><span>Processing</span>';
                break;
            case 'success':
                processStatus.classList.add('status-ready');
                processStatus.innerHTML = '<i class="fas fa-circle"></i><span>Done</span>';
                break;
            case 'error':
                processStatus.classList.add('status-error');
                processStatus.innerHTML = '<i class="fas fa-circle"></i><span>Error</span>';
                break;
        }
        if (message) processStatusText.textContent = message;
    }

    // Update main status message
    function setMainStatus(type, message) {
        statusMsg.className = 'status-message ' + type;
        statusText.textContent = message;
        
        const icon = {
            success: 'fa-check-circle',
            error: 'fa-times-circle',
            info: 'fa-info-circle'
        }[type] || 'fa-info-circle';
        
        statusMsg.innerHTML = `<i class="fas ${icon}"></i><span>${message}</span>`;
    }

    // Upload ke ImageBB
    async function uploadToImageBB(file) {
        const formData = new FormData();
        formData.append('image', file);

        const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        
        if (data.success) {
            return data.data.url;
        } else {
            throw new Error(data.error?.message || 'Upload failed');
        }
    }

    // Handle File
    async function handleFile(file) {
        // Validasi
        if (!file.type.startsWith('image/')) {
            setMainStatus('error', 'Please select an image file');
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            setMainStatus('error', 'Max file size 10MB');
            return;
        }

        selectedFile = file;
        
        // Preview original
        const reader = new FileReader();
        reader.onload = (e) => {
            originalPreview.innerHTML = `<img src="${e.target.result}" alt="original">`;
        };
        reader.readAsDataURL(file);

        // Reset result
        resetResult();
        
        // Update UI
        setMainStatus('info', 'Uploading to ImageBB...');
        setUploadStatus('uploading');
        urlText.innerText = 'Uploading...';
        urlBadge.classList.remove('success');
        processBtn.disabled = true;

        try {
            const imageUrl = await uploadToImageBB(file);
            publicImageUrl = imageUrl;
            
            // Sukses
            urlText.innerText = '✓ Image ready';
            urlBadge.classList.add('success');
            setMainStatus('success', 'Image ready! Click remove background');
            setUploadStatus('ready');
            processBtn.disabled = false;
            
        } catch (error) {
            console.error('Upload error:', error);
            setMainStatus('error', 'Upload failed: ' + (error.message || 'Unknown error'));
            setUploadStatus('error');
            urlText.innerText = 'Upload failed';
            publicImageUrl = null;
        }
    }

    // Process Remove Background
    async function processRemoveBackground() {
        if (!publicImageUrl || isProcessing) {
            console.log('Cannot process:', { publicImageUrl, isProcessing });
            return;
        }

        isProcessing = true;
        processBtn.disabled = true;
        
        // Update UI
        setMainStatus('info', 'AI is removing background...');
        setProcessStatus('processing');
        resultPreview.innerHTML = `
            <div class="placeholder-preview">
                <div class="spinner spinner-lg"></div>
                <span>Processing...</span>
            </div>
        `;
        downloadSection.style.display = 'none';

        try {
            const apiUrl = `${REMOVE_BG_API}${encodeURIComponent(publicImageUrl)}`;
            console.log('Calling API:', apiUrl);
            
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 30000);

            const response = await fetch(apiUrl, {
                signal: controller.signal,
                method: 'GET',
                mode: 'cors',
                headers: {
                    'Accept': 'image/*'
                }
            });
            
            clearTimeout(timeout);

            if (!response.ok) {
                throw new Error(`API error (${response.status})`);
            }

            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.startsWith('image/')) {
                throw new Error('Invalid response format');
            }

            const blob = await response.blob();
            
            if (resultBlobUrl) {
                URL.revokeObjectURL(resultBlobUrl);
            }
            resultBlobUrl = URL.createObjectURL(blob);
            
            // Tampilkan hasil
            resultPreview.innerHTML = `<img src="${resultBlobUrl}" class="result-image" alt="removed background">`;
            
            // Siapkan download
            downloadLink.href = resultBlobUrl;
            downloadLink.download = `lumina-${Date.now()}.png`;
            downloadSection.style.display = 'block';
            
            // Update status
            setMainStatus('success', 'Background removed successfully!');
            setProcessStatus('success');
            
        } catch (error) {
            console.error('Process error:', error);
            
            let errorMessage = 'Processing failed';
            if (error.name === 'AbortError') {
                errorMessage = 'Request timeout';
            } else if (error.message) {
                errorMessage = error.message;
            }
            
            setMainStatus('error', errorMessage);
            setProcessStatus('error');
            
            resultPreview.innerHTML = `
                <div class="placeholder-preview">
                    <i class="fas fa-exclamation-triangle" style="color: #f87171;"></i>
                    <span>Failed</span>
                </div>
            `;
        } finally {
            isProcessing = false;
            if (publicImageUrl) {
                processBtn.disabled = false;
            }
        }
    }

    // Reset result
    function resetResult() {
        resultPreview.innerHTML = `
            <div class="placeholder-preview">
                <i class="fas fa-eye-slash"></i>
                <span>Result</span>
            </div>
        `;
        downloadSection.style.display = 'none';
        setProcessStatus('standby');
        if (resultBlobUrl) {
            URL.revokeObjectURL(resultBlobUrl);
            resultBlobUrl = null;
        }
    }

    // Event Listeners
    dropZone.addEventListener('click', () => {
        fileInput.click();
    });

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#38bdf8';
        dropZone.style.background = 'rgba(56, 189, 248, 0.1)';
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.style.borderColor = 'rgba(56, 189, 248, 0.2)';
        dropZone.style.background = 'rgba(2, 10, 25, 0.3)';
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'rgba(56, 189, 248, 0.2)';
        dropZone.style.background = 'rgba(2, 10, 25, 0.3)';
        
        if (e.dataTransfer.files.length > 0) {
            handleFile(e.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFile(e.target.files[0]);
        }
    });

    processBtn.addEventListener('click', (e) => {
        e.preventDefault();
        processRemoveBackground();
    });

    // Cleanup
    window.addEventListener('beforeunload', () => {
        if (resultBlobUrl) {
            URL.revokeObjectURL(resultBlobUrl);
        }
    });

    console.log('LUMINA AI siap digunakan');
})();
