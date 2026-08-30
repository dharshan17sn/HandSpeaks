import * as THREE from 'three';
import { GLTFLoader } from 'GLTFLoader';

const watch = new TouchSDK.Watch();
const mainContent = document.createElement('main');

// Configuration with Apple design system and ElevenLabs integration
const CONFIG = {
    sequenceLength: 100,
    inactivityTimeout: 3000,
    modelPath: '../3dmodel/arm.glb',
    apiEndpoint: (typeof BACKEND_URL !== 'undefined') ? BACKEND_URL : 'http://127.0.0.1:5000',
    colors: {
        primary: '#007AFF',       // Apple Blue
        primaryDark: '#0066CC',   // Darker Blue for pressed states
        secondary: '#34C759',     // Apple Green
        secondaryDark: '#2DBE4F', // Darker Green
        accent: '#FF3B30',        // Apple Red
        accentDark: '#E63329',    // Darker Red
        background: '#F2F2F7',    // System Gray 6
        cardBackground: '#FFFFFF', // White for cards
        text: '#1C1C1E',          // Label
        secondaryText: '#636366',  // Secondary Label
        tertiaryText: '#AEAEB2',   // Tertiary Label
        separator: '#D1D1D6',     // Separator
        systemFill: '#78788033',   // System Fill with 20% opacity
        dataFlow: '#5856D6',      // Data flow color
        bleConnected: '#34C759',   // BLE Connected color
        bleDisconnected: '#FF3B30', // BLE Disconnected color
        bleScanning: '#FF9500',    // BLE Scanning color
        bleSignal: '#5856D6'      // BLE Signal color
    },
    animations: {
        duration: {
            short: '0.2s',
            medium: '0.3s',
            long: '0.5s'
        },
        timing: {
            ease: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
            spring: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)'
        }
    },
    tones: [
        { id: 'friendly', label: 'Friendly', icon: '😊', color: '#007AFF' },
        { id: 'professional', label: 'Professional', icon: '📝', color: '#5856D6' },
        { id: 'casual', label: 'Casual', icon: '👕', color: '#FF9500' },
        { id: 'persuasive', label: 'Persuasive', icon: '💬', color: '#FF2D55' }
    ],
    typography: {
        largeTitle: '28px',
        title1: '22px',
        title2: '20px',
        title3: '18px',
        headline: '17px',
        body: '16px',
        callout: '15px',
        subhead: '14px',
        footnote: '13px',
        caption1: '12px',
        caption2: '11px'
    },
    spacing: {
        small: '8px',
        medium: '16px',
        large: '24px',
        xLarge: '32px'
    },
    cornerRadius: {
        small: '6px',
        medium: '12px',
        large: '16px'
    },
    elevenLabs: {
        apiKey: 'sk_54a1f2fe7f949692dd39c14b33824298f75a8956d1d77554',
        voiceId: '21m00Tcm4TlvDq8ikWAM', // Rachel voice
        modelId: 'eleven_monolingual_v2',
        apiEndpoint: 'https://api.elevenlabs.io/v1/text-to-speech'
    }
};

// Application State
const appState = {
    sensorData: {
        acceleration: [0, 0, 0],
        gravity: [0, 0, 0],
        angularVelocity: [0, 0, 0],
        orientation: [0, 0, 0, 0]
    },
    sensorDataBuffer: [],
    isCollectingData: true,
    currentSentence: [],
    sentenceHistory: [],
    inactivityTimer: null,
    startTime: null,
    handModel: null,
    scene: null,
    camera: null,
    renderer: null,
    selectedTone: 'friendly',
    isSpeaking: false
};

// Add BLE state tracking
const bleState = {
    isConnected: false,
    isScanning: false,
    signalStrength: 0,
    lastPacketTime: null,
    packetCount: 0,
    dataRate: 0,
    connectionQuality: 'disconnected',
    rssi: 0
};

// Helper function for Apple-style press animations
function applyPressAnimation(element, darkColor) {
    element.addEventListener('mousedown', () => {
        element.style.transition = 'none';
        element.style.backgroundColor = darkColor;
    });
    
    element.addEventListener('mouseup', () => {
        element.style.transition = 'background-color 0.3s ease';
        element.style.backgroundColor = '';
    });
    
    element.addEventListener('mouseleave', () => {
        element.style.transition = 'background-color 0.3s ease';
        element.style.backgroundColor = '';
    });
}

// Initialize the application
function initializeApp() {
    document.body.classList.add('tracking-page');
    setupUI();
    setupThreeJS();
    setupEventListeners();
    startDataCollection();
}

