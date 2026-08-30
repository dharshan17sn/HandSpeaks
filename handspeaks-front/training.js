import * as THREE from 'three';
import { GLTFLoader } from 'GLTFLoader';

const watch = new TouchSDK.Watch();
let isRecording = false;
let startTime = null;
let sensorDataBuffer = [];
let csvContent = [];
let recordedDataCount = 0;

// Configuration
const CONFIG = {
    modelPath: '3dmodel/arm.glb',
    recordingDuration: 3000, // 3 seconds in milliseconds
    colors: {
        primary: '#007AFF',
        secondary: '#34C759',
        accent: '#FF3B30',
        background: '#F2F2F7',
        text: '#1C1C1E'
    }
};

// Application State
const appState = {
    sensorData: {
        acceleration: [0, 0, 0],
        gravity: [0, 0, 0],
        angularVelocity: [0, 0, 0],
        orientation: [0, 0, 0]
    },
    handModel: null,
    scene: null,
    camera: null,
    renderer: null,
    isConnected: false  // Add connection state
};

// Initialize the application
function initializeApp() {
    document.body.classList.add('training-page');
    setupUI();
    setupThreeJS();
    setupEventListeners();
}

// Set up UI elements and event listeners
function setupUI() {
    const recordButton = document.getElementById('record-button');
    const recordingStatus = document.getElementById('recording-status');
    const gestureIdInput = document.getElementById('gesture-id');

    // Add connect button to header
    const connectButton = watch.createConnectButton();
    connectButton.style.backgroundColor = CONFIG.colors.primary;
    connectButton.style.color = 'white';
    connectButton.style.border = 'none';
    connectButton.style.borderRadius = '8px';
    connectButton.style.padding = '8px 16px';
    connectButton.style.fontSize = '14px';
    connectButton.style.fontWeight = '500';
    connectButton.style.cursor = 'pointer';
    connectButton.style.transition = 'background-color 0.3s ease';
    connectButton.style.marginLeft = 'auto';
    connectButton.style.marginRight = '20px';

    // Create custom disconnect button
    const disconnectButton = document.createElement('button');
    disconnectButton.id = 'custom-disconnect-button';
    disconnectButton.textContent = 'Disconnect';
    disconnectButton.style.backgroundColor = '#FF3B30'; // Apple Red
    disconnectButton.style.color = 'white';
    disconnectButton.style.border = 'none';
    disconnectButton.style.borderRadius = '8px';
    disconnectButton.style.padding = '8px 16px';
    disconnectButton.style.fontSize = '14px';
    disconnectButton.style.fontWeight = '500';
    disconnectButton.style.cursor = 'pointer';
    disconnectButton.style.transition = 'background-color 0.3s ease';
    disconnectButton.style.marginLeft = 'auto';
    disconnectButton.style.marginRight = '20px';
    disconnectButton.style.display = 'none'; // Hidden by default
    
    disconnectButton.addEventListener('mouseover', () => {
        disconnectButton.style.backgroundColor = '#FF453A';
    });
    disconnectButton.addEventListener('mouseout', () => {
        disconnectButton.style.backgroundColor = '#FF3B30';
    });
    
    disconnectButton.addEventListener('click', () => {
        try {
            if (typeof watch.disconnect === 'function') {
                watch.disconnect();
            } else if (watch.device && watch.device.gatt && watch.device.gatt.connected) {
                watch.device.gatt.disconnect();
            }
        } catch (e) {
            console.error('Disconnect failed:', e);
        }
    });

    // Insert connect and disconnect buttons into header
    const header = document.querySelector('header');
    if (header) {
        header.insertBefore(disconnectButton, header.querySelector('.search-container'));
        header.insertBefore(connectButton, header.querySelector('.search-container'));
        
        // Create menu toggle for mobile layout
        const menuToggle = document.createElement('div');
        menuToggle.className = 'menu-toggle';
        menuToggle.innerHTML = '☰'; // standard hamburger character
        menuToggle.style.color = CONFIG.colors.text;
        menuToggle.style.fontSize = '24px';
        menuToggle.style.cursor = 'pointer';
        
        // Insert hamburger menu toggle button into header
        header.appendChild(menuToggle);
        
        const navigation = document.querySelector('.navigation');
        menuToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            navigation.classList.toggle('active');
        });
        
        // Close menu when clicking outside
        document.addEventListener('click', () => {
            if (navigation && navigation.classList.contains('active')) {
                navigation.classList.remove('active');
            }
        });
    }

    // Add button event listeners
    connectButton.addEventListener('mouseover', () => {
        connectButton.style.backgroundColor = '#0066CC';
    });

    connectButton.addEventListener('mouseout', () => {
        connectButton.style.backgroundColor = CONFIG.colors.primary;
    });

    // Poll connection state to sync UI dynamically
    let wasConnected = false;
    setInterval(() => {
        const isConnected = (watch.device && watch.device.gatt && watch.device.gatt.connected) || watch.connected || false;
        if (isConnected !== wasConnected) {
            wasConnected = isConnected;
            if (isConnected) {
                disconnectButton.style.display = 'block';
                connectButton.style.display = 'none';
            } else {
                disconnectButton.style.display = 'none';
                connectButton.style.display = 'block';
                connectButton.textContent = 'Connect';
            }
        }
    }, 500);

    // Add class label input if container exists
    const idInputContainer = document.querySelector('.id-input');
    if (idInputContainer) {
        const classLabelInput = document.createElement('input');
        classLabelInput.type = 'text';
        classLabelInput.id = 'class-label';
        classLabelInput.placeholder = 'Enter class label';
        classLabelInput.style.marginLeft = '10px';
        classLabelInput.style.padding = '8px';
        classLabelInput.style.borderRadius = '4px';
        classLabelInput.style.border = '1px solid #ccc';
        idInputContainer.appendChild(classLabelInput);
    }

    // Optimize click handler if record button exists
    if (recordButton) {
        recordButton.addEventListener('click', () => {
            if (!isRecording) {
                startRecording();
            } else {
                stopRecording();
            }
        });
    }
}

