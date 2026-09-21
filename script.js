// ============================================
// DocScan Pro - Main Application Script
// ============================================

// App State
const state = {
    currentFolder: 'root',
    documents: [],
    folders: [],
    selectedItems: [],
    selectMode: false,
    pendingUploads: [],
    driveConnected: false,
    driveToken: null,
    currentImage: null,
    originalImage: null,
    cropPoints: { tl: { x: 0, y: 0 }, tr: { x: 100, y: 0 }, bl: { x: 0, y: 100 }, br: { x: 100, y: 100 } },
    currentFilter: 'magic',
    currentRatio: 'free',
    multiPageImages: [],
    contextTarget: null,
    editingDocId: null,
    searchQuery: '',
    sortBy: 'date-desc',
    viewMode: 'grid',
    theme: 'dark',
    settings: {
        quality: 90,
        watermark: false,
        watermarkText: 'DocScan Pro',
        autoSave: true
    },
    tutorialShown: false,
    viewerZoom: 1,
    viewerPan: { x: 0, y: 0 },
    deferredPrompt: null,
    credits: 0,
    paymentPolling: null,
    currentPin: '', // For PIN entry
    tempPin: ''      // For setting/validating PIN
};

// Google Drive Config (OAuth 2.0 / Google Identity Services)
const GOOGLE_CLIENT_ID = '569266864432-pd09jbb5no9ekdhdr018fj643nopp817.apps.googleusercontent.com';
const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email openid';

// DOM Elements
const $ = (id) => document.getElementById(id);
const $$ = (selector) => document.querySelectorAll(selector);

function loadImage(src) {
    return new Promise((resolve, reject) => {
        if (!src) return reject(new Error('Fonte de imagem vazia'));
        const img = new Image();
        if (!src.startsWith('data:') && !src.startsWith('blob:')) {
            img.crossOrigin = 'anonymous';
        }
        img.onload = () => resolve(img);
        img.onerror = (err) => reject(new Error('Falha ao carregar imagem'));
        img.src = src;
    });
}
window.loadImage = loadImage;

// ============================================
// Initialize App & Instant Splash Screen Handler
// ============================================
function hideSplashScreen() {
    const splash = $('splashScreen');
    const app = $('app');
    if (splash) {
        splash.classList.add('fade-out');
        setTimeout(() => {
            if (splash.parentNode) splash.remove();
        }, 400);
    }
    if (app) {
        app.classList.remove('hidden');
    }
}

async function initApp() {
    try {
        await initDB().catch(e => console.warn('IndexedDB warning:', e));
        await loadData().catch(e => console.warn('LoadData warning:', e));
        setupEventListeners();
        setupViewerZoomPan();
        setupRedactListeners();
        setLanguage(currentLang);
        setupServiceWorker();
        syncCredits().catch(e => console.warn('SyncCredits warning:', e));
        initGoogleDriveClient();
        const savedProfile = localStorage.getItem('googleUserProfile');
        if (savedProfile) {
            try {
                state.googleProfile = JSON.parse(savedProfile);
                updateUserProfileUI(state.googleProfile);
                autoLoginWithGoogleProfile(state.googleProfile);
                if (state.driveToken) {
                    setTimeout(() => syncGoogleDriveTwoWay(true), 1200);
                }
            } catch (e) {}
        }
        setupDevMode();
        updateUI();
    } catch (err) {
        console.error('DocScan Pro initialization error:', err);
    } finally {
        // Fast splash fade-out (300ms)
        setTimeout(hideSplashScreen, 300);
    }

    // Check online status
    try {
        updateOnlineStatus();
        window.addEventListener('online', () => {
            updateOnlineStatus();
            syncPendingUploads();
        });
        window.addEventListener('offline', updateOnlineStatus);
    } catch (e) {}
}

// Immediate execution if DOM is already ready, otherwise on DOMContentLoaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

// Global safety timeout to ensure splash screen NEVER gets stuck
setTimeout(hideSplashScreen, 800);

// ============================================
// IndexedDB Setup
// ============================================
let db;

function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('DocScanPro', 2);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve();
        };

        request.onupgradeneeded = (e) => {
            const database = e.target.result;

            if (!database.objectStoreNames.contains('documents')) {
                const docStore = database.createObjectStore('documents', { keyPath: 'id' });
                docStore.createIndex('folder', 'folder');
                docStore.createIndex('date', 'date');
            }

            if (!database.objectStoreNames.contains('folders')) {
                database.createObjectStore('folders', { keyPath: 'id' });
            }

            if (!database.objectStoreNames.contains('pending')) {
                database.createObjectStore('pending', { keyPath: 'id' });
            }

            if (!database.objectStoreNames.contains('settings')) {
                database.createObjectStore('settings', { keyPath: 'key' });
            }
        };
    });
}

async function loadData() {
    state.documents = await getAllFromStore('documents');
    state.folders = await getAllFromStore('folders');
    state.pendingUploads = await getAllFromStore('pending');

    state.token = localStorage.getItem('keepai_token') || null;
    state.credits = 0;

    const driveSettings = await getFromStore('settings', 'driveToken');
    if (driveSettings) {
        state.driveToken = driveSettings.value;
        state.driveConnected = true;
    }

    // Load app settings
    const appSettings = await getFromStore('settings', 'appSettings');
    if (appSettings) {
        state.settings = { ...state.settings, ...appSettings.value };
        state.theme = appSettings.value.theme || 'dark';
        applyTheme(state.theme);
    }

    // Check if tutorial was shown
    const tutorialSettings = await getFromStore('settings', 'tutorialShown');
    if (!tutorialSettings) {
        state.tutorialShown = false;
        setTimeout(() => openModal('tutorialModal'), 1000);
    } else {
        state.tutorialShown = true;
    }
}

function getAllFromStore(storeName) {
    return new Promise((resolve) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => resolve([]);
    });
}

function getFromStore(storeName, key) {
    return new Promise((resolve) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
    });
}

function saveToStore(storeName, data) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(data);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function deleteFromStore(storeName, key) {
    return new Promise((resolve) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(key);
        request.onsuccess = () => resolve();
        request.onerror = () => resolve();
    });
}

// ============================================
// Event Listeners Setup
// ============================================
function setupEventListeners() {
    // Menu
    $('menuBtn').onclick = () => toggleSideMenu(true);
    $$('.side-menu-overlay').forEach(el => el.onclick = () => toggleSideMenu(false));

    // Menu Items
    $('menuHome').onclick = () => { navigateToFolder('root'); toggleSideMenu(false); };
    $('menuRecent').onclick = () => {
        state.currentFolder = 'root';
        state.sortBy = 'date-desc';
        $$('.sort-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.sort === 'date-desc'));
        updateUI();
        toggleSideMenu(false);
        showToast('Exibindo documentos mais recentes', 'info');
    };
    $('menuFolders').onclick = () => { showFoldersView(); toggleSideMenu(false); };
    $('menuDriveConnect').onclick = connectGoogleDrive;
    $('menuPending').onclick = showPendingUploads;
    $('menuOCR').onclick = () => { openOCRFromGallery(); toggleSideMenu(false); };
    $('menuStats').onclick = () => { showStats(); toggleSideMenu(false); };
    $('menuBackup').onclick = () => { showBackupOptions(); toggleSideMenu(false); };
    $('menuSettings').onclick = () => { openModal('settingsModal'); toggleSideMenu(false); };
    $('menuTutorial').onclick = () => { window.location.href = 'tutorial.html?lang=' + (typeof currentLang !== 'undefined' ? currentLang : 'pt'); };
    $('menuAbout').onclick = () => { openModal('aboutModal'); toggleSideMenu(false); };

    // Logo DEV mode (5 clicks)
    document.querySelectorAll('.app-title, #userNameDisplay').forEach(el => {
        el.onclick = () => handleLogoClick();
    });

    // Header actions
    $('searchBtn').onclick = toggleSearch;
    $('viewModeBtn').onclick = toggleViewMode;

    // Selection Mode
    $('selectModeBtn').onclick = toggleSelectMode;
    $('cancelSelectBtn').onclick = () => { state.selectMode = false; state.selectedItems = []; updateUI(); };
    $('selectAllBtn').onclick = selectAll;
    $('deleteSelectedBtn').onclick = deleteSelected;
    $('downloadSelectedBtn').onclick = downloadSelected;
    $('pdfSelectedBtn').onclick = generatePdfFromSelected;

    // Drive
    if ($('syncBtn')) $('syncBtn').onclick = () => syncGoogleDriveTwoWay(false);
    $('driveBtn').onclick = connectGoogleDrive;

    // FAB
    $('scanFab').onclick = () => openModal('captureModal');
    $('newFolderFab').onclick = () => openFolderModal();

    // Capture
    $('closeCaptureBtn').onclick = () => closeModal('captureModal');
    $('cameraBtn').onclick = () => startLiveCamera(false);
    $('batchCameraBtn').onclick = () => startLiveCamera(true);
    $('galleryBtn').onclick = () => $('galleryInput').click();
    if ($('barcodeScannerBtn')) $('barcodeScannerBtn').onclick = () => { closeModal('captureModal'); openBarcodeModal(); };
    if ($('cameraInput')) $('cameraInput').onchange = handleImageCapture;
    if ($('batchCameraInput')) $('batchCameraInput').onchange = handleBatchCapture;
    if ($('galleryInput')) $('galleryInput').onchange = handleImageCapture;

    // Editor
    $('closeEditorBtn').onclick = () => closeModal('editorModal');
    $('editorDoneBtn').onclick = finishEditing;
    $$('.editor-tab').forEach(tab => tab.onclick = () => switchEditorTab(tab.dataset.tab));

    // Crop Tools
    $$('#cropTools .ratio-btn').forEach(btn => btn.onclick = () => setRatio(btn.dataset.ratio));
    $('autoDetectBtn').onclick = autoDetectEdges;
    $('resetCropBtn').onclick = resetCrop;

    // Filter Tools
    $$('.filter-btn').forEach(btn => btn.onclick = () => applyFilter(btn.dataset.filter));

    // Signature Tools
    $('openSignatureModalBtn').onclick = openSignatureModal;
    $('removeSignatureBtn').onclick = removeSignatureFromDocument;

    // Adjust Tools
    $('rotateLeftBtn').onclick = () => rotateImage(-90);
    $('rotateRightBtn').onclick = () => rotateImage(90);

    // OCR from Editor
    $('editorOcrBtn').onclick = extractTextFromCurrentImage;

    // Multi-Page
    $('closeMultiPageBtn').onclick = () => closeModal('multiPageModal');
    $('addPageBtn').onclick = () => openModal('captureModal');
    $('generatePdfBtn').onclick = () => openPdfOptionsModal(true);

    // Save Modal
    $('closeSaveBtn').onclick = () => closeModal('saveModal');
    $$('.format-btn').forEach(btn => btn.onclick = () => {
        $$('.format-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    });
    $('saveLocalBtn').onclick = () => saveDocument('local');
    $('saveDriveBtn').onclick = () => saveDocument('drive');
    $('saveBothBtn').onclick = () => saveDocument('both');

    // Folder Modal
    $('closeFolderModalBtn').onclick = () => closeModal('folderModal');
    $('saveFolderBtn').onclick = saveFolder;

    // Move Modal
    $('closeMoveModalBtn').onclick = () => closeModal('moveModal');

    // Viewer
    $('closeViewerBtn').onclick = () => {
        state.viewerZoom = 1;
        state.viewerPan = { x: 0, y: 0 };
        updateViewerTransform();
        closeModal('viewerModal');
    };

    // Context Menu
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.context-menu')) {
            $('contextMenu').classList.add('hidden');
        }
    });
    $$('.context-item').forEach(item => item.onclick = () => handleContextAction(item.dataset.action));

    // Payment Events (Unified Recharge Modal)
    $('menuBuyCredits').onclick = () => { openRechargeModal(); toggleSideMenu(false); };

    // PWA Install
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        state.deferredPrompt = e;
        $('menuInstall').classList.remove('hidden');
        $('installDivider').classList.remove('hidden');
    });

    $('menuInstall').onclick = async () => {
        if (!state.deferredPrompt) return;
        state.deferredPrompt.prompt();
        const { outcome } = await state.deferredPrompt.userChoice;
        console.log(`User response to the install prompt: ${outcome}`);
        state.deferredPrompt = null;
        $('menuInstall').classList.add('hidden');
        $('installDivider').classList.add('hidden');
        toggleSideMenu(false);
    };

    window.addEventListener('appinstalled', () => {
        state.deferredPrompt = null;
        $('menuInstall').classList.add('hidden');
        $('installDivider').classList.add('hidden');
        console.log('App installed');
    });

    // Crop Handles
    setupCropHandles();
}

// ============================================
// UI Updates
// ============================================
function updateUI() {
    updateDocumentsGrid();
    updateBreadcrumb();
    updateSelectionBar();
    updateFolderSelect();
    updatePendingBadge();
    updateDriveStatus();

    $('newFolderFab').classList.toggle('hidden', state.selectMode);
}

function updateDocumentsGrid() {
    const grid = $('documentsGrid');
    const emptyState = $('emptyState');

    const folders = state.folders.filter(f => f.parent === state.currentFolder);
    let docs = state.documents.filter(d => d.folder === state.currentFolder);

    // Apply search filter
    docs = filterDocuments(docs);

    // Apply sorting
    docs = sortDocuments(docs);

    if (folders.length === 0 && docs.length === 0) {
        grid.classList.add('hidden');
        emptyState.classList.remove('hidden');
        return;
    }

    grid.classList.remove('hidden');
    emptyState.classList.add('hidden');

    let html = '';

    // Folders
    folders.forEach((folder, i) => {
        const isSelected = state.selectedItems.includes(`folder_${folder.id}`);
        html += `
            <div class="doc-item folder ${isSelected ? 'selected' : ''} ${folder.isLocked ? 'locked' : ''}" 
                 data-type="folder" data-id="${folder.id}" style="animation-delay: ${i * 0.05}s"
                 onclick="handleItemClick(event, 'folder', '${folder.id}')"
                 oncontextmenu="showContextMenu(event, 'folder', '${folder.id}')">
                <div class="doc-checkbox">
                    <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                </div>
                <div class="folder-icon">📁</div>
                <div class="folder-name">${folder.name}</div>
            </div>
        `;
    });

    // Documents
    docs.forEach((doc, i) => {
        const isSelected = state.selectedItems.includes(`doc_${doc.id}`);
        const date = new Date(doc.date).toLocaleDateString(currentLang === 'en' ? 'en-US' : 'pt-BR');
        html += `
            <div class="doc-item ${isSelected ? 'selected' : ''}" 
                 data-type="doc" data-id="${doc.id}" style="animation-delay: ${(folders.length + i) * 0.05}s"
                 onclick="handleItemClick(event, 'doc', '${doc.id}')"
                 oncontextmenu="showContextMenu(event, 'doc', '${doc.id}')">
                <div class="doc-checkbox">
                    <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                </div>
                ${doc.favorite ? '<div class="doc-favorite"><svg viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg></div>' : ''}
                <img class="doc-thumbnail" src="${doc.thumbnail || doc.image}" alt="${doc.name}" loading="lazy">
                <div class="doc-info">
                    <div class="doc-name">${doc.name}</div>
                    <div class="doc-date">${date}</div>
                </div>
                <button class="doc-menu-btn" onclick="event.stopPropagation(); showContextMenu(event, 'doc', '${doc.id}')">
                    <svg viewBox="0 0 24 24"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
                </button>
            </div>
        `;
    });

    grid.innerHTML = html;
    grid.classList.toggle('select-mode', state.selectMode);
    grid.classList.toggle('list-view', state.viewMode === 'list');

    // Swipe-to-delete: attach to all doc items (not folders)
    if (!state.selectMode) setupSwipeToDelete();
}

function updateBreadcrumb() {
    const nav = $('breadcrumb');
    const homeLabel = (typeof I18N_DICT !== 'undefined' && I18N_DICT[currentLang]) ? I18N_DICT[currentLang].home : 'Início';
    let html = `
        <button class="breadcrumb-item ${state.currentFolder === 'root' ? 'active' : ''}" 
                data-folder="root" onclick="navigateToFolder('root')">
            <svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
            <span>${homeLabel}</span>
        </button>
    `;

    if (state.currentFolder !== 'root') {
        const path = getFolderPath(state.currentFolder);
        path.forEach((folder, i) => {
            const isActive = i === path.length - 1;
            html += `
                <span style="color: var(--text-muted)">›</span>
                <button class="breadcrumb-item ${isActive ? 'active' : ''}" 
                        data-folder="${folder.id}" onclick="navigateToFolder('${folder.id}')">
                    <span>${folder.name}</span>
                </button>
            `;
        });
    }

    nav.innerHTML = html;
}

function getFolderPath(folderId) {
    const path = [];
    let current = state.folders.find(f => f.id === folderId);

    while (current) {
        path.unshift(current);
        current = state.folders.find(f => f.id === current.parent);
    }

    return path;
}

function updateSelectionBar() {
    const bar = $('selectionBar');
    const header = document.querySelector('.header');

    if (state.selectMode && state.selectedItems.length > 0) {
        bar.classList.remove('hidden');
        header.classList.add('hidden');
        $('selectedCount').textContent = `${state.selectedItems.length} selecionados`;
    } else {
        bar.classList.add('hidden');
        header.classList.remove('hidden');
    }
}

function updateFolderSelect() {
    const select = $('folderSelect');
    let html = '<option value="root">Raiz</option>';

    state.folders.forEach(folder => {
        html += `<option value="${folder.id}">${folder.name}</option>`;
    });

    select.innerHTML = html;
    select.value = state.currentFolder;
}

function updatePendingBadge() {
    const badge = $('pendingCount');
    if (state.pendingUploads.length > 0) {
        badge.textContent = state.pendingUploads.length;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

function updateDriveStatus() {
    const isEn = (typeof currentLang !== 'undefined' && currentLang === 'en');
    const status = $('driveStatus');
    if (status) {
        status.textContent = state.driveConnected 
            ? (isEn ? 'Connected to Drive' : 'Conectado ao Drive')
            : (isEn ? 'Not connected' : 'Não conectado');
    }
    const menuDriveConnect = $('menuDriveConnect');
    if (menuDriveConnect) {
        const span = menuDriveConnect.querySelector('span');
        if (span) {
            span.textContent = state.driveConnected 
                ? (isEn ? 'Manage Google Drive' : 'Gerenciar Google Drive')
                : (isEn ? 'Connect Google Drive' : 'Conectar Google Drive');
        }
    }
    updateUserProfileUI(state.googleProfile);
}

function updateOnlineStatus() {
    const isOnline = navigator.onLine;
    if ($('syncBtn')) $('syncBtn').style.opacity = isOnline ? '1' : '0.5';
    if ($('driveBtn')) $('driveBtn').style.opacity = isOnline ? '1' : '0.5';
}

// ============================================
// Navigation
// ============================================
function navigateToFolder(folderId) {
    state.currentFolder = folderId;
    state.selectedItems = [];
    state.selectMode = false;
    updateUI();
}

function handleItemClick(event, type, id) {
    if (state.selectMode) {
        toggleSelection(type, id);
        return;
    }

    if (type === 'folder') {
        const folder = state.folders.find(f => f.id === id);
        if (folder && folder.isLocked) {
            openPinModal('unlock', id);
        } else {
            navigateToFolder(id);
        }
    } else {
        viewDocument(id);
    }
}

function toggleSelection(type, id) {
    const key = `${type}_${id}`;
    const index = state.selectedItems.indexOf(key);

    if (index === -1) {
        state.selectedItems.push(key);
    } else {
        state.selectedItems.splice(index, 1);
    }

    updateUI();
}

function toggleSelectMode() {
    state.selectMode = !state.selectMode;
    state.selectedItems = [];
    updateUI();
}

function selectAll() {
    const folders = state.folders.filter(f => f.parent === state.currentFolder);
    const docs = state.documents.filter(d => d.folder === state.currentFolder);

    state.selectedItems = [
        ...folders.map(f => `folder_${f.id}`),
        ...docs.map(d => `doc_${d.id}`)
    ];

    updateUI();
}

// ============================================
// Swipe-to-Delete
// ============================================
function setupSwipeToDelete() {
    const items = document.querySelectorAll('.doc-item:not(.folder)');
    let currentOpen = null;

    // Close any open swipe when touching elsewhere
    document.addEventListener('touchstart', () => {
        if (currentOpen) {
            currentOpen.classList.remove('swipe-open');
            currentOpen = null;
        }
    }, { passive: true, once: false });

    items.forEach(item => {
        let startX = 0, startY = 0, moved = false;

        item.addEventListener('touchstart', e => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            moved = false;
        }, { passive: true });

        item.addEventListener('touchmove', e => {
            const dx = e.touches[0].clientX - startX;
            const dy = e.touches[0].clientY - startY;
            if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
                moved = true;
                e.stopPropagation();
            }
        }, { passive: true });

        item.addEventListener('touchend', e => {
            if (!moved) return;
            const dx = e.changedTouches[0].clientX - startX;
            if (dx < -60) {
                // Swipe left — open delete
                if (currentOpen && currentOpen !== item) {
                    currentOpen.classList.remove('swipe-open');
                }
                item.classList.add('swipe-open');
                currentOpen = item;
                e.preventDefault();
            } else if (dx > 30 && currentOpen === item) {
                item.classList.remove('swipe-open');
                currentOpen = null;
            }
        });

        // Attach delete button (added dynamically to avoid breaking existing layout)
        if (!item.querySelector('.swipe-delete-btn')) {
            const docId = item.dataset.id;
            const delBtn = document.createElement('button');
            delBtn.className = 'swipe-delete-btn';
            delBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>';
            delBtn.onclick = (e) => {
                e.stopPropagation();
                if (confirm('Excluir este documento?')) deleteDocument(docId);
            };
            item.appendChild(delBtn);
        }
    });
}

// ============================================
// Modal Management
// ============================================
function openModal(modalId) {
    const el = $(modalId);
    el.classList.remove('hidden'); // remove display:none !important
    el.classList.add('open');
    document.body.style.overflow = 'hidden';
}

function stopPolling() {
    if (typeof rechargePollingInterval !== 'undefined' && rechargePollingInterval) {
        clearInterval(rechargePollingInterval);
        rechargePollingInterval = null;
    }
}
window.stopPolling = stopPolling;

function closeModal(modalId) {
    const el = $(modalId);
    if (!el) return;
    el.classList.remove('open');
    stopPolling();
    // Re-adiciona hidden após a transição terminar
    setTimeout(() => {
        if (el) el.classList.add('hidden');
    }, 320);
    document.body.style.overflow = '';
}

function toggleSideMenu(open) {
    $('sideMenu').classList.toggle('open', open);
}

// ============================================
// Image Capture
// ============================================
function handleImageCapture(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    closeModal('captureModal');

    const file = files[0];
    const reader = new FileReader();

    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            state.originalImage = img;
            state.currentImage = img;
            state.currentFilter = 'magic'; // Default to the most useful filter
            openEditor();
        };
        img.src = e.target.result;
    };

    reader.readAsDataURL(file);
    event.target.value = '';
}

// ============================================
// Editor
// ============================================
function openEditor(img) {
    if (img) {
        state.originalImage = img;
        state.currentImage = img;
    }
    state.currentFilter = 'magic';
    $$('.filter-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.filter === 'magic'));
    openModal('editorModal');
    switchEditorTab('crop');
    drawImageToCanvas();
    setTimeout(() => autoDetectEdges(true), 120);
}

function switchEditorTab(tab) {
    $$('.editor-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    $('cropTools')?.classList.toggle('hidden', tab !== 'crop');
    $('filterTools')?.classList.toggle('hidden', tab !== 'filters');
    $('adjustTools')?.classList.toggle('hidden', tab !== 'adjust');
    $('signatureTools')?.classList.toggle('hidden', tab !== 'signature');
    $('redactTools')?.classList.toggle('hidden', tab !== 'redact');
    $('eraserTools')?.classList.toggle('hidden', tab !== 'eraser');
    $('cropOverlay').style.display = tab === 'crop' ? 'block' : 'none';

    if (tab === 'crop') {
        $('editorCanvas').style.transform = '';
    }

    if (tab === 'eraser') {
        enableEraserMode(true);
    } else {
        enableEraserMode(false);
    }

    if (tab === 'adjust') {
        ['brightnessSlider', 'contrastSlider', 'saturationSlider'].forEach(id => {
            const s = $(id);
            if (s && typeof updateSliderTrack === 'function') updateSliderTrack(s);
        });
    }

    if (tab === 'redact') {
        const canvas = $('editorCanvas');
        if (canvas && canvas.width) {
            redactInitialSnapshot = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
            redactConfig.history = [];
        }
    }
}

function drawImageToCanvas() {
    const canvas = $('editorCanvas');
    const ctx = canvas.getContext('2d');
    const container = document.querySelector('.editor-canvas-container');

    const maxWidth = container.clientWidth;
    const maxHeight = container.clientHeight;

    let width = state.currentImage.width;
    let height = state.currentImage.height;

    const ratio = Math.min(maxWidth / width, maxHeight / height);
    width = width * ratio;
    height = height * ratio;

    canvas.width = width;
    canvas.height = height;

    ctx.drawImage(state.currentImage, 0, 0, width, height);

    if (state.currentFilter !== 'original') {
        applyFilterToCanvas(state.currentFilter);
    }

    updateCropOverlay();
}

// ============================================
// Crop Functionality
// ============================================
function setupCropHandles() {
    const handles = $$('.crop-handle');

    handles.forEach(handle => {
        let dragging = false;

        const startDrag = (e) => {
            e.preventDefault();
            e.stopPropagation();
            dragging = true;
            triggerHaptic(20);
            const touch = e.touches ? e.touches[0] : e;
            const corner = handle.dataset.corner;
            const pt = state.cropPoints[corner];
            if (pt) renderCornerMagnifier(handle, touch.clientX, touch.clientY, pt.x, pt.y);
        };

        const moveDrag = (e) => {
            if (!dragging) return;
            e.preventDefault();
            e.stopPropagation();

            const touch = e.touches ? e.touches[0] : e;
            const canvas = $('editorCanvas');
            const rect = canvas.getBoundingClientRect();

            let x = ((touch.clientX - rect.left) / rect.width) * 100;
            let y = ((touch.clientY - rect.top) / rect.height) * 100;
            x = Math.max(0, Math.min(100, x));
            y = Math.max(0, Math.min(100, y));

            const corner = handle.dataset.corner;
            state.cropPoints[corner] = { x, y };
            updateCropOverlay();
            renderCornerMagnifier(handle, touch.clientX, touch.clientY, x, y);
        };

        const endDrag = () => {
            if (dragging) {
                dragging = false;
                hideCornerMagnifier();
            }
        };

        handle.addEventListener('mousedown', startDrag);
        handle.addEventListener('touchstart', startDrag, { passive: false });
        document.addEventListener('mousemove', moveDrag);
        document.addEventListener('touchmove', moveDrag, { passive: false });
        document.addEventListener('mouseup', endDrag);
        document.addEventListener('touchend', endDrag);
    });
}

function renderCornerMagnifier(handle, clientX, clientY, xPct, yPct) {
    const magnifier = $('cornerMagnifier');
    const magCanvas = $('magnifierCanvas');
    const container = document.querySelector('.editor-canvas-container');
    if (!magnifier || !magCanvas || !container) return;

    const img = state.originalImage || $('editorCanvas');
    if (!img) return;

    const imgWidth = img.naturalWidth || img.width;
    const imgHeight = img.naturalHeight || img.height;
    if (!imgWidth || !imgHeight) return;

    const containerRect = container.getBoundingClientRect();
    let relX = clientX - containerRect.left;
    let relY = clientY - containerRect.top - 80;

    // Flip below finger if too close to container top
    if (relY < 65) {
        relY = clientY - containerRect.top + 75;
    }

    // Clamp horizontally inside container
    relX = Math.max(68, Math.min(containerRect.width - 68, relX));

    magnifier.style.left = `${relX}px`;
    magnifier.style.top = `${relY}px`;
    magnifier.classList.remove('hidden');

    const ctx = magCanvas.getContext('2d');
    const magW = magCanvas.width;
    const magH = magCanvas.height;

    ctx.clearRect(0, 0, magW, magH);

    // Zoom factor 2.8x for crisp corner inspection
    const zoom = 2.8;
    const srcCropW = magW / zoom;
    const srcCropH = magH / zoom;

    const centerImgX = (xPct / 100) * imgWidth;
    const centerImgY = (yPct / 100) * imgHeight;

    const srcX = centerImgX - srcCropW / 2;
    const srcY = centerImgY - srcCropH / 2;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, srcX, srcY, srcCropW, srcCropH, 0, 0, magW, magH);
}

function hideCornerMagnifier() {
    const magnifier = $('cornerMagnifier');
    if (magnifier) magnifier.classList.add('hidden');
}

function updateCropOverlay() {
    const canvas = $('editorCanvas');
    const overlay = $('cropOverlay');
    const svg = $('cropLines');
    const handles = $$('.crop-handle');

    if (!canvas || !overlay || !svg) return;

    const rect = canvas.getBoundingClientRect();
    const container = document.querySelector('.editor-canvas-container');
    const containerRect = container.getBoundingClientRect();

    const offsetX = rect.left - containerRect.left;
    const offsetY = rect.top - containerRect.top;
    const W = rect.width;
    const H = rect.height;

    const cp = state.cropPoints;

    // Position handles
    handles.forEach(h => {
        const corner = h.dataset.corner;
        const pt = cp[corner];
        h.style.left = `${offsetX + (pt.x / 100) * W}px`;
        h.style.top = `${offsetY + (pt.y / 100) * H}px`;
    });

    // Draw lines
    const pts = [
        { x: offsetX + (cp.tl.x / 100) * W, y: offsetY + (cp.tl.y / 100) * H },
        { x: offsetX + (cp.tr.x / 100) * W, y: offsetY + (cp.tr.y / 100) * H },
        { x: offsetX + (cp.br.x / 100) * W, y: offsetY + (cp.br.y / 100) * H },
        { x: offsetX + (cp.bl.x / 100) * W, y: offsetY + (cp.bl.y / 100) * H }
    ];

    const d = pts.map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' ') + ' Z';

    // Create or update path
    let path = svg.querySelector('path');
    if (!path) {
        path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        svg.appendChild(path);
    }

    path.setAttribute('d', d);
    path.setAttribute('stroke', 'rgba(108, 92, 231, 0.9)');
    path.setAttribute('stroke-width', '2.5');
    path.setAttribute('fill', 'rgba(108, 92, 231, 0.15)');
    path.setAttribute('stroke-dasharray', '6 4');

    // Fit SVG to container
    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.setAttribute('viewBox', `0 0 ${container.clientWidth} ${container.clientHeight}`);
}

function setRatio(ratio) {
    state.currentRatio = ratio;
    $$('#cropTools .ratio-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.ratio === ratio));

    if (ratio !== 'free') {
        adjustCropToRatio(ratio);
    }
}

function adjustCropToRatio(ratio) {
    const canvas = $('editorCanvas');
    let aspectRatio;

    switch (ratio) {
        case 'a4': aspectRatio = 210 / 297; break; // Portrait A4
        case 'square': aspectRatio = 1; break;
        case 'card': aspectRatio = 85.6 / 53.98; break; // Credit card ratio
        default: return;
    }

    // Calculate crop area maintaining aspect ratio
    let cropWidth = 80; // % of canvas
    let cropHeight = cropWidth / aspectRatio * (canvas.width / canvas.height);

    // If height exceeds bounds, recalculate based on height
    if (cropHeight > 90) {
        cropHeight = 80;
        cropWidth = cropHeight * aspectRatio * (canvas.height / canvas.width);
    }

    // Ensure within bounds
    cropWidth = Math.min(90, cropWidth);
    cropHeight = Math.min(90, cropHeight);

    const left = (100 - cropWidth) / 2;
    const top = (100 - cropHeight) / 2;

    state.cropPoints = {
        tl: { x: left, y: top },
        tr: { x: left + cropWidth, y: top },
        bl: { x: left, y: top + cropHeight },
        br: { x: left + cropWidth, y: top + cropHeight }
    };

    updateCropOverlay();
}

function resetCrop() {
    state.cropPoints = {
        tl: { x: 5, y: 5 },
        tr: { x: 95, y: 5 },
        bl: { x: 5, y: 95 },
        br: { x: 95, y: 95 }
    };
    state.currentRatio = 'free';
    $$('#cropTools .ratio-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.ratio === 'free'));
    updateCropOverlay();
}

// ============================================
// Auto Edge Detection — Canny-based pipeline
// ============================================

/** Convert RGBA imageData to a Float32 grayscale array (0-255) */
function _toGrayscale(data, w, h) {
    const gray = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
        const p = i * 4;
        gray[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
    }
    return gray;
}

/** Gaussian blur (5×5 kernel, σ≈1.4) */
function _gaussianBlur(gray, w, h) {
    const kernel = [2, 4, 5, 4, 2, 4, 9, 12, 9, 4, 5, 12, 15, 12, 5, 4, 9, 12, 9, 4, 2, 4, 5, 4, 2];
    const kSum = 159;
    const out = new Float32Array(w * h);
    for (let y = 2; y < h - 2; y++) {
        for (let x = 2; x < w - 2; x++) {
            let v = 0;
            let ki = 0;
            for (let ky = -2; ky <= 2; ky++) {
                for (let kx = -2; kx <= 2; kx++) {
                    v += gray[(y + ky) * w + (x + kx)] * kernel[ki++];
                }
            }
            out[y * w + x] = v / kSum;
        }
    }
    return out;
}

/** Sobel operator — returns {mag, angle} */
function _sobel(gray, w, h) {
    const mag = new Float32Array(w * h);
    const angle = new Float32Array(w * h);
    for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
            const tl = gray[(y - 1) * w + (x - 1)], tc = gray[(y - 1) * w + x], tr = gray[(y - 1) * w + (x + 1)];
            const ml = gray[y * w + (x - 1)], mr = gray[y * w + (x + 1)];
            const bl = gray[(y + 1) * w + (x - 1)], bc = gray[(y + 1) * w + x], br = gray[(y + 1) * w + (x + 1)];
            const gx = -tl - 2 * ml - bl + tr + 2 * mr + br;
            const gy = -tl - 2 * tc - tr + bl + 2 * bc + br;
            mag[y * w + x] = Math.sqrt(gx * gx + gy * gy);
            angle[y * w + x] = Math.atan2(gy, gx);
        }
    }
    return { mag, angle };
}