// Set up the user interface with Apple design
function setupUI() {
    // Reset body styles
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.fontFamily = "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif";
    document.body.style.backgroundColor = CONFIG.colors.background;
    document.body.style.color = CONFIG.colors.text;
    document.body.style.minHeight = '100vh';
    document.body.style.display = 'flex';
    document.body.style.flexDirection = 'column';
    document.body.style.overflowX = 'hidden';

    // Get the existing main content area
    const mainContent = document.getElementById('main-content');
    mainContent.style.flex = '1';
    mainContent.style.width = '100%';
    mainContent.style.padding = '0';
    mainContent.style.marginTop = '0px'; // Already accounted for by content-wrapper

    // Move connect button to header
    const connectButton = watch.createConnectButton();
    connectButton.style.backgroundColor = CONFIG.colors.primary;
    connectButton.style.color = 'white';
    connectButton.style.border = 'none';
    connectButton.style.borderRadius = CONFIG.cornerRadius.medium;
    connectButton.style.padding = `${CONFIG.spacing.small} ${CONFIG.spacing.medium}`;
    connectButton.style.fontSize = CONFIG.typography.subhead;
    connectButton.style.fontWeight = '500';
    connectButton.style.cursor = 'pointer';
    connectButton.style.transition = 'background-color 0.3s ease, transform 0.3s ease';
    connectButton.style.boxShadow = 'none';
    connectButton.style.webkitAppearance = 'none';
    connectButton.style.fontFamily = 'inherit';
    connectButton.style.marginLeft = 'auto'; // Push to the right
    connectButton.style.marginRight = '20px'; // Add some spacing from the right edge
    
    // Create custom disconnect button
    const disconnectButton = document.createElement('button');
    disconnectButton.id = 'custom-disconnect-button';
    disconnectButton.textContent = 'Disconnect';
    disconnectButton.style.backgroundColor = CONFIG.colors.accent; // Apple Red
    disconnectButton.style.color = 'white';
    disconnectButton.style.border = 'none';
    disconnectButton.style.borderRadius = CONFIG.cornerRadius.medium;
    disconnectButton.style.padding = `${CONFIG.spacing.small} ${CONFIG.spacing.medium}`;
    disconnectButton.style.fontSize = CONFIG.typography.subhead;
    disconnectButton.style.fontWeight = '500';
    disconnectButton.style.cursor = 'pointer';
    disconnectButton.style.transition = 'background-color 0.3s ease, transform 0.3s ease';
    disconnectButton.style.boxShadow = 'none';
    disconnectButton.style.webkitAppearance = 'none';
    disconnectButton.style.fontFamily = 'inherit';
    disconnectButton.style.marginLeft = 'auto';
    disconnectButton.style.marginRight = '20px';
    disconnectButton.style.display = 'none'; // Hidden by default
    
    disconnectButton.addEventListener('mouseover', () => {
        disconnectButton.style.backgroundColor = CONFIG.colors.accentDark;
    });
    disconnectButton.addEventListener('mouseout', () => {
        disconnectButton.style.backgroundColor = CONFIG.colors.accent;
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

    // Dashboard container
    const dashboardContainer = document.createElement('div');
    dashboardContainer.id = 'dashboard-container';
    mainContent.appendChild(dashboardContainer);

    // Left panel (3D viewer and controls)
    const leftPanel = document.createElement('div');
    leftPanel.id = 'left-panel';
    dashboardContainer.appendChild(leftPanel);

    // 3D Viewer Container with Apple-style card
    const viewerContainer = document.createElement('div');
    viewerContainer.id = 'viewer-container';
    viewerContainer.style.width = '100%';
    viewerContainer.style.height = 'calc(100vh - 450px)'; // Dynamic height
    viewerContainer.style.backgroundColor = CONFIG.colors.cardBackground;
    viewerContainer.style.borderRadius = CONFIG.cornerRadius.large;
    viewerContainer.style.overflow = 'hidden';
    viewerContainer.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
    viewerContainer.style.border = '1px solid rgba(0,0,0,0.1)';
    leftPanel.appendChild(viewerContainer);

    // Add data flow visualization with enhanced details
    const dataFlowContainer = createDataFlowVisualization();
    dataFlowContainer.style.height = 'calc(100vh - 450px)'; // Dynamic height
    leftPanel.appendChild(dataFlowContainer);

    // Right panel (predictions and info)
    const rightPanel = document.createElement('div');
    rightPanel.id = 'right-panel';
    dashboardContainer.appendChild(rightPanel);

    // Tone Selection Menu with Apple-style segmented control - Moved to top
    const toneMenuContainer = document.createElement('div');
    toneMenuContainer.style.width = '100%';
    toneMenuContainer.style.display = 'flex';
    toneMenuContainer.style.flexDirection = 'column';
    toneMenuContainer.style.gap = CONFIG.spacing.small;
    toneMenuContainer.style.marginBottom = CONFIG.spacing.medium;
    toneMenuContainer.style.flex = 'none';
    
    const toneLabel = document.createElement('div');
    toneLabel.textContent = 'SELECT TONE';
    toneLabel.style.fontWeight = '600';
    toneLabel.style.fontSize = CONFIG.typography.footnote;
    toneLabel.style.color = CONFIG.colors.secondaryText;
    toneLabel.style.letterSpacing = '0.5px';
    toneLabel.style.textTransform = 'uppercase';
    toneMenuContainer.appendChild(toneLabel);
    
    const toneButtonsContainer = document.createElement('div');
    toneButtonsContainer.style.display = 'flex';
    toneButtonsContainer.style.gap = CONFIG.spacing.small;
    toneButtonsContainer.style.flexWrap = 'wrap';
    toneButtonsContainer.style.width = '100%';
    
    // Create Apple-style segmented control
    const segmentedControl = document.createElement('div');
    segmentedControl.style.display = 'flex';
    segmentedControl.style.backgroundColor = CONFIG.colors.systemFill;
    segmentedControl.style.borderRadius = CONFIG.cornerRadius.medium;
    segmentedControl.style.padding = '3px';
    segmentedControl.style.width = '100%';
    
    CONFIG.tones.forEach((tone, index) => {
        const segment = document.createElement('button');
        segment.textContent = `${tone.icon} ${tone.label}`;
        segment.dataset.tone = tone.id;
        segment.style.flex = '1';
        segment.style.padding = '8px 12px';
        segment.style.border = 'none';
        segment.style.borderRadius = '7px';
        segment.style.backgroundColor = appState.selectedTone === tone.id ? tone.color : 'transparent';
        segment.style.color = appState.selectedTone === tone.id ? 'white' : CONFIG.colors.text;
        segment.style.cursor = 'pointer';
        segment.style.transition = 'background-color 0.3s ease, color 0.3s ease';
        segment.style.fontSize = CONFIG.typography.subhead;
        segment.style.fontWeight = '500';
        segment.style.textAlign = 'center';
        segment.style.whiteSpace = 'nowrap';
        segment.style.overflow = 'hidden';
        segment.style.textOverflow = 'ellipsis';
        segment.style.webkitAppearance = 'none';
        segment.style.fontFamily = 'inherit';
        
        segment.addEventListener('click', () => {
            appState.selectedTone = tone.id;
            document.querySelectorAll('[data-tone]').forEach(btn => {
                const currentTone = CONFIG.tones.find(t => t.id === btn.dataset.tone);
                btn.style.backgroundColor = btn.dataset.tone === tone.id ? currentTone.color : 'transparent';
                btn.style.color = btn.dataset.tone === tone.id ? 'white' : CONFIG.colors.text;
            });
        });
        
        segmentedControl.appendChild(segment);
    });
    
    toneButtonsContainer.appendChild(segmentedControl);
    toneMenuContainer.appendChild(toneButtonsContainer);
    rightPanel.appendChild(toneMenuContainer);

    // Prediction Display with Apple-style callout
    const predictionCard = document.createElement('div');
    predictionCard.style.backgroundColor = CONFIG.colors.cardBackground;
    predictionCard.style.borderRadius = CONFIG.cornerRadius.medium;
    predictionCard.style.padding = CONFIG.spacing.medium;
    predictionCard.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
    predictionCard.style.flex = 'none';
    
    const predictionHeader = document.createElement('div');
    predictionHeader.textContent = 'Current Gesture';
    predictionHeader.style.fontWeight = '600';
    predictionHeader.style.fontSize = CONFIG.typography.subhead;
    predictionHeader.style.color = CONFIG.colors.secondaryText;
    predictionHeader.style.marginBottom = CONFIG.spacing.small;
    predictionCard.appendChild(predictionHeader);
    
    const predictionDisplay = document.createElement('div');
    predictionDisplay.id = 'prediction';
    predictionDisplay.style.color = CONFIG.colors.primary;
    predictionDisplay.style.fontSize = CONFIG.typography.headline;
    predictionDisplay.style.fontWeight = '600';
    predictionDisplay.style.textAlign = 'center';
    predictionDisplay.textContent = 'Waiting for gesture...';
    predictionCard.appendChild(predictionDisplay);
    
    rightPanel.appendChild(predictionCard);

    // Time Display with Apple-style caption
    const timeCard = document.createElement('div');
    timeCard.style.backgroundColor = CONFIG.colors.cardBackground;
    timeCard.style.borderRadius = CONFIG.cornerRadius.medium;
    timeCard.style.padding = CONFIG.spacing.medium;
    timeCard.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
    timeCard.style.flex = 'none';
    
    const timeHeader = document.createElement('div');
    timeHeader.textContent = 'Processing Time';
    timeHeader.style.fontWeight = '600';
    timeHeader.style.fontSize = CONFIG.typography.subhead;
    timeHeader.style.color = CONFIG.colors.secondaryText;
    timeHeader.style.marginBottom = CONFIG.spacing.small;
    timeCard.appendChild(timeHeader);
    
    const timeDisplay = document.createElement('div');
    timeDisplay.id = 'timeTaken';
    timeDisplay.style.color = CONFIG.colors.text;
    timeDisplay.style.fontSize = CONFIG.typography.body;
    timeDisplay.style.textAlign = 'center';
    timeDisplay.textContent = '—';
    timeCard.appendChild(timeDisplay);
    
    rightPanel.appendChild(timeCard);

    // Sentence Display with optimized size
    const sentenceCard = document.createElement('div');
    sentenceCard.style.backgroundColor = CONFIG.colors.cardBackground;
    sentenceCard.style.borderRadius = CONFIG.cornerRadius.medium;
    sentenceCard.style.padding = `${CONFIG.spacing.small} ${CONFIG.spacing.medium}`; // Reduced padding
    sentenceCard.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
    sentenceCard.style.maxHeight = '400px'; // Increased to allow expansion
    sentenceCard.style.overflowY = 'auto'; // Add scrolling if needed
    sentenceCard.style.flex = 'none';
    
    const sentenceHeader = document.createElement('div');
    sentenceHeader.style.display = 'flex';
    sentenceHeader.style.justifyContent = 'space-between';
    sentenceHeader.style.alignItems = 'center';
    sentenceHeader.style.cursor = 'pointer';
    sentenceHeader.style.marginBottom = '8px';
    
    const sentenceTitle = document.createElement('span');
    sentenceTitle.textContent = 'Sentence Builder';
    sentenceTitle.style.fontWeight = '600';
    sentenceTitle.style.fontSize = CONFIG.typography.footnote; // Smaller font
    sentenceTitle.style.color = CONFIG.colors.secondaryText;
    
    const sentenceToggleBtn = document.createElement('span');
    sentenceToggleBtn.innerHTML = '▼';
    sentenceToggleBtn.style.fontSize = '12px';
    sentenceToggleBtn.style.color = CONFIG.colors.secondaryText;
    sentenceToggleBtn.style.transition = 'transform 0.3s ease';
    
    sentenceHeader.appendChild(sentenceTitle);
    sentenceHeader.appendChild(sentenceToggleBtn);
    sentenceCard.appendChild(sentenceHeader);
    
    const sentenceCollapseBody = document.createElement('div');
    sentenceCollapseBody.style.transition = 'max-height 0.3s ease-out, opacity 0.2s ease-out';
    sentenceCollapseBody.style.maxHeight = '300px';
    sentenceCollapseBody.style.opacity = '1';
    sentenceCollapseBody.style.overflow = 'hidden';
    
    const currentSentenceContainer = document.createElement('div');
    currentSentenceContainer.style.marginBottom = CONFIG.spacing.small; // Reduced margin
    
    const currentSentenceLabel = document.createElement('div');
    currentSentenceLabel.textContent = 'Current';
    currentSentenceLabel.style.fontWeight = '500';
    currentSentenceLabel.style.fontSize = CONFIG.typography.caption2; // Smaller font
    currentSentenceLabel.style.color = CONFIG.colors.secondaryText;
    currentSentenceLabel.style.marginBottom = '2px'; // Reduced margin
    currentSentenceContainer.appendChild(currentSentenceLabel);
    
    const currentSentenceEl = document.createElement('div');
    currentSentenceEl.id = 'current-sentence';
    currentSentenceEl.style.fontSize = CONFIG.typography.subhead; // Smaller font
    currentSentenceEl.style.color = CONFIG.colors.text;
    currentSentenceEl.style.minHeight = '20px'; // Reduced height
    currentSentenceEl.style.maxHeight = '60px'; // Add max height
    currentSentenceEl.style.overflowY = 'auto'; // Add scrolling if needed
    currentSentenceContainer.appendChild(currentSentenceEl);
    
    sentenceCollapseBody.appendChild(currentSentenceContainer);
    
    // Separator with reduced margin
    const separator = document.createElement('div');
    separator.style.height = '1px';
    separator.style.backgroundColor = CONFIG.colors.separator;
    separator.style.margin = `${CONFIG.spacing.small} 0`;
    sentenceCollapseBody.appendChild(separator);
    
    const historyHeader = document.createElement('div');
    historyHeader.textContent = 'History';
    historyHeader.style.fontWeight = '600';
    historyHeader.style.fontSize = CONFIG.typography.footnote; // Smaller font
    historyHeader.style.color = CONFIG.colors.secondaryText;
    historyHeader.style.marginBottom = '4px'; // Reduced margin
    sentenceCollapseBody.appendChild(historyHeader);
    
    const historyContainer = document.createElement('div');
    historyContainer.id = 'sentence-history';
    historyContainer.style.display = 'flex';
    historyContainer.style.flexDirection = 'column';
    historyContainer.style.gap = CONFIG.spacing.small; // Reduced gap
    historyContainer.style.maxHeight = '180px'; // Add max height
    historyContainer.style.overflowY = 'auto'; // Add scrolling if needed
    sentenceCollapseBody.appendChild(historyContainer);
    
    sentenceCard.appendChild(sentenceCollapseBody);
    
    let isSentenceCollapsed = false;
    sentenceHeader.addEventListener('click', () => {
        isSentenceCollapsed = !isSentenceCollapsed;
        if (isSentenceCollapsed) {
            sentenceCollapseBody.style.maxHeight = '0px';
            sentenceCollapseBody.style.opacity = '0';
            sentenceToggleBtn.style.transform = 'rotate(-90deg)';
        } else {
            sentenceCollapseBody.style.maxHeight = '300px';
            sentenceCollapseBody.style.opacity = '1';
            sentenceToggleBtn.style.transform = 'rotate(0deg)';
        }
    });
    
    rightPanel.appendChild(sentenceCard);
        // Add sensor data visualization
    const sensorViz = createSensorDataVisualization();
    rightPanel.appendChild(sensorViz);

    // Add button event listeners
    connectButton.addEventListener('mouseover', () => {
        connectButton.style.backgroundColor = CONFIG.colors.primaryDark;
    });

    connectButton.addEventListener('mouseout', () => {
        connectButton.style.backgroundColor = CONFIG.colors.primary;
    });


    // Poll connection state to sync UI dynamically
    setInterval(() => {
        const isConnected = (watch.device && watch.device.gatt && watch.device.gatt.connected) || watch.connected || false;
        if (isConnected !== bleState.isConnected) {
            updateBLEStatus(isConnected);
            if (isConnected) {
                disconnectButton.style.display = 'block';
                connectButton.style.display = 'none';
                updateSignalStrength(-50);
            } else {
                disconnectButton.style.display = 'none';
                connectButton.style.display = 'block';
                connectButton.textContent = 'Connect';
                updateSignalStrength(-100);
            }
        }
    }, 500);
}

// Set up Three.js scene
function setupThreeJS() {
    const container = document.getElementById('viewer-container');
    
    appState.scene = new THREE.Scene();
    appState.scene.background = new THREE.Color(CONFIG.colors.cardBackground); // Set background to match card
    appState.camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    appState.camera.position.set(0, 30, 50);
    appState.camera.lookAt(0, 0, 0);

    appState.renderer = new THREE.WebGLRenderer({ antialias: true });
    appState.renderer.setSize(container.clientWidth, container.clientHeight);
    appState.renderer.setClearColor(CONFIG.colors.cardBackground); // Set renderer clear color
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

// Set up event listeners for sensor data
function setupEventListeners() {
    watch.addEventListener('accelerationchanged', (e) => {
        appState.sensorData.acceleration = [e.detail.x, e.detail.y, e.detail.z];
        updateBLEPacketValues();
        updateSignalStrength(-50 + Math.random() * 20 - 10);
    });
    watch.addEventListener('angularvelocitychanged', (e) => {
        appState.sensorData.angularVelocity = [e.detail.x, e.detail.y, e.detail.z];
        updateBLEPacketValues();
    });
    watch.addEventListener('gravityvectorchanged', (e) => {
        appState.sensorData.gravity = [e.detail.x, e.detail.y, e.detail.z];
        updateBLEPacketValues();
    });
    watch.addEventListener('orientationchanged', (e) => {
        appState.sensorData.orientation = [e.detail.x, e.detail.y, e.detail.z, e.detail.w];
        updateBLEPacketValues();
    });
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

// Start collecting sensor data
function startDataCollection() {
    setInterval(() => {
        if (!appState.isCollectingData || !isSensorDataValid()) return;
        
        // Animate data packet with enhanced visualization
        const dataFlowContainer = document.getElementById('data-flow-container');
        if (dataFlowContainer) {
            animateDataPacket(dataFlowContainer);
            
            // Animate device icons
            const watchIcon = dataFlowContainer.querySelector('div:nth-child(2) > div:nth-child(1) > div:nth-child(1)');
            const frontendIcon = dataFlowContainer.querySelector('div:nth-child(2) > div:nth-child(3) > div:nth-child(1)');
            
            watchIcon.style.transform = 'scale(1.1)';
            frontendIcon.style.transform = 'scale(1.1)';
            
            setTimeout(() => {
                watchIcon.style.transform = 'scale(1)';
                frontendIcon.style.transform = 'scale(1)';
            }, 200);
        }
        
        if (appState.sensorDataBuffer.length === 0) {
            appState.startTime = Date.now();
        }
        
        // Store all sensor data including orientation (for visualization)
        appState.sensorDataBuffer.push([
            ...appState.sensorData.acceleration,
            ...appState.sensorData.gravity,
            ...appState.sensorData.angularVelocity,
            ...appState.sensorData.orientation.slice(0, 3)
        ]);

        if (appState.sensorDataBuffer.length >= CONFIG.sequenceLength) {
            processDataBuffer();
        }
    }, 20);
}

// Process collected sensor data (excluding orientation)
function processDataBuffer() {
    appState.isCollectingData = false;
    const timeTaken = (Date.now() - appState.startTime) / 1000;
    document.getElementById('timeTaken').textContent = `${timeTaken.toFixed(2)}s`;
    
    // Only send acceleration, gravity, and angular velocity (9 values per frame)
    const dataToSend = appState.sensorDataBuffer.slice(0, CONFIG.sequenceLength).map(frame => {
        return [
            frame[0], frame[1], frame[2],  // acceleration x,y,z
            frame[3], frame[4], frame[5],  // gravity x,y,z
            frame[6], frame[7], frame[8]   // angular velocity x,y,z
        ];
    });
    
    sendDataToFlask(dataToSend.flat());
    appState.sensorDataBuffer = [];
    setTimeout(() => { appState.isCollectingData = true; }, 1000);
}

// Send data to Flask backend for prediction
async function sendDataToFlask(dataToSend) {
    try {
        const response = await fetch(`${CONFIG.apiEndpoint}/predict`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sensor_data: dataToSend })
        });

        const data = await response.json();
        if (data.prediction) {
            handlePrediction(data.prediction);
        }
    } catch (error) {
        console.error('Prediction error:', error);
        document.getElementById('prediction').textContent = 'Error getting prediction';
    }
}

// Handle prediction results
function handlePrediction(prediction) {
    clearTimeout(appState.inactivityTimer);
    document.getElementById('prediction').textContent = prediction;

    if (prediction === "No gesture") {
        appState.inactivityTimer = setTimeout(finalizeSentence, CONFIG.inactivityTimeout);
    } else {
        appState.currentSentence.push(prediction);
        updateSentenceDisplay();
        speak(prediction);
    }
}

// Update the sentence display
function updateSentenceDisplay() {
    const currentSentenceEl = document.getElementById('current-sentence');
    
    // Clear previous content
    currentSentenceEl.innerHTML = '';
    
    // Add the current sentence
    const sentenceText = document.createElement('div');
    sentenceText.className = 'sentence-text';
    sentenceText.textContent = appState.currentSentence.join(' ');
    currentSentenceEl.appendChild(sentenceText);
}

// ElevenLabs text-to-speech function
async function speak(text) {
    if (!text.trim() || appState.isSpeaking) return;
    appState.isSpeaking = true;
    
    try {
        const response = await fetch(`${CONFIG.elevenLabs.apiEndpoint}/${CONFIG.elevenLabs.voiceId}`, {
            method: 'POST',
            headers: {
                'xi-api-key': CONFIG.elevenLabs.apiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: text,
                model_id: CONFIG.elevenLabs.modelId,
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.75,
                    ...(appState.selectedTone === 'professional' && { stability: 0.7, similarity_boost: 0.8 }),
                    ...(appState.selectedTone === 'persuasive' && { stability: 0.6, similarity_boost: 0.85 }),
                    ...(appState.selectedTone === 'casual' && { stability: 0.4, similarity_boost: 0.7 })
                }
            })
        });

        if (!response.ok) {
            throw new Error(`ElevenLabs API error: ${response.status}`);
        }

        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        
        audio.addEventListener('ended', () => {
            appState.isSpeaking = false;
        });
        
        audio.addEventListener('error', () => {
            appState.isSpeaking = false;
            fallbackSpeak(text);
        });
        
        audio.play();
    } catch (error) {
        console.error('Error with ElevenLabs TTS:', error);
        appState.isSpeaking = false;
        fallbackSpeak(text);
    }
}