// Set up Three.js scene
function setupThreeJS() {
    const container = document.getElementById('viewer-container');
    
    appState.scene = new THREE.Scene();
    appState.scene.background = new THREE.Color(CONFIG.colors.background);
    appState.camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    appState.camera.position.set(0, 30, 50);
    appState.camera.lookAt(0, 0, 0);

    appState.renderer = new THREE.WebGLRenderer({ antialias: true });
    appState.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(appState.renderer.domElement);

    // Lighting
    appState.scene.add(new THREE.AmbientLight(0x404040, 2));
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 5, 5).normalize();
    appState.scene.add(directionalLight);

    // Load Hand Model
    const loader = new GLTFLoader();
    loader.load(CONFIG.modelPath, (gltf) => {
        appState.handModel = gltf.scene;
        appState.scene.add(appState.handModel);
        animate();
    });

    // Handle window resize
    window.addEventListener('resize', () => {
        appState.camera.aspect = container.clientWidth / container.clientHeight;
        appState.camera.updateProjectionMatrix();
        appState.renderer.setSize(container.clientWidth, container.clientHeight);
    });
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    if (appState.handModel && isSensorDataValid()) {
        updateHandModel(appState.handModel);
    }
    appState.renderer.render(appState.scene, appState.camera);
}

// Check if sensor data is valid
function isSensorDataValid() {
    const allValues = [
        ...appState.sensorData.acceleration,
        ...appState.sensorData.gravity,
        ...appState.sensorData.angularVelocity,
        ...appState.sensorData.orientation
    ];
    return allValues.every(v => v !== 0);
}

// Update hand model rotation based on sensor data
function updateHandModel(model) {
    const [x, y, z, w] = appState.sensorData.orientation;
    const quaternion = new THREE.Quaternion(y, -z, x, -w);
    model.rotation.setFromQuaternion(quaternion);
}

// Set up event listeners for sensor data
function setupEventListeners() {
    watch.addEventListener('accelerationchanged', (e) => {
        appState.sensorData.acceleration = [e.detail.x, e.detail.y, e.detail.z];
        updateSensorDisplay();
        
        if (isRecording) {
            const elapsedTime = Date.now() - startTime;
            if (elapsedTime <= CONFIG.recordingDuration) {
                recordSensorData(elapsedTime);
            } else {
                stopRecording();
            }
        }
    });

    watch.addEventListener('angularvelocitychanged', (e) => {
        appState.sensorData.angularVelocity = [e.detail.x, e.detail.y, e.detail.z];
        updateSensorDisplay();
    });

    watch.addEventListener('gravityvectorchanged', (e) => {
        appState.sensorData.gravity = [e.detail.x, e.detail.y, e.detail.z];
        updateSensorDisplay();
    });

    watch.addEventListener('orientationchanged', (e) => {
        appState.sensorData.orientation = [e.detail.x, e.detail.y, e.detail.z, e.detail.w];
        updateSensorDisplay();
    });
}