/** Non-maximum suppression */
function _nms(mag, angle, w, h) {
    const out = new Float32Array(w * h);
    for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
            const a = angle[y * w + x];
            const m = mag[y * w + x];
            // Quantise angle to 4 directions
            const deg = ((a * 180 / Math.PI) + 180) % 180;
            let n1, n2;
            if (deg < 22.5 || deg >= 157.5) { n1 = mag[y * w + (x - 1)]; n2 = mag[y * w + (x + 1)]; }
            else if (deg < 67.5) { n1 = mag[(y - 1) * w + (x + 1)]; n2 = mag[(y + 1) * w + (x - 1)]; }
            else if (deg < 112.5) { n1 = mag[(y - 1) * w + x]; n2 = mag[(y + 1) * w + x]; }
            else { n1 = mag[(y - 1) * w + (x - 1)]; n2 = mag[(y + 1) * w + (x + 1)]; }
            out[y * w + x] = (m >= n1 && m >= n2) ? m : 0;
        }
    }
    return out;
}

/** Hysteresis threshold — returns binary edge map (0/1) */
function _hysteresis(nms, w, h) {
    // Auto-compute thresholds from histogram
    let maxMag = 0;
    for (let i = 0; i < nms.length; i++) if (nms[i] > maxMag) maxMag = nms[i];
    const high = maxMag * 0.20;
    const low = high * 0.40;

    const strong = new Uint8Array(w * h);
    const weak = new Uint8Array(w * h);
    for (let i = 0; i < nms.length; i++) {
        if (nms[i] >= high) strong[i] = 1;
        else if (nms[i] >= low) weak[i] = 1;
    }
    // Propagate strong to connected weak pixels
    const edges = new Uint8Array(w * h);
    for (let i = 0; i < strong.length; i++) if (strong[i]) edges[i] = 1;
    for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
            if (!weak[y * w + x]) continue;
            const nbr = [strong[(y - 1) * w + (x - 1)], strong[(y - 1) * w + x], strong[(y - 1) * w + (x + 1)],
            strong[y * w + (x - 1)], strong[y * w + (x + 1)],
            strong[(y + 1) * w + (x - 1)], strong[(y + 1) * w + x], strong[(y + 1) * w + (x + 1)]];
            if (nbr.some(v => v)) edges[y * w + x] = 1;
        }
    }
    return edges;
}

/**
 * Advanced Document Quadrilateral Detection (CamScanner-grade)
 * Detects the 4 corners { tl, tr, br, bl } of a document in the image using edge gradient transitions.
 */
function _findDocumentCorners(pixelData, w, h) {
    const lum = new Uint8Array(w * h);
    for (let i = 0, p = 0; i < pixelData.length; i += 4, p++) {
        lum[p] = Math.round(0.299 * pixelData[i] + 0.587 * pixelData[i + 1] + 0.114 * pixelData[i + 2]);
    }

    const edgePoints = [];
    const stepY = 2;
    const stepX = 2;

    // Scan horizontal lines for left & right borders
    for (let y = 8; y < h - 8; y += stepY) {
        let firstEdge = -1;
        let lastEdge = -1;
        for (let x = 6; x < w - 6; x++) {
            const diff = Math.abs(lum[y * w + x] - lum[y * w + (x - 4)]);
            if (diff > 25) {
                if (firstEdge === -1) firstEdge = x;
                lastEdge = x;
            }
        }
        if (firstEdge !== -1 && lastEdge !== -1 && (lastEdge - firstEdge) > w * 0.15) {
            edgePoints.push({ x: firstEdge, y });
            edgePoints.push({ x: lastEdge, y });
        }
    }

    // Scan vertical lines for top & bottom borders
    for (let x = 8; x < w - 8; x += stepX) {
        let firstEdge = -1;
        let lastEdge = -1;
        for (let y = 6; y < h - 6; y++) {
            const diff = Math.abs(lum[y * w + x] - lum[(y - 4) * w + x]);
            if (diff > 25) {
                if (firstEdge === -1) firstEdge = y;
                lastEdge = y;
            }
        }
        if (firstEdge !== -1 && lastEdge !== -1 && (lastEdge - firstEdge) > h * 0.15) {
            edgePoints.push({ x, y: firstEdge });
            edgePoints.push({ x, y: lastEdge });
        }
    }

    if (edgePoints.length < 12) {
        return null;
    }

    let tl = edgePoints[0], tr = edgePoints[0], br = edgePoints[0], bl = edgePoints[0];
    let minSum = Infinity, maxSum = -Infinity;
    let minDiff = Infinity, maxDiff = -Infinity;

    for (let i = 0; i < edgePoints.length; i++) {
        const p = edgePoints[i];
        const sum = p.x + p.y;
        const diff = p.x - p.y;

        if (sum < minSum) { minSum = sum; tl = p; }
        if (sum > maxSum) { maxSum = sum; br = p; }
        if (diff > maxDiff) { maxDiff = diff; tr = p; }
        if (diff < minDiff) { minDiff = diff; bl = p; }
    }

    const docW = Math.max(tr.x - tl.x, br.x - bl.x);
    const docH = Math.max(bl.y - tl.y, br.y - tr.y);

    if (docW < w * 0.12 || docH < h * 0.12) {
        return null;
    }

    const toPctX = (px) => Math.max(1, Math.min(99, (px / w) * 100));
    const toPctY = (py) => Math.max(1, Math.min(99, (py / h) * 100));

    return {
        tl: { x: toPctX(tl.x), y: toPctY(tl.y) },
        tr: { x: toPctX(tr.x), y: toPctY(tr.y) },
        br: { x: toPctX(br.x), y: toPctY(br.y) },
        bl: { x: toPctX(bl.x), y: toPctY(bl.y) }
    };
}

/**
 * OpenCV.js Canny + approxPolyDP Document 4-Corner Detection (GitHub / CamScanner standard)
 */
function findDocumentWithOpenCV(canvasOrImg) {
    if (typeof cv === 'undefined' || !cv.Mat) {
        return null;
    }

    try {
        const src = cv.imread(canvasOrImg);
        const gray = new cv.Mat();
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);

        const blurred = new cv.Mat();
        cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);

        const edges = new cv.Mat();
        cv.Canny(blurred, edges, 40, 160);

        const kernel = cv.Mat.ones(3, 3, cv.CV_8U);
        const dilated = new cv.Mat();
        cv.dilate(edges, dilated, kernel);

        let contours = new cv.MatVector();
        let hierarchy = new cv.Mat();
        cv.findContours(dilated, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

        let maxArea = 0;
        let bestPoints = null;
        const minArea = src.cols * src.rows * 0.04;
        const maxAllowedArea = src.cols * src.rows * 0.98;

        for (let i = 0; i < contours.size(); ++i) {
            let contour = contours.get(i);
            let area = cv.contourArea(contour);
            if (area > minArea && area < maxAllowedArea) {
                let peri = cv.arcLength(contour, true);
                let approx = new cv.Mat();
                cv.approxPolyDP(contour, approx, 0.025 * peri, true);

                if (approx.rows === 4 && area > maxArea) {
                    if (cv.isContourConvex(approx)) {
                        maxArea = area;
                        bestPoints = [];
                        for (let k = 0; k < 4; k++) {
                            bestPoints.push({
                                x: approx.data32S[k * 2],
                                y: approx.data32S[k * 2 + 1]
                            });
                        }
                    }
                }
                approx.delete();
            }
        }

        // Cleanup
        src.delete();
        gray.delete();
        blurred.delete();
        edges.delete();
        kernel.delete();
        dilated.delete();
        contours.delete();
        hierarchy.delete();

        if (bestPoints && bestPoints.length === 4) {
            let tl = bestPoints[0], tr = bestPoints[0], br = bestPoints[0], bl = bestPoints[0];
            let minSum = Infinity, maxSum = -Infinity;
            let minDiff = Infinity, maxDiff = -Infinity;

            for (let p of bestPoints) {
                let sum = p.x + p.y;
                let diff = p.x - p.y;
                if (sum < minSum) { minSum = sum; tl = p; }
                if (sum > maxSum) { maxSum = sum; br = p; }
                if (diff > maxDiff) { maxDiff = diff; tr = p; }
                if (diff < minDiff) { minDiff = diff; bl = p; }
            }

            const w = canvasOrImg.width;
            const h = canvasOrImg.height;

            return {
                tl: { x: Math.max(1, Math.min(99, (tl.x / w) * 100)), y: Math.max(1, Math.min(99, (tl.y / h) * 100)) },
                tr: { x: Math.max(1, Math.min(99, (tr.x / w) * 100)), y: Math.max(1, Math.min(99, (tr.y / h) * 100)) },
                br: { x: Math.max(1, Math.min(99, (br.x / w) * 100)), y: Math.max(1, Math.min(99, (br.y / h) * 100)) },
                bl: { x: Math.max(1, Math.min(99, (bl.x / w) * 100)), y: Math.max(1, Math.min(99, (bl.y / h) * 100)) }
            };
        }
    } catch (err) {
        console.warn('OpenCV document detection fallback:', err);
    }
    return null;
}

function autoDetectEdges(autoOnly = false) {
    if (!autoOnly) showLoading('Detectando enquadramento...');

    setTimeout(() => {
        const srcImage = state.originalImage || state.currentImage;
        if (!srcImage) {
            if (!autoOnly) { hideLoading(); showToast('Nenhuma imagem carregada', 'error'); }
            return;
        }

        const sw = 480;
        const sh = Math.round((srcImage.height / srcImage.width) * 480) || 360;

        const offscreen = document.createElement('canvas');
        offscreen.width = sw;
        offscreen.height = sh;
        const octx = offscreen.getContext('2d', { willReadFrequently: true });
        octx.drawImage(srcImage, 0, 0, sw, sh);

        // 1. Try OpenCV detection first (GitHub / CamScanner standard)
        let corners = findDocumentWithOpenCV(offscreen);

        // 2. Fallback to Scanline Gradient Detector
        if (!corners) {
            const imgData = octx.getImageData(0, 0, sw, sh);
            corners = _findDocumentCorners(imgData.data, sw, sh);
        }

        if (!autoOnly) hideLoading();

        if (corners) {
            state.cropPoints = corners;
            updateCropOverlay();
            if (!autoOnly) {
                triggerHaptic('success');
                showToast('Documento enquadrado com precisão!', 'success');
            }
        } else {
            // Smart 5% inset if no high contrast edge
            state.cropPoints = {
                tl: { x: 5, y: 5 },
                tr: { x: 95, y: 5 },
                br: { x: 95, y: 95 },
                bl: { x: 5, y: 95 }
            };
            updateCropOverlay();
            if (!autoOnly) {
                triggerHaptic('warning');
                showToast('Ajuste fino de corte disponível', 'info');
            }
        }
    }, autoOnly ? 60 : 120);
}

// ============================================
// Filters
// ============================================
function applyFilter(filterName) {
    state.currentFilter = filterName;
    $$('.filter-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.filter === filterName));

    drawImageToCanvas();
}

function applyFilterToCanvas(filterName) {
    const canvas = $('editorCanvas');
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    switch (filterName) {
        case 'grayscale':
            for (let i = 0; i < data.length; i += 4) {
                const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
                data[i] = data[i + 1] = data[i + 2] = avg;
            }
            break;

        case 'contrast':
            const factor = 1.5;
            for (let i = 0; i < data.length; i += 4) {
                data[i] = Math.min(255, Math.max(0, factor * (data[i] - 128) + 128));
                data[i + 1] = Math.min(255, Math.max(0, factor * (data[i + 1] - 128) + 128));
                data[i + 2] = Math.min(255, Math.max(0, factor * (data[i + 2] - 128) + 128));
            }
            break;

        case 'brightness':
            const brightness = 40;
            for (let i = 0; i < data.length; i += 4) {
                data[i] = Math.min(255, data[i] + brightness);
                data[i + 1] = Math.min(255, data[i + 1] + brightness);
                data[i + 2] = Math.min(255, data[i + 2] + brightness);
            }
            break;

        case 'document':
            // High contrast + sharpen for documents
            for (let i = 0; i < data.length; i += 4) {
                const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
                const threshold = avg > 180 ? 255 : avg < 80 ? 0 : avg * 1.3;
                data[i] = data[i + 1] = data[i + 2] = Math.min(255, threshold);
            }
            break;

        case 'whiteboard':
            // Enhance whiteboard - boost whites, darken text
            for (let i = 0; i < data.length; i += 4) {
                const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
                if (avg > 200) {
                    data[i] = data[i + 1] = data[i + 2] = 255;
                } else if (avg < 100) {
                    data[i] = Math.max(0, data[i] - 30);
                    data[i + 1] = Math.max(0, data[i + 1] - 30);
                    data[i + 2] = Math.max(0, data[i + 2] - 30);
                } else {
                    const boost = 1.2;
                    data[i] = Math.min(255, data[i] * boost);
                    data[i + 1] = Math.min(255, data[i + 1] * boost);
                    data[i + 2] = Math.min(255, data[i + 2] * boost);
                }
            }
            break;

        case 'autoclean':
            // Remove noise and enhance
            for (let i = 0; i < data.length; i += 4) {
                const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
                // Posterize effect with cleanup
                const level = Math.round(avg / 64) * 64;
                if (avg > 220) {
                    data[i] = data[i + 1] = data[i + 2] = 255;
                } else if (avg < 50) {
                    data[i] = data[i + 1] = data[i + 2] = 0;
                } else {
                    const factor = 1.4;
                    data[i] = Math.min(255, Math.max(0, factor * (data[i] - 128) + 128));
                    data[i + 1] = Math.min(255, Math.max(0, factor * (data[i + 1] - 128) + 128));
                    data[i + 2] = Math.min(255, Math.max(0, factor * (data[i + 2] - 128) + 128));
                }
            }
            break;

        case 'magic': {
            // CamScanner Magic Color V3: High-Pass Text Unsharp + Adaptive Whitening + Vivid Colors
            const w = canvas.width;
            const h = canvas.height;
            const lumMap = new Float32Array(w * h);
            for (let i = 0, p = 0; i < data.length; i += 4, p++) {
                lumMap[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            }

            const orig = new Uint8ClampedArray(data);
            const sharpen = 0.40;

            for (let y = 1; y < h - 1; y++) {
                for (let x = 1; x < w - 1; x++) {
                    const idx = (y * w + x) * 4;
                    const p = y * w + x;
                    const lum = lumMap[p];

                    const localAvg = (lumMap[(y - 1) * w + x] + lumMap[(y + 1) * w + x] + lumMap[y * w + (x - 1)] + lumMap[y * w + (x + 1)]) / 4;

                    for (let c = 0; c < 3; c++) {
                        let val = orig[idx + c];

                        // Laplacian high-pass sharpening
                        const laplacian = (val * 4) - (
                            orig[((y - 1) * w + x) * 4 + c] +
                            orig[((y + 1) * w + x) * 4 + c] +
                            orig[(y * w + (x - 1)) * 4 + c] +
                            orig[(y * w + (x + 1)) * 4 + c]
                        );
                        val = val + laplacian * sharpen;

                        // Adaptive paper whitening
                        if (lum > localAvg - 8 && lum > 115) {
                            const boost = 1 + Math.pow((lum - 115) / 140, 1.1) * 1.3;
                            val = val * boost + 25;
                        } else if (lum < 95) {
                            const darken = Math.max(0.35, Math.pow(lum / 95, 1.3));
                            val = val * darken * 0.85;
                        } else {
                            val = 1.45 * (val - 128) + 128;
                        }

                        data[idx + c] = Math.max(0, Math.min(255, val));
                    }
                }
            }
            break;
        }

        case 'magic_bw': {
            // CamScanner Pure Black & White (Sauvola local window thresholding)
            const w = canvas.width;
            const h = canvas.height;
            const lum = new Float32Array(w * h);
            for (let i = 0, p = 0; i < data.length; i += 4, p++) {
                lum[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            }

            const step = 8;
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    const p = y * w + x;
                    const l = lum[p];

                    const x0 = Math.max(0, x - step), x1 = Math.min(w - 1, x + step);
                    const y0 = Math.max(0, y - step), y1 = Math.min(h - 1, y + step);
                    const localMean = (lum[y0 * w + x] + lum[y1 * w + x] + lum[y * w + x0] + lum[y * w + x1] + l * 2) / 6;

                    const val = l < (localMean - 7) ? 0 : 255;
                    const idx = p * 4;
                    data[idx] = data[idx + 1] = data[idx + 2] = val;
                }
            }
            break;
        }

        case 'deshadow':
            // Shadow Removal (Brightens dark gradients)
            for (let i = 0; i < data.length; i += 4) {
                let r = data[i], g = data[i + 1], b = data[i + 2];
                const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
                const gain = (255 - lum) * 0.4;
                data[i] = Math.min(255, r + gain);
                data[i + 1] = Math.min(255, g + gain);
                data[i + 2] = Math.min(255, b + gain);
            }
            break;
    }

    ctx.putImageData(imageData, 0, 0);
}

// ============================================
// Image Adjustments
// ============================================
function rotateImage(degrees) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const img = state.currentImage;

    if (degrees === 90 || degrees === -90) {
        canvas.width = img.height;
        canvas.height = img.width;
    } else {
        canvas.width = img.width;
        canvas.height = img.height;
    }

    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((degrees * Math.PI) / 180);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);

    const newImg = new Image();
    newImg.onload = () => {
        state.currentImage = newImg;
        state.originalImage = newImg;
        drawImageToCanvas();
        resetCrop();
    };
    newImg.src = canvas.toDataURL('image/jpeg', 0.9);
}

// ============================================
// Image Adjustments — Sliders
// ============================================
function updateSliderTrack(slider) {
    if (!slider) return;
    const min = parseFloat(slider.min) !== undefined && !isNaN(parseFloat(slider.min)) ? parseFloat(slider.min) : -100;
    const max = parseFloat(slider.max) !== undefined && !isNaN(parseFloat(slider.max)) ? parseFloat(slider.max) : 100;
    const val = parseFloat(slider.value) || 0;
    const percent = Math.max(0, Math.min(100, ((val - min) / (max - min)) * 100));
    slider.style.background = `linear-gradient(to right, var(--accent-primary) 0%, var(--accent-primary) ${percent}%, var(--border-color) ${percent}%, var(--border-color) 100%)`;
}

// Debounce helper so oninput doesn't fire too rapidly
let _adjustTimer = null;
function applyAdjustments() {
    const bSlider = $('brightnessSlider');
    const cSlider = $('contrastSlider');
    const sSlider = $('saturationSlider');

    // Dynamically update the purple progress line on each slider
    if (bSlider) updateSliderTrack(bSlider);
    if (cSlider) updateSliderTrack(cSlider);
    if (sSlider) updateSliderTrack(sSlider);

    // Update labels
    const bv = parseInt(bSlider?.value || 0);
    const cv = parseInt(cSlider?.value || 0);
    const sv = parseInt(sSlider?.value || 0);
    $('brightnessVal').textContent = bv > 0 ? `+${bv}` : bv;
    $('contrastVal').textContent = cv > 0 ? `+${cv}` : cv;
    $('saturationVal').textContent = sv > 0 ? `+${sv}` : sv;

    clearTimeout(_adjustTimer);
    _adjustTimer = setTimeout(() => {
        const canvas = $('editorCanvas');
        const ctx = canvas.getContext('2d');

        // Redraw fresh from original image + current filter
        ctx.drawImage(state.currentImage, 0, 0, canvas.width, canvas.height);
        if (state.currentFilter !== 'original') applyFilterToCanvas(state.currentFilter);

        // Now apply slider adjustments on top
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = imageData.data;
        const brightness = bv;                        // -100..100
        const contrast = (cv + 100) / 100;          // 0..2
        const saturation = (sv + 100) / 100;          // 0..2

        for (let i = 0; i < d.length; i += 4) {
            let r = d[i], g = d[i + 1], b = d[i + 2];

            // Brightness
            r += brightness; g += brightness; b += brightness;

            // Contrast (pivot at 128)
            r = contrast * (r - 128) + 128;
            g = contrast * (g - 128) + 128;
            b = contrast * (b - 128) + 128;

            // Saturation via luminance
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            r = lum + saturation * (r - lum);
            g = lum + saturation * (g - lum);
            b = lum + saturation * (b - lum);

            d[i] = Math.max(0, Math.min(255, r));
            d[i + 1] = Math.max(0, Math.min(255, g));
            d[i + 2] = Math.max(0, Math.min(255, b));
        }
        ctx.putImageData(imageData, 0, 0);
        updateCropOverlay();
    }, 60);
}

function resetAdjustments() {
    ['brightnessSlider', 'contrastSlider', 'saturationSlider'].forEach(id => {
        const s = $(id);
        if (s) {
            s.value = 0;
            updateSliderTrack(s);
        }
    });
    ['brightnessVal', 'contrastVal', 'saturationVal'].forEach(id => { $(id).textContent = '0'; });
    // Redraw without adjustments
    drawImageToCanvas();
}

// ============================================
// Canvas Zoom / Pan (pinch-to-zoom + drag)
// ============================================
(function setupCanvasZoomPan() {
    const getCanvas = () => $('editorCanvas');
    let scale = 1, panX = 0, panY = 0;
    let lastTouchDist = null, lastPanTouch = null;
    let isPinching = false;

    function applyTransform(canvas) {
        canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
        canvas.style.transformOrigin = '50% 50%';
    }

    function resetZoom() { scale = 1; panX = 0; panY = 0; }

    document.addEventListener('touchstart', e => {
        const canvas = getCanvas();
        if (!canvas || !canvas.getBoundingClientRect) return;
        const rect = canvas.getBoundingClientRect();
        // Only act when touching over the canvas area in non-crop mode
        const firstTouch = e.touches[0];
        if (firstTouch.clientX < rect.left || firstTouch.clientX > rect.right) return;
        if (firstTouch.clientY < rect.top || firstTouch.clientY > rect.bottom) return;

        if (e.touches.length === 2) {
            isPinching = true;
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            lastTouchDist = Math.hypot(dx, dy);
        } else if (e.touches.length === 1 && scale > 1) {
            lastPanTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
    }, { passive: true });

    document.addEventListener('touchmove', e => {
        const canvas = getCanvas();
        if (!canvas) return;
        if (e.touches.length === 2) {
            e.preventDefault();
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const dist = Math.hypot(dx, dy);
            if (lastTouchDist) {
                const delta = dist / lastTouchDist;
                scale = Math.max(1, Math.min(5, scale * delta));
            }
            lastTouchDist = dist;
            applyTransform(canvas);
        } else if (e.touches.length === 1 && scale > 1 && lastPanTouch) {
            e.preventDefault();
            const dx = e.touches[0].clientX - lastPanTouch.x;
            const dy = e.touches[0].clientY - lastPanTouch.y;
            panX += dx; panY += dy;
            lastPanTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            applyTransform(canvas);
        }
    }, { passive: false });

    document.addEventListener('touchend', e => {
        if (e.touches.length < 2) { lastTouchDist = null; isPinching = false; }
        if (e.touches.length === 0) lastPanTouch = null;
    });

    // Double tap to reset zoom
    let lastTap = 0;
    document.addEventListener('touchend', e => {
        const canvas = getCanvas();
        if (!canvas) return;
        const now = Date.now();
        if (now - lastTap < 300 && e.changedTouches.length === 1) {
            const rect = canvas.getBoundingClientRect();
            const t = e.changedTouches[0];
            if (t.clientX >= rect.left && t.clientX <= rect.right &&
                t.clientY >= rect.top && t.clientY <= rect.bottom) {
                resetZoom();
                canvas.style.transform = '';
            }
        }
        lastTap = now;
    });

    // Reset zoom when editor closes / tab switches
    const origClose = window.closeModal || (() => { });
    window._zoomResetFn = resetZoom;
})();

// ============================================
// Finish Editing
// ============================================
function finishEditing() {
    if (typeof confirmSignaturePlacement === 'function' && $('signatureOverlayBox')) {
        confirmSignaturePlacement();
    }
    showLoading('Processando...');

    setTimeout(() => {
        const croppedImage = getCroppedImage();
        hideLoading();
        closeModal('editorModal');

        if (state.multiPageImages.length > 0) {
            // Already has pages — go straight to multi-page modal
            state.multiPageImages.push(croppedImage);
            runLaserScan(() => {
                hideLoading();
                closeModal('editorModal');
                openMultiPageModal();
            });
        } else {
            // First page — ask with elegant dialog
            state.multiPageImages = [croppedImage];
            runLaserScan(() => {
                hideLoading();
                closeModal('editorModal');
                showMultiPageDialog(croppedImage);
            });
        }
    }, 300);
}

/** 
 * Triggers a professional laser scan animation over the editor canvas 
 */
function runLaserScan(callback) {
    const line = $('laserScanLine');
    if (!line) {
        if (callback) callback();
        return;
    }

    triggerHaptic(50);
    line.classList.add('animating');

    // Wait for the 2s animation to finish
    setTimeout(() => {
        line.classList.remove('animating');
        if (callback) callback();
    }, 2000);
}

/** 
 * Utility to trigger haptic feedback (vibration) 
 */
function triggerHaptic(type = 'light') {
    if (!('vibrate' in navigator)) return;
    try {
        if (typeof type === 'number') {
            navigator.vibrate(type);
        } else if (Array.isArray(type)) {
            navigator.vibrate(type);
        } else if (type === 'light') {
            navigator.vibrate(15);
        } else if (type === 'medium') {
            navigator.vibrate(30);
        } else if (type === 'success') {
            navigator.vibrate([20, 50, 20]);
        } else if (type === 'error' || type === 'warning') {
            navigator.vibrate([40, 40, 40]);
        }
    } catch (e) {}
}

/** Diálogo de escolha: salvar agora ou adicionar outra página */
function showMultiPageDialog(croppedImage) {
    const overlay = document.createElement('div');
    overlay.className = 'multipage-dialog-overlay';
    overlay.innerHTML = `
        <div class="multipage-dialog">
            <div class="multipage-dialog-preview">
                <img src="${croppedImage}" alt="Prévia">
            </div>
            <h3>Documento escaneado!</h3>
            <p>O que deseja fazer?</p>
            <div class="multipage-dialog-actions">
                <button class="mpdialog-btn primary" id="mpdSave">
                    <svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                    Salvar agora
                </button>
                <button class="mpdialog-btn" id="mpdAddPage">
                    <svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
                    Adicionar página
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('open'));

    const close = () => { overlay.classList.remove('open'); setTimeout(() => overlay.remove(), 300); };

    overlay.querySelector('#mpdSave').onclick = () => { close(); openSaveModal(); };
    overlay.querySelector('#mpdAddPage').onclick = () => {
        close();
        openMultiPageModal();
        // Abre captura para nova página
        setTimeout(() => openModal('captureModal'), 400);
    };
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
}

function getCroppedImage() {
    const originalImg = state.originalImage;
    if (!originalImg) return null;

    const { tl, tr, bl, br } = state.cropPoints;
    const fullW = originalImg.width;
    const fullH = originalImg.height;

    // Convert normalized corner coordinates to full resolution
    const pts = {
        tl: { x: (tl.x / 100) * fullW, y: (tl.y / 100) * fullH },
        tr: { x: (tr.x / 100) * fullW, y: (tr.y / 100) * fullH },
        bl: { x: (bl.x / 100) * fullW, y: (bl.y / 100) * fullH },
        br: { x: (br.x / 100) * fullW, y: (br.y / 100) * fullH }
    };

    // Calculate true output size
    const outW = Math.round(Math.max(
        Math.hypot(pts.tr.x - pts.tl.x, pts.tr.y - pts.tl.y),
        Math.hypot(pts.br.x - pts.bl.x, pts.br.y - pts.bl.y)
    ));
    const outH = Math.round(Math.max(
        Math.hypot(pts.bl.x - pts.tl.x, pts.bl.y - pts.tl.y),
        Math.hypot(pts.br.x - pts.tr.x, pts.br.y - pts.tr.y)
    ));

    const destCanvas = document.createElement('canvas');
    destCanvas.width = outW;
    destCanvas.height = outH;

    let warpedWithOpenCV = false;

    // 1. OpenCV High-Precision Perspective Warp with INTER_CUBIC
    if (typeof cv !== 'undefined' && cv.Mat) {
        try {
            const srcCanvas = document.createElement('canvas');
            srcCanvas.width = fullW;
            srcCanvas.height = fullH;
            const srcCtx = srcCanvas.getContext('2d');
            srcCtx.drawImage(originalImg, 0, 0);

            const src = cv.imread(srcCanvas);
            const dst = new cv.Mat();

            const srcCoords = cv.matFromArray(4, 1, cv.CV_32FC2, [
                pts.tl.x, pts.tl.y,
                pts.tr.x, pts.tr.y,
                pts.br.x, pts.br.y,
                pts.bl.x, pts.bl.y
            ]);

            const dstCoords = cv.matFromArray(4, 1, cv.CV_32FC2, [
                0, 0,
                outW, 0,
                outW, outH,
                0, outH
            ]);

            const M = cv.getPerspectiveTransform(srcCoords, dstCoords);
            cv.warpPerspective(src, dst, M, new cv.Size(outW, outH), cv.INTER_CUBIC, cv.BORDER_REPLICATE);

            cv.imshow(destCanvas, dst);

            src.delete();
            dst.delete();
            srcCoords.delete();
            dstCoords.delete();
            M.delete();
            warpedWithOpenCV = true;
        } catch (e) {
            console.warn('OpenCV warpPerspective fallback:', e);
        }
    }

    // 2. High-Res Bilinear Fallback if OpenCV is busy
    if (!warpedWithOpenCV) {
        const srcCanvas = document.createElement('canvas');
        srcCanvas.width = fullW;
        srcCanvas.height = fullH;
        const srcCtx = srcCanvas.getContext('2d');
        srcCtx.drawImage(originalImg, 0, 0);
        const srcData = srcCtx.getImageData(0, 0, fullW, fullH).data;

        const destCtx = destCanvas.getContext('2d');
        const destImageData = destCtx.createImageData(outW, outH);
        const destData = destImageData.data;

        const qTl = pts.tl, qTr = pts.tr, qBl = pts.bl, qBr = pts.br;

        for (let dy = 0; dy < outH; dy++) {
            const t = dy / (outH - 1 || 1);
            for (let dx = 0; dx < outW; dx++) {
                const s = dx / (outW - 1 || 1);
                const sx = (1 - t) * ((1 - s) * qTl.x + s * qTr.x) + t * ((1 - s) * qBl.x + s * qBr.x);
                const sy = (1 - t) * ((1 - s) * qTl.y + s * qTr.y) + t * ((1 - s) * qBl.y + s * qBr.y);

                const x0 = Math.floor(sx), y0 = Math.floor(sy);
                const x1 = Math.min(x0 + 1, fullW - 1), y1 = Math.min(y0 + 1, fullH - 1);
                const fx = sx - x0, fy = sy - y0;

                if (x0 < 0 || y0 < 0 || x0 >= fullW || y0 >= fullH) continue;

                const i00 = (y0 * fullW + x0) * 4, i10 = (y0 * fullW + x1) * 4;
                const i01 = (y1 * fullW + x0) * 4, i11 = (y1 * fullW + x1) * 4;
                const di = (dy * outW + dx) * 4;

                for (let c = 0; c < 3; c++) {
                    destData[di + c] =
                        srcData[i00 + c] * (1 - fx) * (1 - fy) +
                        srcData[i10 + c] * fx * (1 - fy) +
                        srcData[i01 + c] * (1 - fx) * fy +
                        srcData[i11 + c] * fx * fy;
                }
                destData[di + 3] = 255;
            }
        }
        destCtx.putImageData(destImageData, 0, 0);
    }

    // Apply CamScanner Magic Color & filters at full resolution
    if (state.currentFilter !== 'original') {
        applyFilterToHighRes(destCanvas, state.currentFilter);
    }

    return destCanvas.toDataURL('image/jpeg', 0.98);
}

/** Applies filter directly to a canvas (used for high-res final processing) */
function applyFilterToHighRes(canvas, filterName) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;

    switch (filterName) {
        case 'grayscale':
            for (let i = 0; i < data.length; i += 4) {
                const avg = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                data[i] = data[i + 1] = data[i + 2] = avg;
            }
            break;

        case 'contrast':
            for (let i = 0; i < data.length; i += 4) {
                data[i] = Math.min(255, Math.max(0, 1.5 * (data[i] - 128) + 128));
                data[i + 1] = Math.min(255, Math.max(0, 1.5 * (data[i + 1] - 128) + 128));
                data[i + 2] = Math.min(255, Math.max(0, 1.5 * (data[i + 2] - 128) + 128));
            }
            break;

        case 'document':
            for (let i = 0; i < data.length; i += 4) {
                const avg = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                const threshold = avg > 175 ? 255 : avg < 85 ? 0 : avg * 1.35;
                data[i] = data[i + 1] = data[i + 2] = Math.min(255, threshold);
            }
            break;

        case 'magic': {
            // CamScanner Magic Color V3 (High-Pass Text Unsharp + Adaptive Illumination Whitening + Vivid Colors)
            const lumMap = new Float32Array(w * h);
            for (let i = 0, p = 0; i < data.length; i += 4, p++) {
                lumMap[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            }

            const orig = new Uint8ClampedArray(data);
            const sharpen = 0.40;

            for (let y = 1; y < h - 1; y++) {
                for (let x = 1; x < w - 1; x++) {
                    const idx = (y * w + x) * 4;
                    const p = y * w + x;
                    const lum = lumMap[p];

                    const localAvg = (lumMap[(y - 1) * w + x] + lumMap[(y + 1) * w + x] + lumMap[y * w + (x - 1)] + lumMap[y * w + (x + 1)]) / 4;

                    for (let c = 0; c < 3; c++) {
                        let val = orig[idx + c];

                        // Laplacian high-pass sharpening (zero blur on letters)
                        const laplacian = (val * 4) - (
                            orig[((y - 1) * w + x) * 4 + c] +
                            orig[((y + 1) * w + x) * 4 + c] +
                            orig[(y * w + (x - 1)) * 4 + c] +
                            orig[(y * w + (x + 1)) * 4 + c]
                        );
                        val = val + laplacian * sharpen;

                        // Adaptive paper whitening
                        if (lum > localAvg - 8 && lum > 115) {
                            const boost = 1 + Math.pow((lum - 115) / 140, 1.1) * 1.3;
                            val = val * boost + 25;
                        } else if (lum < 95) {
                            // Dark text & barcodes
                            const darken = Math.max(0.35, Math.pow(lum / 95, 1.3));
                            val = val * darken * 0.85;
                        } else {
                            val = 1.45 * (val - 128) + 128;
                        }

                        data[idx + c] = Math.max(0, Math.min(255, val));
                    }
                }
            }
            break;
        }

        case 'magic_bw': {
            // CamScanner Pure Black & White (Sauvola local window thresholding)
            const lum = new Float32Array(w * h);
            for (let i = 0, p = 0; i < data.length; i += 4, p++) {
                lum[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            }

            const step = 8;
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    const p = y * w + x;
                    const l = lum[p];

                    const x0 = Math.max(0, x - step), x1 = Math.min(w - 1, x + step);
                    const y0 = Math.max(0, y - step), y1 = Math.min(h - 1, y + step);
                    const localMean = (lum[y0 * w + x] + lum[y1 * w + x] + lum[y * w + x0] + lum[y * w + x1] + l * 2) / 6;

                    const val = l < (localMean - 7) ? 0 : 255;
                    const idx = p * 4;
                    data[idx] = data[idx + 1] = data[idx + 2] = val;
                }
            }
            break;
        }
    }

    ctx.putImageData(imageData, 0, 0);
}

// ============================================
// Multi-Page
// ============================================
function openMultiPageModal() {
    updatePagesGrid();
    openModal('multiPageModal');
}

function updatePagesGrid() {
    window.renderPagesGrid = updatePagesGrid;
    const grid = $('pagesGrid');

    grid.innerHTML = state.multiPageImages.map((img, i) => `
        <div class="page-item" data-index="${i}">
            <div class="page-drag-handle" title="Arrastar para reordenar">
                <svg viewBox="0 0 24 24"><path d="M11 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm-2-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
            </div>
            <img src="${img}" alt="Página ${i + 1}">
            <span class="page-number">${i + 1}</span>
            <button class="page-remove" onclick="removePage(${i})">
                <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
            </button>
        </div>
    `).join('');

    setupPagesDragDrop();
}

function setupPagesDragDrop() {
    const grid = $('pagesGrid');
    const items = [...grid.querySelectorAll('.page-item')];
    let dragging = null, dragIndex = -1, overIndex = -1;
    let ghost = null, startX = 0, startY = 0;

    items.forEach(item => {
        const handle = item.querySelector('.page-drag-handle');

        handle.addEventListener('touchstart', e => {
            e.stopPropagation();
            const touch = e.touches[0];
            startX = touch.clientX;
            startY = touch.clientY;
            dragIndex = parseInt(item.dataset.index);

            // Haptic feedback
            navigator.vibrate?.(30);

            // Create ghost
            const rect = item.getBoundingClientRect();
            ghost = item.cloneNode(true);
            ghost.style.cssText = `
                position:fixed; left:${rect.left}px; top:${rect.top}px;
                width:${rect.width}px; height:${rect.height}px;
                opacity:0.85; border-radius:12px; z-index:9999;
                box-shadow:0 12px 40px rgba(0,0,0,0.5);
                pointer-events:none; transition:none;
                transform:scale(1.05);
            `;
            document.body.appendChild(ghost);

            item.classList.add('drag-source');
            dragging = item;
        }, { passive: true });
    });

    document.addEventListener('touchmove', e => {
        if (!ghost || !dragging) return;
        e.preventDefault();
        const touch = e.touches[0];
        const dx = touch.clientX - startX;
        const dy = touch.clientY - startY;

        ghost.style.transform = `translate(${dx}px, ${dy}px) scale(1.05)`;

        // Find which item we're over
        const els = grid.querySelectorAll('.page-item:not(.drag-source)');
        overIndex = dragIndex;
        els.forEach(el => {
            const rect = el.getBoundingClientRect();
            if (touch.clientX >= rect.left && touch.clientX <= rect.right &&
                touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
                overIndex = parseInt(el.dataset.index);
                el.classList.add('drag-over');
            } else {
                el.classList.remove('drag-over');
            }
        });
    }, { passive: false });

    document.addEventListener('touchend', e => {
        if (!ghost || !dragging) return;

        // Remove ghost and classes
        ghost.remove(); ghost = null;
        grid.querySelectorAll('.drag-source, .drag-over').forEach(el => {
            el.classList.remove('drag-source', 'drag-over');
        });

        // Reorder array
        if (overIndex !== -1 && overIndex !== dragIndex) {
            const moved = state.multiPageImages.splice(dragIndex, 1)[0];
            state.multiPageImages.splice(overIndex, 0, moved);
            updatePagesGrid();
            showToast('Página reordenada!', 'success');
        }

        dragging = null; dragIndex = -1; overIndex = -1;
    }, { passive: true });
}

function removePage(index) {
    state.multiPageImages.splice(index, 1);
    updatePagesGrid();

    if (state.multiPageImages.length === 0) {
        closeModal('multiPageModal');
    }
}

function generateMultiPagePdf() {
    closeModal('multiPageModal');
    openSaveModal();

    // Force PDF format for multi-page
    if (state.multiPageImages.length > 1) {
        $$('.format-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.format === 'pdf');
        });
    }
}

// ============================================
// Save Document
// ============================================
function openSaveModal() {
    const now = new Date();
    const timestamp = formatTimestamp(now);
    const smartName = state.lastOcrText ? suggestSmartDocumentName(state.lastOcrText) : null;
    $('docNameInput').value = smartName || `scan-${timestamp}`;
    $('folderSelect').value = state.currentFolder;
    openModal('saveModal');
}

function suggestSmartDocumentName(text) {
    if (!text || typeof text !== 'string') return null;

    const upper = text.toUpperCase();
    let docType = null;

    if (upper.includes('NOTA FISCAL') || upper.includes('DANFE') || upper.includes('NFC-E') || upper.includes('NF-E')) {
        docType = 'Nota_Fiscal';
    } else if (upper.includes('CUPOM FISCAL') || upper.includes('EXTRATO SAT')) {
        docType = 'Cupom_Fiscal';
    } else if (upper.includes('RECIBO')) {
        docType = 'Recibo';
    } else if (upper.includes('CONTRATO')) {
        docType = 'Contrato';
    } else if (upper.includes('BOLETO') || upper.includes('FATURA') || upper.includes('DUPLICATA')) {
        docType = 'Boleto_Fatura';
    } else if (upper.includes('CARTEIRA NACIONAL DE HABILITACAO') || upper.includes('HABILITACAO') || upper.includes('CNH')) {
        docType = 'CNH';
    } else if (upper.includes('REGISTRO GERAL') || upper.includes('IDENTIDADE')) {
        docType = 'RG';
    } else if (upper.includes('CERTIDAO')) {
        docType = 'Certidao';
    } else if (upper.includes('COMPROVANTE')) {
        docType = 'Comprovante';
    } else if (upper.includes('RELATORIO') || upper.includes('ORCAMENTO')) {
        docType = 'Orcamento';
    }

    if (!docType) return null;

    // Detect date DD/MM/YYYY or DD-MM-YYYY
    const dateMatch = text.match(/\b([0-3]?\d)[\/\-.]([0-1]?\d)[\/\-.](\d{4})\b/);
    let dateSuffix = '';
    if (dateMatch) {
        const day = dateMatch[1].padStart(2, '0');
        const month = dateMatch[2].padStart(2, '0');
        const year = dateMatch[3];
        dateSuffix = `_${year}-${month}-${day}`;
    } else {
        const now = new Date();
        const pad = n => n.toString().padStart(2, '0');
        dateSuffix = `_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    }

    return `${docType}${dateSuffix}`;
}