// Fallback to browser speech synthesis
function fallbackSpeak(text) {
    if (!window.speechSynthesis) return;
    
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Adjust speech parameters based on selected tone
    switch(appState.selectedTone) {
        case 'professional':
            utterance.rate = 0.9;
            utterance.pitch = 0.9;
            break;
        case 'persuasive':
            utterance.rate = 1.1;
            utterance.pitch = 1.1;
            break;
        case 'casual':
            utterance.rate = 1.0;
            utterance.pitch = 1.0;
            break;
        default: // friendly
            utterance.rate = 1.0;
            utterance.pitch = 1.0;
    }
    
    utterance.addEventListener('end', () => {
        appState.isSpeaking = false;
    });
    
    speechSynthesis.speak(utterance);
}

// Finalize the current sentence and send for grammar correction
async function finalizeSentence() {
    if (appState.currentSentence.length === 0 || appState.isSpeaking) return;
    
    const originalSentence = appState.currentSentence.join(' ');
    const currentSentenceEl = document.getElementById('current-sentence');
    
    // Show loading animation
    currentSentenceEl.innerHTML = `
        <div class="sentence-loading">
            <div class="loading-dots">
                <span></span>
                <span></span>
                <span></span>
            </div>
            <div class="loading-text">Processing sentence...</div>
        </div>
    `;
    
    try {
        const response = await fetch(`${CONFIG.apiEndpoint}/enhance-text`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                text: originalSentence,
                tone: appState.selectedTone
            })
        });
        
        const result = await response.json();
        
        if (result.error) {
            throw new Error(result.error);
        }
        
        // Only show the final, tone-adjusted sentence
        currentSentenceEl.innerHTML = `
            <div class="sentence-text" style="color: ${CONFIG.tones.find(t => t.id === appState.selectedTone).color}">
                ${result.tone_adjusted}
            </div>
        `;
        
        // Add only the final result to history
        addToHistory(originalSentence, result.grammar_corrected, result.tone_adjusted);
        
        // Speak the enhanced text from Gemini
        await speak(result.tone_adjusted);
        
    } catch (error) {
        console.error('Text enhancement failed:', error);
        currentSentenceEl.innerHTML = `
            <div class="sentence-text error">
                Error processing sentence. Please try again.
            </div>
        `;
        addToHistory(originalSentence, originalSentence, originalSentence);
        await speak(originalSentence);
    }
    
    appState.currentSentence = [];
}