// Update sensor data display
function updateSensorDisplay() {
    document.getElementById('acceleration-values').textContent = 
        appState.sensorData.acceleration.map(x => x.toFixed(2)).join(', ');
    document.getElementById('gravity-values').textContent = 
        appState.sensorData.gravity.map(x => x.toFixed(2)).join(', ');
    document.getElementById('angular-values').textContent = 
        appState.sensorData.angularVelocity.map(x => x.toFixed(2)).join(', ');
    document.getElementById('orientation-values').textContent = 
        appState.sensorData.orientation.map(x => x.toFixed(2)).join(', ');
}

// Start recording
function startRecording() {
    isRecording = true;
    startTime = Date.now();
    sensorDataBuffer = [];
    recordedDataCount = 0;
    document.getElementById('record-button').textContent = 'Stop Recording';
    document.getElementById('recording-status').textContent = 'Recording...';
    document.getElementById('recording-status').style.color = CONFIG.colors.accent;
    updateRowCount();
}

// Stop recording
function stopRecording() {
    isRecording = false;
    document.getElementById('record-button').textContent = 'Start Recording';
    document.getElementById('recording-status').textContent = 'Recording Complete';
    document.getElementById('recording-status').style.color = CONFIG.colors.secondary;
}

// Record sensor data
function recordSensorData(elapsedTime) {
    const gestureId = document.getElementById('gesture-id').value;
    const classLabel = document.getElementById('class-label').value || 'No gesture';
    const data = [
        gestureId,
        elapsedTime / 1000, // Convert to seconds
        ...appState.sensorData.acceleration, // Acceleration x, y, z
        ...appState.sensorData.gravity, // Gravity x, y, z
        ...appState.sensorData.angularVelocity, // Angular Velocity x, y, z
        appState.sensorData.orientation[0], // Orientation x
        appState.sensorData.orientation[1], // Orientation y
        appState.sensorData.orientation[2], // Orientation z
        classLabel // Use the entered class label
    ];
    sensorDataBuffer.push(data);
    recordedDataCount++;
    updateCSVDisplay();
    updateRowCount();
}

// Update CSV display
function updateCSVDisplay() {
    const csvContent = document.getElementById('csv-content');
    const headers = ['ID', 'Elapsed Time (s)', 
                    'Acceleration_x', 'Acceleration_y', 'Acceleration_z',
                    'Gravity_x', 'Gravity_y', 'Gravity_z',
                    'Angular Velocity_x', 'Angular Velocity_y', 'Angular Velocity_z',
                    'Orientation_x', 'Orientation_y', 'Orientation_z',
                    'Character'];
    
    let html = '<table><thead><tr>';
    headers.forEach(header => {
        html += `<th>${header}</th>`;
    });
    html += '</tr></thead><tbody>';
    
    // Reverse the array to show latest data first
    const reversedBuffer = [...sensorDataBuffer].reverse();
    
    reversedBuffer.forEach(row => {
        html += '<tr>';
        row.forEach(cell => {
            // Format numbers to 3 decimal places if they are numbers
            const formattedCell = typeof cell === 'number' ? cell.toFixed(3) : cell;
            html += `<td>${formattedCell}</td>`;
        });
        html += '</tr>';
    });
    
    html += '</tbody></table>';
    csvContent.innerHTML = html;
}

// Function to update row count
function updateRowCount() {
    document.getElementById('row-count').textContent = recordedDataCount;
}