function formatTimestamp(date) {
    const pad = n => n.toString().padStart(2, '0');
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

async function saveDocument(target) {
    const name = $('docNameInput').value || `scan-${formatTimestamp(new Date())}`;
    const formatBtn = document.querySelector('.format-btn.active');
    const format = formatBtn ? formatBtn.dataset.format : 'pdf';
    const folder = $('folderSelect') ? $('folderSelect').value : 'root';

    showLoading('Salvando...');

    try {
        let imagesToSave = state.multiPageImages && state.multiPageImages.length > 0
            ? state.multiPageImages
            : [];

        if (imagesToSave.length === 0) {
            const canvas = $('editorCanvas');
            if (canvas && canvas.width) {
                imagesToSave = [canvas.toDataURL('image/jpeg', 0.9)];
            } else if (state.originalImage) {
                imagesToSave = [state.originalImage.src];
            }
        }

        if (imagesToSave.length === 0) {
            throw new Error('Nenhuma imagem encontrada para salvar. Escaneie um documento primeiro.');
        }

        let fileData, fileName, mimeType;

        if (format === 'pdf' || imagesToSave.length > 1) {
            const pdfData = await generatePdf(imagesToSave);
            fileData = pdfData;
            fileName = `${name}.pdf`;
            mimeType = 'application/pdf';
        } else {
            fileData = imagesToSave[0];
            fileName = `${name}.jpg`;
            mimeType = 'image/jpeg';
        }

        // Create document record
        const doc = {
            id: generateId(),
            name: fileName,
            image: imagesToSave[0],
            thumbnail: createThumbnailFromCanvas() || imagesToSave[0],
            folder: folder,
            date: new Date().toISOString(),
            format: format,
            pageCount: imagesToSave.length
        };

        // Download locally if target requires
        if (target === 'local' || target === 'both') {
            downloadFile(fileData, fileName, mimeType);
        }

        let driveUploadSuccess = false;
        let driveErrorMsg = null;

        // Upload to Drive if target requires
        if (target === 'drive' || target === 'both') {
            if (state.driveConnected && navigator.onLine) {
                try {
                    const uploadResult = await uploadToDrive(fileData, fileName, mimeType);
                    if (uploadResult && uploadResult.id) {
                        doc.driveId = uploadResult.id;
                        driveUploadSuccess = true;
                    }
                } catch (dErr) {
                    console.warn('Erro ao enviar para o Drive na hora de salvar:', dErr);
                    driveErrorMsg = dErr.message;
                    // Queue for later sync
                    const pending = {
                        id: generateId(),
                        name: fileName,
                        data: fileData,
                        mimeType: mimeType,
                        timestamp: new Date().toISOString()
                    };
                    await saveToStore('pending', pending);
                    state.pendingUploads.push(pending);
                    updatePendingBadge();
                }
            } else {
                // Queue for later
                const pending = {
                    id: generateId(),
                    name: fileName,
                    data: fileData,
                    mimeType: mimeType,
                    timestamp: new Date().toISOString()
                };
                await saveToStore('pending', pending);
                state.pendingUploads.push(pending);
                updatePendingBadge();
            }
        }

        // Save to IndexedDB (always persist locally so user never loses work!)
        await saveToStore('documents', doc);
        state.documents.push(doc);

        closeModal('saveModal');
        state.multiPageImages = [];
        updateUI();
        hideLoading();
        showSaveSuccessAnimation();

        if (target === 'drive' && !driveUploadSuccess) {
            if (driveErrorMsg && driveErrorMsg.includes('Google Drive API')) {
                showDriveApiActivationModal();
            } else {
                showToast(driveErrorMsg || 'Salvo no aparelho! Upload no Drive pendente.', 'warning');
            }
        } else if (target === 'both' && !driveUploadSuccess) {
            if (driveErrorMsg && driveErrorMsg.includes('Google Drive API')) {
                showToast('Salvo no aparelho! Ative a Google Drive API no Google Cloud para enviar à nuvem.', 'warning');
                showDriveApiActivationModal();
            } else {
                showToast('Salvo no aparelho! Upload no Drive pendente.', 'info');
            }
        } else {
            showToast('Documento salvo com sucesso! ✓', 'success');
        }

    } catch (error) {
        console.error('Save error:', error);
        hideLoading();
        showToast('Erro ao salvar: ' + (error.message || 'Tente novamente'), 'error');
    }
}

function showDriveApiActivationModal() {
    if (typeof Swal === 'undefined') {
        window.open('https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=569266864432', '_blank');
        return;
    }
    Swal.fire({
        icon: 'warning',
        title: 'Ativar Google Drive API',
        html: `
            <div style="text-align: left; font-size: 14px; line-height: 1.6;">
                <p>O Google Cloud exige que a <strong>Google Drive API</strong> seja ativada no seu projeto <code>569266864432</code> para salvar e sincronizar na nuvem.</p>
                <p style="margin-top: 10px;">Toque no botão abaixo para abrir a página do Google Cloud e clique em <strong>ATIVAR (ENABLE)</strong>:</p>
            </div>
        `,
        confirmButtonText: '🔗 Abrir Google Cloud para Ativar',
        confirmButtonColor: '#10b981',
        showCancelButton: true,
        cancelButtonText: 'Mais tarde'
    }).then(res => {
        if (res.isConfirmed) {
            window.open('https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=569266864432', '_blank');
        }
    });
}

async function generatePdf(images) {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();

    for (let i = 0; i < images.length; i++) {
        if (i > 0) pdf.addPage();

        const img = new Image();
        await new Promise(resolve => {
            img.onload = resolve;
            img.src = images[i];
        });

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();

        const imgRatio = img.width / img.height;
        const pageRatio = pageWidth / pageHeight;

        let width, height;
        if (imgRatio > pageRatio) {
            width = pageWidth - 20;
            height = width / imgRatio;
        } else {
            height = pageHeight - 20;
            width = height * imgRatio;
        }

        const x = (pageWidth - width) / 2;
        const y = (pageHeight - height) / 2;

        pdf.addImage(images[i], 'JPEG', x, y, width, height);
    }

    return pdf.output('datauristring');
}

/** Create thumbnail from already-cropped/processed image data */
function createThumbnailFromCanvas() {
    // Use the cropped, processed image (first page) if available — this is what the user sees
    const processedImage = state.multiPageImages && state.multiPageImages.length > 0
        ? state.multiPageImages[0]
        : null;

    if (processedImage) {
        return createThumbnail(processedImage);
    }

    // Fallback: read the canvas (this path is rarely hit)
    const canvas = $('editorCanvas');
    if (!canvas || !canvas.width) return null;
    const maxSize = 200;
    const scale = Math.min(1, maxSize / Math.max(canvas.width, canvas.height));
    const w = Math.round(canvas.width * scale);
    const h = Math.round(canvas.height * scale);
    const tmp = document.createElement('canvas');
    tmp.width = w; tmp.height = h;
    tmp.getContext('2d').drawImage(canvas, 0, 0, w, h);
    return tmp.toDataURL('image/jpeg', 0.65);
}

function createThumbnail(imageData) {
    const img = new Image();
    img.src = imageData;
    const canvas = document.createElement('canvas');
    const maxSize = 200;
    let width = img.width || 200;
    let height = img.height || 200;
    if (width > height) {
        if (width > maxSize) { height = (height * maxSize) / width; width = maxSize; }
    } else {
        if (height > maxSize) { width = (width * maxSize) / height; height = maxSize; }
    }
    canvas.width = width; canvas.height = height;
    canvas.getContext('2d').drawImage(img, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', 0.6);
}

/** Animated success overlay after saving a document */
function showSaveSuccessAnimation() {
    const el = document.createElement('div');
    el.className = 'save-success-anim';
    el.innerHTML = `<div class="save-success-circle"><svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="25" fill="none"/><path fill="none" d="M14 27l8 8 16-16"/></svg></div><span>Salvo!</span>`;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 500); }, 2000);
}

function downloadFile(data, fileName, mimeType) {
    const link = document.createElement('a');

    if (mimeType === 'application/pdf') {
        link.href = data;
    } else {
        link.href = data;
    }

    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ============================================
// Folder Management
// ============================================
function openFolderModal(folder = null) {
    state.editingDocId = folder?.id || null;
    $('folderModalTitle').textContent = folder ? 'Renomear Pasta' : 'Nova Pasta';
    $('folderNameInput').value = folder?.name || '';
    openModal('folderModal');
}

async function saveFolder() {
    const name = $('folderNameInput').value.trim();
    if (!name) {
        showToast('Digite um nome para a pasta', 'error');
        return;
    }

    if (state.editingDocId) {
        // Update existing folder
        const folder = state.folders.find(f => f.id === state.editingDocId);
        if (folder) {
            folder.name = name;
            await saveToStore('folders', folder);
        }
    } else {
        // Create new folder
        const folder = {
            id: generateId(),
            name: name,
            parent: state.currentFolder,
            date: new Date().toISOString()
        };
        await saveToStore('folders', folder);
        state.folders.push(folder);
    }

    closeModal('folderModal');
    updateUI();
    showToast('Pasta salva com sucesso!', 'success');
}

function showFoldersView() {
    navigateToFolder('root');
}

// ============================================
// Context Menu
// ============================================
function showContextMenu(event, type, id) {
    event.preventDefault();
    event.stopPropagation();

    state.contextTarget = { type, id };

    const menu = $('contextMenu');
    menu.classList.remove('hidden');

    // Position menu
    let x = event.clientX || event.touches?.[0]?.clientX || 0;
    let y = event.clientY || event.touches?.[0]?.clientY || 0;

    // Adjust if menu would go off screen
    const menuRect = menu.getBoundingClientRect();
    if (x + menuRect.width > window.innerWidth) {
        x = window.innerWidth - menuRect.width - 10;
    }
    if (y + menuRect.height > window.innerHeight) {
        y = window.innerHeight - menuRect.height - 10;
    }

    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    // Show/hide lock options
    const lockOpt = $('lockFolderOption');
    const unlockOpt = $('unlockFolderOption');
    if (type === 'folder') {
        const folder = state.folders.find(f => f.id === id);
        lockOpt.classList.toggle('hidden', folder.isLocked);
        unlockOpt.classList.toggle('hidden', !folder.isLocked);
    } else {
        lockOpt.classList.add('hidden');
        unlockOpt.classList.add('hidden');
    }
}

async function handleContextAction(action) {
    const { type, id } = state.contextTarget;
    $('contextMenu').classList.add('hidden');

    switch (action) {
        case 'view':
            if (type === 'doc') viewDocument(id);
            else navigateToFolder(id);
            break;

        case 'favorite':
            if (type === 'doc') {
                await toggleFavorite(id);
            }
            break;

        case 'share':
            if (type === 'doc') {
                const doc = state.documents.find(d => d.id === id);
                if (doc) shareDocument(doc);
            }
            break;

        case 'rename':
            if (type === 'folder') {
                const folder = state.folders.find(f => f.id === id);
                openFolderModal(folder);
            } else {
                const doc = state.documents.find(d => d.id === id);
                const newName = prompt(t('prompt_new_name') || 'Novo nome:', doc.name);
                if (newName) {
                    doc.name = newName;
                    await saveToStore('documents', doc);
                    updateUI();
                }
            }
            break;

        case 'move':
            openMoveModal(type, id);
            break;

        case 'download':
            if (type === 'doc') {
                const doc = state.documents.find(d => d.id === id);
                downloadFile(doc.image, doc.name, 'image/jpeg');
            }
            break;

        case 'ocr':
            if (type === 'doc') {
                const doc = state.documents.find(d => d.id === id);
                if (doc && doc.image) {
                    extractTextFromImage(doc.image);
                }
            }
            break;

        case 'drive':
            if (type === 'doc') {
                const doc = state.documents.find(d => d.id === id);
                if (state.driveConnected && navigator.onLine) {
                    showLoading(currentLang === 'en' ? 'Uploading to Drive...' : 'Enviando para Drive...');
                    await uploadToDrive(doc.image, doc.name, 'image/jpeg');
                    hideLoading();
                    showToast(currentLang === 'en' ? 'Saved to Google Drive!' : 'Enviado para o Google Drive!', 'success');
                } else {
                    showToast(currentLang === 'en' ? 'Connect to Google Drive first' : 'Conecte ao Google Drive primeiro', 'error');
                }
            }
            break;

        case 'lock':
            openPinModal('set');
            break;

        case 'unlock':
            openPinModal('unlock');
            break;

        case 'delete':
            if (confirm(t('confirm_delete_item') || 'Tem certeza que deseja excluir?')) {
                if (type === 'folder') {
                    await deleteFolder(id);
                } else {
                    await deleteDocument(id);
                }
            }
            break;
    }
}

async function deleteFolder(id) {
    // Move documents to root
    for (const doc of state.documents.filter(d => d.folder === id)) {
        doc.folder = 'root';
        await saveToStore('documents', doc);
    }

    // Delete subfolders
    for (const folder of state.folders.filter(f => f.parent === id)) {
        await deleteFolder(folder.id);
    }

    // Delete folder
    await deleteFromStore('folders', id);
    state.folders = state.folders.filter(f => f.id !== id);

    updateUI();
    showToast('Pasta excluída', 'success');
}

// Tombstones de exclusão para evitar que arquivos deletados ressuscitem no 2-Way Sync
function getTombstoneDeleted() {
    try {
        return JSON.parse(localStorage.getItem('docscan_deleted_records') || '[]');
    } catch (e) {
        return [];
    }
}

function addTombstoneDeleted(id, driveId, name) {
    try {
        const list = getTombstoneDeleted();
        if (id) list.push(String(id));
        if (driveId) list.push(String(driveId));
        if (name) list.push(String(name).toLowerCase().trim());
        const unique = [...new Set(list)].slice(-500);
        localStorage.setItem('docscan_deleted_records', JSON.stringify(unique));
    } catch (e) {}
}

async function deleteDocument(id) {
    const doc = state.documents.find(d => d.id === id);
    if (doc) {
        addTombstoneDeleted(doc.id, doc.driveId, doc.name);

        if (state.driveConnected && state.driveToken) {
            try {
                if (doc.driveId) {
                    await fetch(`https://www.googleapis.com/drive/v3/files/${doc.driveId}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${state.driveToken}` }
                    });
                    console.log(`[DocScan] Arquivo ${doc.name} (${doc.driveId}) excluído do Google Drive.`);
                } else if (doc.name) {
                    // Buscar por nome e deletar do Google Drive
                    const q = encodeURIComponent(`name = '${doc.name}' and trashed = false`);
                    const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)`, {
                        headers: { 'Authorization': `Bearer ${state.driveToken}` }
                    });
                    if (searchRes.ok) {
                        const sData = await searchRes.json();
                        for (const f of (sData.files || [])) {
                            await fetch(`https://www.googleapis.com/drive/v3/files/${f.id}`, {
                                method: 'DELETE',
                                headers: { 'Authorization': `Bearer ${state.driveToken}` }
                            });
                            addTombstoneDeleted(null, f.id, null);
                            console.log(`[DocScan] Arquivo ${doc.name} (${f.id}) excluído do Drive por nome.`);
                        }
                    }
                }
            } catch (e) {
                console.warn('Erro ao deletar do Google Drive:', e);
            }
        }
    }
    await deleteFromStore('documents', id);
    state.documents = state.documents.filter(d => d.id !== id);
    updateUI();
    showToast('Documento excluído permanentemente', 'success');
}

// ============================================
// Pinch-to-Zoom & Pan for Document Viewer
// ============================================
let viewerZoom = 1;
let viewerPanX = 0;
let viewerPanY = 0;
let isViewerPanning = false;
let startPanX = 0;
let startPanY = 0;
let initialDistance = 0;
let initialZoom = 1;
let lastTapTime = 0;

function setupViewerZoomPan() {
    const content = $('viewerContent');
    const img = $('viewerImage');
    if (!content || !img) return;

    function updateViewerTransform() {
        if (viewerZoom <= 1) {
            viewerZoom = 1;
            viewerPanX = 0;
            viewerPanY = 0;
        }
        img.style.transform = `translate(${viewerPanX}px, ${viewerPanY}px) scale(${viewerZoom})`;
        img.style.cursor = viewerZoom > 1 ? 'grab' : 'default';
    }

    window.resetViewerZoom = function() {
        viewerZoom = 1;
        viewerPanX = 0;
        viewerPanY = 0;
        if (img) {
            img.style.transition = 'transform 0.25s ease';
            updateViewerTransform();
            setTimeout(() => { if (img) img.style.transition = 'none'; }, 250);
        }
    };

    // Double tap / click to zoom
    content.addEventListener('click', (e) => {
        const now = Date.now();
        if (now - lastTapTime < 300) {
            triggerHaptic('medium');
            img.style.transition = 'transform 0.25s ease';
            if (viewerZoom > 1.2) {
                viewerZoom = 1;
                viewerPanX = 0;
                viewerPanY = 0;
            } else {
                viewerZoom = 2.5;
                const rect = content.getBoundingClientRect();
                const touchX = e.clientX - rect.left - rect.width / 2;
                const touchY = e.clientY - rect.top - rect.height / 2;
                viewerPanX = -touchX * 1.2;
                viewerPanY = -touchY * 1.2;
            }
            updateViewerTransform();
            setTimeout(() => { if (img) img.style.transition = 'none'; }, 250);
        }
        lastTapTime = now;
    });

    // Touch events
    content.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            e.preventDefault();
            initialDistance = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            initialZoom = viewerZoom;
        } else if (e.touches.length === 1 && viewerZoom > 1) {
            isViewerPanning = true;
            startPanX = e.touches[0].clientX - viewerPanX;
            startPanY = e.touches[0].clientY - viewerPanY;
        }
    }, { passive: false });

    content.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2) {
            e.preventDefault();
            const currentDistance = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            if (initialDistance > 0) {
                const scaleFactor = currentDistance / initialDistance;
                viewerZoom = Math.min(Math.max(1, initialZoom * scaleFactor), 5);
                updateViewerTransform();
            }
        } else if (e.touches.length === 1 && isViewerPanning && viewerZoom > 1) {
            e.preventDefault();
            viewerPanX = e.touches[0].clientX - startPanX;
            viewerPanY = e.touches[0].clientY - startPanY;
            updateViewerTransform();
        }
    }, { passive: false });

    content.addEventListener('touchend', (e) => {
        if (e.touches.length < 2) initialDistance = 0;
        if (e.touches.length === 0) isViewerPanning = false;
        if (viewerZoom <= 1) window.resetViewerZoom();
    });

    // Mouse wheel zoom
    content.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.25 : -0.25;
        viewerZoom = Math.min(Math.max(1, viewerZoom + delta), 5);
        if (viewerZoom <= 1) {
            viewerPanX = 0;
            viewerPanY = 0;
        }
        updateViewerTransform();
    }, { passive: false });

    // Desktop mouse pan
    content.addEventListener('mousedown', (e) => {
        if (viewerZoom > 1) {
            isViewerPanning = true;
            startPanX = e.clientX - viewerPanX;
            startPanY = e.clientY - viewerPanY;
            img.style.cursor = 'grabbing';
        }
    });

    window.addEventListener('mousemove', (e) => {
        if (isViewerPanning && viewerZoom > 1) {
            viewerPanX = e.clientX - startPanX;
            viewerPanY = e.clientY - startPanY;
            updateViewerTransform();
        }
    });

    window.addEventListener('mouseup', () => {
        isViewerPanning = false;
        if (img) img.style.cursor = viewerZoom > 1 ? 'grab' : 'default';
    });
}

function viewDocument(id) {
    const doc = state.documents.find(d => d.id === id);
    if (!doc) return;

    if (!doc.pages || !Array.isArray(doc.pages) || doc.pages.length === 0) {
        doc.pages = [doc.image];
    }
    state.viewerDoc = doc;
    state.contextTarget = { type: 'document', id: doc.id };
    state.activePageIndex = 0;

    $('viewerTitle').textContent = doc.name;
    updateViewerPageUI();
    if (window.resetViewerZoom) window.resetViewerZoom();
    openModal('viewerModal');
}

function updateViewerPageUI() {
    const doc = state.viewerDoc;
    if (!doc || !doc.pages) return;

    const pageCount = doc.pages.length;
    const currentIndex = state.activePageIndex || 0;
    const pageImage = doc.pages[currentIndex] || doc.image;

    $('viewerImage').src = pageImage;

    const pageBar = $('viewerPageBar');
    if (pageBar) {
        pageBar.classList.remove('hidden');
        const indicator = $('viewerPageIndicator');
        if (indicator) indicator.textContent = `Página ${currentIndex + 1} de ${pageCount}`;
        const prevBtn = $('viewerPrevPageBtn');
        if (prevBtn) prevBtn.style.opacity = currentIndex > 0 ? '1' : '0.4';
        const nextBtn = $('viewerNextPageBtn');
        if (nextBtn) nextBtn.style.opacity = currentIndex < pageCount - 1 ? '1' : '0.4';
        const delBtn = $('viewerDeletePageBtn');
        if (delBtn) delBtn.style.display = pageCount > 1 ? 'block' : 'none';
    }
}

function viewerNavigatePage(delta) {
    const doc = state.viewerDoc;
    if (!doc || !doc.pages) return;

    const newIndex = (state.activePageIndex || 0) + delta;
    if (newIndex >= 0 && newIndex < doc.pages.length) {
        triggerHaptic('light');
        state.activePageIndex = newIndex;
        updateViewerPageUI();
        if (window.resetViewerZoom) window.resetViewerZoom();
    }
}

async function viewerAddPage() {
    triggerHaptic('medium');
    const result = await Swal.fire({
        title: 'Adicionar Página 📄',
        text: 'Como deseja adicionar a nova página a este documento?',
        icon: 'question',
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonText: '📷 Usar Câmera',
        denyButtonText: '📁 Escolher da Galeria',
        cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
        closeModal('viewerModal');
        state.multiPageTargetDocId = state.viewerDoc.id;
        openModal('captureModal');
    } else if (result.isDenied) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async (ev) => {
                const newImg = ev.target.result;
                state.viewerDoc.pages.push(newImg);
                state.viewerDoc.pageCount = state.viewerDoc.pages.length;
                await saveToStore('documents', state.viewerDoc);
                state.activePageIndex = state.viewerDoc.pages.length - 1;
                updateViewerPageUI();
                updateUI();
                showToast('Nova página adicionada!', 'success');
            };
            reader.readAsDataURL(file);
        };
        input.click();
    }
}