// Add sentence to history display with Apple-style design
function addToHistory(original, corrected, enhanced) {
    const historyContainer = document.getElementById('sentence-history');
    
    // Check if this original sentence already exists in history
    const existingIndex = appState.sentenceHistory.findIndex(
        item => item.original === original
    );
    
    if (existingIndex >= 0) {
        // Update existing entry
        const existingItem = appState.sentenceHistory[existingIndex];
        existingItem.corrected = corrected;
        existingItem.enhanced = enhanced;
        
        // Update the DOM element
        const historyElements = historyContainer.children;
        if (historyElements.length > existingIndex) {
            historyElements[existingIndex].innerHTML = `
                <div class="history-item-content" style="font-size: ${CONFIG.typography.caption2}; padding: 4px 0;">
                    <div class="history-original" style="margin-bottom: 2px;">
                        Original: <span class="strikethrough" style="color: ${CONFIG.colors.tertiaryText};">${original}</span>
                    </div>
                    <div class="history-corrected" style="margin-bottom: 2px;">
                        Corrected: <span style="color: ${CONFIG.colors.secondaryText};">${corrected}</span>
                    </div>
                    <div class="history-enhanced">
                        <span style="color: ${CONFIG.tones.find(t => t.id === appState.selectedTone).color};">${enhanced}</span>
                    </div>
                </div>
            `;
        }
        
        // Move to top if modified
        if (existingIndex > 0) {
            const itemToMove = appState.sentenceHistory.splice(existingIndex, 1)[0];
            appState.sentenceHistory.unshift(itemToMove);
            
            const domItem = historyContainer.children[existingIndex];
            historyContainer.insertBefore(domItem, historyContainer.firstChild);
        }
        
        return;
    }

    // Create new history item with Apple-style design
    const historyItem = document.createElement('div');
    historyItem.className = 'history-item';
    
    historyItem.innerHTML = `
        <div class="history-item-content" style="font-size: ${CONFIG.typography.caption2}; padding: 4px 0;">
            <div class="history-original" style="margin-bottom: 2px;">
                Original: <span class="strikethrough" style="color: ${CONFIG.colors.tertiaryText};">${original}</span>
            </div>
            <div class="history-corrected" style="margin-bottom: 2px;">
                Corrected: <span style="color: ${CONFIG.colors.secondaryText};">${corrected}</span>
            </div>
            <div class="history-enhanced">
                <span style="color: ${CONFIG.tones.find(t => t.id === appState.selectedTone).color};">${enhanced}</span>
            </div>
        </div>
    `;
    
    // Add to beginning of history
    historyContainer.insertBefore(historyItem, historyContainer.firstChild);
    appState.sentenceHistory.unshift({ original, corrected, enhanced });
    
    // Limit history to last 5 items
    if (appState.sentenceHistory.length > 5) {
        appState.sentenceHistory = appState.sentenceHistory.slice(0, 5);
        if (historyContainer.children.length > 5) {
            historyContainer.removeChild(historyContainer.lastChild);
        }
    }
}