// Function to show operation status
function showOperationStatus(message, isError = false, isLoading = false) {
    const statusElement = document.getElementById('operation-status');
    const saveButton = document.getElementById('save-button');
    const deleteByIdButton = document.getElementById('delete-by-id');
    const deleteByLabelButton = document.getElementById('delete-by-label');

    if (!statusElement) return;

    if (isLoading) {
        statusElement.className = 'operation-status loading';
        statusElement.innerHTML = `
            <div class="loading-spinner"></div>
            <span>${message}</span>
        `;
        // Safely disable buttons if they exist
        if (saveButton) saveButton.disabled = true;
        if (deleteByIdButton) deleteByIdButton.disabled = true;
        if (deleteByLabelButton) deleteByLabelButton.disabled = true;
    } else {
        statusElement.className = 'operation-status ' + (isError ? 'error' : 'success');
        statusElement.textContent = message;
        // Safely enable buttons if they exist
        if (saveButton) saveButton.disabled = false;
        if (deleteByIdButton) deleteByIdButton.disabled = false;
        if (deleteByLabelButton) deleteByLabelButton.disabled = false;

        // Hide the status after 3 seconds
        setTimeout(() => {
            if (statusElement) {
                statusElement.style.display = 'none';
            }
        }, 3000);
    }
    statusElement.style.display = 'block';
}

// Function to save recorded data
async function saveRecordedData() {
    if (sensorDataBuffer.length === 0) {
        showOperationStatus('No data to save', true);
        return;
    }

    showOperationStatus('Saving data...', false, true);

    try {
        const response = await fetch(`${(typeof BACKEND_URL !== 'undefined') ? BACKEND_URL : 'http://localhost:5000'}/save_csv`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                csv_data: sensorDataBuffer.map(row => row.join(','))
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showOperationStatus(`Successfully saved ${sensorDataBuffer.length} records`);
            // Only clear the buffer after successful save
            sensorDataBuffer = [];
            recordedDataCount = 0;
            updateCSVDisplay();
            updateRowCount();
        } else {
            showOperationStatus(data.error || 'Failed to save data', true);
        }
    } catch (error) {
        showOperationStatus('Error saving data: ' + error.message, true);
        console.error('Error saving data:', error);
    }
}

// Function to delete rows by ID or label
async function deleteRows(type, value) {
    if (!value) {
        showOperationStatus(`Please enter a ${type} to delete`, true);
        return;
    }

    showOperationStatus('Deleting rows...', false, true);

    try {
        const response = await fetch(`${(typeof BACKEND_URL !== 'undefined') ? BACKEND_URL : 'http://localhost:5000'}/delete_rows`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                type: type,
                value: value 
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showOperationStatus(`Successfully deleted rows with ${type}: ${value}`);
            // Clear the delete inputs
            document.getElementById('delete-id').value = '';
            document.getElementById('delete-label').value = '';
        } else {
            showOperationStatus(data.error || 'Failed to delete rows', true);
        }
    } catch (error) {
        showOperationStatus('Error deleting rows: ' + error.message, true);
    }
}