async function viewerDeletePage() {
    const doc = state.viewerDoc;
    if (!doc || !doc.pages || doc.pages.length <= 1) return;

    const res = await Swal.fire({
        title: 'Excluir esta página?',
        text: `Remover a página ${(state.activePageIndex || 0) + 1} de ${doc.pages.length}?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sim, excluir',
        cancelButtonText: 'Cancelar'
    });

    if (res.isConfirmed) {
        triggerHaptic('warning');
        doc.pages.splice(state.activePageIndex, 1);
        doc.pageCount = doc.pages.length;
        if (state.activePageIndex >= doc.pages.length) {
            state.activePageIndex = doc.pages.length - 1;
        }
        doc.image = doc.pages[0];
        doc.thumbnail = doc.pages[0];
        await saveToStore('documents', doc);
        updateViewerPageUI();
        updateUI();
        showToast('Página removida', 'info');
    }
}

// ============================================
// STAMP & WATERMARK SYSTEM
// ============================================
let activeStampConfig = {
    text: 'PAGO ✅',
    color: '#ef4444',
    position: 'bottom-right'
};

function openStampModal() {
    triggerHaptic('light');
    openModal('stampModal');
    setTimeout(updateStampPreview, 100);
}

function selectStampPreset(text, color, btn) {
    triggerHaptic('light');
    $$('.stamp-chip').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');

    if (text === 'DATA_HORA') {
        const now = new Date();
        text = `EMITIDO: ${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    }

    $('stampTextInput').value = text;
    activeStampConfig.text = text;
    activeStampConfig.color = color;
    updateStampPreview();
}

function selectStampColor(color, dot) {
    triggerHaptic('light');
    $$('.stamp-color-picker .color-dot').forEach(d => d.classList.remove('active'));
    if (dot) dot.classList.add('active');
    activeStampConfig.color = color;
    updateStampPreview();
}

function updateStampPreview() {
    const canvas = $('stampPreviewCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const text = $('stampTextInput')?.value || activeStampConfig.text || 'PAGO ✅';
    const color = activeStampConfig.color || '#ef4444';
    const position = $('stampPositionSelect')?.value || 'bottom-right';

    canvas.width = 400;
    canvas.height = 140;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.font = 'bold 22px "Inter", sans-serif';
    const metrics = ctx.measureText(text);
    const boxW = metrics.width + 30;
    const boxH = 46;

    let posX = canvas.width / 2;
    let posY = canvas.height / 2;
    let angle = position === 'center' ? -Math.PI / 12 : 0;

    ctx.translate(posX, posY);
    ctx.rotate(angle);

    // Double border stamp box
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.strokeRect(-boxW / 2, -boxH / 2, boxW, boxH);
    ctx.lineWidth = 1;
    ctx.strokeRect(-boxW / 2 + 4, -boxH / 2 + 4, boxW - 8, boxH - 8);

    // Text
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 0, 1);

    ctx.restore();
}

async function applyStampToActiveDoc() {
    triggerHaptic('success');
    const text = $('stampTextInput')?.value || activeStampConfig.text || 'PAGO ✅';
    const color = activeStampConfig.color || '#ef4444';
    const position = $('stampPositionSelect')?.value || 'bottom-right';

    const doc = state.viewerDoc || state.documents.find(d => d.id === state.contextTarget?.id);
    const viewerImg = $('viewerImage');
    const curIdx = state.activePageIndex || 0;
    const src = (doc && doc.pages && doc.pages[curIdx]) || doc?.image || viewerImg?.src;

    if (!src) {
        showToast('Nenhum documento aberto', 'warning');
        return;
    }

    showLoading('Aplicando carimbo...');
    try {
        let img;
        if (viewerImg && viewerImg.complete && viewerImg.naturalWidth > 0 && viewerImg.src === src) {
            img = viewerImg;
        } else {
            img = await loadImage(src);
        }

        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width || 1200;
        canvas.height = img.naturalHeight || img.height || 1600;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Calculate stamp size proportional to document
        const fontSize = Math.max(28, Math.round(canvas.width * 0.045));
        ctx.font = `bold ${fontSize}px "Inter", sans-serif`;
        const metrics = ctx.measureText(text);
        const boxW = metrics.width + fontSize * 1.2;
        const boxH = fontSize * 1.8;

        let posX = canvas.width / 2;
        let posY = canvas.height / 2;
        let angle = 0;

        if (position === 'center') {
            angle = -Math.PI / 8; // 22.5 deg diagonal
        } else if (position === 'top-right') {
            posX = canvas.width - boxW / 2 - 40;
            posY = boxH / 2 + 40;
        } else if (position === 'bottom-right') {
            posX = canvas.width - boxW / 2 - 40;
            posY = canvas.height - boxH / 2 - 40;
        } else if (position === 'top-left') {
            posX = boxW / 2 + 40;
            posY = boxH / 2 + 40;
        } else if (position === 'bottom-left') {
            posX = boxW / 2 + 40;
            posY = canvas.height - boxH / 2 - 40;
        }

        ctx.save();
        ctx.translate(posX, posY);
        ctx.rotate(angle);

        // Outer box
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(3, Math.round(fontSize * 0.1));
        ctx.strokeRect(-boxW / 2, -boxH / 2, boxW, boxH);
        // Inner box
        ctx.lineWidth = Math.max(1, Math.round(fontSize * 0.04));
        ctx.strokeRect(-boxW / 2 + 5, -boxH / 2 + 5, boxW - 10, boxH - 10);

        // Text
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 0, 2);
        ctx.restore();

        const stampedDataUrl = canvas.toDataURL('image/jpeg', 0.95);
        if (viewerImg) {
            viewerImg.src = stampedDataUrl;
        }

        // Update document in state and DB
        if (doc) {
            if (!doc.pages || !Array.isArray(doc.pages)) {
                doc.pages = [stampedDataUrl];
            } else {
                doc.pages[curIdx] = stampedDataUrl;
            }
            if (curIdx === 0) {
                doc.image = stampedDataUrl;
                doc.thumbnail = stampedDataUrl;
            }
            await saveToStore('documents', doc);
            updateUI();
        }

        hideLoading();
        closeModal('stampModal');
        showToast('Carimbo aplicado com sucesso!', 'success');
    } catch (err) {
        hideLoading();
        console.error('Stamp error:', err);
        showToast('Erro ao aplicar carimbo: ' + err.message, 'error');
    }
}

// ============================================
// I18N — BILINGUAL SYSTEM (PT-BR / EN)
// ============================================
const I18N_DICT = {
    pt: {
        app_title: "DocScan Pro",
        search_ph: "Buscar documentos...",
        all_docs: "Todos os Documentos",
        folders: "Pastas",
        trash: "Lixeira",
        settings: "Configurações",
        sync: "Sincronizar",
        connected: "Conectado",
        disconnected: "Desconectado",
        nav_docs: "Documentos",
        nav_folders: "Pastas",
        nav_trash: "Lixeira",
        nav_settings: "Ajustes",
        home: "Início",
        sort_recent: "Mais recentes",
        sort_oldest: "Mais antigos",
        sort_name: "Nome A-Z",
        sort_favs: "Favoritos",
        tag_all: "Todos",
        tag_pdf: "PDFs",
        tag_images: "Imagens",
        tag_favs: "Favoritos",
        empty_title: "Nenhum documento",
        empty_desc: "Toque no botão abaixo para escanear seu primeiro documento",
        menu_home: "Início",
        menu_folders: "Pastas",
        menu_credits: "Comprar Créditos",
        menu_recent: "Recentes",
        menu_drive: "Conectar Google Drive",
        menu_pending: "Uploads Pendentes",
        menu_ocr: "Extrair Texto (OCR)",
        menu_qrcode: "Scanner QR Code",
        menu_stats: "Estatísticas",
        menu_backup: "Exportar/Importar",
        menu_settings: "Configurações",
        menu_tutorial: "Ajuda e Tutorial",
        menu_about: "Sobre",
        menu_install: "Instalar App",
        camera_live: "Câmera ao Vivo (4K)",
        batch_mode: "Modo Lote (Várias Págs)",
        gallery: "Galeria",
        id_card_mode: "🪪 Modo RG / CNH (2 Lados em 1 A4)",
        crop: "Cortar",
        filters: "Filtros",
        adjust: "Ajustar",
        signature: "✍️ Assinar",
        stamp: "🏷️ Carimbo",
        redact: "⬛ Censurar",
        eraser: "🧹 Retoque",
        prop_free: "Livre",
        prop_card: "Cartão",
        auto_detect: "Auto Detectar",
        reset: "Resetar",
        save: "Salvar",
        export_pdf: "Exportar PDF",
        print_thermal: "Imprimir",
        google_drive: "Google Drive",
        id_step_front: "Passo 1: Posicione a FRENTE do documento",
        id_step_back: "Passo 2: Posicione o VERSO do documento",
        id_composing: "Montando folha A4 com Frente e Verso...",
        redact_black: "⬛ Tarja Preta",
        redact_blur: "🌁 Desfoque (Blur)",
        redact_rect: "▭ Retângulo",
        redact_brush: "🖌️ Pincel",
        undo: "Desfazer",
        clear: "Limpar",
        filter_magic: "✨ Mágico Pro",
        filter_magic_bw: "⚡ Mágico P&B",
        filter_original: "Original",
        filter_deshadow: "☀️ Tirar Sombras",
        filter_contrast: "Contraste",
        filter_brightness: "Brilho",
        filter_document: "Documento",
        filter_whiteboard: "Quadro",
        filter_autoclean: "Auto Limpar",
        lang_switch_msg: "Idioma alterado para Português 🇧🇷",
        ctx_view: "Visualizar",
        ctx_favorite: "Favoritar",
        ctx_share: "Compartilhar",
        ctx_lock: "Proteger com PIN",
        ctx_unlock: "Remover Proteção",
        ctx_rename: "Renomear",
        ctx_move: "Mover para pasta",
        ctx_download: "Baixar",
        ctx_ocr: "Extrair Texto (OCR)",
        ctx_drive: "Enviar para Drive",
        ctx_delete: "Excluir",
        prompt_new_name: "Novo nome:",
        confirm_delete_item: "Tem certeza que deseja excluir?",
        confirm_delete_doc: "Excluir este documento?",
        confirm_delete_multiple: "Excluir {n} itens?",
        move_to_title: "Mover para",
        pin_modal_title: "Digite o PIN",
        viewer_add_page: "+ Página",
        ocr_title: "Texto Extraído (OCR)",
        ocr_placeholder: "O texto extraído aparecerá aqui...",
        copy_text: "Copiar Texto",
        export_excel: "Exportar Excel (.xlsx)",
        print_btn: "Imprimir"
    },
    en: {
        app_title: "DocScan Pro",
        search_ph: "Search documents...",
        all_docs: "All Documents",
        folders: "Folders",
        trash: "Trash",
        settings: "Settings",
        sync: "Sync",
        connected: "Connected",
        disconnected: "Disconnected",
        nav_docs: "Documents",
        nav_folders: "Folders",
        nav_trash: "Trash",
        nav_settings: "Settings",
        home: "Home",
        sort_recent: "Most Recent",
        sort_oldest: "Oldest",
        sort_name: "Name A-Z",
        sort_favs: "Favorites",
        tag_all: "All",
        tag_pdf: "PDFs",
        tag_images: "Images",
        tag_favs: "Favorites",
        empty_title: "No documents",
        empty_desc: "Tap the button below to scan your first document",
        menu_home: "Home",
        menu_folders: "Folders",
        menu_credits: "Buy Credits",
        menu_recent: "Recent",
        menu_drive: "Connect Google Drive",
        menu_pending: "Pending Uploads",
        menu_ocr: "Extract Text (OCR)",
        menu_qrcode: "QR Code Scanner",
        menu_stats: "Statistics",
        menu_backup: "Export/Import",
        menu_settings: "Settings",
        menu_tutorial: "Help & Tutorial",
        menu_about: "About",
        menu_install: "Install App",
        camera_live: "Live Camera (4K)",
        batch_mode: "Batch Mode (Multi-Page)",
        gallery: "Gallery",
        id_card_mode: "🪪 ID Card / License (2 Sides in 1 A4)",
        crop: "Crop",
        filters: "Filters",
        adjust: "Adjust",
        signature: "✍️ Signature",
        stamp: "🏷️ Stamp",
        redact: "⬛ Redact",
        eraser: "🧹 Retouch",
        prop_free: "Free",
        prop_card: "Card",
        auto_detect: "Auto Detect",
        reset: "Reset",
        save: "Save",
        export_pdf: "Export PDF",
        print_thermal: "Print",
        google_drive: "Google Drive",
        id_step_front: "Step 1: Position FRONT of ID document",
        id_step_back: "Step 2: Position BACK of ID document",
        id_composing: "Composing A4 sheet with Front and Back...",
        redact_black: "⬛ Black Bar",
        redact_blur: "🌁 Blur",
        redact_rect: "▭ Rectangle",
        redact_brush: "🖌️ Brush",
        undo: "Undo",
        clear: "Clear",
        filter_magic: "✨ Magic Pro",
        filter_magic_bw: "⚡ Magic B&W",
        filter_original: "Original",
        filter_deshadow: "☀️ Deshadow",
        filter_contrast: "Contrast",
        filter_brightness: "Brightness",
        filter_document: "Document",
        filter_whiteboard: "Whiteboard",
        filter_autoclean: "Auto Clean",
        lang_switch_msg: "Language changed to English 🇺🇸",
        ctx_view: "View",
        ctx_favorite: "Favorite",
        ctx_share: "Share",
        ctx_lock: "Protect with PIN",
        ctx_unlock: "Remove PIN",
        ctx_rename: "Rename",
        ctx_move: "Move to Folder",
        ctx_download: "Download",
        ctx_ocr: "Extract Text (OCR)",
        ctx_drive: "Save to Drive",
        ctx_delete: "Delete",
        prompt_new_name: "New name:",
        confirm_delete_item: "Are you sure you want to delete?",
        confirm_delete_doc: "Delete this document?",
        confirm_delete_multiple: "Delete {n} items?",
        move_to_title: "Move to",
        pin_modal_title: "Enter PIN",
        viewer_add_page: "+ Page",
        ocr_title: "Extracted Text (OCR)",
        ocr_placeholder: "Extracted text will appear here...",
        copy_text: "Copy Text",
        export_excel: "Export to Excel (.xlsx)",
        print_btn: "Print"
    }
};

let currentLang = localStorage.getItem('docscan_lang') || 'pt';

function setAboutLang(lang) {
    const isEn = lang === 'en';
    const ptContent = $('aboutContentPt');
    const enContent = $('aboutContentEn');
    const btnPt = $('aboutLangPt');
    const btnEn = $('aboutLangEn');
    const badge = $('aboutVersionBadge');

    if (ptContent) ptContent.style.display = isEn ? 'none' : 'block';
    if (enContent) enContent.style.display = isEn ? 'block' : 'none';
    if (btnPt) btnPt.classList.toggle('active', !isEn);
    if (btnEn) btnEn.classList.toggle('active', isEn);
    if (badge) badge.textContent = isEn ? 'Version 2.0.0 — 2026 Edition' : 'Versão 2.0.0 — Edição 2026';
}
window.setAboutLang = setAboutLang;

function setLanguage(lang) {
    currentLang = lang === 'en' ? 'en' : 'pt';
    localStorage.setItem('docscan_lang', currentLang);
    const dict = I18N_DICT[currentLang];

    // Update About Modal language
    setAboutLang(currentLang);

    // Update flag button — only the flag emoji
    const flagEl = $('langFlag');
    if (flagEl) flagEl.textContent = currentLang === 'pt' ? '🇧🇷' : '🇺🇸';

    // Search Input
    const searchInp = $('searchInput');
    if (searchInp) searchInp.placeholder = dict.search_ph;

    // Breadcrumb
    const homeBreadcrumb = document.querySelector('.breadcrumb-item[data-folder="root"] span');
    if (homeBreadcrumb) homeBreadcrumb.textContent = dict.home;

    // Sort Bar
    const sortRecent = document.querySelector('.sort-btn[data-sort="date-desc"] span');
    if (sortRecent) sortRecent.textContent = dict.sort_recent;
    const sortOldest = document.querySelector('.sort-btn[data-sort="date-asc"] span');
    if (sortOldest) sortOldest.textContent = dict.sort_oldest;
    const sortName = document.querySelector('.sort-btn[data-sort="name-asc"] span');
    if (sortName) sortName.textContent = dict.sort_name;
    const sortFavs = document.querySelector('.sort-btn[data-sort="favorites"] span');
    if (sortFavs) sortFavs.textContent = dict.sort_favs;

    const isEn = currentLang === 'en';
    const setMenuText = (id, text) => {
        const el = document.querySelector(`#${id} span`);
        if (el) el.textContent = text;
    };

    setMenuText('menuHome', dict.menu_home);
    setMenuText('menuFolders', dict.menu_folders);
    setMenuText('menuBuyCredits', dict.menu_credits);
    setMenuText('menuRecent', dict.menu_recent);
    setMenuText('menuDriveConnect', state.driveConnected ? (isEn ? 'Manage Google Drive' : 'Gerenciar Google Drive') : dict.menu_drive);
    setMenuText('menuPending', dict.menu_pending);
    setMenuText('menuOCR', dict.menu_ocr);
    setMenuText('menuQRCode', dict.menu_qrcode);
    setMenuText('menuStats', dict.menu_stats);
    setMenuText('menuBackup', dict.menu_backup);
    setMenuText('menuSettings', dict.menu_settings);
    setMenuText('menuTutorial', dict.menu_tutorial);
    setMenuText('menuAbout', dict.menu_about);
    setMenuText('menuInstall', dict.menu_install);

    // Logout button
    const logoutBtnSpan = document.querySelector('#logoutBtn span');
    if (logoutBtnSpan) logoutBtnSpan.textContent = isEn ? '🚪 Sign Out' : '🚪 Sair da Conta';

    // Update side menu footer
    const sideVersion = $('sideMenuVersion');
    if (sideVersion) sideVersion.textContent = isEn ? 'Version 2.0.0' : 'Versão 2.0.0';
    const sideMade = $('sideMenuMadeWith');
    if (sideMade) {
        sideMade.innerHTML = isEn 
            ? 'Made with love by <a href="https://4u.ia.br" target="_blank" style="color: var(--accent-secondary); font-weight: bold; text-decoration: none;">4u.ia.br</a>'
            : 'Feito com amor por <a href="https://4u.ia.br" target="_blank" style="color: var(--accent-secondary); font-weight: bold; text-decoration: none;">4u.ia.br</a>';
    }

    // Refresh Drive badge & button, and breadcrumb
    updateUserProfileUI(state.googleProfile);
    updateBreadcrumb();

    // Empty State
    const emptyH2 = document.querySelector('#emptyState h2');
    if (emptyH2) emptyH2.textContent = dict.empty_title;
    const emptyP = document.querySelector('#emptyState p');
    if (emptyP) emptyP.textContent = dict.empty_desc;

    // Capture Modal Options
    const camBtnSpan = document.querySelector('#cameraBtn span');
    if (camBtnSpan) camBtnSpan.textContent = dict.camera_live;
    const batchBtnSpan = document.querySelector('#batchCameraBtn span');
    if (batchBtnSpan) batchBtnSpan.textContent = dict.batch_mode;
    const galleryBtnSpan = document.querySelector('#galleryBtn span');
    if (galleryBtnSpan) galleryBtnSpan.textContent = dict.gallery;
    const idCardBtnSpan = document.querySelector('#idCardModeBtn span');
    if (idCardBtnSpan) idCardBtnSpan.textContent = dict.id_card_mode;

    // Editor Tabs
    const tabCrop = document.querySelector('.editor-tab[data-tab="crop"]');
    if (tabCrop) tabCrop.textContent = dict.crop;
    const tabFilters = document.querySelector('.editor-tab[data-tab="filters"]');
    if (tabFilters) tabFilters.textContent = dict.filters;
    const tabAdjust = document.querySelector('.editor-tab[data-tab="adjust"]');
    if (tabAdjust) tabAdjust.textContent = dict.adjust;
    const tabSignature = document.querySelector('.editor-tab[data-tab="signature"]');
    if (tabSignature) tabSignature.textContent = dict.signature;
    const tabRedact = document.querySelector('.editor-tab[data-tab="redact"]');
    if (tabRedact) tabRedact.textContent = dict.redact;
    const tabEraser = document.querySelector('.editor-tab[data-tab="eraser"]');
    if (tabEraser) tabEraser.textContent = dict.eraser;

    // Crop Proportions & Buttons
    const autoDetectBtn = document.querySelector('.crop-actions button[onclick*="autoDetectEdges"], #autoDetectBtn');
    if (autoDetectBtn) autoDetectBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0013 3.06V1h-2v2.06A8.994 8.994 0 003.06 11H1v2h2.06A8.994 8.994 0 0011 20.94V23h2v-2.06A8.994 8.994 0 0020.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/></svg> ${dict.auto_detect}`;
    const resetCropBtn = document.querySelector('.crop-actions button[onclick*="resetCrop"], #resetCropBtn');
    if (resetCropBtn) resetCropBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/></svg> ${dict.reset}`;

    // Translate all [data-i18n] elements
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (dict[key]) el.textContent = dict[key];
    });

    // Translate all [data-i18n-ph] elements (placeholders)
    document.querySelectorAll('[data-i18n-ph]').forEach(el => {
        const key = el.getAttribute('data-i18n-ph');
        if (dict[key]) el.setAttribute('placeholder', dict[key]);
    });

    // Translate all [data-i18n-title] elements
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        if (dict[key]) el.setAttribute('title', dict[key]);
    });

    if (typeof updateUI === 'function') {
        updateUI();
    }
}

function toggleLanguage() {
    triggerHaptic('light');
    const newLang = currentLang === 'pt' ? 'en' : 'pt';
    setLanguage(newLang);
    showToast(I18N_DICT[newLang].lang_switch_msg, 'info');
}

function t(key) {
    return (I18N_DICT[currentLang] && I18N_DICT[currentLang][key]) || (I18N_DICT.pt && I18N_DICT.pt[key]) || key;
}

// ============================================
// ID CARD SCANNER & A4 COMPOSER (RG / CNH)
// ============================================
let idCardScanState = {
    active: false,
    step: 1, // 1: Front, 2: Back
    frontImage: null,
    backImage: null
};

function startIdCardScanner() {
    triggerHaptic('medium');
    closeModal('captureModal');
    idCardScanState.active = true;
    idCardScanState.step = 1;
    idCardScanState.frontImage = null;
    idCardScanState.backImage = null;

    const banner = $('idCardStepBanner');
    const stepText = $('idCardStepText');
    if (banner) banner.classList.remove('hidden');
    if (stepText) stepText.textContent = t('id_step_front');

    const badge = $('cameraModeBadge');
    if (badge) badge.textContent = '🪪 Modo RG/CNH (Passo 1/2)';

    startLiveCamera(false);
}

async function handleIdCardCapture(dataUrl) {
    triggerHaptic('success');
    if (idCardScanState.step === 1) {
        idCardScanState.frontImage = dataUrl;
        idCardScanState.step = 2;
        const banner = $('idCardStepBanner');
        const stepText = $('idCardStepText');
        const badge = $('cameraModeBadge');
        if (banner) banner.classList.remove('hidden');
        if (stepText) stepText.textContent = t('id_step_back');
        if (badge) badge.textContent = '🪪 Modo RG/CNH (Passo 2/2)';
        showToast('Frente capturada! Agora capture o VERSO.', 'success');
    } else {
        idCardScanState.backImage = dataUrl;
        idCardScanState.active = false;
        const banner = $('idCardStepBanner');
        if (banner) banner.classList.add('hidden');
        stopLiveCamera();
        showLoading(t('id_composing'));
        const a4Image = await composeIdCardOnA4(idCardScanState.frontImage, idCardScanState.backImage);
        hideLoading();

        const img = new Image();
        img.onload = () => {
            state.originalImage = img;
            state.currentImage = img;
            openEditor(img);
        };
        img.src = a4Image;
        showToast('Frente e Verso combinados em folha A4!', 'success');
    }
}

async function composeIdCardOnA4(frontDataUrl, backDataUrl) {
    const frontImg = await loadImage(frontDataUrl);
    const backImg = await loadImage(backDataUrl);

    // Standard A4 Canvas at 300 DPI: 2480 x 3508 pixels
    const canvas = document.createElement('canvas');
    canvas.width = 2480;
    canvas.height = 3508;
    const ctx = canvas.getContext('2d');

    // Clean white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Header Title
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 52px "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('DOCUMENTO DE IDENTIFICAÇÃO (FRENTE E VERSO)', canvas.width / 2, 180);

    // Subtle header separator line
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(200, 230);
    ctx.lineTo(canvas.width - 200, 230);
    ctx.stroke();

    // Target dimensions for ID cards on A4
    const cardTargetW = 1600;
    const cardTargetH = 1000;

    // Draw Front Card (Top section)
    const frontY = 480;
    const frontX = (canvas.width - cardTargetW) / 2;

    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 3;
    ctx.strokeRect(frontX - 4, frontY - 4, cardTargetW + 8, cardTargetH + 8);
    ctx.drawImage(frontImg, frontX, frontY, cardTargetW, cardTargetH);

    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 36px "Inter", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('▲ FRENTE', frontX, frontY - 18);

    // Draw Back Card (Bottom section)
    const backY = 1900;
    const backX = (canvas.width - cardTargetW) / 2;

    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 3;
    ctx.strokeRect(backX - 4, backY - 4, cardTargetW + 8, cardTargetH + 8);
    ctx.drawImage(backImg, backX, backY, cardTargetW, cardTargetH);

    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 36px "Inter", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('▲ VERSO', backX, backY - 18);

    // Footer Watermark
    ctx.fillStyle = '#94a3b8';
    ctx.font = '28px "Inter", sans-serif';
    ctx.textAlign = 'center';
    const dateStr = new Date().toLocaleDateString('pt-BR');
    ctx.fillText(`Digitalizado via DocScan Pro em ${dateStr} — Cópia Digital Autenticada`, canvas.width / 2, 3350);

    return canvas.toDataURL('image/jpeg', 0.98);
}

// ============================================
// REDACTION / CENSURA DE DADOS SENSÍVEIS
// ============================================
let redactConfig = {
    mode: 'black',  // 'black' | 'blur'
    shape: 'rect',  // 'rect' | 'brush'
    history: []
};

function setRedactMode(mode) {
    triggerHaptic('light');
    redactConfig.mode = mode;
    $('redactModeBlack')?.classList.toggle('active', mode === 'black');
    $('redactModeBlur')?.classList.toggle('active', mode === 'blur');
}

function setRedactShape(shape) {
    triggerHaptic('light');
    redactConfig.shape = shape;
    $('redactShapeRect')?.classList.toggle('active', shape === 'rect');
    $('redactShapeBrush')?.classList.toggle('active', shape === 'brush');
}

let isRedacting = false;
let redactStartX = 0;
let redactStartY = 0;
let redactLastX = 0;
let redactLastY = 0;
let redactInitialSnapshot = null;

function setupRedactListeners() {
    const canvas = $('editorCanvas');
    const container = document.querySelector('.editor-canvas-container');
    if (!canvas) return;

    function saveRedactState() {
        const ctx = canvas.getContext('2d');
        redactConfig.history.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
        if (redactConfig.history.length > 25) redactConfig.history.shift();
    }

    function getCoords(e) {
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches && e.touches.length > 0 ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches && e.touches.length > 0 ? e.touches[0].clientY : e.clientY;
        const scaleX = canvas.width / (rect.width || 1);
        const scaleY = canvas.height / (rect.height || 1);
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY,
            clientX,
            clientY
        };
    }

    let previewBox = null;

    function startDraw(e) {
        const activeTab = document.querySelector('.editor-tab.active')?.dataset.tab;
        if (activeTab !== 'redact') return;

        isRedacting = true;
        saveRedactState();
        const pos = getCoords(e);
        redactStartX = pos.x;
        redactStartY = pos.y;
        redactLastX = pos.x;
        redactLastY = pos.y;

        if (redactConfig.shape === 'brush') {
            applyBrushPoint(pos.x, pos.y);
        } else if (redactConfig.shape === 'rect' && container) {
            if (!previewBox) {
                previewBox = document.createElement('div');
                previewBox.className = 'redact-selection-box';
                container.appendChild(previewBox);
            }
            const containerRect = container.getBoundingClientRect();
            previewBox.style.left = `${pos.clientX - containerRect.left}px`;
            previewBox.style.top = `${pos.clientY - containerRect.top}px`;
            previewBox.style.width = '0px';
            previewBox.style.height = '0px';
            previewBox.style.display = 'block';
        }
    }

    function moveDraw(e) {
        if (!isRedacting) return;
        const activeTab = document.querySelector('.editor-tab.active')?.dataset.tab;
        if (activeTab !== 'redact') return;

        const pos = getCoords(e);
        if (redactConfig.shape === 'brush') {
            applyBrushStroke(redactLastX, redactLastY, pos.x, pos.y);
            redactLastX = pos.x;
            redactLastY = pos.y;
        } else if (redactConfig.shape === 'rect' && previewBox && container) {
            const containerRect = container.getBoundingClientRect();
            const canvasRect = canvas.getBoundingClientRect();
            const startClientX = (redactStartX * (canvasRect.width / canvas.width)) + canvasRect.left;
            const startClientY = (redactStartY * (canvasRect.height / canvas.height)) + canvasRect.top;

            const curLeft = Math.min(startClientX, pos.clientX) - containerRect.left;
            const curTop = Math.min(startClientY, pos.clientY) - containerRect.top;
            const curW = Math.abs(pos.clientX - startClientX);
            const curH = Math.abs(pos.clientY - startClientY);

            previewBox.style.left = `${curLeft}px`;
            previewBox.style.top = `${curTop}px`;
            previewBox.style.width = `${curW}px`;
            previewBox.style.height = `${curH}px`;
        }
    }

    function endDraw(e) {
        if (!isRedacting) return;
        const activeTab = document.querySelector('.editor-tab.active')?.dataset.tab;
        if (activeTab !== 'redact') return;

        isRedacting = false;
        if (previewBox) {
            previewBox.style.display = 'none';
        }

        if (redactConfig.shape === 'rect') {
            const pos = e.changedTouches && e.changedTouches.length > 0 ? getCoords(e.changedTouches[0]) : getCoords(e);
            applyRectRedact(redactStartX, redactStartY, pos.x, pos.y);
        }
    }

    canvas.addEventListener('mousedown', startDraw);
    window.addEventListener('mousemove', moveDraw);
    window.addEventListener('mouseup', endDraw);

    canvas.addEventListener('touchstart', (e) => {
        const activeTab = document.querySelector('.editor-tab.active')?.dataset.tab;
        if (activeTab === 'redact') {
            if (e.cancelable) e.preventDefault();
        }
        startDraw(e);
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
        const activeTab = document.querySelector('.editor-tab.active')?.dataset.tab;
        if (activeTab === 'redact') {
            if (e.cancelable) e.preventDefault();
        }
        moveDraw(e);
    }, { passive: false });

    canvas.addEventListener('touchend', endDraw);
    canvas.addEventListener('touchcancel', endDraw);
}