// --- BLE Visualization Animation Helpers ---
function animateStatusBadge(state) {
    const statusIndicator = document.getElementById('ble-status');
    if (!statusIndicator) return;
    statusIndicator.classList.remove('ble-connected', 'ble-disconnected', 'ble-scanning');
    statusIndicator.classList.add(`ble-${state}`);
    statusIndicator.querySelector('.status-dot').classList.remove('pulse');
    if (state === 'connected') {
        statusIndicator.querySelector('.status-dot').classList.add('pulse');
    }
}

function animatePacket(container) {
    // Remove any existing packet
    const oldPacket = container.querySelector('.ble-packet');
    if (oldPacket) oldPacket.remove();
    // Create a new packet
    const packet = document.createElement('div');
    packet.className = 'ble-packet';
    container.appendChild(packet);
    // Animate packet from left to right
    setTimeout(() => {
        packet.style.left = 'calc(100% - 80px)';
        packet.style.opacity = '0.7';
        packet.style.boxShadow = '0 0 24px 8px #007AFF44';
    }, 10);
    setTimeout(() => {
        packet.remove();
    }, 1200);
}

function animateSignalBars(strength) {
    const bars = document.querySelectorAll('.ble-signal-bar');
    bars.forEach((bar, i) => {
        if (strength > (i * 25)) {
            bar.classList.add('active');
        } else {
            bar.classList.remove('active');
        }
    });
}

function animateMetric(id, value, unit = '') {
    const el = document.getElementById(id);
    if (!el) return;
    const oldValue = parseFloat(el.dataset.value || '0');
    const newValue = parseFloat(value);
    if (isNaN(newValue)) {
        el.textContent = value + (unit ? ` ${unit}` : '');
        return;
    }
    let frame = 0;
    const frames = 20;
    function animate() {
        frame++;
        const v = oldValue + (newValue - oldValue) * (frame / frames);
        el.textContent = unit ? `${v.toFixed(0)} ${unit}` : v.toFixed(0);
        el.dataset.value = v;
        if (frame < frames) requestAnimationFrame(animate);
        else el.textContent = unit ? `${newValue} ${unit}` : newValue;
    }
    animate();
}