// Add event listeners for the buttons
document.addEventListener('DOMContentLoaded', () => {
    // Initialize the application
    initializeApp();

    // Style the controls container
    const trainingControls = document.querySelector('.training-controls');
    if (trainingControls) {
        trainingControls.style.display = 'flex';
        trainingControls.style.flexDirection = 'column';
        trainingControls.style.gap = '20px';
        trainingControls.style.padding = '20px';
        trainingControls.style.backgroundColor = '#f8f8f8';
        trainingControls.style.borderRadius = '12px';
        trainingControls.style.margin = '20px 0';
    }

    // Style sections
    const sections = document.querySelectorAll('.control-section');
    sections.forEach(section => {
        section.style.display = 'flex';
        section.style.gap = '15px';
        section.style.alignItems = 'center';
    });

    // Style the delete section specifically
    const deleteSection = document.querySelector('.delete-section');
    if (deleteSection) {
        deleteSection.style.flexDirection = 'column';
        deleteSection.style.background = '#fff';
        deleteSection.style.padding = '15px';
        deleteSection.style.borderRadius = '8px';
        deleteSection.style.border = '1px solid #e1e1e1';
    }

    // Style the delete controls grid
    const deleteGrid = document.querySelector('.delete-controls-grid');
    if (deleteGrid) {
        deleteGrid.style.display = 'grid';
        deleteGrid.style.gridTemplateColumns = '1fr 1fr';
        deleteGrid.style.gap = '15px';
        deleteGrid.style.width = '100%';
    }

    // Style all input groups
    const inputGroups = document.querySelectorAll('.input-group, .delete-input-group');
    inputGroups.forEach(group => {
        group.style.display = 'flex';
        group.style.flexDirection = group.classList.contains('delete-input-group') ? 'row' : 'column';
        group.style.gap = '8px';
        group.style.flex = '1';
    });

    // Style all inputs
    const inputs = document.querySelectorAll('input');
    inputs.forEach(input => {
        input.style.padding = '8px';
        input.style.borderRadius = '6px';
        input.style.border = '1px solid #ccc';
        input.style.width = '100%';
    });

    // Style all labels
    const labels = document.querySelectorAll('label');
    labels.forEach(label => {
        label.style.fontWeight = '500';
        label.style.marginBottom = '4px';
    });

    // Style all buttons (including record button)
    const buttons = document.querySelectorAll('.control-button, .record-button');
    buttons.forEach(button => {
        button.style.padding = '8px 16px';
        button.style.borderRadius = '8px';
        button.style.border = 'none';
        button.style.cursor = 'pointer';
        button.style.fontWeight = '500';
        button.style.transition = 'background-color 0.3s ease, box-shadow 0.2s';
        button.style.boxShadow = '0 1px 4px rgba(0,0,0,0.07)';
        button.tabIndex = 0;
        button.onfocus = () => { button.style.outline = '2px solid #007AFF'; };
        button.onblur = () => { button.style.outline = 'none'; };
        button.onmousedown = () => { button.style.transform = 'scale(0.97)'; };
        button.onmouseup = () => { button.style.transform = 'scale(1)'; };
        button.onmouseleave = () => { button.style.transform = 'scale(1)'; };
    });

    // Style primary buttons (Save, Record)
    const primaryButtons = document.querySelectorAll('.control-button.primary, .record-button');
    primaryButtons.forEach(button => {
        button.style.backgroundColor = '#007AFF';
        button.style.color = 'white';
        button.style.flex = '1';
        button.addEventListener('mouseover', () => {
            button.style.backgroundColor = '#0066CC';
        });
        button.addEventListener('mouseout', () => {
            button.style.backgroundColor = '#007AFF';
        });
    });

    // Style warning buttons (Clear)
    const warningButtons = document.querySelectorAll('.control-button.warning');
    warningButtons.forEach(button => {
        button.style.backgroundColor = '#FF9500';
        button.style.color = 'white';
        button.style.flex = '1';
        button.addEventListener('mouseover', () => {
            button.style.backgroundColor = '#E68500';
        });
        button.addEventListener('mouseout', () => {
            button.style.backgroundColor = '#FF9500';
        });
    });

    // Style delete buttons
    const deleteButtons = document.querySelectorAll('.control-button.delete');
    deleteButtons.forEach(button => {
        button.style.backgroundColor = '#FF3B30';
        button.style.color = 'white';
        button.style.minWidth = '80px';
        button.addEventListener('mouseover', () => {
            button.style.backgroundColor = '#E63329';
        });
        button.addEventListener('mouseout', () => {
            button.style.backgroundColor = '#FF3B30';
        });
    });

    // Style all button groups for layout
    const buttonGroups = document.querySelectorAll('.button-group');
    buttonGroups.forEach(group => {
        group.style.display = 'flex';
        group.style.gap = '12px';
        group.style.justifyContent = 'center';
        group.style.alignItems = 'center';
        group.style.width = '100%';
    });

    // Add event listeners
    document.getElementById('save-button').addEventListener('click', saveRecordedData);
    document.getElementById('clear-button').onclick = () => {
        if (sensorDataBuffer.length > 0) {
            if (confirm('Are you sure you want to clear all recorded data? This cannot be undone.')) {
                sensorDataBuffer = [];
                recordedDataCount = 0;
                updateCSVDisplay();
                updateRowCount();
                showOperationStatus('Data cleared');
            }
        } else {
            showOperationStatus('No data to clear', true);
        }
    };

    document.getElementById('delete-by-id').addEventListener('click', () => {
        const id = document.getElementById('delete-id').value;
        deleteRows('id', id);
    });

    document.getElementById('delete-by-label').addEventListener('click', () => {
        const label = document.getElementById('delete-label').value;
        deleteRows('label', label);
    });
}); 
// Add training button listener
const trainButton = document.getElementById('train-button');
const trainingStatus = document.getElementById('training-status');
if (trainButton) {
    trainButton.addEventListener('click', async () => {
        trainButton.disabled = true;

        // Create or show loading spinner
        let spinner = document.getElementById('loading-spinner');
        if (!spinner) {
            spinner = document.createElement('div');
            spinner.id = 'loading-spinner';
            spinner.style.cssText = `
                border: 4px solid #f3f3f3;
                border-top: 4px solid #3498db;
                border-radius: 50%;
                width: 24px;
                height: 24px;
                animation: spin 1s linear infinite;
                display: inline-block;
                margin-left: 10px;
                vertical-align: middle;
            `;
            trainingStatus.parentNode.insertBefore(spinner, trainingStatus.nextSibling);
        }
        spinner.style.display = 'inline-block';

        trainingStatus.textContent = 'Training started...';
        trainingStatus.style.color = 'blue';

        const metricsSection = document.getElementById('training-metrics');
        if (metricsSection) metricsSection.style.display = 'none';

        const epochs = parseInt(document.getElementById('epochs')?.value) || 10;
        const batchSize = parseInt(document.getElementById('batch-size')?.value) || 32;

        try {
            const response = await fetch(`${(typeof BACKEND_URL !== 'undefined') ? BACKEND_URL : 'http://localhost:5000'}/train-model`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    epochs: epochs,
                    batch_size: batchSize,
                    // learning_rate: learningRate  // if you add this later
                })
            });

            const data = await response.json();

            if (response.ok && data.status === 'completed') {
                trainingStatus.textContent = 'Training completed successfully!';
                trainingStatus.style.color = 'green';

                if (metricsSection) metricsSection.style.display = 'block';

                // 1. Loss Chart (train + val)
                if (data.loss && data.val_loss) {
                    const ctxLoss = document.getElementById('lossChart').getContext('2d');
                    if (window.lossChart && typeof window.lossChart.destroy === 'function') {
                        window.lossChart.destroy();
                    }
                    window.lossChart = new Chart(ctxLoss, {
                        type: 'line',
                        data: {
                            labels: data.loss.map((_, i) => i + 1),
                            datasets: [
                                {
                                    label: 'Training Loss',
                                    data: data.loss,
                                    borderColor: 'red',
                                    fill: false,
                                    tension: 0.1
                                },
                                {
                                    label: 'Validation Loss',
                                    data: data.val_loss,
                                    borderColor: 'orange',
                                    fill: false,
                                    tension: 0.1
                                }
                            ]
                        },
                        options: {
                            responsive: true,
                            scales: {
                                x: { title: { display: true, text: 'Epoch' } },
                                y: { title: { display: true, text: 'Loss' }, beginAtZero: true }
                            }
                        }
                    });
                }

                // 2. Accuracy Chart (train + val)
                if (data.accuracy && data.val_accuracy) {
                    const ctxAcc = document.getElementById('accuracyChart').getContext('2d');
                    if (window.accuracyChart && typeof window.accuracyChart.destroy === 'function') {
                        window.accuracyChart.destroy();
                    }
                    window.accuracyChart = new Chart(ctxAcc, {
                        type: 'line',
                        data: {
                            labels: data.accuracy.map((_, i) => i + 1),
                            datasets: [
                                {
                                    label: 'Training Accuracy',
                                    data: data.accuracy,
                                    borderColor: 'green',
                                    fill: false,
                                    tension: 0.1
                                },
                                {
                                    label: 'Validation Accuracy',
                                    data: data.val_accuracy,
                                    borderColor: 'limegreen',
                                    fill: false,
                                    tension: 0.1
                                }
                            ]
                        },
                        options: {
                            responsive: true,
                            scales: {
                                x: { title: { display: true, text: 'Epoch' } },
                                y: { title: { display: true, text: 'Accuracy' }, beginAtZero: true, max: 1 }
                            }
                        }
                    });
                }

                // 3. Confusion Matrix (table + heatmap)
                if (data.confusion_matrix && data.class_labels) {
                    const cmCanvas = document.getElementById('confusionMatrixChart');
                    if (cmCanvas) {
                        const ctx = cmCanvas.getContext('2d');
                        ctx.clearRect(0, 0, cmCanvas.width, cmCanvas.height);
                    }

                    let existingTable = document.getElementById('confusionMatrixTable');
                    if (existingTable) existingTable.remove();

                    const cmContainer = cmCanvas.parentElement;
                    const table = document.createElement('table');
                    table.id = 'confusionMatrixTable';
                    table.style.borderCollapse = 'collapse';
                    table.style.width = '100%';
                    table.style.marginTop = '10px';

                    // Header row
                    let thead = document.createElement('thead');
                    let headerRow = document.createElement('tr');
                    let emptyHeader = document.createElement('th');
                    emptyHeader.textContent = '';
                    headerRow.appendChild(emptyHeader);
                    data.class_labels.forEach(label => {
                        let th = document.createElement('th');
                        th.textContent = label;
                        th.style.border = '1px solid #ddd';
                        th.style.padding = '5px';
                        headerRow.appendChild(th);
                    });
                    thead.appendChild(headerRow);
                    table.appendChild(thead);

                    // Body rows
                    let tbody = document.createElement('tbody');
                    data.confusion_matrix.forEach((row, i) => {
                        let tr = document.createElement('tr');
                        let rowHeader = document.createElement('th');
                        rowHeader.textContent = data.class_labels[i];
                        rowHeader.style.border = '1px solid #ddd';
                        rowHeader.style.padding = '5px';
                        tr.appendChild(rowHeader);

                        row.forEach(value => {
                            let td = document.createElement('td');
                            td.textContent = value;
                            td.style.border = '1px solid #ddd';
                            td.style.padding = '5px';

                            // Heatmap coloring (red-green scale)
                            let maxVal = Math.max(...row);
                            let intensity = maxVal ? value / maxVal : 0;
                            let red = Math.floor(255 * intensity);
                            let green = 255 - red;
                            td.style.backgroundColor = `rgba(${red}, ${green}, 0, 0.3)`;

                            tr.appendChild(td);
                        });
                        tbody.appendChild(tr);
                    });
                    table.appendChild(tbody);
                    cmContainer.appendChild(table);
                }

                // 4. Class Labels list
                if (data.class_labels) {
                    const classListUl = document.getElementById('classList');
                    classListUl.innerHTML = '';
                    data.class_labels.forEach(label => {
                        const li = document.createElement('li');
                        li.textContent = label;
                        classListUl.appendChild(li);
                    });
                }

                // 5. Precision/Recall/F1 Table
                if (data.prf_per_class) {
                    const prfTableBody = document.getElementById('prfTableBody');
                    if (prfTableBody) {
                        prfTableBody.innerHTML = '';
                        Object.entries(data.prf_per_class).forEach(([label, metrics]) => {
                            const tr = document.createElement('tr');

                            const tdLabel = document.createElement('td');
                            tdLabel.textContent = label;
                            tr.appendChild(tdLabel);

                            const tdPrecision = document.createElement('td');
                            tdPrecision.textContent = (metrics.precision * 100).toFixed(2) + '%';
                            tr.appendChild(tdPrecision);

                            const tdRecall = document.createElement('td');
                            tdRecall.textContent = (metrics.recall * 100).toFixed(2) + '%';
                            tr.appendChild(tdRecall);

                            const tdF1 = document.createElement('td');
                            tdF1.textContent = (metrics.f1_score * 100).toFixed(2) + '%';
                            tr.appendChild(tdF1);

                            prfTableBody.appendChild(tr);
                        });
                    } else {
                        console.warn('prfTableBody element not found.');
                    }
                }

                // 6. Final metrics text
                if (data.final_metrics) {
                    const finalMetricsDiv = document.getElementById('finalMetrics');
                    finalMetricsDiv.innerHTML = Object.entries(data.final_metrics)
                        .map(([k, v]) => {
                            const isAccuracy = k.toLowerCase().includes('accuracy');
                            if (typeof v === 'number') {
                                return `<div><strong>${k}:</strong> ${(isAccuracy ? v * 100 : v).toFixed(4)}${isAccuracy ? '%' : ''}</div>`;
                            } else {
                                return `<div><strong>${k}:</strong> ${v}</div>`;
                            }
                        })
                        .join('');
                }

            } else {
                trainingStatus.textContent = `Training failed: ${data.error || 'Unknown error'}`;
                trainingStatus.style.color = 'red';
            }
        } catch (error) {
            trainingStatus.textContent = `Training error: ${error.message}`;
            trainingStatus.style.color = 'red';
        } finally {
            trainButton.disabled = false;
            const spinner = document.getElementById('loading-spinner');
            if (spinner) spinner.style.display = 'none';
            setTimeout(() => { trainingStatus.textContent = ''; }, 5000);
        }
    });
}

// Add keyframes animation CSS for spinner once
const style = document.createElement('style');
style.textContent = `
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}`;
document.head.appendChild(style);