function applyRectRedact(x1, y1, x2, y2) {
    const canvas = $('editorCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rx = Math.min(x1, x2);
    const ry = Math.min(y1, y2);
    const rw = Math.abs(x2 - x1);
    const rh = Math.abs(y2 - y1);

    if (rw < 5 || rh < 5) return;

    if (redactConfig.mode === 'black') {
        ctx.fillStyle = '#000000';
        ctx.fillRect(rx, ry, rw, rh);
    } else {
        applyBlurToRegion(ctx, rx, ry, rw, rh, 14);
    }
    triggerHaptic('light');
}

function applyBrushPoint(x, y) {
    const canvas = $('editorCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const size = 32;

    if (redactConfig.mode === 'black') {
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(x, y, size / 2, 0, Math.PI * 2);
        ctx.fill();
    } else {
        applyBlurToRegion(ctx, x - size / 2, y - size / 2, size, size, 12);
    }
}

function applyBrushStroke(x1, y1, x2, y2) {
    const canvas = $('editorCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const size = 32;

    if (redactConfig.mode === 'black') {
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    } else {
        const minX = Math.min(x1, x2) - size / 2;
        const minY = Math.min(y1, y2) - size / 2;
        const w = Math.abs(x2 - x1) + size;
        const h = Math.abs(y2 - y1) + size;
        applyBlurToRegion(ctx, minX, minY, w, h, 12);
    }
}

function applyBlurToRegion(ctx, x, y, w, h, blurRadius = 14) {
    x = Math.max(0, Math.floor(x));
    y = Math.max(0, Math.floor(y));
    w = Math.min(ctx.canvas.width - x, Math.floor(w));
    h = Math.min(ctx.canvas.height - y, Math.floor(h));
    if (w <= 4 || h <= 4) return;

    try {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = w;
        tempCanvas.height = h;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(ctx.canvas, x, y, w, h, 0, 0, w, h);

        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.clip();
        ctx.filter = `blur(${blurRadius}px)`;
        ctx.drawImage(tempCanvas, x - blurRadius, y - blurRadius, w + blurRadius * 2, h + blurRadius * 2);
        ctx.restore();
    } catch (e) {
        console.warn('Fallback pixelate blur:', e);
        applyPixelate(ctx, x, y, w, h, 14);
    }
}

function applyPixelate(ctx, x, y, w, h, pixelSize = 14) {
    x = Math.max(0, Math.floor(x));
    y = Math.max(0, Math.floor(y));
    w = Math.min(ctx.canvas.width - x, Math.floor(w));
    h = Math.min(ctx.canvas.height - y, Math.floor(h));
    if (w <= 0 || h <= 0) return;

    const imgData = ctx.getImageData(x, y, w, h);
    const data = imgData.data;

    for (let py = 0; py < h; py += pixelSize) {
        const blockH = Math.min(pixelSize, h - py);
        for (let px = 0; px < w; px += pixelSize) {
            const blockW = Math.min(pixelSize, w - px);

            // Média real das cores do bloco (evita que texto preto pinte todo o bloco de preto)
            let sumR = 0, sumG = 0, sumB = 0, count = 0;
            for (let dy = 0; dy < blockH; dy++) {
                for (let dx = 0; dx < blockW; dx++) {
                    const idx = ((py + dy) * w + (px + dx)) * 4;
                    sumR += data[idx];
                    sumG += data[idx + 1];
                    sumB += data[idx + 2];
                    count++;
                }
            }

            const avgR = count > 0 ? Math.round(sumR / count) : 210;
            const avgG = count > 0 ? Math.round(sumG / count) : 210;
            const avgB = count > 0 ? Math.round(sumB / count) : 210;

            for (let dy = 0; dy < blockH; dy++) {
                for (let dx = 0; dx < blockW; dx++) {
                    const idx = ((py + dy) * w + (px + dx)) * 4;
                    data[idx] = avgR;
                    data[idx + 1] = avgG;
                    data[idx + 2] = avgB;
                    data[idx + 3] = 255;
                }
            }
        }
    }
    ctx.putImageData(imgData, x, y);
}

function undoRedact() {
    const canvas = $('editorCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (redactConfig.history.length === 0) {
        if (redactInitialSnapshot) {
            ctx.putImageData(redactInitialSnapshot, 0, 0);
        }
        showToast('Nada a desfazer', 'info');
        return;
    }
    triggerHaptic('light');
    const last = redactConfig.history.pop();
    ctx.putImageData(last, 0, 0);
    showToast('Ação desfeita', 'info');
}

function clearAllRedacts() {
    triggerHaptic('warning');
    const canvas = $('editorCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (redactInitialSnapshot) {
        ctx.putImageData(redactInitialSnapshot, 0, 0);
    }
    redactConfig.history = [];
    showToast('Tarjas e desfoques removidos', 'info');
}

// ============================================
// REAL-TIME CONTINUOUS EDGE TRACKING (CAMERA)
// ============================================
let edgeTrackingRaf = null;
let edgeTrackingCanvas = document.createElement('canvas');
edgeTrackingCanvas.width = 320;
edgeTrackingCanvas.height = 240;

let smoothedLiveQuad = null;
let isAutoCaptureEnabled = true;
let autoCaptureStabilityCounter = 0;
let lastAutoCaptureTime = 0;
let prevCorners = null;
const AUTO_CAPTURE_STABLE_FRAMES = 12; // ~500-600ms de estabilidade do documento
const AUTO_CAPTURE_MAX_DIFF = 1.3;     // tolerância de movimento em %
const AUTO_CAPTURE_COOLDOWN_MS = 2200; // intervalo mínimo entre fotos automáticas

function toggleAutoCapture() {
    isAutoCaptureEnabled = !isAutoCaptureEnabled;
    const btn = $('autoCaptureToggleBtn');
    if (btn) {
        btn.classList.toggle('auto-active', isAutoCaptureEnabled);
    }
    triggerHaptic(30);
    showToast(isAutoCaptureEnabled ? '🎯 Disparo Automático Ativado' : '✋ Disparo Manual Ativado', 'info');
}

function startRealtimeEdgeTracking() {
    const video = $('liveCameraVideo');
    const svg = $('liveCameraContour');
    const container = document.querySelector('.camera-viewport-container');
    const hintText = $('cameraHintText');
    if (!video || !svg || !container) return;

    let lastTrackTime = 0;
    let hasDetected = false;
    smoothedLiveQuad = null;
    autoCaptureStabilityCounter = 0;
    prevCorners = null;

    function track(timestamp) {
        if (!liveCameraStream || video.paused || video.ended || !video.videoWidth) {
            edgeTrackingRaf = requestAnimationFrame(track);
            return;
        }

        if (timestamp - lastTrackTime > 45) {
            lastTrackTime = timestamp;
            try {
                const ctx = edgeTrackingCanvas.getContext('2d', { willReadFrequently: true });
                ctx.drawImage(video, 0, 0, 320, 240);

                // 1. Run OpenCV detection on live camera frame
                let corners = findDocumentWithOpenCV(edgeTrackingCanvas);

                // 2. Fallback to scanline gradient detector
                if (!corners) {
                    const imgData = ctx.getImageData(0, 0, 320, 240);
                    corners = _findDocumentCorners(imgData.data, 320, 240);
                }

                if (corners) {
                    // Exponential moving average for silky-smooth tracking
                    if (!smoothedLiveQuad) {
                        smoothedLiveQuad = {
                            tl: { ...corners.tl },
                            tr: { ...corners.tr },
                            br: { ...corners.br },
                            bl: { ...corners.bl }
                        };
                    } else {
                        const alpha = 0.40;
                        smoothedLiveQuad.tl.x += (corners.tl.x - smoothedLiveQuad.tl.x) * alpha;
                        smoothedLiveQuad.tl.y += (corners.tl.y - smoothedLiveQuad.tl.y) * alpha;
                        smoothedLiveQuad.tr.x += (corners.tr.x - smoothedLiveQuad.tr.x) * alpha;
                        smoothedLiveQuad.tr.y += (corners.tr.y - smoothedLiveQuad.tr.y) * alpha;
                        smoothedLiveQuad.br.x += (corners.br.x - smoothedLiveQuad.br.x) * alpha;
                        smoothedLiveQuad.br.y += (corners.br.y - smoothedLiveQuad.br.y) * alpha;
                        smoothedLiveQuad.bl.x += (corners.bl.x - smoothedLiveQuad.bl.x) * alpha;
                        smoothedLiveQuad.bl.y += (corners.bl.y - smoothedLiveQuad.bl.y) * alpha;
                    }

                    const cw = container.clientWidth;
                    const ch = container.clientHeight;
                    const vw = video.videoWidth || 1920;
                    const vh = video.videoHeight || 1080;
                    const videoRatio = vw / vh;
                    const containerRatio = cw / ch;

                    let rw = cw, rh = ch, rx = 0, ry = 0;
                    if (containerRatio > videoRatio) {
                        rw = ch * videoRatio;
                        rx = (cw - rw) / 2;
                    } else {
                        rh = cw / videoRatio;
                        ry = (ch - rh) / 2;
                    }

                    const mapPt = (pt) => ({
                        x: ((rx + (pt.x / 100) * rw) / cw) * 100,
                        y: ((ry + (pt.y / 100) * rh) / ch) * 100
                    });

                    const p1 = mapPt(smoothedLiveQuad.tl);
                    const p2 = mapPt(smoothedLiveQuad.tr);
                    const p3 = mapPt(smoothedLiveQuad.br);
                    const p4 = mapPt(smoothedLiveQuad.bl);

                    svg.innerHTML = `
                        <polygon points="${p1.x.toFixed(2)},${p1.y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)} ${p3.x.toFixed(2)},${p3.y.toFixed(2)} ${p4.x.toFixed(2)},${p4.y.toFixed(2)}"></polygon>
                        <circle cx="${p1.x.toFixed(2)}" cy="${p1.y.toFixed(2)}" r="0.9"></circle>
                        <circle cx="${p2.x.toFixed(2)}" cy="${p2.y.toFixed(2)}" r="0.9"></circle>
                        <circle cx="${p3.x.toFixed(2)}" cy="${p3.y.toFixed(2)}" r="0.9"></circle>
                        <circle cx="${p4.x.toFixed(2)}" cy="${p4.y.toFixed(2)}" r="0.9"></circle>
                    `;

                    state.cropPoints = {
                        tl: { x: corners.tl.x, y: corners.tl.y },
                        tr: { x: corners.tr.x, y: corners.tr.y },
                        br: { x: corners.br.x, y: corners.br.y },
                        bl: { x: corners.bl.x, y: corners.bl.y }
                    };

                    if (!hasDetected) {
                        hasDetected = true;
                        triggerHaptic('light');
                        if (hintText && !isAutoCaptureEnabled) {
                            hintText.textContent = '✨ Documento Enquadrado (Pronto)';
                            hintText.style.background = 'rgba(16, 185, 129, 0.85)';
                        }
                    }

                    // Smart Auto-Capture Stability Detection
                    if (isAutoCaptureEnabled) {
                        const now = Date.now();
                        if (now - lastAutoCaptureTime > AUTO_CAPTURE_COOLDOWN_MS) {
                            if (prevCorners) {
                                const diffTL = Math.hypot(corners.tl.x - prevCorners.tl.x, corners.tl.y - prevCorners.tl.y);
                                const diffTR = Math.hypot(corners.tr.x - prevCorners.tr.x, corners.tr.y - prevCorners.tr.y);
                                const diffBR = Math.hypot(corners.br.x - prevCorners.br.x, corners.br.y - prevCorners.br.y);
                                const diffBL = Math.hypot(corners.bl.x - prevCorners.bl.x, corners.bl.y - prevCorners.bl.y);
                                const maxDiff = Math.max(diffTL, diffTR, diffBR, diffBL);

                                const docW = Math.hypot(corners.tr.x - corners.tl.x, corners.tr.y - corners.tl.y);
                                const docH = Math.hypot(corners.bl.x - corners.tl.x, corners.bl.y - corners.tl.y);

                                if (maxDiff < AUTO_CAPTURE_MAX_DIFF && docW > 20 && docH > 20) {
                                    autoCaptureStabilityCounter++;
                                    if (hintText) {
                                        const pct = Math.min(100, Math.round((autoCaptureStabilityCounter / AUTO_CAPTURE_STABLE_FRAMES) * 100));
                                        hintText.textContent = `🎯 Mantenha firme... ${pct}%`;
                                        hintText.style.background = 'rgba(16, 185, 129, 0.95)';
                                    }
                                    if (autoCaptureStabilityCounter >= AUTO_CAPTURE_STABLE_FRAMES) {
                                        autoCaptureStabilityCounter = 0;
                                        lastAutoCaptureTime = now;
                                        triggerHaptic('success');
                                        if (hintText) {
                                            hintText.textContent = '📸 Capturando!';
                                        }
                                        captureLivePhoto();
                                    }
                                } else {
                                    autoCaptureStabilityCounter = Math.max(0, autoCaptureStabilityCounter - 1);
                                }
                            }
                            prevCorners = {
                                tl: { ...corners.tl },
                                tr: { ...corners.tr },
                                br: { ...corners.br },
                                bl: { ...corners.bl }
                            };
                        }
                    }
                } else {
                    svg.innerHTML = '';
                    smoothedLiveQuad = null;
                    autoCaptureStabilityCounter = 0;
                    prevCorners = null;
                    if (hasDetected) {
                        hasDetected = false;
                        if (hintText) {
                            hintText.textContent = '🔍 Aponte para o documento';
                            hintText.style.background = 'rgba(0, 0, 0, 0.65)';
                        }
                    }
                }
            } catch (e) {}
        }

        edgeTrackingRaf = requestAnimationFrame(track);
    }
    edgeTrackingRaf = requestAnimationFrame(track);
}

function stopRealtimeEdgeTracking() {
    if (edgeTrackingRaf) {
        cancelAnimationFrame(edgeTrackingRaf);
        edgeTrackingRaf = null;
    }
    const svg = $('liveCameraContour');
    if (svg) svg.innerHTML = '';
}

function openMoveModal(type, id) {
    state.contextTarget = { type, id };

    const list = $('moveFoldersList');
    let html = `
        <div class="folder-list-item" onclick="moveToFolder('root')">
            <span class="folder-icon">🏠</span>
            <span>Raiz</span>
        </div>
    `;

    state.folders.forEach(folder => {
        if (type === 'folder' && folder.id === id) return;
        html += `
            <div class="folder-list-item" onclick="moveToFolder('${folder.id}')">
                <span class="folder-icon">📁</span>
                <span>${folder.name}</span>
            </div>
        `;
    });

    list.innerHTML = html;
    openModal('moveModal');
}

async function moveToFolder(targetFolder) {
    const { type, id } = state.contextTarget;

    if (type === 'folder') {
        const folder = state.folders.find(f => f.id === id);
        if (folder) {
            folder.parent = targetFolder;
            await saveToStore('folders', folder);
        }
    } else {
        const doc = state.documents.find(d => d.id === id);
        if (doc) {
            doc.folder = targetFolder;
            await saveToStore('documents', doc);
        }
    }

    closeModal('moveModal');
    updateUI();
    showToast('Item movido com sucesso!', 'success');
}

// ============================================
// Bulk Actions
// ============================================
async function deleteSelected() {
    if (!confirm(`Excluir ${state.selectedItems.length} itens?`)) return;

    showLoading('Excluindo...');

    for (const item of state.selectedItems) {
        const [type, id] = item.split('_');
        if (type === 'folder') {
            await deleteFolder(id);
        } else {
            await deleteDocument(id);
        }
    }

    state.selectedItems = [];
    state.selectMode = false;
    hideLoading();
    updateUI();
    showToast('Itens excluídos', 'success');
}

async function downloadSelected() {
    showLoading('Preparando download...');

    for (const item of state.selectedItems) {
        const [type, id] = item.split('_');
        if (type === 'doc') {
            const doc = state.documents.find(d => d.id === id);
            if (doc) {
                downloadFile(doc.image, doc.name, 'image/jpeg');
                await new Promise(r => setTimeout(r, 500)); // Delay between downloads
            }
        }
    }

    hideLoading();
    showToast('Downloads iniciados', 'success');
}

async function generatePdfFromSelected() {
    const images = [];

    for (const item of state.selectedItems) {
        const [type, id] = item.split('_');
        if (type === 'doc') {
            const doc = state.documents.find(d => d.id === id);
            if (doc) {
                images.push(doc.image);
            }
        }
    }

    if (images.length === 0) {
        showToast('Selecione documentos para gerar o PDF', 'error');
        return;
    }

    showLoading('Gerando PDF...');

    try {
        const pdfData = await generatePdf(images);
        const fileName = `multiplos-${formatTimestamp(new Date())}.pdf`;
        downloadFile(pdfData, fileName, 'application/pdf');
        hideLoading();
        showToast('PDF gerado com sucesso!', 'success');
    } catch (error) {
        hideLoading();
        showToast('Erro ao gerar PDF', 'error');
    }
}

// ============================================
// Google Drive Integration (OAuth 2.0 / REST v3)
// ============================================
let googleTokenClient = null;

function initGoogleDriveClient() {
    if (typeof google === 'undefined' || !google.accounts || !google.accounts.oauth2) {
        return;
    }
    try {
        googleTokenClient = google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: GOOGLE_SCOPES,
            callback: async (tokenResponse) => {
                if (tokenResponse && tokenResponse.access_token) {
                    state.driveToken = tokenResponse.access_token;
                    state.driveConnected = true;
                    saveToStore('settings', { key: 'driveToken', value: tokenResponse.access_token });
                    
                    await fetchGoogleUserProfile(tokenResponse.access_token);
                    updateDriveStatus();
                    
                    // Auto 2-Way Sync on connect
                    await syncGoogleDriveTwoWay(true);
                }
            },
            error_callback: (err) => {
                console.error('Google OAuth error:', err);
                showToast('Erro ao autenticar com o Google.', 'error');
            }
        });
    } catch (e) {
        console.warn('Erro ao inicializar token client:', e);
    }
}

async function autoLoginWithGoogleProfile(profile) {
    if (!profile || !profile.email) return;
    try {
        let resp = await fetch('api/auth.php?action=google', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: profile.email,
                name: profile.name || '',
                picture: profile.picture || ''
            })
        }).catch(() => null);

        if (!resp || !resp.ok) {
            resp = await fetch('../keepai/api/auth.php?action=google', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: profile.email,
                    name: profile.name || '',
                    picture: profile.picture || ''
                })
            });
        }
        const data = await resp.json();
        if (data.success && data.token) {
            localStorage.setItem('keepai_token', data.token);
            state.token = data.token;
            state.credits = data.user.credits;
            state.user = data.user;
            updateCreditsUI();
            console.log('[DocScan SSO] Login unificado via Google autenticado com sucesso! Créditos:', state.credits);

            const isVip = profile.email && (profile.email.toLowerCase() === 'fbr4g4@gmail.com' || profile.email.toLowerCase() === 'fb4g4@gmail.com');
            if (isVip) {
                showToast(`Conta VIP fbr4g4@gmail.com! Créditos de IA liberados! 🚀`, 'success');
            }
        }
    } catch (e) {
        console.warn('[DocScan SSO] Aviso na autenticação com Google:', e);
    }
}
window.autoLoginWithGoogleProfile = autoLoginWithGoogleProfile;

async function fetchGoogleUserProfile(token) {
    try {
        const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const profile = await res.json();
            state.googleProfile = profile;
            localStorage.setItem('googleUserProfile', JSON.stringify(profile));
            updateUserProfileUI(profile);
            await autoLoginWithGoogleProfile(profile);

            const isVip = profile.email && (profile.email.toLowerCase() === 'fbr4g4@gmail.com' || profile.email.toLowerCase() === 'fb4g4@gmail.com');
            if (!isVip) {
                showToast(`Conectado como ${profile.name || profile.email}!`, 'success');
            }
        }
    } catch (e) {
        console.warn('Erro ao buscar perfil Google:', e);
    }
}

function updateUserProfileUI(profile) {
    const avatarImg = $('userAvatarImg');
    const avatarPlaceholder = $('userAvatarPlaceholder');
    const nameDisplay = $('userNameDisplay');
    const emailDisplay = $('userEmailDisplay');
    const badge = $('driveConnectedBadge');
    const badgeText = $('driveStatusText');
    const connectBtn = $('googleConnectBtn');
    const connectBtnText = $('googleConnectBtnText');
    const driveIconBtn = $('driveBtn');

    if (profile && (state.driveConnected || state.driveToken || localStorage.getItem('googleUserProfile'))) {
        if (avatarImg) {
            avatarImg.src = profile.picture || '';
            avatarImg.classList.toggle('hidden', !profile.picture);
        }
        if (avatarPlaceholder) {
            avatarPlaceholder.classList.toggle('hidden', !!profile.picture);
        }
        if (nameDisplay) nameDisplay.textContent = profile.name || 'Conta Google';
        if (emailDisplay) {
            emailDisplay.textContent = profile.email || '';
            emailDisplay.classList.remove('hidden');
        }
        const isEn = (typeof currentLang !== 'undefined' && currentLang === 'en');
        if (badge) badge.className = 'drive-status-badge connected';
        if (badgeText) badgeText.textContent = isEn ? 'Google Drive Connected' : 'Google Drive Conectado';
        if (connectBtn) connectBtn.className = 'google-login-btn connected';
        if (connectBtnText) connectBtnText.textContent = isEn ? 'Manage Google Drive ☁️' : 'Gerenciar Google Drive ☁️';
        if (driveIconBtn) driveIconBtn.classList.add('primary');
    } else {
        const isEn = (typeof currentLang !== 'undefined' && currentLang === 'en');
        if (avatarImg) {
            avatarImg.src = '';
            avatarImg.classList.add('hidden');
        }
        if (avatarPlaceholder) avatarPlaceholder.classList.remove('hidden');
        if (nameDisplay) nameDisplay.textContent = 'DocScan Pro';
        if (emailDisplay) {
            emailDisplay.textContent = '';
            emailDisplay.classList.add('hidden');
        }
        if (badge) badge.className = 'drive-status-badge disconnected';
        if (badgeText) badgeText.textContent = isEn ? 'Google Drive: Disconnected' : 'Google Drive: Desconectado';
        if (connectBtn) connectBtn.className = 'google-login-btn';
        if (connectBtnText) connectBtnText.textContent = isEn ? 'Connect Google Drive' : 'Conectar Google Drive';
        if (driveIconBtn) driveIconBtn.classList.remove('primary');
    }

    const isEn = (typeof currentLang !== 'undefined' && currentLang === 'en');
    const menuDriveSpan = $('menuDriveConnect')?.querySelector('span');
    if (menuDriveSpan) {
        menuDriveSpan.textContent = state.driveConnected 
            ? (isEn ? 'Manage Google Drive' : 'Gerenciar Google Drive') 
            : (isEn ? 'Connect Google Drive' : 'Conectar Google Drive');
    }
}

async function connectGoogleDrive() {
    toggleSideMenu(false);

    if (state.driveConnected) {
        await showDriveOptionsModal();
        return;
    }

    if (!googleTokenClient) {
        initGoogleDriveClient();
    }

    if (googleTokenClient) {
        googleTokenClient.requestAccessToken({ prompt: 'select_account' });
    } else {
        showToast('Inicializando serviço Google...', 'info');
        setTimeout(() => {
            initGoogleDriveClient();
            if (googleTokenClient) {
                googleTokenClient.requestAccessToken({ prompt: 'select_account' });
            } else {
                Swal.fire({
                    icon: 'warning',
                    title: 'Google Sign-In',
                    text: 'O serviço do Google ainda está carregando ou foi bloqueado pelo navegador. Verifique sua conexão e tente novamente.',
                    confirmButtonText: 'Tentar Novamente'
                }).then((r) => {
                    if (r.isConfirmed) {
                        initGoogleDriveClient();
                        if (googleTokenClient) googleTokenClient.requestAccessToken({ prompt: 'select_account' });
                    }
                });
            }
        }, 800);
    }
}

async function showDriveOptionsModal() {
    const isEn = (typeof currentLang !== 'undefined' && currentLang === 'en');
    const profile = state.googleProfile || JSON.parse(localStorage.getItem('googleUserProfile') || '{}');
    const avatarHtml = profile.picture ? `<img src="${profile.picture}" style="width:52px;height:52px;border-radius:50%;margin-bottom:8px;border:2px solid #38bdf8;">` : '';
    const nameHtml = profile.name ? `<div style="font-weight:bold;color:#fff;font-size:15px;">${profile.name}</div>` : '';
    const emailHtml = profile.email ? `<div style="font-size:12px;color:rgba(255,255,255,0.7);">${profile.email}</div>` : '';

    const result = await Swal.fire({
        title: isEn ? 'Google Drive Connected ☁️' : 'Google Drive Conectado ☁️',
        html: `
            <div style="text-align: center; margin-bottom: 12px;">
                ${avatarHtml}
                ${nameHtml}
                ${emailHtml}
            </div>
            <div style="text-align: left; font-size: 13px; color: var(--text-secondary); line-height: 1.6;">
                <p>${isEn ? 'Your documents are saved in the <strong>"DocScan Pro"</strong> folder on your Google Drive.' : 'Seus documentos são salvos na pasta <strong>"DocScan Pro"</strong> do seu Google Drive.'}</p>
                <div style="margin-top: 10px; padding: 10px; background: rgba(108,92,231,0.15); border-radius: 8px;">
                    📄 <strong>${isEn ? 'Documents in app:' : 'Documentos salvos no app:'}</strong> ${state.documents.length}<br>
                    ⏳ <strong>${isEn ? 'Pending uploads:' : 'Uploads pendentes:'}</strong> ${state.pendingUploads.length}
                </div>
            </div>
        `,
        icon: 'info',
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonText: isEn ? '🔄 Mirror from Cloud (Exact copy)' : '🔄 Espelhar da Nuvem (Exata cópia)',
        denyButtonText: isEn ? '🔌 Disconnect' : '🔌 Desconectar',
        cancelButtonText: isEn ? 'Close' : 'Fechar'
    });

    if (result.isConfirmed) {
        await syncGoogleDriveTwoWay(false, true);
    } else if (result.isDenied) {
        state.driveConnected = false;
        state.driveToken = null;
        state.googleProfile = null;
        deleteFromStore('settings', 'driveToken');
        localStorage.removeItem('googleUserProfile');
        updateUserProfileUI(null);
        showToast(isEn ? 'Disconnected from Google Drive' : 'Desconectado do Google Drive', 'info');
    }
}

function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

async function syncAllDocumentsToDrive() {
    await syncGoogleDriveTwoWay(false, false);
}

async function syncGoogleDriveTwoWay(silent = false, mirror = false) {
    if (!state.driveConnected || !state.driveToken) {
        if (!silent) {
            const res = await Swal.fire({
                icon: 'info',
                title: 'Conectar Google Drive',
                text: 'Conecte sua conta Google para sincronizar todos os documentos entre celular e computador.',
                confirmButtonText: 'Conectar Agora',
                showCancelButton: true,
                cancelButtonText: 'Cancelar'
            });
            if (res.isConfirmed) {
                connectGoogleDrive();
            }
        }
        return;
    }

    if (!silent) {
        showLoading(mirror ? 'Espelhando arquivos do Google Drive...' : 'Sincronizando com o Google Drive...');
    }

    try {
        // 1. Find all "DocScan Pro" folders in the user's Drive
        let allFolderIds = [];
        try {
            const fQuery = encodeURIComponent("name = 'DocScan Pro' and mimeType = 'application/vnd.google-apps.folder' and trashed = false");
            const fRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${fQuery}&fields=files(id,name)`, {
                headers: { 'Authorization': `Bearer ${state.driveToken}` }
            });
            if (fRes.status === 401) {
                state.driveConnected = false;
                state.driveToken = null;
                deleteFromStore('settings', 'driveToken');
                updateDriveStatus();
                if (silent) {
                    console.log('[DocScan Sync] Sessão do Google Drive expirada (401). Aguardando próxima conexão.');
                    return;
                }
                hideLoading();
                const res = await Swal.fire({
                    icon: 'warning',
                    title: 'Sessão do Google Expirada',
                    text: 'Sua sessão segura do Google Drive expirou. Deseja reconectar agora?',
                    confirmButtonText: 'Reconectar Google Drive',
                    showCancelButton: true,
                    cancelButtonText: 'Mais tarde'
                });
                if (res.isConfirmed) {
                    connectGoogleDrive();
                }
                return;
            }
            if (fRes.ok) {
                const fData = await fRes.json();
                allFolderIds = (fData.files || []).map(f => f.id);
            }
        } catch (e) {
            console.warn('Erro ao buscar pastas DocScan Pro:', e);
        }

        const targetFolderId = allFolderIds.length > 0 ? allFolderIds[0] : (await getOrCreateDocScanFolder());
        if (!targetFolderId && !state.driveToken) return;

        // 2. Query all scan documents in Google Drive
        let queryStr = "trashed = false and (name contains 'scan-' or mimeType contains 'image/' or mimeType = 'application/pdf')";
        if (allFolderIds.length > 0) {
            const parentPart = allFolderIds.map(fid => `'${fid}' in parents`).join(' or ');
            queryStr = `trashed = false and (${parentPart} or name contains 'scan-')`;
        }

        const listQuery = encodeURIComponent(queryStr);
        const listRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${listQuery}&fields=files(id,name,mimeType,createdTime,thumbnailLink,webContentLink)&pageSize=100&orderBy=createdTime desc`, {
            headers: { 'Authorization': `Bearer ${state.driveToken}` }
        });

        if (listRes.status === 401) {
            state.driveConnected = false;
            state.driveToken = null;
            deleteFromStore('settings', 'driveToken');
            updateDriveStatus();
            if (silent) {
                console.log('[DocScan Sync] Sessão do Google Drive expirada (401). Aguardando próxima conexão.');
                return;
            }
            hideLoading();
            const res = await Swal.fire({
                icon: 'warning',
                title: 'Sessão do Google Expirada',
                text: 'Sua sessão segura do Google Drive expirou. Deseja reconectar agora?',
                confirmButtonText: 'Reconectar Google Drive',
                showCancelButton: true,
                cancelButtonText: 'Mais tarde'
            });
            if (res.isConfirmed) {
                connectGoogleDrive();
            }
            return;
        }

        if (!listRes.ok) {
            const errTxt = await listRes.text();
            let msg = errTxt;
            try {
                const o = JSON.parse(errTxt);
                if (o.error && o.error.message) msg = o.error.message;
            } catch (e) {}
            if (msg.includes('Google Drive API has not been used') || msg.includes('disabled')) {
                if (!silent) {
                    hideLoading();
                    showDriveApiActivationModal();
                    return;
                }
            }
            throw new Error(`Erro ao listar arquivos do Google Drive (${listRes.status}): ${msg}`);
        }

        const listData = await listRes.json();
        const remoteFiles = (listData.files || []).filter(f => f.mimeType !== 'application/vnd.google-apps.folder');

        console.log(`[DocScan Sync] Encontrados ${remoteFiles.length} arquivos no Google Drive:`, remoteFiles);

        let downloadedCount = 0;
        let uploadedCount = 0;
        let removedCount = 0;

        // If mirror mode is active, clean local files that no longer exist in Google Drive
        if (mirror) {
            const remoteIds = new Set(remoteFiles.map(rf => rf.id));
            const remoteNames = new Set(remoteFiles.map(rf => rf.name));

            const toKeep = [];
            for (const localDoc of state.documents) {
                const stillExists = (localDoc.driveId && remoteIds.has(localDoc.driveId)) || remoteNames.has(localDoc.name);
                if (stillExists) {
                    toKeep.push(localDoc);
                } else {
                    await deleteFromStore('documents', localDoc.id);
                    removedCount++;
                }
            }
            state.documents = toKeep;
        }

        // 3. DOWNLOAD: Pull remote files that are not present locally on this device
        const seenDriveIds = new Set(state.documents.filter(d => d.driveId).map(d => d.driveId));
        const seenNames = new Set(state.documents.map(d => d.name));
        const tombstoneSet = new Set(getTombstoneDeleted());

        for (const remoteFile of remoteFiles) {
            const remoteNameClean = (remoteFile.name || '').toLowerCase().trim();
            // Se o usuário excluiu este arquivo anteriormente, NÃO baixe e limpe do Google Drive
            if (tombstoneSet.has(remoteFile.id) || tombstoneSet.has(remoteNameClean)) {
                console.log(`[DocScan Sync] Ignorando e purgando arquivo previamente excluído: ${remoteFile.name}`);
                try {
                    await fetch(`https://www.googleapis.com/drive/v3/files/${remoteFile.id}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${state.driveToken}` }
                    });
                } catch (e) {}
                continue;
            }

            if (seenDriveIds.has(remoteFile.id)) {
                continue;
            }

            // If a local doc has this name without a driveId, link them
            const localByName = state.documents.find(d => !d.driveId && d.name === remoteFile.name);
            if (localByName) {
                localByName.driveId = remoteFile.id;
                await saveToStore('documents', localByName);
                seenDriveIds.add(remoteFile.id);
                continue;
            }

            console.log(`[DocScan Sync] Baixando ${remoteFile.name} (${remoteFile.id})...`);
            try {
                let dataUrl = null;
                const downloadRes = await fetch(`https://www.googleapis.com/drive/v3/files/${remoteFile.id}?alt=media`, {
                    headers: { 'Authorization': `Bearer ${state.driveToken}` }
                });

                if (downloadRes.ok) {
                    const blob = await downloadRes.blob();
                    dataUrl = await blobToDataURL(blob);
                } else if (remoteFile.thumbnailLink) {
                    const hiRes = remoteFile.thumbnailLink.replace(/=s\d+/, '=s2048');
                    const tRes = await fetch(hiRes);
                    if (tRes.ok) {
                        const tBlob = await tRes.blob();
                        dataUrl = await blobToDataURL(tBlob);
                    }
                }

                if (dataUrl) {
                    let finalName = remoteFile.name;
                    if (seenNames.has(finalName)) {
                        finalName = finalName.replace(/\.([a-zA-Z0-9]+)$/, `-${remoteFile.id.slice(-4)}.$1`);
                    }

                    const newDoc = {
                        id: generateId(),
                        driveId: remoteFile.id,
                        name: finalName,
                        image: dataUrl,
                        thumbnail: dataUrl,
                        folder: 'root',
                        date: remoteFile.createdTime || new Date().toISOString(),
                        format: (remoteFile.mimeType === 'application/pdf' || remoteFile.name.endsWith('.pdf')) ? 'pdf' : 'jpg',
                        pageCount: 1
                    };

                    await saveToStore('documents', newDoc);
                    state.documents.unshift(newDoc);
                    seenDriveIds.add(remoteFile.id);
                    seenNames.add(finalName);
                    downloadedCount++;
                    console.log(`[DocScan Sync] Sucesso: ${finalName} adicionado à biblioteca local.`);
                }
            } catch (dlErr) {
                console.error(`[DocScan Sync] Erro ao processar ${remoteFile.name}:`, dlErr);
            }
        }

        // 4. UPLOAD (only if not mirror mode): Push local files that do not exist in Google Drive
        if (!mirror) {
            for (const localDoc of state.documents) {
                if (localDoc.driveId && seenDriveIds.has(localDoc.driveId)) {
                    continue;
                }
                const existsRemotely = remoteFiles.some(rf => rf.name === localDoc.name || rf.id === localDoc.driveId);
                if (!existsRemotely) {
                    try {
                        const mimeType = localDoc.format === 'pdf' ? 'application/pdf' : 'image/jpeg';
                        const upRes = await uploadToDrive(localDoc.image, localDoc.name, mimeType);
                        if (upRes && upRes.id) {
                            localDoc.driveId = upRes.id;
                            await saveToStore('documents', localDoc);
                            seenDriveIds.add(upRes.id);
                        }
                        uploadedCount++;
                    } catch (ulErr) {
                        console.warn(`Erro ao enviar ${localDoc.name}:`, ulErr);
                    }
                }
            }
        }

        // 5. Process pending queue
        for (const pending of [...state.pendingUploads]) {
            try {
                await uploadToDrive(pending.data, pending.name, pending.mimeType);
                await deleteFromStore('pending', pending.id);
                state.pendingUploads = state.pendingUploads.filter(p => p.id !== pending.id);
            } catch (pErr) {}
        }
        updatePendingBadge();

        updateUI();

        if (!silent) {
            hideLoading();
            Swal.fire({
                icon: 'success',
                title: 'Nuvem Sincronizada! ☁️',
                html: `
                    <div style="text-align: left; font-size: 14px; line-height: 1.6;">
                        <p>Seus arquivos estão sincronizados com o Google Drive:</p>
                        <ul style="margin-top: 8px; padding-left: 20px;">
                            <li>📥 <strong>${downloadedCount}</strong> novo(s) documento(s) baixado(s).</li>
                            ${mirror ? `<li>🗑️ <strong>${removedCount}</strong> arquivo(s) antigos removidos deste aparelho.</li>` : `<li>📤 <strong>${uploadedCount}</strong> documento(s) enviado(s).</li>`}
                            <li>📄 <strong>${state.documents.length}</strong> documento(s) ativos no seu app.</li>
                        </ul>
                    </div>
                `
            });
        } else {
            showToast(`Nuvem sincronizada (${state.documents.length} docs)`, 'success');
        }
    } catch (error) {
        if (!silent) {
            hideLoading();
            console.error('Sync error:', error);
            showToast('Erro na sincronização: ' + error.message, 'error');
        } else {
            console.log('[DocScan Sync] Sincronização em segundo plano:', error.message);
        }
    }
}

async function uploadCurrentViewerDocToDrive() {
    const title = $('viewerTitle').textContent;
    const doc = state.documents.find(d => d.name === title) || { image: $('viewerImage').src, name: title, format: 'jpg' };

    if (!state.driveConnected || !state.driveToken) {
        const res = await Swal.fire({
            icon: 'info',
            title: 'Conectar Google Drive',
            text: 'Para enviar este documento, conecte sua conta Google primeiro.',
            confirmButtonText: 'Conectar Agora',
            showCancelButton: true,
            cancelButtonText: 'Cancelar'
        });
        if (res.isConfirmed) {
            connectGoogleDrive();
        }
        return;
    }

    showLoading(`Enviando "${doc.name}" para o Google Drive...`);
    try {
        const mimeType = doc.format === 'pdf' ? 'application/pdf' : 'image/jpeg';
        await uploadToDrive(doc.image, doc.name, mimeType);
        hideLoading();
        Swal.fire({
            icon: 'success',
            title: 'Enviado com Sucesso! ☁️',
            text: `O arquivo "${doc.name}" está salvo na pasta "DocScan Pro" do seu Google Drive.`
        });
    } catch (e) {
        hideLoading();
        if (e.message && e.message.includes('Google Drive API')) {
            showDriveApiActivationModal();
        } else {
            showToast('Erro no upload: ' + e.message, 'error');
        }
    }
}

let docScanDriveFolderId = null;

async function getOrCreateDocScanFolder() {
    if (docScanDriveFolderId) return docScanDriveFolderId;
    if (!state.driveConnected || !state.driveToken) return null;

    try {
        const query = encodeURIComponent("name = 'DocScan Pro' and mimeType = 'application/vnd.google-apps.folder' and trashed = false");
        const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`, {
            headers: { 'Authorization': `Bearer ${state.driveToken}` }
        });

        if (searchRes.ok) {
            const data = await searchRes.json();
            if (data.files && data.files.length > 0) {
                docScanDriveFolderId = data.files[0].id;
                return docScanDriveFolderId;
            }
        }

        const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${state.driveToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: 'DocScan Pro',
                mimeType: 'application/vnd.google-apps.folder'
            })
        });

        if (createRes.ok) {
            const newFolder = await createRes.json();
            docScanDriveFolderId = newFolder.id;
            return docScanDriveFolderId;
        }
    } catch (e) {
        console.warn('Erro ao obter/criar pasta DocScan Pro no Drive:', e);
    }
    return null;
}

async function uploadToDrive(fileData, fileName, mimeType) {
    if (!state.driveConnected || !state.driveToken) {
        throw new Error('Não conectado ao Google Drive');
    }

    const folderId = await getOrCreateDocScanFolder();

    const metadata = {
        name: fileName,
        mimeType: mimeType
    };

    if (folderId) {
        metadata.parents = [folderId];
    }

    const base64Data = fileData.includes(',') ? fileData.split(',')[1] : fileData;
    const binaryStr = atob(base64Data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
    }
    const fileBlob = new Blob([bytes], { type: mimeType });

    const boundary = '-------DocScanBoundary' + Math.random().toString(36).substring(2);
    const delimiter = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` + JSON.stringify(metadata) + `\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const multipartBlob = new Blob([delimiter, fileBlob, closeDelimiter], {
        type: `multipart/related; boundary=${boundary}`
    });

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${state.driveToken}`,
            'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body: multipartBlob
    });

    if (response.status === 401) {
        state.driveConnected = false;
        state.driveToken = null;
        deleteFromStore('settings', 'driveToken');
        updateDriveStatus();
        throw new Error('Sessão do Google Drive expirada. Por favor, conecte novamente.');
    }

    if (!response.ok) {
        const errText = await response.text();
        let errMsg = `Falha no upload (${response.status})`;
        try {
            const errObj = JSON.parse(errText);
            if (errObj.error && errObj.error.message) {
                errMsg = errObj.error.message;
            }
        } catch (e) {
            errMsg = errText;
        }

        if (errMsg.includes('Google Drive API has not been used') || errMsg.includes('disabled')) {
            errMsg = 'A Google Drive API precisa ser ativada no Google Cloud Console (Projeto 569266864432).';
        }
        throw new Error(errMsg);
    }

    const result = await response.json();
    return result;
}

async function syncPendingUploads() {
    const isEn = (typeof currentLang !== 'undefined' && currentLang === 'en');
    if (!state.driveConnected || !navigator.onLine || state.pendingUploads.length === 0) {
        if (!state.driveConnected) {
            showToast(isEn ? 'Connect to Google Drive first' : 'Conecte ao Google Drive primeiro', 'error');
        } else if (!navigator.onLine) {
            showToast(isEn ? 'No internet connection' : 'Sem conexão com a internet', 'error');
        } else {
            showToast(isEn ? 'No pending uploads' : 'Nenhum upload pendente', 'success');
        }
        return;
    }

    showLoading(isEn ? `Syncing ${state.pendingUploads.length} files...` : `Sincronizando ${state.pendingUploads.length} arquivos...`);

    try {
        for (const pending of [...state.pendingUploads]) {
            await uploadToDrive(pending.data, pending.name, pending.mimeType);
            await deleteFromStore('pending', pending.id);
            state.pendingUploads = state.pendingUploads.filter(p => p.id !== pending.id);
            updatePendingBadge();
        }

        hideLoading();
        showToast(isEn ? 'Sync completed!' : 'Sincronização concluída!', 'success');
    } catch (error) {
        hideLoading();
        showToast(isEn ? 'Sync error' : 'Erro na sincronização', 'error');
    }
}