// --- Update BLEStatus to use new badge logic ---
function updateBLEStatus(isConnected, isScanning = false) {
    bleState.isConnected = isConnected;
    bleState.isScanning = isScanning;
    const statusIndicator = document.getElementById('ble-status');
    const statusDot = statusIndicator.querySelector('.status-dot');
    const statusText = statusIndicator.querySelector('.status-text');
    let statusColor, statusLabel, state;
    if (isConnected) {
        statusColor = CONFIG.colors.bleConnected;
        statusLabel = 'Connected';
        state = 'connected';
        bleState.connectionQuality = 'connected';
    } else if (isScanning) {
        statusColor = CONFIG.colors.bleScanning;
        statusLabel = 'Scanning...';
        state = 'scanning';
        bleState.connectionQuality = 'scanning';
    } else {
        statusColor = CONFIG.colors.bleDisconnected;
        statusLabel = 'Disconnected';
        state = 'disconnected';
        bleState.connectionQuality = 'disconnected';
        
        // Reset BLE State metrics
        bleState.packetCount = 0;
        bleState.dataRate = 0;
        bleState.latency = 0;
        bleState.packetLoss = 0;
        bleState.uptime = 0;
        bleState.lastPacketTime = 0;
        
        animateMetric('packet-count', 0, 'pkts');
        animateMetric('data-rate', 0, 'B/s');
        animateMetric('latency', 0, 'ms');
        animateMetric('packet-loss', 0, '%');
        
        const uptimeEl = document.getElementById('uptime');
        if (uptimeEl) uptimeEl.textContent = '00:00:00';
        
        // Reset sensor data to stop processing
        appState.sensorData.acceleration = [0, 0, 0];
        appState.sensorData.gravity = [0, 0, 0];
        appState.sensorData.angularVelocity = [0, 0, 0];
        appState.sensorData.orientation = [0, 0, 0, 0];
        appState.sensorDataBuffer = [];
    }
    statusDot.style.backgroundColor = statusColor;
    statusText.textContent = statusLabel;
    animateStatusBadge(state);
}

// --- Update signal strength visualization ---
function updateSignalStrength(rssi) {
    bleState.rssi = rssi;
    const rssiElement = document.getElementById('rssi');
    // Convert RSSI to percentage (RSSI typically ranges from -100 to -40)
    const strength = Math.min(100, Math.max(0, ((rssi + 100) / 60) * 100));
    animateSignalBars(strength);
    // Update RSSI display
    if (rssiElement) rssiElement.textContent = `${rssi} dBm`;
}

// --- Enhanced data packet animation ---
function animateDataPacket(container) {
    animatePacket(container.querySelector('.ble-connection-line'));
    // Update metrics with enhanced calculations
    bleState.packetCount++;
    const now = Date.now();
    if (bleState.lastPacketTime) {
        const timeDiff = now - bleState.lastPacketTime;
        bleState.dataRate = Math.round((1000 / timeDiff) * 12);
        bleState.latency = Math.round(timeDiff);
        bleState.packetLoss = Math.round(Math.random() * 2); // Simulated packet loss
    }
    bleState.lastPacketTime = now;
    animateMetric('packet-count', bleState.packetCount, 'pkts');
    animateMetric('data-rate', bleState.dataRate, 'B/s');
    animateMetric('latency', bleState.latency, 'ms');
    animateMetric('packet-loss', bleState.packetLoss, '%');
}

// --- Update createDataFlowVisualization for new visuals ---
function createDataFlowVisualization() {
    const container = document.createElement('div');
    container.id = 'data-flow-container';
    container.style.width = '100%';
    container.style.backgroundColor = CONFIG.colors.cardBackground;
    container.style.borderRadius = CONFIG.cornerRadius.large;
    container.style.padding = '10px 10px 16px 10px'; // Reduced top/bottom padding
    container.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
    container.style.position = 'relative';
    container.style.overflow = 'hidden';
    container.style.marginBottom = CONFIG.spacing.medium;
    container.style.transition = `all ${CONFIG.animations.duration.medium} ${CONFIG.animations.timing.ease}`;
    container.style.border = '1px solid rgba(0,0,0,0.1)';

    // Header
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.marginBottom = '8px'; // Smaller gap
    const title = document.createElement('h3');
    title.textContent = 'BLE Connection';
    title.style.margin = '0';
    title.style.fontSize = '16px'; // Smaller font
    title.style.fontWeight = '600';
    title.style.color = CONFIG.colors.text;
    const statusIndicator = document.createElement('div');
    statusIndicator.id = 'ble-status';
    statusIndicator.className = 'ble-disconnected';
    statusIndicator.style.display = 'flex';
    statusIndicator.style.alignItems = 'center';
    statusIndicator.style.gap = '6px'; // Smaller gap
    statusIndicator.style.padding = '2px 8px'; // Smaller padding
    statusIndicator.style.borderRadius = '10px';
    statusIndicator.style.backgroundColor = CONFIG.colors.systemFill;
    statusIndicator.style.fontSize = '12px'; // Smaller font
    statusIndicator.style.fontWeight = '500';
    statusIndicator.innerHTML = `
        <span class="status-dot"></span>
        <span class="status-text">Disconnected</span>
    `;
    header.appendChild(title);
    header.appendChild(statusIndicator);
    container.appendChild(header);

    // Visualization area
    const visualizationArea = document.createElement('div');
    visualizationArea.style.position = 'relative';
    visualizationArea.style.height = '70px'; // Reduced height
    visualizationArea.style.display = 'flex';
    visualizationArea.style.alignItems = 'center';
    visualizationArea.style.justifyContent = 'space-between';
    visualizationArea.style.padding = '0 10px'; // Smaller padding
    visualizationArea.style.marginBottom = '8px'; // Smaller gap

    // Watch device
    const watchDevice = document.createElement('div');
    watchDevice.style.position = 'relative';
    watchDevice.style.width = '48px'; // Smaller
    watchDevice.style.height = '48px';
    watchDevice.style.display = 'flex';
    watchDevice.style.flexDirection = 'column';
    watchDevice.style.alignItems = 'center';
    watchDevice.style.gap = '2px';
    const watchIcon = document.createElement('div');
    watchIcon.style.fontSize = '20px'; // Smaller
    watchIcon.textContent = '⌚';
    watchIcon.style.transition = `transform ${CONFIG.animations.duration.medium} ${CONFIG.animations.timing.spring}`;
    const watchLabel = document.createElement('div');
    watchLabel.textContent = 'Watch';
    watchLabel.style.fontSize = '10px';
    watchLabel.style.color = CONFIG.colors.secondaryText;
    const watchDetails = document.createElement('div');
    watchDetails.style.fontSize = '9px';
    watchDetails.style.color = CONFIG.colors.tertiaryText;
    watchDetails.textContent = 'BLE Device';
    watchDevice.appendChild(watchIcon);
    watchDevice.appendChild(watchLabel);
    watchDevice.appendChild(watchDetails);
    visualizationArea.appendChild(watchDevice);

    // Connection line
    const connectionLine = document.createElement('div');
    connectionLine.className = 'ble-connection-line';
    connectionLine.style.flex = '1';
    connectionLine.style.height = '4px'; // Smaller
    connectionLine.style.background = 'linear-gradient(90deg, #007AFF 0%, #34C759 100%)';
    connectionLine.style.position = 'relative';
    connectionLine.style.margin = '0 10px'; // Smaller
    connectionLine.style.borderRadius = '2px';
    connectionLine.style.overflow = 'visible';
    visualizationArea.appendChild(connectionLine);

    // Signal bars
    const signalBars = document.createElement('div');
    signalBars.className = 'ble-signal-bars';
    signalBars.style.display = 'flex';
    signalBars.style.flexDirection = 'column';
    signalBars.style.justifyContent = 'center';
    signalBars.style.alignItems = 'center';
    signalBars.style.height = '48px'; // Smaller
    signalBars.style.gap = '1px';
    for (let i = 0; i < 4; i++) {
        const bar = document.createElement('div');
        bar.className = 'ble-signal-bar';
        bar.style.width = `${6 + i * 4}px`;
        bar.style.height = `${8 + i * 5}px`;
        bar.style.background = '#E5E5EA';
        bar.style.borderRadius = '2px';
        bar.style.transition = 'background 0.3s, box-shadow 0.3s';
        signalBars.appendChild(bar);
    }
    visualizationArea.appendChild(signalBars);

    // Frontend device
    const frontendDevice = document.createElement('div');
    frontendDevice.style.position = 'relative';
    frontendDevice.style.width = '48px';
    frontendDevice.style.height = '48px';
    frontendDevice.style.display = 'flex';
    frontendDevice.style.flexDirection = 'column';
    frontendDevice.style.alignItems = 'center';
    frontendDevice.style.gap = '2px';
    const frontendIcon = document.createElement('div');
    frontendIcon.style.fontSize = '20px';
    frontendIcon.textContent = '💻';
    frontendIcon.style.transition = `transform ${CONFIG.animations.duration.medium} ${CONFIG.animations.timing.spring}`;
    const frontendLabel = document.createElement('div');
    frontendLabel.textContent = 'Frontend';
    frontendLabel.style.fontSize = '10px';
    frontendLabel.style.color = CONFIG.colors.secondaryText;
    const frontendDetails = document.createElement('div');
    frontendDetails.style.fontSize = '9px';
    frontendDetails.style.color = CONFIG.colors.tertiaryText;
    frontendDetails.textContent = 'Web App';
    frontendDevice.appendChild(frontendIcon);
    frontendDevice.appendChild(frontendLabel);
    frontendDevice.appendChild(frontendDetails);
    visualizationArea.appendChild(frontendDevice);

    container.appendChild(visualizationArea);

    // Metrics
    const metricsContainer = document.createElement('div');
    metricsContainer.style.display = 'grid';
    metricsContainer.style.gridTemplateColumns = 'repeat(3, 1fr)';
    metricsContainer.style.gap = CONFIG.spacing.medium;
    metricsContainer.style.padding = '0 20px';
    const metrics = [
        { id: 'packet-count', label: 'Packets', value: '0', unit: 'pkts' },
        { id: 'data-rate', label: 'Data Rate', value: '0', unit: 'B/s' },
        { id: 'rssi', label: 'Signal', value: 'N/A', unit: 'dBm' },
        { id: 'latency', label: 'Latency', value: '0', unit: 'ms' },
        { id: 'packet-loss', label: 'Packet Loss', value: '0', unit: '%' },
        { id: 'connection-time', label: 'Uptime', value: '00:00:00', unit: '' }
    ];
    metrics.forEach(metric => {
        const metricElement = document.createElement('div');
        metricElement.style.display = 'flex';
        metricElement.style.flexDirection = 'column';
        metricElement.style.alignItems = 'center';
        metricElement.style.gap = '2px';
        metricElement.style.padding = CONFIG.spacing.small;
        metricElement.style.backgroundColor = CONFIG.colors.systemFill;
        metricElement.style.borderRadius = CONFIG.cornerRadius.medium;
        const value = document.createElement('div');
        value.id = metric.id;
        value.textContent = `${metric.value}${metric.unit ? ` ${metric.unit}` : ''}`;
        value.style.fontSize = CONFIG.typography.subhead;
        value.style.fontWeight = '600';
        value.style.color = CONFIG.colors.text;
        value.dataset.value = metric.value;
        const label = document.createElement('div');
        label.textContent = metric.label;
        label.style.fontSize = CONFIG.typography.caption2;
        label.style.color = CONFIG.colors.secondaryText;
        metricElement.appendChild(value);
        metricElement.appendChild(label);
        metricsContainer.appendChild(metricElement);
    });
    container.appendChild(metricsContainer);

    // --- New: Real-time packet values row ---
    const packetValuesRow = document.createElement('div');
    packetValuesRow.id = 'ble-packet-values-row';
    packetValuesRow.style.display = 'grid';
    packetValuesRow.style.gridTemplateColumns = 'repeat(4, 1fr)';
    packetValuesRow.style.gap = '12px';
    packetValuesRow.style.margin = '16px 0 0 0';
    packetValuesRow.style.padding = '8px 0';
    packetValuesRow.style.background = 'rgba(120,120,128,0.06)';
    packetValuesRow.style.borderRadius = '10px';
    packetValuesRow.style.boxShadow = '0 1px 4px 0 rgba(0,0,0,0.04)';
    packetValuesRow.innerHTML = `
      <div class="packet-value-col">
        <div class="packet-label">Acceleration</div>
        <div class="packet-value" id="ble-acceleration">—</div>
      </div>
      <div class="packet-value-col">
        <div class="packet-label">Gravity</div>
        <div class="packet-value" id="ble-gravity">—</div>
      </div>
      <div class="packet-value-col">
        <div class="packet-label">Angular Velocity</div>
        <div class="packet-value" id="ble-angular">—</div>
      </div>
      <div class="packet-value-col">
        <div class="packet-label">Orientation</div>
        <div class="packet-value" id="ble-orientation">—</div>
      </div>
    `;
    container.appendChild(packetValuesRow);
    return container;
}

// --- Update real-time values in BLE visualization ---
function updateBLEPacketValues() {
    document.getElementById('ble-acceleration').textContent = appState.sensorData.acceleration.map(x => x.toFixed(2)).join(', ');
    document.getElementById('ble-gravity').textContent = appState.sensorData.gravity.map(x => x.toFixed(2)).join(', ');
    document.getElementById('ble-angular').textContent = appState.sensorData.angularVelocity.map(x => x.toFixed(2)).join(', ');
    document.getElementById('ble-orientation').textContent = appState.sensorData.orientation.map(x => x.toFixed(2)).join(', ');
}