function showPendingUploads() {
    toggleSideMenu(false);
    const isEn = (typeof currentLang !== 'undefined' && currentLang === 'en');

    if (state.pendingUploads.length === 0) {
        showToast(isEn ? 'No pending uploads' : 'Nenhum upload pendente', 'success');
        return;
    }

    const message = state.pendingUploads.map(p => p.name).join('\n');
    alert(isEn ? `Pending uploads:\n\n${message}` : `Uploads pendentes:\n\n${message}`);
}

// ============================================
// Service Worker
// ============================================
function setupServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('service-worker.js', { updateViaCache: 'none' })
            .then(reg => {
                reg.update();
                console.log('Service Worker v9 active (updateViaCache: none)');
            })
            .catch(err => console.log('Service Worker registration:', err));
    }
}

// ============================================
// Utilities
// ============================================
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function showLoading(text = 'Processando...') {
    $('loadingText').textContent = text;
    $('loading').classList.remove('hidden');
    // Esconder progresso se não for OCR
    const progress = $('loadingProgress');
    if (progress) progress.classList.add('hidden');
}

function showToast(message, type = '') {
    const toast = $('toast');
    const toastMessage = $('toastMessage');

    toastMessage.textContent = message;
    toast.className = `toast ${type}`;

    toast.classList.remove('hidden');

    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

// ============================================
// PIN Modal Functions
// ============================================

let pinCallback = null;
let currentPinMode = 'unlock'; // 'set' or 'unlock'
let pinTargetId = null;

function openPinModal(mode, targetId = null) {
    currentPinMode = mode;
    pinTargetId = targetId || (state.contextTarget ? state.contextTarget.id : null);
    state.currentPin = '';
    $('pinInput').value = '';
    $('pinModalTitle').textContent = mode === 'set' ? 'Definir novo PIN (4 dígitos)' : 'Digite o PIN desta pasta';
    openModal('pinModal');
}

window.appendPin = function (num) {
    if (state.currentPin.length < 4) {
        state.currentPin += num;
        $('pinInput').value = '•'.repeat(state.currentPin.length);
        triggerHaptic(30);
    }
}

window.clearPin = function () {
    state.currentPin = '';
    $('pinInput').value = '';
    triggerHaptic(50);
}

window.confirmPin = async function () {
    if (state.currentPin.length < 4) {
        showToast('PIN deve ter 4 dígitos', 'warning');
        return;
    }

    if (currentPinMode === 'unlock') {
        const folderId = pinTargetId || state.currentFolder;
        const folder = state.folders.find(f => f.id === folderId);

        if (folder && state.currentPin === folder.pin) {
            triggerHaptic(100);
            closeModal('pinModal');
            showToast('PIN Correto!', 'success');

            // If we were unlocking to enter the folder
            if (state.contextTarget?.type !== 'folder' || !$('contextMenu').classList.contains('hidden')) {
                navigateToFolder(folderId);
            } else {
                // If we were unlocking to remove protection
                folder.isLocked = false;
                delete folder.pin;
                await saveToStore('folders', folder);
                updateUI();
                showToast('Proteção removida', 'success');
            }
        } else {
            triggerHaptic([50, 50, 50]);
            showToast('PIN Incorreto', 'error');
            clearPin();
        }
    } else if (currentPinMode === 'set') {
        // Mode 'set'
        const folder = state.folders.find(f => f.id === pinTargetId);
        if (folder) {
            folder.isLocked = true;
            folder.pin = state.currentPin;
            await saveToStore('folders', folder);
            closeModal('pinModal');
            updateUI();
            showToast('Pasta protegida com sucesso!', 'success');
            triggerHaptic(80);
        }
    }
}

$('closePinModalBtn').onclick = () => closeModal('pinModal');

// ============================================
// Search Functionality
// ============================================
function toggleSearch() {
    const searchBar = $('searchBar');
    const isHidden = searchBar.classList.contains('hidden');

    searchBar.classList.toggle('hidden');

    if (!isHidden) {
        $('searchInput').value = '';
        state.searchQuery = '';
        updateUI();
    } else {
        $('searchInput').focus();
    }
}

$('closeSearchBtn')?.addEventListener('click', toggleSearch);

$('searchInput')?.addEventListener('input', (e) => {
    state.searchQuery = e.target.value.toLowerCase();
    updateUI();
});

// ============================================
// Sort Functionality
// ============================================
$$('.sort-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        $$('.sort-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.sortBy = btn.dataset.sort;
        updateUI();
    });
});

function sortDocuments(docs) {
    const sorted = [...docs];

    switch (state.sortBy) {
        case 'date-desc':
            return sorted.sort((a, b) => new Date(b.date) - new Date(a.date));
        case 'date-asc':
            return sorted.sort((a, b) => new Date(a.date) - new Date(b.date));
        case 'name-asc':
            return sorted.sort((a, b) => a.name.localeCompare(b.name));
        case 'favorites':
            return sorted.sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0));
        default:
            return sorted;
    }
}

function filterDocuments(docs) {
    if (!state.searchQuery) return docs;

    return docs.filter(doc =>
        doc.name.toLowerCase().includes(state.searchQuery) ||
        (doc.tags && doc.tags.some(tag => tag.toLowerCase().includes(state.searchQuery)))
    );
}

// ============================================
// View Mode Toggle
// ============================================
function toggleViewMode() {
    state.viewMode = state.viewMode === 'grid' ? 'list' : 'grid';
    $('documentsGrid').classList.toggle('list-view', state.viewMode === 'list');

    const icon = state.viewMode === 'grid'
        ? '<path d="M4 11h5V5H4v6zm0 7h5v-6H4v6zm6 0h5v-6h-5v6zm6 0h5v-6h-5v6zm-6-7h5V5h-5v6zm6-6v6h5V5h-5z"/>'
        : '<path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>';

    $('viewModeBtn').querySelector('svg').innerHTML = icon;
}

// ============================================
// Favorites
// ============================================
async function toggleFavorite(docId) {
    const doc = state.documents.find(d => d.id === docId);
    if (!doc) return;

    doc.favorite = !doc.favorite;
    await saveToStore('documents', doc);
    updateUI();
    showToast(doc.favorite ? 'Adicionado aos favoritos' : 'Removido dos favoritos', 'success');
}

// ============================================
// Theme Management
// ============================================
function applyTheme(theme) {
    if (theme === 'auto') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        theme = prefersDark ? 'dark' : 'light';
        // Listen for OS-level change in real-time
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
            if (state.theme === 'auto') {
                document.body.classList.remove('theme-light', 'theme-dark');
                document.body.classList.add(e.matches ? 'theme-dark' : 'theme-light');
            }
        }, { once: false });
    }
    document.body.classList.remove('theme-light', 'theme-dark');
    document.body.classList.add(`theme-${theme}`);
    $$('.theme-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === state.theme);
    });
}

$$('.theme-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        state.theme = btn.dataset.theme;
        applyTheme(state.theme);
        saveSettings();
    });
});

// ============================================
// Settings Management
// ============================================
$('closeSettingsBtn')?.addEventListener('click', () => closeModal('settingsModal'));

$('qualityRange')?.addEventListener('input', (e) => {
    const value = e.target.value;
    $('qualityValue').textContent = `${value}%`;
    state.settings.quality = parseInt(value);
});

$('watermarkToggle')?.addEventListener('change', (e) => {
    state.settings.watermark = e.target.checked;
    $('watermarkTextGroup').classList.toggle('active', e.target.checked);
});

$('watermarkText')?.addEventListener('input', (e) => {
    state.settings.watermarkText = e.target.value;
});

$('autoSaveToggle')?.addEventListener('change', (e) => {
    state.settings.autoSave = e.target.checked;
});

async function saveSettings() {
    await saveToStore('settings', {
        key: 'appSettings',
        value: {
            ...state.settings,
            theme: state.theme
        }
    });
    showToast('Configurações salvas', 'success');
}

// Auto-save settings on modal close
const originalCloseSettings = () => closeModal('settingsModal');
$('closeSettingsBtn').onclick = () => {
    saveSettings();
    originalCloseSettings();
};

// ============================================
// OCR (Text Extraction) - REAL com Tesseract.js
// ============================================
let ocrWorker = null;

function showOCRInfo() {
    showToast('OCR: Visualize um documento e toque no ícone de texto', 'success');
}

// OCR direto da galeria
function openOCRFromGallery() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';

    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            // Criar imagem temporária
            const tempImg = new Image();
            tempImg.onload = async () => {
                // Extrair texto da imagem
                await extractTextFromImage(tempImg.src);
            };
            tempImg.src = event.target.result;
        };
        reader.readAsDataURL(file);
    };

    input.click();
}

async function extractTextWithAI(imageSrc) {
    const token = state.token || 'guest_system_token_777';
    try {
        let base64 = imageSrc;
        if (base64.includes('base64,')) {
            base64 = base64.split('base64,')[1];
        }
        updateProgress(40, 'Processando com Inteligência Artificial...');

        const prompt = 'Você é um assistente de OCR de altíssima precisão. Extraia todo o texto visível deste documento ou comprovante fiscal exatamente como está escrito, preservando nomes, telefones, CNPJ/CPF, número de pedido, datas e horários, itens, valores em R$, status e carimbos. Ignore ruídos de códigos de barra ou QR code (apenas mencione [QR Code presente] se houver). Retorne estritamente o texto transcrito, de maneira limpa, profissional e legível, sem introduções ou comentários adicionais.';

        let resp = await fetch('api/ai_vision.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                prompt: prompt,
                image: base64,
                token: token
            })
        }).catch(() => null);

        if (!resp || !resp.ok) {
            resp = await fetch('../keepai/api/ai_vision.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    prompt: prompt,
                    image: base64,
                    token: token
                })
            }).catch(() => null);
        }

        if (resp && resp.ok) {
            const data = await resp.json();
            if (data.text) {
                syncCredits();
                return data.text.trim();
            } else if (data.choices && data.choices[0] && data.choices[0].message) {
                syncCredits();
                return data.choices[0].message.content.trim();
            }
        }
    } catch (e) {
        console.warn('AI OCR fallback to Tesseract:', e);
    }
    return null;
}

async function extractTextFromImage(imageSrc) {
    showLoadingWithProgress('Iniciando OCR...');

    try {
        // 1. Tentar OCR de Alta Precisão com IA (Primeira opção para todos os documentos)
        updateProgress(20, 'Consultando Inteligência Artificial...');
        const aiText = await extractTextWithAI(imageSrc);
        if (aiText && aiText.length > 0) {
            $('ocrText').value = aiText;
            state.lastOcrText = aiText;
            hideLoading();
            openModal('ocrModal');
            showToast('Texto extraído com Inteligência Artificial! ✨', 'success');
            return;
        }

        // 2. Fallback para Tesseract Local
        if (typeof Tesseract === 'undefined') {
            throw new Error('Tesseract.js não carregado');
        }

        updateProgress(5, 'Carregando engine OCR local...');

        const worker = await Tesseract.createWorker(['por', 'eng'], 1, {
            logger: (m) => {
                if (m.status === 'recognizing text') {
                    const progress = Math.round(m.progress * 100);
                    updateProgress(progress, `Reconhecendo texto... ${progress}%`);
                } else if (m.status === 'loading language traineddata') {
                    updateProgress(20, 'Carregando idioma português...');
                }
            }
        });

        const { data: { text, confidence } } = await worker.recognize(imageSrc);
        await worker.terminate();

        const cleanText = sanitizeReceiptOcrText(text);

        if (cleanText.length === 0) {
            hideLoading();
            showToast('Nenhum texto encontrado', 'warning');
            return;
        }

        $('ocrText').value = cleanText;
        state.lastOcrText = cleanText;
        hideLoading();
        openModal('ocrModal');
        deductCredit();
        showToast(`Confiança: ${Math.round(confidence)}%`, 'success');

    } catch (error) {
        hideLoading();
        showToast('Erro no OCR: ' + error.message, 'error');
    }
}

function sanitizeReceiptOcrText(rawText) {
    if (!rawText) return '';
    const lines = rawText.split('\n');
    const cleanedLines = [];

    for (let line of lines) {
        let l = line.trim();
        if (!l) continue;

        // Remove leading/trailing pipe/bracket remnants from scan borders
        l = l.replace(/^[\|\!\[\]\(\)\{\}\\\/]+\s*/, '').replace(/\s*[\|\!\[\]\(\)\{\}\\\/]+$/, '').trim();
        if (!l) continue;

        // Common Brazilian receipt OCR fixes
        l = l.replace(/\bENPI\b/gi, 'CNPJ')
             .replace(/\bvaia\b/gi, 'Data')
             .replace(/\bCOLET\s+ADO\b/gi, 'COLETADO')
             .replace(/\bRS\s*(\d)/gi, 'R$ $1')
             .replace(/R\$\s*B(\d)/gi, 'R$ 8$1')
             .replace(/\bRe\s+Ke\b/gi, 'RECIBO')
             .replace(/\bPOIGA\b/gi, '99164');

        // Filter out obvious QR-code / noise hallucination lines
        const alphaNumCount = (l.match(/[a-zA-Z0-9À-ÿ]/g) || []).length;
        const totalCount = l.length;
        const symbolCount = (l.match(/[^a-zA-Z0-9À-ÿ\s]/g) || []).length;

        // If line has high density of random punctuation or single scattered letters
        if (totalCount > 3 && symbolCount > alphaNumCount && !l.includes('---')) {
            continue; // Skip noise line
        }
        if (l.match(/^[^\w\s]{2,}$/) || l.match(/^[a-z]\s+[a-z]\s+[a-z]$/i)) {
            continue; // Skip single-letter scattered lines from QR code
        }

        cleanedLines.push(l);
    }

    return cleanedLines.join('\n').trim();
}

$('viewerOcrBtn')?.addEventListener('click', extractText);
$('closeOcrBtn')?.addEventListener('click', () => closeModal('ocrModal'));
$('copyOcrBtn')?.addEventListener('click', copyOCRText);
$('shareOcrBtn')?.addEventListener('click', shareOCRText);

async function extractText() {
    const img = $('viewerImage');
    if (!img || !img.src) return;

    showLoadingWithProgress('Iniciando OCR...');

    try {
        // 1. Tentar OCR de Alta Precisão com IA (Primeira opção para todos os documentos)
        updateProgress(20, 'Consultando Inteligência Artificial...');
        const aiText = await extractTextWithAI(img.src);
        if (aiText && aiText.length > 0) {
            $('ocrText').value = aiText;
            state.lastOcrText = aiText;
            hideLoading();
            openModal('ocrModal');
            showToast('Texto extraído com Inteligência Artificial! ✨', 'success');
            return;
        }

        // 2. Fallback para Tesseract Local
        if (typeof Tesseract === 'undefined') {
            throw new Error('Tesseract.js não carregado');
        }

        updateProgress(5, 'Carregando engine OCR...');

        const worker = await Tesseract.createWorker(['por', 'eng'], 1, {
            logger: (m) => {
                if (m.status === 'recognizing text') {
                    const progress = Math.round(m.progress * 100);
                    updateProgress(progress, `Reconhecendo texto... ${progress}%`);
                } else if (m.status === 'loading language traineddata') {
                    updateProgress(20, 'Carregando idioma...');
                } else if (m.status === 'initializing api') {
                    updateProgress(10, 'Inicializando...');
                }
            }
        });

        await worker.setParameters({ tessedit_pageseg_mode: '6' });

        updateProgress(30, 'Processando imagem...');
        const { data: { text, confidence } } = await worker.recognize(img.src);
        await worker.terminate();

        updateProgress(100, 'Concluído!');

        const cleanText = sanitizeReceiptOcrText(text);

        if (cleanText.length === 0) {
            hideLoading();
            showToast('Nenhum texto encontrado na imagem', 'warning');
            return;
        }

        $('ocrText').value = cleanText;
        state.lastOcrText = cleanText;
        hideLoading();
        openModal('ocrModal');
        deductCredit();

        const confidencePercent = Math.round(confidence);
        showToast(`Texto extraído com ${confidencePercent}% de confiança`, 'success');

    } catch (error) {
        console.error('OCR Error:', error);
        hideLoading();

        if (error.message && error.message.includes('não carregado')) {
            showToast('Erro: Biblioteca OCR não disponível', 'error');
        } else {
            showToast('Erro ao extrair texto: ' + error.message, 'error');
        }
    }
}

function showLoadingWithProgress(text) {
    $('loadingText').textContent = text;
    $('loading').classList.remove('hidden');
    $('loadingProgress').classList.remove('hidden');
    updateProgress(0, text);
}

function updateProgress(percent, text) {
    const fill = $('progressFill');
    const textEl = $('progressText');
    const loadingText = $('loadingText');

    if (fill) fill.style.width = `${percent}%`;
    if (textEl) textEl.textContent = `${percent}%`;
    if (loadingText && text) loadingText.textContent = text;
}

function hideLoading() {
    $('loading').classList.add('hidden');
    $('loadingProgress')?.classList.add('hidden');
}

function copyOCRText() {
    const text = $('ocrText').value;
    if (!text) {
        showToast('Nenhum texto para copiar', 'error');
        return;
    }

    navigator.clipboard.writeText(text).then(() => {
        showToast('Texto copiado para a área de transferência!', 'success');
    }).catch(() => {
        // Fallback para dispositivos mais antigos
        const textarea = $('ocrText');
        textarea.select();
        document.execCommand('copy');
        showToast('Texto copiado!', 'success');
    });
}

async function shareOCRText() {
    const text = $('ocrText').value;
    if (!text) {
        showToast('Nenhum texto para compartilhar', 'error');
        return;
    }

    try {
        if (navigator.share) {
            await navigator.share({
                title: 'Texto extraído - DocScan Pro',
                text: text
            });
            showToast('Compartilhado com sucesso!', 'success');
        } else {
            // Fallback: copiar para clipboard
            await navigator.clipboard.writeText(text);
            showToast('Texto copiado! (Compartilhamento não suportado)', 'success');
        }
    } catch (error) {
        if (error.name !== 'AbortError') {
            showToast('Erro ao compartilhar', 'error');
        }
    }
}

function exportOcrToExcel() {
    const text = $('ocrText')?.value;
    if (!text || !text.trim()) {
        showToast('Nenhum texto OCR para exportar.', 'warning');
        return;
    }

    if (typeof XLSX === 'undefined') {
        showToast('Biblioteca XLSX não carregada.', 'error');
        return;
    }

    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length === 0) {
        showToast('Texto vazio para exportar.', 'warning');
        return;
    }

    const hasTabs = lines.some(l => l.includes('\t'));
    const hasPipes = lines.some(l => l.includes('|'));
    const hasSemicolons = lines.some(l => l.includes(';'));

    const rows = [];
    lines.forEach(line => {
        let cols;
        if (hasTabs) {
            cols = line.split('\t').map(c => c.trim());
        } else if (hasPipes) {
            cols = line.split('|').map(c => c.trim()).filter((c, idx, arr) => !(idx === 0 && c === '') && !(idx === arr.length - 1 && c === ''));
        } else if (hasSemicolons) {
            cols = line.split(';').map(c => c.trim());
        } else if (/\s{2,}/.test(line)) {
            cols = line.split(/\s{2,}/).map(c => c.trim());
        } else {
            cols = [line.trim()];
        }
        rows.push(cols);
    });

    try {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(rows);

        const colWidths = [];
        rows.forEach(row => {
            row.forEach((val, idx) => {
                const len = (val ? val.toString().length : 0);
                colWidths[idx] = Math.max(colWidths[idx] || 10, Math.min(50, len + 2));
            });
        });
        ws['!cols'] = colWidths.map(w => ({ wch: w }));

        XLSX.utils.book_append_sheet(wb, ws, "Dados OCR");

        const smartName = suggestSmartDocumentName(text);
        const filename = (smartName || `docscan_tabela_${Date.now()}`) + '.xlsx';

        XLSX.writeFile(wb, filename);
        showToast(`Planilha "${filename}" exportada com sucesso! 📊`, 'success');
        triggerHaptic(40);
    } catch (err) {
        console.error('XLSX export error:', err);
        showToast('Erro ao exportar planilha Excel: ' + err.message, 'error');
    }
}

// OCR da imagem atual no editor
async function extractTextFromCurrentImage() {
    const canvas = $('editorCanvas');
    if (!canvas) {
        showToast('Nenhuma imagem no editor', 'error');
        return;
    }

    if (!checkCreditsForOCR()) return;

    // Use the full high-res processed image from getCroppedImage for best OCR accuracy
    showLoadingWithProgress('Gerando imagem para OCR...');
    updateProgress(5, 'Preparando imagem em alta resolução...');
    const imageDataUrl = getCroppedImage();
    if (!imageDataUrl) {
        hideLoading();
        showToast('Nenhuma imagem disponível', 'error');
        return;
    }

    try {
        // 1. Tentar OCR de Alta Precisão com IA
        updateProgress(20, 'Consultando Inteligência Artificial...');
        const aiText = await extractTextWithAI(imageDataUrl);
        if (aiText && aiText.length > 0) {
            $('ocrText').value = aiText;
            state.lastOcrText = aiText;
            hideLoading();
            openModal('ocrModal');
            showToast('Texto extraído com Inteligência Artificial! ✨', 'success');
            return;
        }

        // 2. Fallback para Tesseract Local
        if (typeof Tesseract === 'undefined') {
            throw new Error('Tesseract.js não carregado');
        }

        updateProgress(5, 'Carregando engine OCR...');

        const worker = await Tesseract.createWorker(['por', 'eng'], 1, {
            logger: (m) => {
                if (m.status === 'recognizing text') {
                    const progress = Math.round(m.progress * 100);
                    updateProgress(progress, `Reconhecendo texto... ${progress}%`);
                } else if (m.status === 'loading language traineddata') {
                    updateProgress(20, 'Carregando idioma português...');
                }
            }
        });

        // PSM 6 = uniform block of text — best for typed/printed documents
        await worker.setParameters({ tessedit_pageseg_mode: '6' });

        const { data: { text, confidence } } = await worker.recognize(imageDataUrl);
        await worker.terminate();

        const cleanText = sanitizeReceiptOcrText(text);

        if (cleanText.length === 0) {
            hideLoading();
            showToast('Nenhum texto encontrado', 'warning');
            return;
        }

        $('ocrText').value = cleanText;
        state.lastOcrText = cleanText;
        hideLoading();
        openModal('ocrModal');
        deductCredit();
        showToast(`Confiança: ${Math.round(confidence)}%`, 'success');

    } catch (error) {
        hideLoading();
        showToast('Erro no OCR: ' + error.message, 'error');
    }
}

// ============================================
// QR CODE SCANNER - REAL com Html5-QRCode
// ============================================
let html5QrCode = null;
let qrScannerActive = false;

$('menuQRCode')?.addEventListener('click', () => {
    toggleSideMenu(false);
    openQRScanner();
});

$('closeQrBtn')?.addEventListener('click', closeQRScanner);
$('switchCameraBtn')?.addEventListener('click', switchCamera);
$('qrCopyBtn')?.addEventListener('click', copyQRResult);
$('qrOpenBtn')?.addEventListener('click', openQRLink);
$('qrScanAgainBtn')?.addEventListener('click', scanAgain);

async function openQRScanner() {
    openModal('qrModal');
    $('qrResult').classList.add('hidden');

    // Aguardar modal abrir
    await new Promise(resolve => setTimeout(resolve, 300));

    try {
        // Verificar se biblioteca está disponível
        if (typeof Html5Qrcode === 'undefined') {
            showToast('Biblioteca QR Code não disponível', 'error');
            return;
        }

        // Criar instância
        html5QrCode = new Html5Qrcode('qrReader');

        // Adicionar linha de scan animada
        const frame = document.querySelector('.qr-frame');
        if (frame && !frame.querySelector('.scan-line')) {
            const scanLine = document.createElement('div');
            scanLine.className = 'scan-line';
            frame.appendChild(scanLine);
        }

        // Configurações do scanner
        const config = {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0
        };

        // Iniciar scanner
        await html5QrCode.start(
            { facingMode: 'environment' },
            config,
            onQRCodeSuccess,
            onQRCodeError
        );

        qrScannerActive = true;

    } catch (error) {
        console.error('QR Scanner Error:', error);

        if (error.name === 'NotAllowedError') {
            showToast('Permissão de câmera negada', 'error');
        } else if (error.name === 'NotFoundError') {
            showToast('Câmera não encontrada', 'error');
        } else {
            showToast('Erro ao iniciar scanner: ' + error.message, 'error');
        }
    }
}

function onQRCodeSuccess(decodedText, decodedResult) {
    // Vibrar para feedback
    if (navigator.vibrate) {
        navigator.vibrate(200);
    }

    // Pausar scanner
    if (html5QrCode && qrScannerActive) {
        html5QrCode.pause();
    }

    // Mostrar resultado
    displayQRResult(decodedText);
}

function onQRCodeError(error) {
    // Erros de "não encontrado" são normais, ignorar
    // console.log('QR scan error:', error);
}

function displayQRResult(text) {
    const resultDiv = $('qrResult');
    const contentDiv = $('qrResultContent');
    const openBtn = $('qrOpenBtn');

    contentDiv.textContent = text;
    resultDiv.classList.remove('hidden');

    // Verificar se é URL
    const isUrl = /^(https?:\/\/|www\.)/i.test(text);
    openBtn.classList.toggle('hidden', !isUrl);

    // Scroll para resultado
    resultDiv.scrollIntoView({ behavior: 'smooth' });
}

function copyQRResult() {
    const text = $('qrResultContent').textContent;
    navigator.clipboard.writeText(text).then(() => {
        showToast('Copiado para área de transferência!', 'success');
    }).catch(() => {
        showToast('Erro ao copiar', 'error');
    });
}

function openQRLink() {
    let url = $('qrResultContent').textContent;

    // Adicionar protocolo se necessário
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
    }

    window.open(url, '_blank');
}

function scanAgain() {
    $('qrResult').classList.add('hidden');

    if (html5QrCode) {
        html5QrCode.resume();
    }
}

async function switchCamera() {
    if (!html5QrCode || !qrScannerActive) return;

    try {
        // Obter câmeras disponíveis
        const cameras = await Html5Qrcode.getCameras();

        if (cameras.length < 2) {
            showToast('Apenas uma câmera disponível', 'warning');
            return;
        }

        // Parar scanner atual
        await html5QrCode.stop();

        // Alternar entre front e back
        const currentFacing = html5QrCode._currentFacingMode || 'environment';
        const newFacing = currentFacing === 'environment' ? 'user' : 'environment';

        // Reiniciar com nova câmera
        await html5QrCode.start(
            { facingMode: newFacing },
            { fps: 10, qrbox: { width: 250, height: 250 } },
            onQRCodeSuccess,
            onQRCodeError
        );

        html5QrCode._currentFacingMode = newFacing;
        showToast(newFacing === 'user' ? 'Câmera frontal' : 'Câmera traseira', 'success');

    } catch (error) {
        console.error('Switch camera error:', error);
        showToast('Erro ao trocar câmera', 'error');
    }
}

async function closeQRScanner() {
    if (html5QrCode && qrScannerActive) {
        try {
            await html5QrCode.stop();
        } catch (e) {
            console.log('Scanner already stopped');
        }
        qrScannerActive = false;
    }

    closeModal('qrModal');
    $('qrResult').classList.add('hidden');
}

// ============================================
// Share Functionality
// ============================================
$('viewerShareBtn')?.addEventListener('click', () => shareDocument());

async function shareDocument(doc) {
    if (!doc || doc instanceof Event) {
        doc = state.viewerDoc || state.documents.find(d => d.id === state.contextTarget?.id);
    }
    if (!doc) {
        showToast('Nenhum documento aberto para compartilhar', 'error');
        return;
    }

    // Determine the exact image to share (current page or doc image)
    const currentIndex = state.activePageIndex || 0;
    const targetImage = (doc.pages && doc.pages[currentIndex]) ? doc.pages[currentIndex] : (doc.image || doc.pages?.[0]);

    if (!targetImage) {
        showToast('Imagem do documento não encontrada', 'error');
        return;
    }

    try {
        let baseName = (doc.name || 'documento').trim();
        // If multi-page, append page number to filename if > 1 page
        if (doc.pages && doc.pages.length > 1) {
            baseName = `${baseName}_pag_${currentIndex + 1}`;
        }

        const isPdf = doc.type === 'pdf' || targetImage.startsWith('data:application/pdf');
        const ext = isPdf ? '.pdf' : '.jpg';
        const mimeType = isPdf ? 'application/pdf' : 'image/jpeg';

        let fileName = baseName;
        if (!fileName.toLowerCase().endsWith('.jpg') && !fileName.toLowerCase().endsWith('.jpeg') && !fileName.toLowerCase().endsWith('.png') && !fileName.toLowerCase().endsWith('.pdf')) {
            fileName += ext;
        }

        // Convert data URL to Blob reliably
        let blob;
        if (targetImage.startsWith('data:')) {
            const arr = targetImage.split(',');
            const mime = arr[0].match(/:(.*?);/)?.[1] || mimeType;
            const bstr = atob(arr[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) {
                u8arr[n] = bstr.charCodeAt(n);
            }
            blob = new Blob([u8arr], { type: mime });
        } else {
            const response = await fetch(targetImage);
            blob = await response.blob();
        }

        const file = new File([blob], fileName, { type: blob.type || mimeType });

        let shared = false;

        // 1. Try Web Share API with File
        if (navigator.share) {
            try {
                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                    await navigator.share({
                        title: fileName,
                        text: 'Documento digitalizado com DocScan Pro',
                        files: [file]
                    });
                    shared = true;
                }
            } catch (shareFileErr) {
                console.warn('Web Share File attempt fallback:', shareFileErr);
            }
        }

        // 2. Try Web Share API fallback without file
        if (!shared && navigator.share) {
            try {
                await navigator.share({
                    title: fileName,
                    text: 'DocScan Pro — ' + fileName
                });
                shared = true;
            } catch (shareTextErr) {}
        }

        if (shared) {
            triggerHaptic('success');
            showToast('Compartilhado com sucesso!', 'success');
        } else {
            // Direct download fallback for desktop browsers
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(a.href), 2000);
            showToast('Arquivo baixado para compartilhamento!', 'info');
        }
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error('Share error:', error);
            showToast('Erro ao compartilhar arquivo', 'error');
        }
    }
}

// ============================================
// Statistics
// ============================================
$('closeStatsBtn')?.addEventListener('click', () => closeModal('statsModal'));

async function showStats() {
    const totalDocs = state.documents.length;
    const totalFolders = state.folders.length;
    const totalFavorites = state.documents.filter(d => d.favorite).length;
    const totalPages = state.documents.reduce((sum, doc) => sum + (doc.pageCount || 1), 0);

    // Calculate storage
    let totalSize = 0;
    for (const doc of state.documents) {
        totalSize += doc.image ? doc.image.length : 0;
    }

    const sizeKB = Math.round(totalSize / 1024);
    const sizeMB = (sizeKB / 1024).toFixed(2);
    const storageText = sizeKB < 1024 ? `${sizeKB} KB` : `${sizeMB} MB`;

    $('totalDocs').textContent = totalDocs;
    $('totalFolders').textContent = totalFolders;
    $('totalFavorites').textContent = totalFavorites;
    $('totalPages').textContent = totalPages;
    $('storageUsed').textContent = storageText;

    toggleSideMenu(false);
    openModal('statsModal');
}

// ============================================
// Backup/Export
// ============================================
async function showBackupOptions() {
    const choice = confirm('Exportar todos os dados?\n\nOK = Exportar\nCancelar = Importar');

    if (choice) {
        await exportBackup();
    } else {
        importBackup();
    }

    toggleSideMenu(false);
}

async function exportBackup() {
    showLoading('Exportando dados...');

    try {
        const backup = {
            version: '2.0.0',
            timestamp: new Date().toISOString(),
            documents: state.documents,
            folders: state.folders,
            settings: state.settings
        };

        const json = JSON.stringify(backup, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `docscan-backup-${formatTimestamp(new Date())}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        hideLoading();
        showToast('Backup exportado com sucesso!', 'success');
    } catch (error) {
        hideLoading();
        showToast('Erro ao exportar backup', 'error');
    }
}

function importBackup() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        showLoading('Importando dados...');

        try {
            const text = await file.text();
            const backup = JSON.parse(text);

            if (!backup.version || !backup.documents) {
                throw new Error('Arquivo de backup inválido');
            }

            // Restore data
            for (const doc of backup.documents) {
                await saveToStore('documents', doc);
            }

            for (const folder of backup.folders) {
                await saveToStore('folders', folder);
            }

            if (backup.settings) {
                await saveToStore('settings', {
                    key: 'appSettings',
                    value: backup.settings
                });
            }

            // Reload
            await loadData();
            updateUI();

            hideLoading();
            showToast('Backup importado com sucesso!', 'success');
        } catch (error) {
            hideLoading();
            showToast('Erro ao importar backup', 'error');
        }
    };

    input.click();
}

// ============================================
// Tutorial
// ============================================
let currentSlide = 0;

$('tutorialNext')?.addEventListener('click', nextTutorialSlide);
$('tutorialSkip')?.addEventListener('click', closeTutorial);

function nextTutorialSlide() {
    const slides = $$('.tutorial-slide');
    const dots = $$('.tutorial-dots .dot');

    if (currentSlide < slides.length - 1) {
        slides[currentSlide].classList.remove('active');
        slides[currentSlide].classList.add('prev');
        dots[currentSlide].classList.remove('active');

        currentSlide++;

        slides[currentSlide].classList.add('active');
        slides[currentSlide].classList.remove('prev');
        dots[currentSlide].classList.add('active');

        if (currentSlide === slides.length - 1) {
            $('tutorialNext').textContent = 'Começar';
        }
    } else {
        closeTutorial();
    }
}

async function closeTutorial() {
    await saveToStore('settings', { key: 'tutorialShown', value: true });
    state.tutorialShown = true;
    currentSlide = 0;

    const slides = $$('.tutorial-slide');
    const dots = $$('.tutorial-dots .dot');

    slides.forEach((slide, i) => {
        slide.classList.remove('active', 'prev');
        if (i === 0) slide.classList.add('active');
    });

    dots.forEach((dot, i) => {
        dot.classList.remove('active');
        if (i === 0) dot.classList.add('active');
    });

    $('tutorialNext').textContent = 'Próximo';
    closeModal('tutorialModal');
}

// ============================================
// Viewer Zoom & Pan
// ============================================
let isZooming = false;
let lastDistance = 0;
let isPanning = false;
let startPan = { x: 0, y: 0 };

const viewerContent = $('viewerContent');
const viewerImage = $('viewerImage');

if (viewerContent) {
    // Touch events for zoom
    viewerContent.addEventListener('touchstart', handleTouchStart);
    viewerContent.addEventListener('touchmove', handleTouchMove);
    viewerContent.addEventListener('touchend', handleTouchEnd);

    // Mouse events for pan
    viewerContent.addEventListener('mousedown', handleMouseDown);
    viewerContent.addEventListener('mousemove', handleMouseMove);
    viewerContent.addEventListener('mouseup', handleMouseUp);

    // Wheel for zoom
    viewerContent.addEventListener('wheel', handleWheel, { passive: false });
}

function handleTouchStart(e) {
    if (e.touches.length === 2) {
        isZooming = true;
        lastDistance = getDistance(e.touches[0], e.touches[1]);
    } else if (e.touches.length === 1 && state.viewerZoom > 1) {
        isPanning = true;
        startPan = {
            x: e.touches[0].clientX - state.viewerPan.x,
            y: e.touches[0].clientY - state.viewerPan.y
        };
    }
}

function handleTouchMove(e) {
    if (isZooming && e.touches.length === 2) {
        e.preventDefault();
        const distance = getDistance(e.touches[0], e.touches[1]);
        const delta = distance - lastDistance;
        state.viewerZoom = Math.max(1, Math.min(5, state.viewerZoom + delta * 0.01));
        lastDistance = distance;
        updateViewerTransform();
    } else if (isPanning && e.touches.length === 1) {
        e.preventDefault();
        state.viewerPan = {
            x: e.touches[0].clientX - startPan.x,
            y: e.touches[0].clientY - startPan.y
        };
        updateViewerTransform();
    }
}

function handleTouchEnd(e) {
    if (e.touches.length < 2) {
        isZooming = false;
    }
    if (e.touches.length === 0) {
        isPanning = false;
        if (state.viewerZoom === 1) {
            state.viewerPan = { x: 0, y: 0 };
            updateViewerTransform();
        }
    }
}

function handleMouseDown(e) {
    if (state.viewerZoom > 1) {
        isPanning = true;
        startPan = {
            x: e.clientX - state.viewerPan.x,
            y: e.clientY - state.viewerPan.y
        };
    }
}

function handleMouseMove(e) {
    if (isPanning) {
        state.viewerPan = {
            x: e.clientX - startPan.x,
            y: e.clientY - startPan.y
        };
        updateViewerTransform();
    }
}

function handleMouseUp() {
    isPanning = false;
}

function handleWheel(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    state.viewerZoom = Math.max(1, Math.min(5, state.viewerZoom + delta));

    if (state.viewerZoom === 1) {
        state.viewerPan = { x: 0, y: 0 };
    }

    updateViewerTransform();
}

function getDistance(touch1, touch2) {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

function updateViewerTransform() {
    if (viewerImage) {
        viewerImage.style.transform = `scale(${state.viewerZoom}) translate(${state.viewerPan.x / state.viewerZoom}px, ${state.viewerPan.y / state.viewerZoom}px)`;
    }
}

// ============================================
// Watermark Application
// ============================================
function applyWatermark(canvas) {
    if (!state.settings.watermark) return;

    const ctx = canvas.getContext('2d');
    const text = state.settings.watermarkText || 'DocScan Pro';

    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.font = '20px Inter';
    ctx.fillStyle = '#888888';
    ctx.textAlign = 'center';
    ctx.translate(canvas.width / 2, canvas.height - 30);
    ctx.fillText(text, 0, 0);
    ctx.restore();
}

// Make functions globally available
window.handleItemClick = handleItemClick;
window.showContextMenu = showContextMenu;
window.navigateToFolder = navigateToFolder;
window.removePage = removePage;
window.moveToFolder = moveToFolder;
window.toggleFavorite = toggleFavorite;

// ============================================
// ============================================
// Keep AI - Payment, Credits and Backdoor Integration
// ============================================

async function syncCredits() {
    state.token = localStorage.getItem('keepai_token') || null;
    if (!state.token) {
        updateCreditsUI();
        return;
    }

    try {
        let resp = await fetch('api/auth.php', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${state.token}` }
        }).catch(() => null);

        if (!resp || !resp.ok) {
            resp = await fetch('../keepai/api/auth.php', {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${state.token}` }
            });
        }

        if (resp.status === 401) {
            logout();
            return;
        }

        const data = await resp.json();
        if (data.success && data.user) {
            state.credits = data.user.credits;
            state.user = data.user;
            updateCreditsUI();
        }
    } catch (e) {
        console.warn('Erro ao sincronizar créditos:', e);
    }
}

function updateCreditsUI() {
    const isLogged = !!state.token;
    const badge = $('unified-user-badge');
    const emailSpan = $('unified-user-email');
    const valSpan = $('unified-credits-val');
    const loginBtn = $('unified-login-btn');
    const quickAdminBtn = $('quickLoginAdminBtn');
    const openLoginBtn = $('openLoginBtn');
    const logoutBtn = $('logoutBtn');
    const nameDisplay = $('userNameDisplay');
    const emailDisplay = $('userEmailDisplay');

    if (valSpan) {
        valSpan.textContent = isLogged ? `${state.credits} créditos` : '10 créditos';
    }

    if (isLogged && state.user) {
        if (badge) badge.style.display = 'flex';
        if (emailSpan) emailSpan.textContent = state.user.email || state.user.display_name;
        if (nameDisplay) nameDisplay.textContent = state.user.display_name || 'Usuário VIP';
        if (emailDisplay) {
            emailDisplay.textContent = `${state.user.email} (${state.credits} créditos)`;
            emailDisplay.classList.remove('hidden');
        }
        if (quickAdminBtn) quickAdminBtn.classList.add('hidden');
        if (openLoginBtn) openLoginBtn.classList.add('hidden');
        if (logoutBtn) logoutBtn.classList.remove('hidden');

        if (loginBtn) {
            loginBtn.textContent = 'Sair';
            loginBtn.classList.remove('highlight');
            loginBtn.style.background = 'rgba(255, 255, 255, 0.1)';
            loginBtn.style.color = 'var(--text-primary)';
            loginBtn.style.boxShadow = 'none';
            loginBtn.onclick = () => logout();
        }
    } else {
        if (badge) badge.style.display = 'none';
        if (valSpan) valSpan.textContent = 'Sem Login';
        if (quickAdminBtn) quickAdminBtn.classList.remove('hidden');
        if (openLoginBtn) openLoginBtn.classList.remove('hidden');
        if (logoutBtn) logoutBtn.classList.add('hidden');

        if (loginBtn) {
            loginBtn.textContent = 'Entrar';
            loginBtn.style.background = '';
            loginBtn.style.color = '';
            loginBtn.classList.add('highlight');
            loginBtn.onclick = () => handleCreditsClick();
        }
    }
}

async function quickLoginAdmin() {
    toggleSideMenu(false);
    showLoading('Entrando como fbr4g4@gmail.com...');
    try {
        let resp = await fetch('api/auth.php?action=login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'fbr4g4@gmail.com',
                password: 'Fbr4g4@'
            })
        }).catch(() => null);

        if (!resp || !resp.ok) {
            resp = await fetch('../keepai/api/auth.php?action=login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: 'fbr4g4@gmail.com',
                    password: 'Fbr4g4@'
                })
            });
        }

        const data = await resp.json();
        hideLoading();

        if (data.success && data.token) {
            localStorage.setItem('keepai_token', data.token);
            state.token = data.token;
            state.credits = data.user.credits;
            state.user = data.user;
            updateCreditsUI();
            showToast('Bem-vindo Fabiano! 999.999 créditos de IA liberados! 🚀', 'success');
        } else {
            showToast(data.error || 'Erro ao entrar.', 'error');
        }
    } catch (e) {
        hideLoading();
        showToast('Erro de conexão ao autenticar.', 'error');
    }
}
window.quickLoginAdmin = quickLoginAdmin;

function handleCreditsClick() {
    if (!state.token) {
        openLoginModal();
    } else {
        openRechargeModal();
    }
}

function openLoginModal() {
    toggleSideMenu(false);
    openModal('modalOverlay');
    renderLoginModal(true);
}

function renderLoginModal(isLoginMode) {
    const overlay = $('modalOverlay');
    overlay.innerHTML = `
        <div class="modal-content" style="max-width: 400px; border-radius: 28px; padding: 28px; color: var(--text-primary); border: 2px solid var(--border-color); box-shadow: var(--shadow-lg); position: relative;">
            <button onclick="app.closeModal()" style="position: absolute; top: 16px; right: 16px; border: none; background: transparent; color: var(--text-secondary); cursor: pointer; font-size: 18px;">✕</button>
            
            <div style="text-align: center; margin-bottom: 20px;">
                <div style="font-size: 2rem; margin-bottom: 8px;">${isLoginMode ? '🔑' : '🚀'}</div>
                <h2 style="font-size: 1.4rem; font-weight: 800; color: var(--accent-secondary); margin: 0;">
                    ${isLoginMode ? 'Entrar no DocScan Pro' : 'Criar Conta Grátis'}
                </h2>
                <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 6px;">
                    ${isLoginMode ? 'Acesse com sua conta unificada 4uLabs' : 'Crie sua conta e ganhe <strong style="color:var(--accent-secondary)">+10 créditos</strong> grátis!'}
                </p>
            </div>

            <form onsubmit="app.handleAuthSubmit(event, ${isLoginMode})" style="display: flex; flex-direction: column; gap: 14px;">
                <div>
                    <label style="display: block; font-size: 0.75rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 6px; text-transform: uppercase;">E-mail</label>
                    <input type="email" id="auth-email" required placeholder="seu@email.com" style="width: 100%; box-sizing: border-box; background: var(--bg-tertiary); border: 2px solid var(--border-color); border-radius: 12px; padding: 12px 14px; color: var(--text-primary); font-size: 0.95rem; outline: none; transition: border-color 0.2s;">
                </div>

                <div>
                    <label style="display: block; font-size: 0.75rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 6px; text-transform: uppercase;">Senha</label>
                    <input type="password" id="auth-password" required placeholder="••••••••" minlength="6" style="width: 100%; box-sizing: border-box; background: var(--bg-tertiary); border: 2px solid var(--border-color); border-radius: 12px; padding: 12px 14px; color: var(--text-primary); font-size: 0.95rem; outline: none; transition: border-color 0.2s;">
                </div>

                <button type="submit" id="auth-btn" class="btn-primary" style="margin-top: 10px; border-radius: 14px; padding: 14px; font-weight: 800; font-size: 0.95rem; letter-spacing: 0.5px;">
                    ${isLoginMode ? '🔓 ENTRAR AGORA' : '🚀 CADASTRAR E GANHAR CRÉDITOS'}
                </button>
            </form>

            <div style="text-align: center; margin-top: 20px; font-size: 0.85rem; color: var(--text-secondary);">
                ${isLoginMode ? 'Ainda não tem conta?' : 'Já possui uma conta?'}
                <span onclick="app.renderLoginModal(${!isLoginMode})" style="color: var(--accent-secondary); text-decoration: underline; cursor: pointer; font-weight: 700; margin-left: 4px;">
                    ${isLoginMode ? 'Cadastre-se grátis ↗' : 'Fazer login'}
                </span>
            </div>
        </div>
    `;

    setTimeout(() => {
        const input = $('auth-email');
        if (input) {
            input.focus();
            input.parentElement.querySelectorAll('input').forEach(i => {
                i.addEventListener('focus', () => i.style.borderColor = 'var(--accent-secondary)');
                i.addEventListener('blur', () => i.style.borderColor = 'var(--border-color)');
            });
        }
    }, 100);
}

async function handleAuthSubmit(event, isLoginMode) {
    event.preventDefault();
    const email = $('auth-email').value.trim();
    const password = $('auth-password').value.trim();
    const btn = $('auth-btn');

    btn.disabled = true;
    btn.innerHTML = `<span class="loading-spinner" style="width: 12px; height: 12px; border-width: 2px; display: inline-block; vertical-align: middle; margin-right: 6px;"></span> PROCESSANDO...`;

    const action = isLoginMode ? 'login' : 'register';

    try {
        let resp = await fetch(`api/auth.php?action=${action}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        }).catch(() => null);

        if (!resp || !resp.ok) {
            resp = await fetch(`../keepai/api/auth.php?action=${action}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
        }

        const data = await resp.json();

        if (data.success && data.token) {
            localStorage.setItem('keepai_token', data.token);
            state.token = data.token;
            state.credits = data.user.credits;
            state.user = data.user;
            
            updateCreditsUI();
            closeModal('modalOverlay');
            showToast(isLoginMode ? 'Bem-vindo de volta!' : 'Conta criada! +10 créditos adicionados.', 'success');
        } else {
            throw new Error(data.error || 'Erro na autenticação');
        }
    } catch (e) {
        showToast(e.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = isLoginMode ? 'ENTRAR AGORA' : 'CADASTRAR E GANHAR CRÉDITOS';
    }
}

let paypalSDKLoaded = false;
let paypalSDKLoading = false;

function loadPayPalSDK(callback) {
    if (window.paypal) {
        callback();
        return;
    }
    if (paypalSDKLoading) {
        const check = setInterval(() => {
            if (window.paypal) {
                clearInterval(check);
                callback();
            }
        }, 100);
        return;
    }
    paypalSDKLoading = true;
    const script = document.createElement('script');
    script.src = 'https://www.paypal.com/sdk/js?client-id=BAAsoqPW8MlsLqTNKrQMoPEeqyfKafERMBvspk51nt_y9eSMEKqFSOMNfzgMlg7ru7TOYtvj_FOtx5mFf0&currency=USD&enable-funding=card';
    script.async = true;
    script.onload = () => {
        paypalSDKLoaded = true;
        paypalSDKLoading = false;
        callback();
    };
    script.onerror = () => {
        paypalSDKLoading = false;
        showToast('Error loading PayPal SDK', 'error');
    };
    document.head.appendChild(script);
}

function openRechargeModal() {
    toggleSideMenu(false);
    openModal('modalOverlay');
    state.rechargeMethod = (typeof currentLang !== 'undefined' && currentLang === 'en') ? 'paypal' : 'pix';
    state.selectedPackage = 1;
    renderRechargeModalContent();
}

function setRechargeMethod(method) {
    state.rechargeMethod = method;
    state.selectedPackage = 1;
    renderRechargeModalContent();
}

function renderRechargeModalContent() {
    const overlay = $('modalOverlay');
    if (!overlay) return;

    const isEn = (typeof currentLang !== 'undefined' && currentLang === 'en');
    const isPix = state.rechargeMethod === 'pix';
    const pricesBRL = ["R$ 4,90", "R$ 19,90", "R$ 34,90"];
    const pricesUSD = ["$0.99", "$3.99", "$6.99"];

    overlay.innerHTML = `
        <div class="modal-content" style="max-width: 420px; border-radius: 28px; padding: 24px; color: var(--text-primary); border: 2px solid var(--border-color); box-shadow: var(--shadow-lg); position: relative; display: flex; flex-direction: column; gap: 14px;">
            <button onclick="app.closeModal()" style="position: absolute; top: 16px; right: 16px; border: none; background: transparent; color: var(--text-secondary); cursor: pointer; font-size: 18px;">✕</button>
            
            <div style="text-align: center;">
                <h2 style="font-size: 1.35rem; font-weight: 800; color: var(--accent-secondary); margin: 0;">
                    ${isEn ? 'Buy AI Credits' : 'Recarregar Créditos'}
                </h2>
                <p style="font-size: 0.8rem; color: var(--text-muted); margin: 6px 0 0 0;">
                    ${isEn ? 'Instant credit delivery for AI OCR text recognition' : 'Escolha a forma de pagamento e o pacote de créditos'}
                </p>
            </div>

            <!-- Payment Method Tabs -->
            <div style="display: flex; gap: 8px; background: var(--bg-tertiary); padding: 4px; border-radius: 12px; border: 1px solid var(--border-color);">
                <button type="button" id="tab-method-pix" onclick="app.setRechargeMethod('pix')" style="flex: 1; padding: 8px 10px; border-radius: 8px; border: none; font-weight: 700; font-size: 0.8rem; cursor: pointer; transition: all 0.2s; ${isPix ? 'background: var(--accent-gradient); color: #fff;' : 'background: transparent; color: var(--text-secondary);'}">
                    🇧🇷 PIX (R$ BRL)
                </button>
                <button type="button" id="tab-method-paypal" onclick="app.setRechargeMethod('paypal')" style="flex: 1; padding: 8px 10px; border-radius: 8px; border: none; font-weight: 700; font-size: 0.8rem; cursor: pointer; transition: all 0.2s; ${!isPix ? 'background: var(--accent-gradient); color: #fff;' : 'background: transparent; color: var(--text-secondary);'}">
                    🌐 PayPal (US$ USD)
                </button>
            </div>

            <div id="recharge-content" style="display: flex; flex-direction: column; gap: 16px;">
                <!-- Package Cards -->
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
                    <div id="pkg-card-0" onclick="app.selectPackage(0)" style="box-sizing: border-box; background: var(--bg-tertiary); border: 2px solid ${state.selectedPackage === 0 ? 'var(--accent-secondary)' : 'var(--border-color)'}; border-radius: 16px; padding: 14px 6px; text-align: center; cursor: pointer; transition: all 0.3s;">
                        <div style="font-weight: 800; font-size: 1.2rem; color: var(--text-primary);">10</div>
                        <div style="font-size: 0.72rem; color: var(--text-secondary); margin-bottom: 6px;">${isEn ? 'credits' : 'créditos'}</div>
                        <div style="font-weight: 700; font-size: 0.88rem; color: var(--accent-secondary);">${isPix ? pricesBRL[0] : pricesUSD[0]}</div>
                    </div>
                    <div id="pkg-card-1" onclick="app.selectPackage(1)" style="box-sizing: border-box; background: var(--bg-tertiary); border: 2px solid ${state.selectedPackage === 1 ? 'var(--accent-secondary)' : 'var(--border-color)'}; border-radius: 16px; padding: 14px 6px; text-align: center; cursor: pointer; transition: all 0.3s; position: relative;">
                        <span style="position: absolute; top: -10px; left: 50%; transform: translateX(-50%); background: var(--accent-secondary); color: #000; font-size: 0.6rem; font-weight: 900; padding: 2px 6px; border-radius: 8px; text-transform: uppercase;">Top</span>
                        <div style="font-weight: 800; font-size: 1.2rem; color: var(--text-primary);">50</div>
                        <div style="font-size: 0.72rem; color: var(--text-secondary); margin-bottom: 6px;">${isEn ? 'credits' : 'créditos'}</div>
                        <div style="font-weight: 700; font-size: 0.88rem; color: var(--accent-secondary);">${isPix ? pricesBRL[1] : pricesUSD[1]}</div>
                    </div>
                    <div id="pkg-card-2" onclick="app.selectPackage(2)" style="box-sizing: border-box; background: var(--bg-tertiary); border: 2px solid ${state.selectedPackage === 2 ? 'var(--accent-secondary)' : 'var(--border-color)'}; border-radius: 16px; padding: 14px 6px; text-align: center; cursor: pointer; transition: all 0.3s;">
                        <div style="font-weight: 800; font-size: 1.2rem; color: var(--text-primary);">100</div>
                        <div style="font-size: 0.72rem; color: var(--text-secondary); margin-bottom: 6px;">${isEn ? 'credits' : 'créditos'}</div>
                        <div style="font-weight: 700; font-size: 0.88rem; color: var(--accent-secondary);">${isPix ? pricesBRL[2] : pricesUSD[2]}</div>
                    </div>
                </div>

                ${isPix ? `
                    <button id="generate-pix-btn" onclick="app.createPixPayment()" class="btn-primary" style="width: 100%; border-radius: 14px; padding: 14px; font-weight: 800; font-size: 0.95rem; letter-spacing: 0.5px;">
                        GERAR PIX (${pricesBRL[state.selectedPackage]})
                    </button>
                ` : `
                    <div id="paypal-button-container" style="min-height: 46px;"></div>
                `}

                <div style="font-size: 0.72rem; color: var(--text-muted); text-align: center; line-height: 1.4; background: rgba(108,92,231,0.08); padding: 8px 12px; border-radius: 10px; border: 1px solid rgba(108,92,231,0.2);">
                    💎 <strong>${isEn ? '100% Free App:' : '100% Gratuito:'}</strong> ${isEn ? 'Scanning, filters, signing and PDFs are completely free. Credits are required strictly for AI OCR text recognition.' : 'Todos os recursos de scanner, filtros, assinatura e PDF são gratuitos e ilimitados. Os créditos são necessários apenas para o uso de IA (OCR).'}
                </div>
            </div>
        </div>
    `;

    if (!isPix) {
        renderPayPalButtons();
    }
}

function renderPayPalButtons() {
    const container = $('paypal-button-container');
    if (!container) return;

    container.innerHTML = `
        <div style="text-align: center; padding: 12px; color: var(--text-secondary); font-size: 0.82rem;">
            <span class="loading-spinner" style="width: 14px; height: 14px; border-width: 2px; display: inline-block; vertical-align: middle; margin-right: 6px;"></span>
            ${typeof currentLang !== 'undefined' && currentLang === 'en' ? 'Loading PayPal & Card options...' : 'Carregando PayPal e Cartão...'}
        </div>
    `;

    loadPayPalSDK(() => {
        if (!window.paypal) {
            container.innerHTML = `<div style="color: var(--danger); font-size: 0.8rem; text-align: center;">Error loading PayPal. Please refresh.</div>`;
            return;
        }

        container.innerHTML = '';
        window.paypal.Buttons({
            style: {
                layout: 'vertical',
                color: 'gold',
                shape: 'rect',
                label: 'paypal',
                height: 45
            },
            createOrder: async () => {
                if (!state.token) {
                    showToast(typeof currentLang !== 'undefined' && currentLang === 'en' ? 'Please log in with your Google account first.' : 'Faça login com sua conta Google antes de comprar.', 'error');
                    openLoginModal();
                    throw new Error('Not authenticated');
                }
                const resp = await fetch('../keepai/api/paypal_create_order.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${state.token}`
                    },
                    body: JSON.stringify({ package_index: state.selectedPackage })
                });
                const orderData = await resp.json();
                if (!orderData.success || !orderData.order_id) {
                    throw new Error(orderData.error || 'Error creating PayPal order');
                }
                return orderData.order_id;
            },
            onApprove: async (data) => {
                container.innerHTML = `
                    <div style="text-align: center; padding: 12px; color: var(--accent-secondary); font-size: 0.85rem;">
                        <span class="loading-spinner" style="width: 14px; height: 14px; border-width: 2px; display: inline-block; vertical-align: middle; margin-right: 6px;"></span>
                        ${typeof currentLang !== 'undefined' && currentLang === 'en' ? 'Confirming payment with PayPal...' : 'Confirmando pagamento no PayPal...'}
                    </div>
                `;
                try {
                    const resp = await fetch('../keepai/api/paypal_capture_order.php', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${state.token}`
                        },
                        body: JSON.stringify({ order_id: data.orderID })
                    });
                    const captureData = await resp.json();
                    if (captureData.success) {
                        state.credits = captureData.new_credits;
                        updateCreditsUI();
                        closeModal('modalOverlay');
                        showToast(typeof currentLang !== 'undefined' && currentLang === 'en' ? `Payment approved! +${captureData.credits_added} credits added.` : `Pagamento aprovado! +${captureData.credits_added} créditos adicionados.`, 'success');
                    } else {
                        throw new Error(captureData.error || 'Payment capture failed');
                    }
                } catch (err) {
                    showToast(err.message, 'error');
                    renderPayPalButtons();
                }
            },
            onError: (err) => {
                console.error('PayPal Error:', err);
                showToast(typeof currentLang !== 'undefined' && currentLang === 'en' ? 'PayPal payment was cancelled or encountered an error.' : 'Pagamento via PayPal cancelado ou com erro.', 'error');
            }
        }).render('#paypal-button-container');
    });
}

function selectPackage(index) {
    state.selectedPackage = index;
    const isPix = state.rechargeMethod === 'pix';
    const pricesBRL = ["R$ 4,90", "R$ 19,90", "R$ 34,90"];
    
    [0, 1, 2].forEach(i => {
        const card = $(`pkg-card-${i}`);
        if (card) {
            card.style.borderColor = (i === index) ? 'var(--accent-secondary)' : 'var(--border-color)';
        }
    });

    if (isPix) {
        const btn = $('generate-pix-btn');
        if (btn) {
            btn.textContent = `GERAR PIX (${pricesBRL[index]})`;
        }
    }
}

async function createPixPayment() {
    const btn = $('generate-pix-btn');
    btn.disabled = true;
    btn.innerHTML = `<span class="loading-spinner" style="width: 12px; height: 12px; border-width: 2px; display: inline-block; vertical-align: middle; margin-right: 6px;"></span> GERANDO PIX...`;

    try {
        const resp = await fetch('../keepai/api/mp_create.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.token}`
            },
            body: JSON.stringify({ package_index: state.selectedPackage })
        });

        const data = await resp.json();
        if (data.success && data.qr_code) {
            renderPixPaymentScreen(data);
            startRechargePolling(data.payment_id);
        } else {
            throw new Error(data.error || 'Erro ao gerar PIX');
        }
    } catch (e) {
        showToast(e.message, 'error');
        btn.disabled = false;
        btn.textContent = 'TENTAR NOVAMENTE';
    }
}

function renderPixPaymentScreen(data) {
    const content = $('recharge-content');
    content.innerHTML = `
        <div style="text-align: center; display: flex; flex-direction: column; align-items: center; gap: 12px;">
            <div style="background: #ffffff; padding: 12px; border-radius: 16px; border: 2px solid var(--border-color); display: inline-block;">
                <img src="data:image/png;base64,${data.qr_code_base64}" style="width: 180px; height: 180px; display: block;" alt="QR Code PIX">
            </div>

            <div style="font-size: 0.8rem; color: var(--text-secondary); max-width: 280px;">
                Escaneie o QR Code acima ou use a chave Copia e Cola abaixo:
            </div>

            <div style="display: flex; gap: 8px; width: 100%;">
                <input type="text" readonly value="${data.qr_code}" id="pix-copy-input" style="flex: 1; min-width: 0; background: var(--bg-tertiary); border: 2px solid var(--border-color); border-radius: 12px; padding: 10px; color: var(--text-muted); font-size: 0.8rem; outline: none;">
                <button onclick="app.copyPix()" class="btn-primary" style="padding: 10px 14px; border-radius: 12px; font-weight: 700; font-size: 0.8rem; white-space: nowrap;">COPIAR</button>
            </div>

            <div style="margin-top: 10px; font-size: 0.75rem; color: var(--accent-secondary); display: flex; align-items: center; gap: 6px; font-weight: 600;">
                <span class="loading-spinner" style="width: 10px; height: 10px; border-width: 2px;"></span>
                Aguardando confirmação do pagamento...
            </div>
        </div>
    `;
}

function copyPix() {
    const input = $('pix-copy-input');
    if (!input) return;
    input.select();
    navigator.clipboard.writeText(input.value);
    showToast('Código PIX copiado!', 'success');
}

let rechargePollingInterval = null;
function startRechargePolling(paymentId) {
    if (rechargePollingInterval) clearInterval(rechargePollingInterval);

    rechargePollingInterval = setInterval(async () => {
        try {
            const resp = await fetch(`../keepai/api/credits.php`, {
                headers: { 'Authorization': `Bearer ${state.token}` }
            });
            const data = await resp.json();

            if (data.transactions && data.transactions.length > 0) {
                const latest = data.transactions[0];
                if (latest.status === 'approved') {
                    clearInterval(rechargePollingInterval);
                    rechargePollingInterval = null;
                    state.credits = data.credits;
                    updateCreditsUI();
                    closeModal('modalOverlay');
                    showToast(`Pagamento aprovado! +${latest.credits_added} créditos adicionados.`, 'success');
                }
            }
        } catch (e) {}
    }, 3000);
}

function logout() {
    localStorage.removeItem('keepai_token');
    state.token = null;
    state.user = null;
    state.credits = 0;
    updateCreditsUI();
    showToast('Você saiu da sua conta.', 'info');
    if (rechargePollingInterval) {
        clearInterval(rechargePollingInterval);
        rechargePollingInterval = null;
    }
}

let logoClickCount = 0;
let logoLastClickTime = 0;

function handleLogoClick() {
    const now = Date.now();
    if (now - logoLastClickTime < 3000) {
        logoClickCount++;
    } else {
        logoClickCount = 1;
    }
    logoLastClickTime = now;
    triggerHaptic('light');

    if (logoClickCount >= 5) {
        logoClickCount = 0;
        triggerHaptic('success');

        if (!state.token) {
            showToast("Faça login antes de usar o modo DEV", "info");
            openLoginModal();
            return;
        }

        const secret = prompt("Insira a senha do modo desenvolvedor (DEV):");
        if (!secret) return;

        const amount = parseInt(prompt("Quantidade de créditos de IA:", "100"), 10);
        if (isNaN(amount) || amount <= 0) return;

        window.talkmotion.addCredit(amount, secret);
    }
}
window.handleLogoClick = handleLogoClick;

function setupDevMode() {
    window.talkmotion = {
        addCredit: async (amount, secret) => {
            if (!state.token) return;
            
            try {
                let resp = await fetch('api/credits.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${state.token}`
                    },
                    body: JSON.stringify({
                        dev_password: secret,
                        amount: amount
                    })
                }).catch(() => null);

                if (!resp || !resp.ok) {
                    resp = await fetch('../keepai/api/credits.php', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${state.token}`
                        },
                        body: JSON.stringify({
                            dev_password: secret,
                            amount: amount
                        })
                    });
                }
                const data = await resp.json();
                if (data.success) {
                    showToast(`Sucesso! +${amount} créditos adicionados.`, 'success');
                    syncCredits();
                } else {
                    showToast(data.error || "Erro no backdoor", "error");
                }
            } catch (e) {
                showToast("Falha na comunicação com o banco", "error");
            }
        }
    };
}

function checkCreditsForOCR() {
    if (!state.token) {
        showToast("Por favor, faça login para usar o OCR.", "info");
        openLoginModal();
        return false;
    }
    if (state.credits < 1) {
        showToast("Saldo de créditos insuficiente!", "error");
        openRechargeModal();
        return false;
    }
    return true;
}

async function deductCredit() {
    if (!state.token) return;
    try {
        const response = await fetch('api/api_ocr.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.token}`
            }
        });
        
        if (response.status === 401) {
            showToast("Sessão expirada. Faça login novamente.", "error");
            logout();
            return;
        }
        
        const result = await response.json();
        if (result.success) {
            state.credits = result.credits_remaining;
            updateCreditsUI();
            showToast("OCR concluído! (Consumido 1 crédito)", "success");
        }
    } catch (e) {
        console.error("Erro ao debitar crédito central:", e);
    }
}

// ============================================
// 1. Digital Signature Pad Engine
// ============================================
let sigCanvas, sigCtx, isSigDrawing = false, sigColor = '#1e3a8a';
let appliedSignatureImg = null;

function initSignaturePad() {
    sigCanvas = $('signatureCanvas');
    if (!sigCanvas) return;
    sigCtx = sigCanvas.getContext('2d');
    sigCtx.lineWidth = 3;
    sigCtx.lineCap = 'round';
    sigCtx.lineJoin = 'round';
    sigCtx.strokeStyle = sigColor;

    if (sigCanvas._hasSigListeners) return;
    sigCanvas._hasSigListeners = true;

    const getCoordinates = (e) => {
        const rect = sigCanvas.getBoundingClientRect();
        const clientX = e.touches && e.touches.length > 0 ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches && e.touches.length > 0 ? e.touches[0].clientY : e.clientY;
        const scaleX = sigCanvas.width / (rect.width || 1);
        const scaleY = sigCanvas.height / (rect.height || 1);
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    };

    const startDraw = (e) => {
        isSigDrawing = true;
        const pos = getCoordinates(e);
        sigCtx.beginPath();
        sigCtx.moveTo(pos.x, pos.y);
    };

    const draw = (e) => {
        if (!isSigDrawing) return;
        if (e.cancelable) e.preventDefault();
        const pos = getCoordinates(e);
        sigCtx.lineTo(pos.x, pos.y);
        sigCtx.stroke();
    };

    const stopDraw = () => { 
        if (isSigDrawing) {
            isSigDrawing = false; 
            sigCtx.closePath();
        }
    };

    sigCanvas.addEventListener('mousedown', startDraw);
    sigCanvas.addEventListener('mousemove', draw);
    window.addEventListener('mouseup', stopDraw);

    sigCanvas.addEventListener('touchstart', startDraw, { passive: false });
    sigCanvas.addEventListener('touchmove', draw, { passive: false });
    window.addEventListener('touchend', stopDraw);
    window.addEventListener('touchcancel', stopDraw);
}

function openSignatureModal() {
    openModal('signatureModal');
    setTimeout(() => {
        initSignaturePad();
        clearSignatureCanvas();
    }, 150);
}

function closeSignatureModal() {
    closeModal('signatureModal');
}

function clearSignatureCanvas() {
    if (sigCanvas && sigCtx) {
        sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
        sigCtx.beginPath();
    }
}

function setSigColor(color) {
    sigColor = color;
    if (sigCtx) sigCtx.strokeStyle = color;
    $$('.sig-color-btn').forEach(b => b.classList.remove('active'));
    if (color === '#1e3a8a') document.querySelector('.sig-color-blue')?.classList.add('active');
    else if (color === '#000000') document.querySelector('.sig-color-black')?.classList.add('active');
    else if (color === '#dc2626') document.querySelector('.sig-color-red')?.classList.add('active');
}

function applySignatureToDocument() {
    if (!sigCanvas) return;
    const dataUrl = sigCanvas.toDataURL('image/png');
    appliedSignatureImg = new Image();
    appliedSignatureImg.onload = () => {
        closeSignatureModal();
        createSignatureOverlay(dataUrl);
    };
    appliedSignatureImg.src = dataUrl;
}