// Create real-time sensor data visualization
function createSensorDataVisualization() {
    const container = document.createElement('div');
    container.id = 'sensor-data-visualization';
    container.style.width = '100%';
    container.style.backgroundColor = CONFIG.colors.cardBackground;
    container.style.borderRadius = CONFIG.cornerRadius.large;
    container.style.padding = CONFIG.spacing.medium;
    container.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
    container.style.marginTop = CONFIG.spacing.medium;
    container.style.border = '1px solid rgba(0,0,0,0.1)';
    container.style.overflow = 'hidden';
    container.style.flex = 'none';

    // Header
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.marginBottom = CONFIG.spacing.medium;
    header.style.cursor = 'pointer';
    
    const titleWrapper = document.createElement('div');
    titleWrapper.style.display = 'flex';
    titleWrapper.style.alignItems = 'center';
    
    const title = document.createElement('h3');
    title.textContent = 'Real-time Sensor Data';
    title.style.margin = '0';
    title.style.fontSize = CONFIG.typography.title3;
    title.style.fontWeight = '600';
    title.style.color = CONFIG.colors.text;
    
    const toggleBtn = document.createElement('span');
    toggleBtn.innerHTML = '▼';
    toggleBtn.style.fontSize = '12px';
    toggleBtn.style.color = CONFIG.colors.secondaryText;
    toggleBtn.style.transition = 'transform 0.3s ease';
    toggleBtn.style.marginLeft = '8px';
    
    titleWrapper.appendChild(title);
    titleWrapper.appendChild(toggleBtn);
    
    const bufferInfo = document.createElement('div');
    bufferInfo.id = 'buffer-info';
    bufferInfo.style.fontSize = CONFIG.typography.footnote;
    bufferInfo.style.color = CONFIG.colors.secondaryText;
    bufferInfo.textContent = `Buffer: 0/100`;
    
    header.appendChild(titleWrapper);
    header.appendChild(bufferInfo);
    container.appendChild(header);

    // Collapsible content wrapper
    const collapseBody = document.createElement('div');
    collapseBody.style.transition = 'max-height 0.3s ease-out, opacity 0.2s ease-out';
    collapseBody.style.maxHeight = '300px';
    collapseBody.style.opacity = '1';
    collapseBody.style.overflow = 'hidden';

    // Create visualization canvas
    const canvasContainer = document.createElement('div');
    canvasContainer.style.position = 'relative';
    canvasContainer.style.height = '200px';
    canvasContainer.style.marginBottom = CONFIG.spacing.medium;
    
    const canvas = document.createElement('canvas');
    canvas.id = 'sensor-data-canvas';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.borderRadius = CONFIG.cornerRadius.medium;
    canvas.style.backgroundColor = CONFIG.colors.systemFill;
    
    canvasContainer.appendChild(canvas);
    collapseBody.appendChild(canvasContainer);

    // Create legend
    const legend = document.createElement('div');
    legend.style.display = 'flex';
    legend.style.justifyContent = 'center';
    legend.style.gap = CONFIG.spacing.medium;
    legend.style.marginTop = CONFIG.spacing.small;
    
    const sensorTypes = [
        { label: 'Acceleration', color: '#FF3B30' },
        { label: 'Gravity', color: '#34C759' },
        { label: 'Angular Velocity', color: '#5856D6' }
    ];
    
    sensorTypes.forEach(type => {
        const legendItem = document.createElement('div');
        legendItem.style.display = 'flex';
        legendItem.style.alignItems = 'center';
        legendItem.style.gap = '6px';
        
        const colorDot = document.createElement('div');
        colorDot.style.width = '8px';
        colorDot.style.height = '8px';
        colorDot.style.borderRadius = '50%';
        colorDot.style.backgroundColor = type.color;
        
        const label = document.createElement('span');
        label.textContent = type.label;
        label.style.fontSize = CONFIG.typography.caption2;
        label.style.color = CONFIG.colors.secondaryText;
        
        legendItem.appendChild(colorDot);
        legendItem.appendChild(label);
        legend.appendChild(legendItem);
    });
    
    collapseBody.appendChild(legend);
    container.appendChild(collapseBody);

    let isCollapsed = false;
    header.addEventListener('click', () => {
        isCollapsed = !isCollapsed;
        if (isCollapsed) {
            collapseBody.style.maxHeight = '0px';
            collapseBody.style.opacity = '0';
            toggleBtn.style.transform = 'rotate(-90deg)';
        } else {
            collapseBody.style.maxHeight = '300px';
            collapseBody.style.opacity = '1';
            toggleBtn.style.transform = 'rotate(0deg)';
        }
    });

    // Initialize canvas context and animation
    const ctx = canvas.getContext('2d');
    let animationFrame;
    let lastTimestamp = 0;
    
    function resizeCanvas() {
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * window.devicePixelRatio;
        canvas.height = rect.height * window.devicePixelRatio;
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }
    
    function drawSensorData(timestamp) {
        if (canvas.width === 0 || canvas.height === 0) {
            resizeCanvas();
        }
        if (!lastTimestamp) lastTimestamp = timestamp;
        const deltaTime = timestamp - lastTimestamp;
        lastTimestamp = timestamp;
        
        const width = canvas.width / window.devicePixelRatio;
        const height = canvas.height / window.devicePixelRatio;
        
        // Clear canvas with fade effect
        ctx.fillStyle = CONFIG.colors.systemFill;
        ctx.globalAlpha = 0.1;
        ctx.fillRect(0, 0, width, height);
        ctx.globalAlpha = 1;
        
        // Update buffer info
        const bufferInfo = document.getElementById('buffer-info');
        bufferInfo.textContent = `Buffer: ${appState.sensorDataBuffer.length}/${CONFIG.sequenceLength}`;
        
        // Draw sensor data
        if (appState.sensorDataBuffer.length > 0) {
            const dataPoints = appState.sensorDataBuffer;
            const pointWidth = width / (CONFIG.sequenceLength - 1);
            
            // Draw acceleration (red)
            drawDataLine(ctx, dataPoints, 0, 2, '#FF3B30', width, height, pointWidth);
            
            // Draw gravity (green)
            drawDataLine(ctx, dataPoints, 3, 5, '#34C759', width, height, pointWidth);
            
            // Draw angular velocity (purple)
            drawDataLine(ctx, dataPoints, 6, 8, '#5856D6', width, height, pointWidth);
            
            // Add glow effect
            addGlowEffect(ctx, width, height);
        }
        
        animationFrame = requestAnimationFrame(drawSensorData);
    }
    
    function drawDataLine(ctx, dataPoints, startIdx, endIdx, color, width, height, pointWidth) {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        
        dataPoints.forEach((point, index) => {
            const x = index * pointWidth;
            // Calculate average of the three values for this sensor type
            const avg = (point[startIdx] + point[startIdx + 1] + point[endIdx]) / 3;
            // Normalize and scale to canvas height
            const y = height - ((avg + 1) * height / 2);
            
            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        
        ctx.stroke();
        
        // Add gradient fill
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, `${color}33`);
        gradient.addColorStop(1, `${color}00`);
        
        ctx.fillStyle = gradient;
        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
        ctx.closePath();
        ctx.fill();
    }
    
    function addGlowEffect(ctx, width, height) {
        ctx.shadowColor = '#007AFF';
        ctx.shadowBlur = 20;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        
        // Draw a subtle grid
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 0.5;
        
        // Vertical lines
        for (let x = 0; x < width; x += width / 10) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        
        // Horizontal lines
        for (let y = 0; y < height; y += height / 5) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        
        ctx.shadowBlur = 0;
    }
    
    // Initialize canvas and start animation
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    animationFrame = requestAnimationFrame(drawSensorData);
    
    // Cleanup function
    container.cleanup = () => {
        window.removeEventListener('resize', resizeCanvas);
        cancelAnimationFrame(animationFrame);
    };
    
    return container;
}

// Start the application
initializeApp();