function createSignatureOverlay(dataUrl) {
    const existing = $('signatureOverlayBox');
    if (existing) existing.remove();

    const container = document.querySelector('.editor-canvas-container');
    const canvas = $('editorCanvas');
    if (!container || !canvas) return;

    const containerRect = container.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();

    const initWidth = Math.max(120, Math.min(canvasRect.width * 0.45, 220));
    const naturalW = appliedSignatureImg.naturalWidth || appliedSignatureImg.width || 480;
    const naturalH = appliedSignatureImg.naturalHeight || appliedSignatureImg.height || 200;
    const aspectRatio = naturalH / naturalW;
    const initHeight = Math.max(50, initWidth * aspectRatio);

    // Initial position: towards bottom-right of the document canvas
    let initLeft = (canvasRect.left - containerRect.left) + canvasRect.width * 0.5;
    let initTop = (canvasRect.top - containerRect.top) + canvasRect.height * 0.65;

    initLeft = Math.max(canvasRect.left - containerRect.left, Math.min(initLeft, (canvasRect.right - containerRect.left) - initWidth));
    initTop = Math.max(canvasRect.top - containerRect.top, Math.min(initTop, (canvasRect.bottom - containerRect.top) - initHeight));

    const overlay = document.createElement('div');
    overlay.id = 'signatureOverlayBox';
    overlay.className = 'signature-overlay-box';
    overlay.style.position = 'absolute';
    overlay.style.left = `${Math.round(initLeft)}px`;
    overlay.style.top = `${Math.round(initTop)}px`;
    overlay.style.width = `${Math.round(initWidth)}px`;
    overlay.style.height = `${Math.round(initHeight)}px`;

    overlay.innerHTML = `
        <div class="signature-drag-header">
            <span>✍️ Posicione e ajuste</span>
            <div class="sig-action-buttons">
                <button type="button" class="btn-sig-confirm" onclick="confirmSignaturePlacement()">✓ Aplicar</button>
                <button type="button" class="btn-sig-cancel" onclick="cancelSignaturePlacement()">✕</button>
            </div>
        </div>
        <div class="signature-img-wrapper">
            <img src="${dataUrl}" alt="Assinatura" />
        </div>
        <div class="sig-resize-handle"></div>
    `;

    container.appendChild(overlay);
    setupSignatureOverlayInteractions(overlay, aspectRatio);
    showToast('Posicione a assinatura e clique em Aplicar!', 'info');
}

function setupSignatureOverlayInteractions(overlay, aspectRatio) {
    const resizeHandle = overlay.querySelector('.sig-resize-handle');
    let isDragging = false;
    let isResizing = false;
    let startX, startY, startLeft, startTop, startWidth, startHeight;

    const onDragStart = (e) => {
        if (e.target.closest('.sig-resize-handle') || e.target.closest('button')) return;
        isDragging = true;
        const point = e.touches ? e.touches[0] : e;
        startX = point.clientX;
        startY = point.clientY;
        startLeft = overlay.offsetLeft;
        startTop = overlay.offsetTop;
        if (e.cancelable) e.preventDefault();
    };

    const onDragMove = (e) => {
        if (!isDragging) return;
        if (e.cancelable) e.preventDefault();
        const point = e.touches ? e.touches[0] : e;
        const dx = point.clientX - startX;
        const dy = point.clientY - startY;
        overlay.style.left = `${startLeft + dx}px`;
        overlay.style.top = `${startTop + dy}px`;
    };

    const onDragEnd = () => {
        isDragging = false;
    };

    overlay.addEventListener('mousedown', onDragStart);
    overlay.addEventListener('touchstart', onDragStart, { passive: false });
    window.addEventListener('mousemove', onDragMove);
    window.addEventListener('touchmove', onDragMove, { passive: false });
    window.addEventListener('mouseup', onDragEnd);
    window.addEventListener('touchend', onDragEnd);

    if (resizeHandle) {
        const onResizeStart = (e) => {
            e.stopPropagation();
            isResizing = true;
            const point = e.touches ? e.touches[0] : e;
            startX = point.clientX;
            startY = point.clientY;
            startWidth = overlay.offsetWidth;
            startHeight = overlay.offsetHeight;
            if (e.cancelable) e.preventDefault();
        };

        const onResizeMove = (e) => {
            if (!isResizing) return;
            if (e.cancelable) e.preventDefault();
            const point = e.touches ? e.touches[0] : e;
            const dx = point.clientX - startX;
            const newW = Math.max(60, startWidth + dx);
            const newH = Math.max(30, newW * aspectRatio);
            overlay.style.width = `${Math.round(newW)}px`;
            overlay.style.height = `${Math.round(newH)}px`;
        };

        const onResizeEnd = () => {
            isResizing = false;
        };

        resizeHandle.addEventListener('mousedown', onResizeStart);
        resizeHandle.addEventListener('touchstart', onResizeStart, { passive: false });
        window.addEventListener('mousemove', onResizeMove);
        window.addEventListener('touchmove', onResizeMove, { passive: false });
        window.addEventListener('mouseup', onResizeEnd);
        window.addEventListener('touchend', onResizeEnd);
    }
}

function confirmSignaturePlacement() {
    const box = $('signatureOverlayBox');
    if (!box || !appliedSignatureImg) return;
    const canvas = $('editorCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const boxRect = box.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();

    const scaleX = canvas.width / (canvasRect.width || 1);
    const scaleY = canvas.height / (canvasRect.height || 1);

    const drawX = (boxRect.left - canvasRect.left) * scaleX;
    const drawY = (boxRect.top - canvasRect.top) * scaleY;
    const drawW = boxRect.width * scaleX;
    const drawH = boxRect.height * scaleY;

    ctx.drawImage(appliedSignatureImg, drawX, drawY, drawW, drawH);

    const updatedImg = new Image();
    updatedImg.onload = () => {
        state.originalImage = updatedImg;
    };
    updatedImg.src = canvas.toDataURL('image/png');

    box.remove();
    showToast('Assinatura fixada no documento!', 'success');
}

function cancelSignaturePlacement() {
    const box = $('signatureOverlayBox');
    if (box) box.remove();
    showToast('Assinatura cancelada.', 'info');
}

function removeSignatureFromDocument() {
    const box = $('signatureOverlayBox');
    if (box) box.remove();
    appliedSignatureImg = null;
    drawImageToCanvas();
    showToast('Assinatura removida.', 'info');
}

// ============================================
// 2. Eraser / Retouching Engine
// ============================================
let isErasing = false;
let eraserSize = 20;

function enableEraserMode(enabled) {
    const canvas = $('editorCanvas');
    if (!canvas) return;
    if (enabled) {
        canvas.classList.add('eraser-active');
        canvas.onmousedown = startErasing;
        canvas.onmousemove = doErasing;
        window.onmouseup = stopErasing;
        canvas.ontouchstart = startErasing;
        canvas.ontouchmove = doErasing;
        window.ontouchend = stopErasing;
    } else {
        canvas.classList.remove('eraser-active');
        canvas.onmousedown = null;
        canvas.onmousemove = null;
        canvas.ontouchstart = null;
        canvas.ontouchmove = null;
    }
}

function updateEraserSize(val) {
    eraserSize = parseInt(val) || 20;
    const label = $('eraserSizeVal');
    if (label) label.textContent = `${eraserSize}px`;
}

function startErasing(e) {
    isErasing = true;
    doErasing(e);
}

function doErasing(e) {
    if (!isErasing) return;
    e.preventDefault();
    const canvas = $('editorCanvas');
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, eraserSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();
}

function stopErasing() {
    isErasing = false;
}

// ============================================
// 3. Boleto / Barcode Scanner
// ============================================
let barcodeScannerInstance = null;

function openBarcodeModal() {
    openModal('barcodeModal');
    $('barcodeResultCard')?.classList.add('hidden');
    startBarcodeScanner();
}

function closeBarcodeModal() {
    if (barcodeScannerInstance) {
        try { barcodeScannerInstance.stop(); } catch (e) {}
        barcodeScannerInstance = null;
    }
    closeModal('barcodeModal');
}

function startBarcodeScanner() {
    const readerDiv = $('barcodeReader');
    if (!readerDiv) return;
    readerDiv.innerHTML = '';

    if (typeof Html5Qrcode === 'undefined') {
        showToast('Biblioteca de código de barras não carregada.', 'error');
        return;
    }

    barcodeScannerInstance = new Html5Qrcode("barcodeReader");
    barcodeScannerInstance.start(
        { facingMode: "environment" },
        {
            fps: 15,
            qrbox: { width: 280, height: 160 }
        },
        (decodedText) => {
            handleBarcodeScanned(decodedText);
        },
        () => {}
    ).catch(err => {
        console.warn("Camera start error:", err);
    });
}

function handleBarcodeScanned(rawCode) {
    if (barcodeScannerInstance) {
        try { barcodeScannerInstance.stop(); } catch (e) {}
    }
    triggerHaptic(80);
    const card = $('barcodeResultCard');
    const display = $('barcodeCodeDisplay');
    const typeLabel = $('barcodeTypeLabel');
    if (card && display) {
        card.classList.remove('hidden');
        const formatted = formatBoletoLinhaDigitavel(rawCode);
        display.textContent = formatted.code;
        if (typeLabel) typeLabel.textContent = formatted.type;
        showToast('Código detectado com sucesso!', 'success');
    }
}

function scanBarcodeAgain() {
    $('barcodeResultCard')?.classList.add('hidden');
    startBarcodeScanner();
}

function copyBarcodeCode() {
    const display = $('barcodeCodeDisplay');
    if (display && display.textContent) {
        const cleanCode = display.textContent.replace(/\s+/g, '');
        navigator.clipboard.writeText(cleanCode).then(() => {
            showToast('Linha digitável copiada!', 'success');
        });
    }
}

function formatBoletoLinhaDigitavel(raw) {
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 44) {
        const campo1 = digits.substring(0, 4) + digits.substring(19, 24);
        const campo2 = digits.substring(24, 34);
        const campo3 = digits.substring(34, 44);
        const campo4 = digits.substring(4, 5);
        const campo5 = digits.substring(5, 19);
        return {
            type: 'Boleto Bancário (FEBRABAN)',
            code: `${campo1.substring(0,5)}.${campo1.substring(5)} ${campo2.substring(0,5)}.${campo2.substring(5)} ${campo3.substring(0,5)}.${campo3.substring(5)} ${campo4} ${campo5}`
        };
    }
    if (digits.length === 47) {
        return {
            type: 'Linha Digitável (47 dígitos)',
            code: `${digits.substring(0,5)}.${digits.substring(5,10)} ${digits.substring(10,15)}.${digits.substring(15,21)} ${digits.substring(21,26)}.${digits.substring(26,32)} ${digits.substring(32,33)} ${digits.substring(33)}`
        };
    }
    if (digits.length === 48) {
        return {
            type: 'Concessionária / Tributos (48 dígitos)',
            code: `${digits.substring(0,12)} ${digits.substring(12,24)} ${digits.substring(24,36)} ${digits.substring(36,48)}`
        };
    }
    return {
        type: 'Código de Barras / QR Code',
        code: raw
    };
}

// ============================================
// 4. Advanced PDF Export & Searchable OCR
// ============================================
let pdfExportConfig = {
    quality: 'medium',
    searchableOcr: true,
    watermark: 'none',
    isMultiPage: false
};

function openPdfOptionsModal(isMulti = false) {
    pdfExportConfig.isMultiPage = isMulti;
    openModal('pdfOptionsModal');
}

function closePdfOptionsModal() {
    closeModal('pdfOptionsModal');
}

function setPdfQuality(qual) {
    pdfExportConfig.quality = qual;
    $$('.pdf-quality-btn').forEach(b => b.classList.toggle('active', b.dataset.quality === qual));
}

async function executePdfExportWithOptions() {
    closePdfOptionsModal();
    showLoading('Gerando PDF de alta definição...');

    try {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const qualityVal = pdfExportConfig.quality === 'high' ? 0.92 : pdfExportConfig.quality === 'medium' ? 0.78 : 0.55;
        const watermarkText = $('pdfWatermarkSelect')?.value || 'none';
        const isSearchable = $('pdfSearchableOcrToggle')?.checked;

        let imagesToExport = [];
        if (state.viewerDoc && state.viewerDoc.pages && state.viewerDoc.pages.length > 0) {
            imagesToExport = state.viewerDoc.pages;
        } else if (pdfExportConfig.isMultiPage && state.multiPageImages.length > 0) {
            imagesToExport = state.multiPageImages;
        } else {
            imagesToExport = [state.currentImage?.src || $('viewerImage')?.src];
        }

        for (let i = 0; i < imagesToExport.length; i++) {
            if (i > 0) pdf.addPage();

            const imgUrl = imagesToExport[i];
            const img = await loadImage(imgUrl);

            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const margin = 10;
            const maxW = pageWidth - margin * 2;
            const maxH = pageHeight - margin * 2;
            const imgRatio = img.width / img.height;
            let finalW = maxW;
            let finalH = maxW / imgRatio;
            if (finalH > maxH) {
                finalH = maxH;
                finalW = maxH * imgRatio;
            }
            const x = (pageWidth - finalW) / 2;
            const y = (pageHeight - finalH) / 2;

            pdf.addImage(img, 'JPEG', x, y, finalW, finalH, undefined, 'FAST', qualityVal);

            if (watermarkText && watermarkText !== 'none') {
                pdf.saveGraphicsState();
                pdf.setTextColor(200, 200, 200);
                pdf.setFontSize(36);
                pdf.setFont('helvetica', 'bold');
                pdf.text(watermarkText, pageWidth / 2, pageHeight / 2, { align: 'center', angle: 45 });
                pdf.restoreGraphicsState();
            }

            if (isSearchable && typeof Tesseract !== 'undefined') {
                try {
                    const ocrRes = await Tesseract.recognize(imgUrl, 'por+eng', { logger: () => {} });
                    if (ocrRes && ocrRes.data && ocrRes.data.text) {
                        pdf.saveGraphicsState();
                        pdf.setTextColor(255, 255, 255);
                        pdf.setFontSize(8);
                        const lines = ocrRes.data.text.split('\n');
                        let textY = y + 10;
                        lines.forEach(line => {
                            if (line.trim()) {
                                pdf.text(line.trim(), x + 5, textY, { renderingMode: 'invisible' });
                                textY += 6;
                            }
                        });
                        pdf.restoreGraphicsState();
                    }
                } catch (ocrErr) {
                    console.warn("Searchable OCR warning:", ocrErr);
                }
            }
        }

        const fileName = `docscan-${new Date().toISOString().slice(0,10)}.pdf`;
        pdf.save(fileName);
        hideLoading();
        showToast('PDF exportado com sucesso!', 'success');
    } catch (err) {
        hideLoading();
        console.error(err);
        showToast('Erro ao exportar PDF: ' + err.message, 'error');
    }
}

// ============================================
// 5. Thermal Printer Integration (Bematech 80mm)
// ============================================
function printActiveDocThermal() {
    const imgEl = $('viewerImage') || $('editorCanvas');
    if (!imgEl || !imgEl.src) {
        showToast('Nenhuma imagem para imprimir.', 'error');
        return;
    }
    triggerHaptic(60);
    showToast('Preparando impressão térmica (80mm Bematech)...', 'info');

    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    document.body.appendChild(printFrame);

    const doc = printFrame.contentWindow.document;
    doc.open();
    doc.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Impressão Térmica Bematech 80mm</title>
            <style>
                @page { size: 80mm auto; margin: 0; }
                body { margin: 0; padding: 4mm; width: 72mm; text-align: center; font-family: monospace; background: #fff; }
                .receipt-header { font-size: 14px; font-weight: bold; border-bottom: 1px dashed #000; padding-bottom: 4px; margin-bottom: 6px; }
                img { width: 100%; max-width: 72mm; height: auto; filter: contrast(150%) grayscale(100%); image-rendering: pixelated; }
                .receipt-footer { font-size: 11px; margin-top: 8px; border-top: 1px dashed #000; padding-top: 4px; }
            </style>
        </head>
        <body>
            <div class="receipt-header">DOCSCAN PRO — IMPRESSÃO TÉRMICA</div>
            <img src="${imgEl.src || imgEl.toDataURL?.()}">
            <div class="receipt-footer">${new Date().toLocaleString('pt-BR')} — Bematech MP-4200 TH</div>
        </body>
        </html>
    `);
    doc.close();

    setTimeout(() => {
        printFrame.contentWindow.focus();
        printFrame.contentWindow.print();
        setTimeout(() => printFrame.remove(), 2000);
    }, 400);
}

function printOcrTextThermal() {
    const ocrText = $('ocrText')?.value;
    if (!ocrText || !ocrText.trim()) {
        showToast('Nenhum texto OCR para imprimir.', 'error');
        return;
    }
    triggerHaptic(60);

    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    document.body.appendChild(printFrame);

    const doc = printFrame.contentWindow.document;
    doc.open();
    doc.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Impressão Térmica Texto OCR</title>
            <style>
                @page { size: 80mm auto; margin: 0; }
                body { margin: 0; padding: 4mm; width: 72mm; font-family: 'Courier New', monospace; font-size: 12px; line-height: 1.4; color: #000; }
                .header { font-size: 13px; font-weight: bold; text-align: center; border-bottom: 1px dashed #000; padding-bottom: 4px; margin-bottom: 8px; }
                .content { white-space: pre-wrap; word-break: break-word; }
                .footer { font-size: 10px; text-align: center; margin-top: 10px; border-top: 1px dashed #000; padding-top: 4px; }
            </style>
        </head>
        <body>
            <div class="header">COMPROVANTE / TEXTO OCR</div>
            <div class="content">${ocrText.replace(/</g, '&lt;')}</div>
            <div class="footer">${new Date().toLocaleString('pt-BR')}<br>DocScan Pro 2026</div>
        </body>
        </html>
    `);
    doc.close();

    setTimeout(() => {
        printFrame.contentWindow.focus();
        printFrame.contentWindow.print();
        setTimeout(() => printFrame.remove(), 2000);
    }, 400);
}

// ============================================
// 6. Batch Camera Capture
// ============================================
async function handleBatchCapture(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    showLoading(`Processando ${files.length} páginas...`);
    closeModal('captureModal');

    for (const file of files) {
        const dataUrl = await readFileAsDataURL(file);
        state.multiPageImages.push(dataUrl);
    }

    hideLoading();
    showToast(`${files.length} páginas adicionadas!`, 'success');
    updatePagesGrid();
    openModal('multiPageModal');
}

// ============================================
// PDF Import (Multi-page PDF to Scanned Pages)
// ============================================
function triggerPdfUpload() {
    closeModal('captureModal');
    const input = $('pdfFileInput');
    if (input) input.click();
}

async function handlePdfImport(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    if (typeof pdfjsLib === 'undefined') {
        showToast('Biblioteca PDF.js não carregada.', 'error');
        return;
    }

    showLoading('Carregando arquivo PDF...');

    try {
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        const numPages = pdf.numPages;

        if (numPages === 0) {
            hideLoading();
            showToast('O arquivo PDF não contém páginas.', 'warning');
            return;
        }

        const pageImages = [];

        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
            showLoading(`Renderizando página ${pageNum} de ${numPages} em alta resolução...`);
            const page = await pdf.getPage(pageNum);
            const viewport = page.getViewport({ scale: 2.0 });
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');

            await page.render({
                canvasContext: ctx,
                viewport: viewport
            }).promise;

            const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
            pageImages.push(dataUrl);
        }

        hideLoading();

        if (pageImages.length === 1) {
            const img = new Image();
            img.onload = () => {
                state.originalImage = img;
                state.currentImage = img;
                openEditor(img);
                showToast('Página do PDF carregada no editor! ✨', 'success');
            };
            img.src = pageImages[0];
        } else {
            pageImages.forEach(imgData => state.multiPageImages.push(imgData));
            updatePagesGrid();
            openModal('multiPageModal');
            showToast(`${pageImages.length} páginas importadas do PDF com sucesso! 📄`, 'success');
        }
    } catch (err) {
        hideLoading();
        console.error('PDF Import error:', err);
        showToast('Erro ao importar PDF: ' + err.message, 'error');
    } finally {
        event.target.value = '';
    }
}

// ============================================
// 7. Live Camera Engine (Notebook Webcam & Mobile)
// ============================================
let liveCameraStream = null;
let currentCameraFacing = 'environment';
let isLiveBatchActive = false;
let isTorchOn = false;

function checkTorchCapability() {
    const torchBtn = $('cameraTorchBtn');
    if (!torchBtn || !liveCameraStream) return;
    const track = liveCameraStream.getVideoTracks()[0];
    const capabilities = track && track.getCapabilities ? track.getCapabilities() : {};
    if (capabilities.torch) {
        torchBtn.style.display = 'flex';
        torchBtn.classList.toggle('active', isTorchOn);
    } else {
        torchBtn.style.display = 'none';
        isTorchOn = false;
        torchBtn.classList.remove('active');
    }
}

async function toggleCameraTorch() {
    if (!liveCameraStream) {
        showToast('Câmera não está ativa', 'warning');
        return;
    }
    const track = liveCameraStream.getVideoTracks()[0];
    if (!track) {
        showToast('Nenhum canal de vídeo disponível', 'error');
        return;
    }

    const capabilities = track.getCapabilities ? track.getCapabilities() : {};
    if (!capabilities.torch) {
        showToast('Lanterna não disponível nesta câmera/dispositivo', 'warning');
        return;
    }

    try {
        isTorchOn = !isTorchOn;
        await track.applyConstraints({
            advanced: [{ torch: isTorchOn }]
        });
        const btn = $('cameraTorchBtn');
        if (btn) {
            btn.classList.toggle('active', isTorchOn);
        }
        triggerHaptic(30);
        showToast(isTorchOn ? '🔦 Lanterna ligada' : '🔦 Lanterna desligada', 'info');
    } catch (err) {
        console.error('Erro ao alternar lanterna:', err);
        showToast('Não foi possível controlar a lanterna', 'error');
    }
}

async function startLiveCamera(batchMode = false) {
    isLiveBatchActive = batchMode;
    closeModal('captureModal');
    openModal('liveCameraModal');

    const badge = $('cameraModeBadge');
    const batchCounter = $('liveBatchCounter');
    const batchToggle = $('liveBatchToggleBtn');
    const batchCountVal = $('liveBatchCountVal');

    if (badge) {
        if (idCardScanState && idCardScanState.active) {
            badge.textContent = idCardScanState.step === 1 ? '🪪 RG/CNH (Frente)' : '🪪 RG/CNH (Verso)';
        } else {
            badge.textContent = isLiveBatchActive ? 'Modo Lote (Várias Págs)' : 'Câmera ao Vivo';
        }
    }
    if (batchCounter) {
        batchCounter.classList.toggle('hidden', !isLiveBatchActive);
        if (batchCountVal) batchCountVal.textContent = state.multiPageImages.length;
    }
    if (batchToggle) batchToggle.classList.toggle('active', isLiveBatchActive);

    await initLiveVideoStream();
}

async function initLiveVideoStream() {
    const video = $('liveCameraVideo');
    if (!video) return;

    if (liveCameraStream) {
        liveCameraStream.getTracks().forEach(track => track.stop());
        liveCameraStream = null;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showToast('Navegador sem suporte direto a câmera. Abrindo seletor.', 'info');
        stopLiveCamera();
        $('cameraInput').click();
        return;
    }

    const constraints = {
        video: {
            facingMode: currentCameraFacing,
            width: { min: 1920, ideal: 3840, max: 7680 },
            height: { min: 1080, ideal: 2160, max: 4320 },
            focusMode: 'continuous',
            exposureMode: 'continuous',
            whiteBalanceMode: 'continuous'
        },
        audio: false
    };

    try {
        liveCameraStream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = liveCameraStream;
        await video.play();
        checkTorchCapability();
        startRealtimeEdgeTracking();
    } catch (err) {
        console.warn('First 4K getUserMedia attempt failed, trying fallback video constraints:', err);
        try {
            liveCameraStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: currentCameraFacing,
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                },
                audio: false
            });
            video.srcObject = liveCameraStream;
            await video.play();
            checkTorchCapability();
            startRealtimeEdgeTracking();
        } catch (fallbackErr) {
            console.error('Camera access error:', fallbackErr);
            stopLiveCamera();
            Swal.fire({
                icon: 'warning',
                title: 'Acesso à Câmera',
                text: 'Não foi possível acessar a câmera em alta resolução. Verifique as permissões.',
                confirmButtonText: 'Escolher Arquivo / Câmera Nativa',
                showCancelButton: true,
                cancelButtonText: 'Cancelar'
            }).then((res) => {
                if (res.isConfirmed) {
                    $('cameraInput').click();
                }
            });
        }
    }
}

function stopLiveCamera() {
    stopRealtimeEdgeTracking();
    isTorchOn = false;
    const torchBtn = $('cameraTorchBtn');
    if (torchBtn) torchBtn.classList.remove('active');

    if (idCardScanState) {
        idCardScanState.active = false;
        idCardScanState.step = 1;
    }
    const banner = $('idCardStepBanner');
    if (banner) banner.classList.add('hidden');

    if (liveCameraStream) {
        liveCameraStream.getTracks().forEach(track => track.stop());
        liveCameraStream = null;
    }
    const video = $('liveCameraVideo');
    if (video) video.srcObject = null;
    closeModal('liveCameraModal');

    if (isLiveBatchActive && state.multiPageImages.length > 0) {
        updatePagesGrid();
        openModal('multiPageModal');
    }
}

async function switchLiveCamera() {
    currentCameraFacing = currentCameraFacing === 'environment' ? 'user' : 'environment';
    isTorchOn = false;
    triggerHaptic(40);
    await initLiveVideoStream();
}

function toggleLiveBatchMode() {
    isLiveBatchActive = !isLiveBatchActive;
    triggerHaptic(40);
    const badge = $('cameraModeBadge');
    const batchCounter = $('liveBatchCounter');
    const batchToggle = $('liveBatchToggleBtn');
    const batchCountVal = $('liveBatchCountVal');

    if (badge) badge.textContent = isLiveBatchActive ? 'Modo Lote (Várias Págs)' : 'Câmera ao Vivo HD';
    if (batchCounter) {
        batchCounter.classList.toggle('hidden', !isLiveBatchActive);
        if (batchCountVal) batchCountVal.textContent = state.multiPageImages.length;
    }
    if (batchToggle) batchToggle.classList.toggle('active', isLiveBatchActive);
    showToast(isLiveBatchActive ? 'Modo Lote ativado' : 'Modo Foto Única ativado', 'info');
}

function triggerFileFallback() {
    stopLiveCamera();
    $('cameraInput').click();
}

let _shutterAudioCtx = null;

function playShutterSound() {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        if (!_shutterAudioCtx || _shutterAudioCtx.state === 'closed') {
            _shutterAudioCtx = new AudioCtx();
        }
        if (_shutterAudioCtx.state === 'suspended') {
            _shutterAudioCtx.resume();
        }
        const ctx = _shutterAudioCtx;
        const now = ctx.currentTime;

        const createClick = (time, freq, duration, gainLevel, noiseCutoff) => {
            const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.22));
            }
            const noise = ctx.createBufferSource();
            noise.buffer = buffer;

            const noiseFilter = ctx.createBiquadFilter();
            noiseFilter.type = 'bandpass';
            noiseFilter.frequency.setValueAtTime(noiseCutoff, time);
            noiseFilter.Q.setValueAtTime(2.2, time);

            const noiseGain = ctx.createGain();
            noiseGain.gain.setValueAtTime(gainLevel * 0.75, time);
            noiseGain.gain.exponentialRampToValueAtTime(0.001, time + duration);

            noise.connect(noiseFilter);
            noiseFilter.connect(noiseGain);
            noiseGain.connect(ctx.destination);
            noise.start(time);
            noise.stop(time + duration);

            const osc = ctx.createOscillator();
            const oscGain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, time);
            osc.frequency.exponentialRampToValueAtTime(freq * 0.25, time + duration);

            oscGain.gain.setValueAtTime(gainLevel, time);
            oscGain.gain.exponentialRampToValueAtTime(0.001, time + duration);

            osc.connect(oscGain);
            oscGain.connect(ctx.destination);
            osc.start(time);
            osc.stop(time + duration);
        };

        // Click 1: Front shutter curtain open (crisp, high mechanical snap)
        createClick(now, 1850, 0.022, 0.45, 3600);

        // Click 2: Rear shutter curtain close (deeper mechanical clack)
        createClick(now + 0.046, 850, 0.036, 0.55, 1750);

        // Low body resonance / mirror slap thump
        const thump = ctx.createOscillator();
        const thumpGain = ctx.createGain();
        thump.type = 'sine';
        thump.frequency.setValueAtTime(150, now + 0.046);
        thump.frequency.exponentialRampToValueAtTime(40, now + 0.11);
        thumpGain.gain.setValueAtTime(0.35, now + 0.046);
        thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
        thump.connect(thumpGain);
        thumpGain.connect(ctx.destination);
        thump.start(now + 0.046);
        thump.stop(now + 0.12);

    } catch (e) {
        console.warn('Shutter sound error:', e);
    }
}

async function captureLivePhoto() {
    const video = $('liveCameraVideo');
    if (!video || !video.videoWidth) {
        showToast('Aguardando câmera iniciar...', 'error');
        return;
    }

    triggerHaptic('medium');
    playShutterSound();

    const flash = $('cameraFlashOverlay');
    if (flash) {
        flash.classList.add('flash');
        setTimeout(() => flash.classList.remove('flash'), 150);
    }

    showLoading('Capturando em Alta Definição (HD)...');

    let dataUrl = null;

    // 1. Try Hardware Still Photo Capture (12MP - 48MP Full Sensor Resolution)
    if (liveCameraStream) {
        const track = liveCameraStream.getVideoTracks()[0];
        if (track && (window.ImageCapture || ('ImageCapture' in window))) {
            try {
                const imageCapture = new ImageCapture(track);
                const photoBlob = await imageCapture.takePhoto({
                    imageWidth: 4032,
                    imageHeight: 3024,
                    fillLightMode: 'auto'
                });
                if (photoBlob && photoBlob.size > 15000) {
                    dataUrl = await blobToDataURL(photoBlob);
                    console.log(`[DocScan Camera HD] Foto em resolução nativa do sensor capturada: ${photoBlob.size} bytes`);
                }
            } catch (capErr) {
                console.warn('[DocScan Camera] ImageCapture fallback para canvas HD:', capErr);
            }
        }
    }

    // 2. High-Precision Canvas Fallback
    if (!dataUrl) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = video.videoWidth;
        tempCanvas.height = video.videoHeight;
        const ctx = tempCanvas.getContext('2d', { alpha: false });
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
        dataUrl = tempCanvas.toDataURL('image/jpeg', 0.98);
        console.log(`[DocScan Camera] Capturado via Canvas HD: ${tempCanvas.width}x${tempCanvas.height}`);
    }

    hideLoading();

    // Check if ID Card Mode is active
    if (idCardScanState && idCardScanState.active) {
        await handleIdCardCapture(dataUrl);
        return;
    }

    if (isLiveBatchActive) {
        state.multiPageImages.push(dataUrl);
        const countVal = $('liveBatchCountVal');
        if (countVal) countVal.textContent = state.multiPageImages.length;
        showToast(`Página ${state.multiPageImages.length} capturada em HD!`, 'success');
    } else {
        stopLiveCamera();
        const img = new Image();
        img.onload = () => {
            state.originalImage = img;
            state.currentImage = img;
            openEditor(img);
        };
        img.src = dataUrl;
    }
}

// Global exposes
window.startLiveCamera = startLiveCamera;
window.stopLiveCamera = stopLiveCamera;
window.switchLiveCamera = switchLiveCamera;
window.captureLivePhoto = captureLivePhoto;
window.toggleLiveBatchMode = toggleLiveBatchMode;
window.triggerFileFallback = triggerFileFallback;
window.openSignatureModal = openSignatureModal;
window.closeSignatureModal = closeSignatureModal;
window.clearSignatureCanvas = clearSignatureCanvas;
window.setSigColor = setSigColor;
window.applySignatureToDocument = applySignatureToDocument;
window.confirmSignaturePlacement = confirmSignaturePlacement;
window.cancelSignaturePlacement = cancelSignaturePlacement;
window.removeSignatureFromDocument = removeSignatureFromDocument;
window.updateEraserSize = updateEraserSize;
window.openBarcodeModal = openBarcodeModal;
window.closeBarcodeModal = closeBarcodeModal;
window.scanBarcodeAgain = scanBarcodeAgain;
window.copyBarcodeCode = copyBarcodeCode;
window.openPdfOptionsModal = openPdfOptionsModal;
window.closePdfOptionsModal = closePdfOptionsModal;
window.setPdfQuality = setPdfQuality;
window.executePdfExportWithOptions = executePdfExportWithOptions;
window.printActiveDocThermal = printActiveDocThermal;
window.printOcrTextThermal = printOcrTextThermal;
window.uploadCurrentViewerDocToDrive = uploadCurrentViewerDocToDrive;
window.syncAllDocumentsToDrive = syncAllDocumentsToDrive;
window.viewerNavigatePage = viewerNavigatePage;
window.viewerAddPage = viewerAddPage;
window.viewerDeletePage = viewerDeletePage;
window.openStampModal = openStampModal;
window.selectStampPreset = selectStampPreset;
window.selectStampColor = selectStampColor;
window.updateStampPreview = updateStampPreview;
window.applyStampToActiveDoc = applyStampToActiveDoc;
window.triggerHaptic = triggerHaptic;
window.toggleLanguage = toggleLanguage;
window.setLanguage = setLanguage;
window.startIdCardScanner = startIdCardScanner;
window.setRedactMode = setRedactMode;
window.setRedactShape = setRedactShape;
window.undoRedact = undoRedact;
window.clearAllRedacts = clearAllRedacts;

// Global Bridging Object
window.app = {
    handleLogoClick() {
        handleLogoClick();
    },
    handleCreditsClick() {
        handleCreditsClick();
    },
    logout() {
        logout();
    },
    closeModal() {
        closeModal('modalOverlay');
    },
    renderLoginModal(isLoginMode) {
        renderLoginModal(isLoginMode);
    },
    handleAuthSubmit(event, isLoginMode) {
        handleAuthSubmit(event, isLoginMode);
    },
    selectPackage(index) {
        selectPackage(index);
    },
    setRechargeMethod(method) {
        setRechargeMethod(method);
    },
    createPixPayment() {
        createPixPayment();
    },
    generatePIX() {
        generatePIX();
    },
    copyPix(code) {
        copyPix(code);
    }
};
