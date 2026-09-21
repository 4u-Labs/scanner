<?php
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Cache-Control: post-check=0, pre-check=0", false);
header("Pragma: no-cache");
header("Expires: Mon, 26 Jul 1997 05:00:00 GMT");

$uri = $_SERVER["REQUEST_URI"] ?? "";
$path = parse_url($uri, PHP_URL_PATH);
if (!str_ends_with($path, "/") && !pathinfo($path, PATHINFO_EXTENSION)) {
    $queryString = $_SERVER["QUERY_STRING"] ?? "";
    $target = $path . "/" . ($queryString ? "?" . $queryString : "");
    header("Location: $target", true, 301);
    exit;
}
$v = time();
$baseDir = rtrim(dirname($_SERVER["SCRIPT_NAME"]), "/\\") . "/";
?>
<!DOCTYPE html>
<html lang="pt-BR">

<head>
    <meta charset="UTF-8">
    <meta name="viewport"
        content="width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=5.0, user-scalable=yes">
    <meta name="theme-color" content="#1a1a2e">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="description"
        content="Scanner de documentos profissional - Digitalize, edite e organize seus documentos">
    <title>DocScan Pro</title>
    <link rel="manifest" href="manifest.json?v=<?php echo $v; ?>">
    <link rel="icon" type="image/png" sizes="192x192" href="icon-192x192.png?v=<?php echo $v; ?>">
    <link rel="apple-touch-icon" href="icon-192x192.png?v=<?php echo $v; ?>">
    <base href="<?php echo htmlspecialchars($baseDir); ?>">
    <link rel="stylesheet" href="style.css?v=<?php echo $v; ?>">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
</head>

<body>
    <!-- Splash Screen -->
    <div id="splashScreen" class="splash-screen">
        <div class="splash-content">
            <div class="splash-icon">📄</div>
            <h1>DocScan Pro</h1>
            <div class="splash-loader"></div>
        </div>
    </div>

    <!-- Main App -->
    <div id="app" class="app hidden">
        <!-- Header -->
        <header class="header">
            <div class="header-left">
                <button id="menuBtn" class="icon-btn" aria-label="Menu">
                    <svg viewBox="0 0 24 24">
                        <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
                    </svg>
                </button>
                <h1 class="app-title">DocScan Pro</h1>
            </div>
            <div class="header-right">
                <button id="searchBtn" class="icon-btn" aria-label="Buscar">
                    <svg viewBox="0 0 24 24">
                        <path
                            d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
                    </svg>
                </button>
                <button id="viewModeBtn" class="icon-btn" aria-label="Modo de visualização">
                    <svg viewBox="0 0 24 24">
                        <path
                            d="M4 11h5V5H4v6zm0 7h5v-6H4v6zm6 0h5v-6h-5v6zm6 0h5v-6h-5v6zm-6-7h5V5h-5v6zm6-6v6h5V5h-5z" />
                    </svg>
                </button>
                <button id="selectModeBtn" class="icon-btn" aria-label="Selecionar">
                    <svg viewBox="0 0 24 24">
                        <path
                            d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM17.99 9l-1.41-1.42-6.59 6.59-2.58-2.57-1.42 1.41 4 3.99z" />
                    </svg>
                </button>
                <button id="langToggleBtn" class="icon-btn" title="Idioma / Language" onclick="toggleLanguage()" style="font-size:16px; font-weight:bold;">
                    <span id="langFlag">🇧🇷</span>
                </button>
                <button id="driveBtn" class="icon-btn" aria-label="Google Drive">
                    <svg viewBox="0 0 24 24">
                        <path
                            d="M7.71 3.5L1.15 15l3.43 6 6.55-11.5L7.71 3.5zm1.14 0l6.57 11.5h6.56l-6.57-11.5H8.85zm7.14 12.5H2.29l3.43 6h13.71l-3.44-6z" />
                    </svg>
                </button>
            </div>
        </header>

        <!-- Search Bar -->
        <div id="searchBar" class="search-bar hidden">
            <div class="search-input-container">
                <svg class="search-icon" viewBox="0 0 24 24">
                    <path
                        d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
                </svg>
                <input type="text" id="searchInput" placeholder="Buscar documentos..." />
                <button id="closeSearchBtn" class="icon-btn-small">
                    <svg viewBox="0 0 24 24">
                        <path
                            d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                    </svg>
                </button>
            </div>
        </div>

        <!-- Sort Bar -->
        <div id="sortBar" class="sort-bar">
            <button class="sort-btn active" data-sort="date-desc">
                <svg viewBox="0 0 24 24">
                    <path d="M7 14l5-5 5 5z" />
                </svg>
                <span>Mais recentes</span>
            </button>
            <button class="sort-btn" data-sort="date-asc">
                <svg viewBox="0 0 24 24">
                    <path d="M7 10l5 5 5-5z" />
                </svg>
                <span>Mais antigos</span>
            </button>
            <button class="sort-btn" data-sort="name-asc">
                <svg viewBox="0 0 24 24">
                    <path d="M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z" />
                </svg>
                <span>Nome A-Z</span>
            </button>
            <button class="sort-btn" data-sort="favorites">
                <svg viewBox="0 0 24 24">
                    <path
                        d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                </svg>
                <span>Favoritos</span>
            </button>
        </div>

        <!-- Selection Bar -->
        <div id="selectionBar" class="selection-bar hidden">
            <div class="selection-left">
                <button id="cancelSelectBtn" class="icon-btn">
                    <svg viewBox="0 0 24 24">
                        <path
                            d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                    </svg>
                </button>
                <span id="selectedCount">0 selecionados</span>
            </div>
            <div class="selection-right">
                <button id="selectAllBtn" class="icon-btn" title="Selecionar todos">
                    <svg viewBox="0 0 24 24">
                        <path
                            d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM.41 13.41L6 19l1.41-1.41L1.83 12 .41 13.41z" />
                    </svg>
                </button>
                <button id="deleteSelectedBtn" class="icon-btn danger" title="Excluir">
                    <svg viewBox="0 0 24 24">
                        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                    </svg>
                </button>
                <button id="downloadSelectedBtn" class="icon-btn" title="Baixar">
                    <svg viewBox="0 0 24 24">
                        <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
                    </svg>
                </button>
                <button id="pdfSelectedBtn" class="icon-btn" title="Gerar PDF">
                    <svg viewBox="0 0 24 24">
                        <path
                            d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm10 5.5h1v-3h-1v3z" />
                    </svg>
                </button>
            </div>
        </div>

        <!-- Navigation -->
        <div class="breadcrumb-container">
            <nav id="breadcrumb" class="breadcrumb">
                <button class="breadcrumb-item active" data-folder="root">
                    <svg viewBox="0 0 24 24">
                        <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
                    </svg>
                    <span>Início</span>
                </button>
            </nav>
            <button id="mainInstallBtn" class="main-install-btn hidden" onclick="triggerPwaInstall()">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
                    <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
                </svg>
                <span data-i18n="install_app">Instalar App</span>
            </button>
        </div>

        <!-- Main Content -->
        <main class="main-content">
            <!-- Empty State -->
            <div id="emptyState" class="empty-state">
                <div class="empty-icon">
                    <svg viewBox="0 0 24 24" width="64" height="64" fill="currentColor">
                        <circle cx="12" cy="12" r="3.2" />
                        <path
                            d="M9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z" />
                    </svg>
                </div>
                <h2>Nenhum documento</h2>
                <p>Toque no botão abaixo para escanear seu primeiro documento</p>
            </div>

            <!-- Documents Grid -->
            <div id="documentsGrid" class="documents-grid hidden"></div>
        </main>

        <!-- FAB -->
        <button id="scanFab" class="fab" aria-label="Escanear">
            <svg viewBox="0 0 24 24">
                <path
                    d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z" />
            </svg>
        </button>
    </div>

    <!-- Side Menu -->
    <div id="sideMenu" class="side-menu">
        <div class="side-menu-overlay"></div>
        <div class="side-menu-content">
            <div class="side-menu-header" id="sideMenuHeader">
                <div class="user-avatar-container" id="userAvatarContainer" onclick="connectGoogleDrive()" title="Conta Google">
                    <div class="user-avatar-icon" id="userAvatarPlaceholder">📄</div>
                    <img id="userAvatarImg" class="user-avatar-photo hidden" alt="Foto da Conta Google" src="">
                </div>
                <h2 id="userNameDisplay" style="font-size: 16px; margin: 0; color: #fff;">DocScan Pro</h2>
                <div id="userEmailDisplay" class="user-email-text hidden"></div>
                <div id="driveConnectedBadge" class="drive-status-badge disconnected" onclick="connectGoogleDrive()" style="cursor: pointer;">
                    <span class="status-dot"></span>
                    <span id="driveStatusText">Google Drive: Desconectado</span>
                </div>
                <div style="margin-top: 12px; width: 100%;">
                    <button id="googleConnectBtn" onclick="connectGoogleDrive()" class="google-login-btn">
                        <svg viewBox="0 0 24 24" width="18" height="18">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                        </svg>
                        <span id="googleConnectBtnText">Conectar Google Drive</span>
                    </button>
                </div>
                <div id="authButtonsContainer" style="margin-top: 8px; width: 100%; display: flex; flex-direction: column; gap: 8px;">
                    <button id="logoutBtn" onclick="logout()" class="google-login-btn hidden" style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); color: #ef4444;">
                        <span>🚪 Sair da Conta</span>
                    </button>
                </div>
            </div>
            <nav class="side-menu-nav">
                <button id="menuHome" class="menu-item active">
                    <svg viewBox="0 0 24 24">
                        <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
                    </svg>
                    <span>Início</span>
                </button>
                <button id="menuFolders" class="menu-item">
                    <svg viewBox="0 0 24 24">
                        <path
                            d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
                    </svg>
                    <span>Pastas</span>
                </button>
                <button id="menuBuyCredits" class="menu-item highlight">
                    <svg viewBox="0 0 24 24">
                        <path
                            d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                    </svg>
                    <span>Comprar Créditos</span>
                </button>
                <button id="menuRecent" class="menu-item">
                    <svg viewBox="0 0 24 24">
                        <path
                            d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
                    </svg>
                    <span>Recentes</span>
                </button>
                <div class="menu-divider"></div>
                <button id="menuDriveConnect" class="menu-item">
                    <svg viewBox="0 0 24 24">
                        <path
                            d="M7.71 3.5L1.15 15l3.43 6 6.55-11.5L7.71 3.5zm1.14 0l6.57 11.5h6.56l-6.57-11.5H8.85zm7.14 12.5H2.29l3.43 6h13.71l-3.44-6z" />
                    </svg>
                    <span>Conectar Google Drive</span>
                </button>
                <button id="menuPending" class="menu-item">
                    <svg viewBox="0 0 24 24">
                        <path
                            d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" />
                    </svg>
                    <span>Uploads Pendentes</span>
                    <span id="pendingCount" class="badge hidden">0</span>
                </button>
                <div class="menu-divider"></div>
                <button id="menuOCR" class="menu-item">
                    <svg viewBox="0 0 24 24">
                        <path
                            d="M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5C13 2.12 11.88 1 10.5 1S8 2.12 8 3.5V5H4c-1.1 0-1.99.9-1.99 2v3.8H3.5c1.49 0 2.7 1.21 2.7 2.7s-1.21 2.7-2.7 2.7H2V20c0 1.1.9 2 2 2h3.8v-1.5c0-1.49 1.21-2.7 2.7-2.7 1.49 0 2.7 1.21 2.7 2.7V22H17c1.1 0 2-.9 2-2v-4h1.5c1.38 0 2.5-1.12 2.5-2.5S21.88 11 20.5 11z" />
                    </svg>
                    <span>Extrair Texto (OCR)</span>
                </button>
                <button id="menuQRCode" class="menu-item">
                    <svg viewBox="0 0 24 24">
                        <path
                            d="M3 11h8V3H3v8zm2-6h4v4H5V5zm8-2v8h8V3h-8zm6 6h-4V5h4v4zM3 21h8v-8H3v8zm2-6h4v4H5v-4zm13 2h-2v2h2v2h-4v-4h2v-2h-2v-2h4v4zm2 0h2v4h-4v-2h2v-2zm0-2h-2v-2h2v2zm0 4h2v2h-2v-2z" />
                    </svg>
                    <span>Scanner QR Code</span>
                </button>
                <button id="menuStats" class="menu-item">
                    <svg viewBox="0 0 24 24">
                        <path
                            d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z" />
                    </svg>
                    <span>Estatísticas</span>
                </button>
                <button id="menuBackup" class="menu-item">
                    <svg viewBox="0 0 24 24">
                        <path
                            d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11zM8 15.01l1.41 1.41L11 14.84V19h2v-4.16l1.59 1.59L16 15.01 12.01 11z" />
                    </svg>
                    <span>Exportar/Importar</span>
                </button>
                <div class="menu-divider"></div>
                <button id="menuSettings" class="menu-item">
                    <svg viewBox="0 0 24 24">
                        <path
                            d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
                    </svg>
                    <span>Configurações</span>
                </button>
                <div class="menu-divider"></div>
                <button id="menuTutorial" class="menu-item">
                    <svg viewBox="0 0 24 24">
                        <path
                            d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z" />
                    </svg>
                    <span>Ajuda e Tutorial</span>
                </button>
                <button id="menuAbout" class="menu-item">
                    <svg viewBox="0 0 24 24">
                        <path
                            d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
                    </svg>
                    <span>Sobre</span>
                </button>
                <div class="menu-divider hidden" id="installDivider"></div>
                <button id="menuInstall" class="menu-item hidden">
                    <svg viewBox="0 0 24 24">
                        <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
                    </svg>
                    <span>Instalar App</span>
                </button>
            </nav>
            <div class="side-menu-footer">
                <p id="sideMenuVersion">Versão 2.0.0</p>
                <p style="margin-top: 4px; font-size: 10px;" id="sideMenuMadeWith">
                    Feito com amor por <a href="https://4u.ia.br" target="_blank" style="color: var(--accent-secondary); font-weight: bold; text-decoration: none;">4u.ia.br</a>
                </p>
            </div>
        </div>
    </div>

    <!-- Capture Modal -->
    <div id="captureModal" class="modal">
        <div class="modal-content capture-modal">
            <div class="modal-header">
                <button id="closeCaptureBtn" class="icon-btn">
                    <svg viewBox="0 0 24 24">
                        <path
                            d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                    </svg>
                </button>
                <h2>Capturar</h2>
                <div></div>
            </div>
            <div class="capture-options">
                <button id="cameraBtn" class="capture-option">
                    <div class="capture-icon">
                        <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor">
                            <circle cx="12" cy="12" r="3.2" />
                            <path
                                d="M9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z" />
                        </svg>
                    </div>
                    <span>Câmera ao Vivo (4K)</span>
                </button>
                <button id="batchCameraBtn" class="capture-option highlight">
                    <div class="capture-icon">
                        <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor">
                            <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9h-4v4h-2v-4H9V9h4V5h2v4h4v2z"/>
                        </svg>
                    </div>
                    <span>Modo Lote (Várias Págs)</span>
                </button>
                <button id="galleryBtn" class="capture-option">
                    <div class="capture-icon">
                        <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor">
                            <path
                                d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
                        </svg>
                    </div>
                    <span>Galeria</span>
                </button>
                <button id="idCardModeBtn" class="capture-option" onclick="startIdCardScanner()">
                    <div class="capture-icon" style="background: rgba(99, 102, 241, 0.15); color: #6366f1;">
                        <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor">
                            <path d="M20 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4V6h16v12zM6 10h2v2H6zm0 4h8v1H6zm10 0h2v1h-2zm-6-4h8v2h-8z"/>
                        </svg>
                    </div>
                    <span>🪪 Modo RG / CNH (2 Lados em 1 A4)</span>
                </button>
                <button id="openPdfBtn" class="capture-option" onclick="triggerPdfUpload()">
                    <div class="capture-icon" style="background: rgba(239, 68, 68, 0.15); color: #ef4444;">
                        <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor">
                            <path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zm5 2h1v-3h-1v3zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6z"/>
                        </svg>
                    </div>
                    <span>📄 Abrir / Editar PDF</span>
                </button>
            </div>
            <input type="file" id="cameraInput" accept="image/*" capture="environment" hidden>
            <input type="file" id="batchCameraInput" accept="image/*" capture="environment" multiple hidden>
            <input type="file" id="galleryInput" accept="image/*" multiple hidden>
            <input type="file" id="pdfFileInput" accept="application/pdf" onchange="handlePdfImport(event)" hidden>
        </div>
    </div>

    <!-- Live Camera Viewport Modal (Webcam on Notebook/PC & Mobile) -->
    <div id="liveCameraModal" class="modal live-camera-modal-container">
        <div class="live-camera-modal">
            <!-- Camera Top Bar -->
            <div class="camera-top-bar">
                <button id="closeLiveCameraBtn" class="camera-icon-btn" aria-label="Fechar Câmera" onclick="stopLiveCamera()">
                    <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                </button>
                <div class="camera-title-badge" id="cameraModeBadge">Câmera ao Vivo</div>
                <div class="camera-top-actions">
                    <button id="autoCaptureToggleBtn" class="camera-icon-btn auto-active" title="Disparo Automático Inteligente" onclick="toggleAutoCapture()">
                        <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
                        </svg>
                        <span class="auto-capture-badge">AUTO</span>
                    </button>
                    <button id="cameraTorchBtn" class="camera-icon-btn" title="Lanterna" onclick="toggleCameraTorch()">
                        <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                            <path d="M9 2c-.55 0-1 .45-1 1v2c0 .55.45 1 1 1h6c.55 0 1-.45 1-1V3c0-.55-.45-1-1-1H9zm-2 6v1.5c0 1.8 1 3.4 2.5 4.3V21c0 .55.45 1 1 1h3c.55 0 1-.45 1-1v-7.2c1.5-.9 2.5-2.5 2.5-4.3V8H7zm5 6c-.83 0-1.5-.67-1.5-1.5S11.17 11 12 11s1.5.67 1.5 1.5S12.83 14 12 14z"/>
                        </svg>
                    </button>
                    <button id="switchLiveCameraBtn" class="camera-icon-btn" title="Alternar Câmera" onclick="switchLiveCamera()">
                        <svg viewBox="0 0 24 24"><path d="M9 12c0 1.66 1.34 3 3 3s3-1.34 3-3-1.34-3-3-3-3 1.34-3 3zm13-2V7c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v3h2v7c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-7h2zM7 8H5V6h2v2zm0 6c0-2.76 2.24-5 5-5s5 2.24 5 5-2.24 5-5 5-5-2.24-5-5z"/></svg>
                    </button>
                </div>
            </div>

            <!-- Video Viewport -->
            <div class="camera-viewport-container">
                <video id="liveCameraVideo" autoplay playsinline muted></video>
                <svg id="liveCameraContour" class="camera-live-contour" viewBox="0 0 100 100" preserveAspectRatio="none"></svg>
                <div id="idCardStepBanner" class="id-card-step-banner hidden">
                    <span id="idCardStepIcon">🪪</span>
                    <span id="idCardStepText">Posicione a FRENTE do documento</span>
                </div>
                <div class="camera-doc-frame" id="cameraDocFrame">
                    <div class="frame-corner tl"></div>
                    <div class="frame-corner tr"></div>
                    <div class="frame-corner bl"></div>
                    <div class="frame-corner br"></div>
                    <div class="camera-scan-laser"></div>
                </div>
                <div id="cameraFlashOverlay" class="camera-flash-overlay"></div>
                <div class="camera-hint-text" id="cameraHintText">Posicione o documento no enquadramento</div>
                <div id="liveBatchCounter" class="camera-batch-counter hidden">Páginas: <span id="liveBatchCountVal">0</span></div>
            </div>

            <!-- Camera Bottom Bar -->
            <div class="camera-bottom-bar">
                <button class="camera-sub-btn" onclick="triggerFileFallback()" title="Selecionar Arquivo">
                    <svg viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>
                    <span>Galeria</span>
                </button>

                <button id="shutterBtn" class="camera-shutter-btn" onclick="captureLivePhoto()" aria-label="Tirar Foto">
                    <div class="shutter-inner"></div>
                </button>

                <button id="liveBatchToggleBtn" class="camera-sub-btn" onclick="toggleLiveBatchMode()" title="Modo Contínuo">
                    <svg viewBox="0 0 24 24"><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9h-4v4h-2v-4H9V9h4V5h2v4h4v2z"/></svg>
                    <span id="liveBatchBtnLabel">Modo Lote</span>
                </button>
            </div>
        </div>
    </div>

    <!-- Editor Modal -->
    <div id="editorModal" class="modal">
        <div class="modal-content editor-modal">
            <div class="modal-header">
                <button id="closeEditorBtn" class="icon-btn">
                    <svg viewBox="0 0 24 24">
                        <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
                    </svg>
                </button>
                <h2 id="editorTitle">Editor</h2>
                <button id="editorDoneBtn" class="icon-btn primary">
                    <svg viewBox="0 0 24 24">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                    </svg>
                </button>
            </div>

            <!-- Editor Tabs -->
            <div class="editor-tabs">
                <button class="editor-tab active" data-tab="crop">Cortar</button>
                <button class="editor-tab" data-tab="filters">Filtros</button>
                <button class="editor-tab" data-tab="adjust">Ajustar</button>
                <button class="editor-tab" data-tab="signature">✍️ Assinar</button>
                <button class="editor-tab" data-tab="redact">⬛ Censurar</button>
                <button class="editor-tab" data-tab="eraser">🧹 Retoque</button>
            </div>

            <!-- Canvas Container -->
            <div class="editor-canvas-container laser-scan-container">
                <div id="laserScanLine" class="laser-scan-line"></div>
                <canvas id="editorCanvas"></canvas>
                <div id="cropOverlay" class="crop-overlay">
                    <svg id="cropLines" class="persp-lines"></svg>
                    <div class="crop-handle" data-corner="tl"></div>
                    <div class="crop-handle" data-corner="tr"></div>
                    <div class="crop-handle" data-corner="bl"></div>
                    <div class="crop-handle" data-corner="br"></div>
                </div>
                <!-- Lupa de Alta Precisão (Magnifier Loupe) -->
                <div id="cornerMagnifier" class="corner-magnifier hidden">
                    <canvas id="magnifierCanvas" width="130" height="130"></canvas>
                    <div class="magnifier-crosshair"></div>
                </div>
            </div>

            <!-- Crop Tools -->
            <div id="cropTools" class="editor-tools">
                <div class="tool-group">
                    <span class="tool-label">Proporção:</span>
                    <div class="ratio-buttons">
                        <button class="ratio-btn active" data-ratio="free">Livre</button>
                        <button class="ratio-btn" data-ratio="a4">A4</button>
                        <button class="ratio-btn" data-ratio="square">1:1</button>
                        <button class="ratio-btn" data-ratio="card">Cartão</button>
                    </div>
                </div>
                <div class="tool-actions">
                    <button id="autoDetectBtn" class="tool-btn">
                        <svg viewBox="0 0 24 24">
                            <path
                                d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3c-.46-4.17-3.77-7.48-7.94-7.94V1h-2v2.06C6.83 3.52 3.52 6.83 3.06 11H1v2h2.06c.46 4.17 3.77 7.48 7.94 7.94V23h2v-2.06c4.17-.46 7.48-3.77 7.94-7.94H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z" />
                        </svg>
                        <span>Auto Detectar</span>
                    </button>
                    <button id="resetCropBtn" class="tool-btn">
                        <svg viewBox="0 0 24 24">
                            <path
                                d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z" />
                        </svg>
                        <span>Resetar</span>
                    </button>
                </div>
            </div>

            <!-- Filter Tools -->
            <div id="filterTools" class="editor-tools hidden">
                <div class="filter-section">
                    <h4>Recomendados</h4>
                    <div class="filter-grid">
                        <button class="filter-btn active" data-filter="magic">
                            <div class="filter-preview magic"></div>
                            <span>✨ Mágico Pro</span>
                        </button>
                        <button class="filter-btn" data-filter="magic_bw">
                            <div class="filter-preview magic_bw"></div>
                            <span>⚡ Mágico P&B</span>
                        </button>
                        <button class="filter-btn" data-filter="original">
                            <div class="filter-preview original"></div>
                            <span>Original</span>
                        </button>
                        <button class="filter-btn" data-filter="deshadow">
                            <div class="filter-preview deshadow"></div>
                            <span>☀️ Tirar Sombras</span>
                        </button>
                    </div>
                </div>
                <div class="filter-section">
                    <h4>Avançados & Cores</h4>
                    <div class="filter-grid">
                        <button class="filter-btn" data-filter="grayscale">
                            <div class="filter-preview grayscale"></div>
                            <span>P&B</span>
                        </button>
                        <button class="filter-btn" data-filter="contrast">
                            <div class="filter-preview contrast"></div>
                            <span>Contraste</span>
                        </button>
                        <button class="filter-btn" data-filter="brightness">
                            <div class="filter-preview brightness"></div>
                            <span>Brilho</span>
                        </button>
                        <button class="filter-btn" data-filter="document">
                            <div class="filter-preview document"></div>
                            <span>Documento</span>
                        </button>
                        <button class="filter-btn" data-filter="whiteboard">
                            <div class="filter-preview whiteboard"></div>
                            <span>Quadro</span>
                        </button>
                        <button class="filter-btn" data-filter="autoclean">
                            <div class="filter-preview autoclean"></div>
                            <span>Auto Limpar</span>
                        </button>
                    </div>
                </div>
                <div class="filter-section">
                    <h4>Ferramentas</h4>
                    <button id="editorOcrBtn" class="tool-btn" style="width: 100%; margin-top: 10px;">
                        <svg viewBox="0 0 24 24">
                            <path
                                d="M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5C13 2.12 11.88 1 10.5 1S8 2.12 8 3.5V5H4c-1.1 0-1.99.9-1.99 2v3.8H3.5c1.49 0 2.7 1.21 2.7 2.7s-1.21 2.7-2.7 2.7H2V20c0 1.1.9 2 2 2h3.8v-1.5c0-1.49 1.21-2.7 2.7-2.7 1.49 0 2.7 1.21 2.7 2.7V22H17c1.1 0 2-.9 2-2v-4h1.5c1.38 0 2.5-1.12 2.5-2.5S21.88 11 20.5 11z" />
                        </svg>
                        <span>📝 Extrair Texto (OCR)</span>
                    </button>
                </div>
            </div>

            <!-- Signature Tools -->
            <div id="signatureTools" class="editor-tools hidden">
                <div class="tool-actions" style="flex-direction: column; gap: 10px;">
                    <button id="openSignatureModalBtn" class="save-btn primary" style="width: 100%;">
                        <span>✍️ Desenhar Nova Assinatura</span>
                    </button>
                    <button id="removeSignatureBtn" class="tool-btn" style="width: 100%;">
                        <span>Remover Assinatura Aplicada</span>
                    </button>
                </div>
            </div>

            <!-- Eraser / Retouch Tools -->
            <div id="eraserTools" class="editor-tools hidden">
                <div class="adjust-sliders">
                    <div class="slider-row">
                        <label>Tamanho do Pincel Borracha: <span id="eraserSizeVal">20px</span></label>
                        <input type="range" id="eraserSizeSlider" min="5" max="60" value="20" oninput="updateEraserSize(this.value)">
                    </div>
                    <p style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">Passe o dedo ou o mouse sobre o documento para apagar manchas, dedos ou grampos.</p>
                </div>
            </div>

            <!-- Adjust Tools -->
            <div id="adjustTools" class="editor-tools hidden">
                <div class="adjust-buttons">
                    <button id="rotateLeftBtn" class="adjust-btn">
                        <svg viewBox="0 0 24 24">
                            <path
                                d="M7.11 8.53L5.7 7.11C4.8 8.27 4.24 9.61 4.07 11h2.02c.14-.87.49-1.72 1.02-2.47zM6.09 13H4.07c.17 1.39.72 2.73 1.62 3.89l1.41-1.42c-.52-.75-.87-1.59-1.01-2.47zm1.01 5.32c1.16.9 2.51 1.44 3.9 1.61V17.9c-.87-.15-1.71-.49-2.46-1.03L7.1 18.32zM13 4.07V1L8.45 5.55 13 10V6.09c2.84.48 5 2.94 5 5.91s-2.16 5.43-5 5.91v2.02c3.95-.49 7-3.85 7-7.93s-3.05-7.44-7-7.93z" />
                        </svg>
                        <span>Girar -90°</span>
                    </button>
                    <button id="rotateRightBtn" class="adjust-btn">
                        <svg viewBox="0 0 24 24">
                            <path
                                d="M15.55 5.55L11 1v3.07C7.06 4.56 4 7.92 4 12s3.05 7.44 7 7.93v-2.02c-2.84-.48-5-2.94-5-5.91s2.16-5.43 5-5.91V10l4.55-4.45zM19.93 11c-.17-1.39-.72-2.73-1.62-3.89l-1.42 1.42c.54.75.88 1.6 1.02 2.47h2.02zM13 17.9v2.02c1.39-.17 2.74-.71 3.9-1.61l-1.44-1.44c-.75.54-1.59.89-2.46 1.03zm3.89-2.42l1.42 1.41c.9-1.16 1.45-2.5 1.62-3.89h-2.02c-.14.87-.48 1.72-1.02 2.48z" />
                        </svg>
                        <span>Girar +90°</span>
                    </button>
                </div>
                <!-- Manual adjustment sliders -->
                <div class="adjust-sliders">
                    <div class="slider-row">
                        <label>☀️ Brilho <span id="brightnessVal">0</span></label>
                        <input type="range" id="brightnessSlider" min="-100" max="100" value="0"
                            oninput="applyAdjustments()">
                    </div>
                    <div class="slider-row">
                        <label>◐ Contraste <span id="contrastVal">0</span></label>
                        <input type="range" id="contrastSlider" min="-100" max="100" value="0"
                            oninput="applyAdjustments()">
                    </div>
                    <div class="slider-row">
                        <label>🎨 Saturação <span id="saturationVal">0</span></label>
                        <input type="range" id="saturationSlider" min="-100" max="100" value="0"
                            oninput="applyAdjustments()">
                    </div>
                    <button class="tool-btn" id="resetAdjustBtn" style="width:100%;margin-top:8px"
                        onclick="resetAdjustments()">
                        <svg viewBox="0 0 24 24">
                            <path
                                d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z" />
                        </svg>
                        <span>Resetar Ajustes</span>
                    </button>
                </div>
            </div>

            <!-- Redact Tools (Tarja / Censura de Dados Sensíveis) -->
            <div id="redactTools" class="editor-tools hidden">
                <div class="tool-group">
                    <span class="tool-label">Estilo:</span>
                    <div class="ratio-buttons">
                        <button type="button" class="redact-btn active" id="redactModeBlack" onclick="setRedactMode('black')">⬛ Tarja Preta</button>
                        <button type="button" class="redact-btn" id="redactModeBlur" onclick="setRedactMode('blur')">🌁 Desfoque (Blur)</button>
                    </div>
                </div>
                <div class="tool-group">
                    <span class="tool-label">Forma:</span>
                    <div class="ratio-buttons">
                        <button type="button" class="redact-btn active" id="redactShapeRect" onclick="setRedactShape('rect')">▭ Retângulo</button>
                        <button type="button" class="redact-btn" id="redactShapeBrush" onclick="setRedactShape('brush')">🖌️ Pincel</button>
                    </div>
                </div>
                <div class="tool-actions">
                    <button type="button" class="tool-btn" onclick="undoRedact()">
                        <svg viewBox="0 0 24 24"><path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/></svg>
                        <span>Desfazer</span>
                    </button>
                    <button type="button" class="tool-btn" onclick="clearAllRedacts()">
                        <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                        <span>Limpar</span>
                    </button>
                </div>
            </div>

            <!-- Perspective Tools -->
            <div id="perspectiveTools" class="editor-tools hidden">
                <div class="persp-instructions">
                    <p>Arraste os 4 cantos para corrigir a perspectiva. Toque em <strong>Aplicar</strong> para
                        processar.</p>
                </div>
                <div class="tool-actions" style="margin-top:10px">
                    <button id="applyPerspBtn" class="tool-btn primary" onclick="applyPerspective()">
                        <svg viewBox="0 0 24 24">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                        </svg>
                        <span>Aplicar Perspectiva</span>
                    </button>
                    <button id="resetPerspBtn" class="tool-btn" onclick="resetPerspective()">
                        <svg viewBox="0 0 24 24">
                            <path
                                d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z" />
                        </svg>
                        <span>Resetar</span>
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Multi-Page Modal -->
    <div id="multiPageModal" class="modal">
        <div class="modal-content multipage-modal">
            <div class="modal-header">
                <button id="closeMultiPageBtn" class="icon-btn">
                    <svg viewBox="0 0 24 24">
                        <path
                            d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                    </svg>
                </button>
                <h2>Documento Multi-Página</h2>
                <button id="generatePdfBtn" class="icon-btn primary">
                    <svg viewBox="0 0 24 24">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                    </svg>
                </button>
            </div>
            <div class="pages-grid" id="pagesGrid"></div>
            <div class="multipage-actions">
                <button id="addPageBtn" class="action-btn">
                    <svg viewBox="0 0 24 24">
                        <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                    </svg>
                    <span>Adicionar Página</span>
                </button>
            </div>
        </div>
    </div>

    <!-- Save Modal -->
    <div id="saveModal" class="modal">
        <div class="modal-content save-modal">
            <div class="modal-header">
                <button id="closeSaveBtn" class="icon-btn">
                    <svg viewBox="0 0 24 24">
                        <path
                            d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                    </svg>
                </button>
                <h2>Salvar Documento</h2>
                <div></div>
            </div>
            <div class="save-options">
                <div class="form-group">
                    <label>Nome do documento</label>
                    <input type="text" id="docNameInput" placeholder="scan-YYYYMMDD-HHMMSS">
                </div>
                <div class="form-group">
                    <label>Formato</label>
                    <div class="format-buttons">
                        <button class="format-btn active" data-format="jpg">JPG</button>
                        <button class="format-btn" data-format="pdf">PDF</button>
                    </div>
                </div>
                <div class="form-group">
                    <label>Pasta</label>
                    <select id="folderSelect">
                        <option value="root">Raiz</option>
                    </select>
                </div>
                <div class="save-actions">
                    <button id="saveLocalBtn" class="save-btn primary">
                        <svg viewBox="0 0 24 24">
                            <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
                        </svg>
                        <span>Salvar no Dispositivo</span>
                    </button>
                    <button id="saveDriveBtn" class="save-btn">
                        <svg viewBox="0 0 24 24">
                            <path
                                d="M7.71 3.5L1.15 15l3.43 6 6.55-11.5L7.71 3.5zm1.14 0l6.57 11.5h6.56l-6.57-11.5H8.85zm7.14 12.5H2.29l3.43 6h13.71l-3.44-6z" />
                        </svg>
                        <span>Salvar no Google Drive</span>
                    </button>
                    <button id="saveBothBtn" class="save-btn secondary">
                        <svg viewBox="0 0 24 24">
                            <path
                                d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z" />
                        </svg>
                        <span>Salvar em Ambos</span>
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Folder Modal -->
    <div id="folderModal" class="modal">
        <div class="modal-content folder-modal">
            <div class="modal-header">
                <button id="closeFolderModalBtn" class="icon-btn">
                    <svg viewBox="0 0 24 24">
                        <path
                            d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                    </svg>
                </button>
                <h2 id="folderModalTitle" data-i18n="new_folder_title">Nova Pasta</h2>
                <button id="saveFolderBtn" class="icon-btn primary">
                    <svg viewBox="0 0 24 24">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                    </svg>
                </button>
            </div>
            <div class="folder-form">
                <div class="form-group">
                    <label data-i18n="folder_name_label">Nome da pasta</label>
                    <input type="text" id="folderNameInput" data-i18n-ph="new_folder_ph" placeholder="Nova pasta">
                </div>
            </div>
        </div>
    </div>

    <!-- Context Menu -->
    <div id="contextMenu" class="context-menu hidden">
        <button class="context-item" data-action="view">
            <svg viewBox="0 0 24 24">
                <path
                    d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
            </svg>
            <span data-i18n="ctx_view">Visualizar</span>
        </button>
        <button class="context-item" data-action="favorite">
            <svg viewBox="0 0 24 24">
                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
            </svg>
            <span data-i18n="ctx_favorite">Favoritar</span>
        </button>
        <button class="context-item" data-action="share">
            <svg viewBox="0 0 24 24">
                <path
                    d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z" />
            </svg>
            <span data-i18n="ctx_share">Compartilhar</span>
        </button>
        <div class="context-divider"></div>
        <button class="context-item" data-action="lock" id="lockFolderOption">
            <svg viewBox="0 0 24 24">
                <path
                    d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
            </svg>
            <span data-i18n="ctx_lock">Proteger com PIN</span>
        </button>
        <button class="context-item hidden" data-action="unlock" id="unlockFolderOption">
            <svg viewBox="0 0 24 24">
                <path
                    d="M12 17c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm6-9h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6h1.9c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm0 12H6V10h12v10z" />
            </svg>
            <span data-i18n="ctx_unlock">Remover Proteção</span>
        </button>
        <div class="context-divider"></div>
        <button class="context-item" data-action="rename">
            <svg viewBox="0 0 24 24">
                <path
                    d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
            </svg>
            <span data-i18n="ctx_rename">Renomear</span>
        </button>
        <button class="context-item" data-action="move">
            <svg viewBox="0 0 24 24">
                <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
            </svg>
            <span data-i18n="ctx_move">Mover para pasta</span>
        </button>
        <button class="context-item" data-action="download">
            <svg viewBox="0 0 24 24">
                <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
            </svg>
            <span data-i18n="ctx_download">Baixar</span>
        </button>
        <button class="context-item" data-action="ocr">
            <svg viewBox="0 0 24 24">
                <path
                    d="M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5C13 2.12 11.88 1 10.5 1S8 2.12 8 3.5V5H4c-1.1 0-1.99.9-1.99 2v3.8H3.5c1.49 0 2.7 1.21 2.7 2.7s-1.21 2.7-2.7 2.7H2V20c0 1.1.9 2 2 2h3.8v-1.5c0-1.49 1.21-2.7 2.7-2.7 1.49 0 2.7 1.21 2.7 2.7V22H17c1.1 0 2-.9 2-2v-4h1.5c1.38 0 2.5-1.12 2.5-2.5S21.88 11 20.5 11z" />
            </svg>
            <span data-i18n="ctx_ocr">Extrair Texto (OCR)</span>
        </button>
        <button class="context-item" data-action="drive">
            <svg viewBox="0 0 24 24">
                <path
                    d="M7.71 3.5L1.15 15l3.43 6 6.55-11.5L7.71 3.5zm1.14 0l6.57 11.5h6.56l-6.57-11.5H8.85zm7.14 12.5H2.29l3.43 6h13.71l-3.44-6z" />
            </svg>
            <span data-i18n="ctx_drive">Enviar para Drive</span>
        </button>
        <div class="context-divider"></div>
        <button class="context-item danger" data-action="delete">
            <svg viewBox="0 0 24 24">
                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
            </svg>
            <span data-i18n="ctx_delete">Excluir</span>
        </button>
    </div>

    <!-- Move Modal -->
    <div id="moveModal" class="modal">
        <div class="modal-content move-modal">
            <div class="modal-header">
                <button id="closeMoveModalBtn" class="icon-btn">
                    <svg viewBox="0 0 24 24">
                        <path
                            d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                    </svg>
                </button>
                <h2 data-i18n="move_to_title">Mover para</h2>
                <div></div>
            </div>
            <div id="moveFoldersList" class="folders-list"></div>
        </div>
    </div>

    <!-- PIN Modal -->
    <div id="pinModal" class="modal">
        <div class="modal-content pin-modal">
            <div class="modal-header">
                <h2 id="pinModalTitle" data-i18n="pin_modal_title">Digite o PIN</h2>
                <button id="closePinModalBtn" class="icon-btn">
                    <svg viewBox="0 0 24 24">
                        <path
                            d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                    </svg>
                </button>
            </div>
            <div class="pin-display">
                <input type="password" id="pinInput" maxlength="4" placeholder="••••" readonly>
            </div>
            <div class="pin-keypad">
                <button onclick="appendPin(1)">1</button>
                <button onclick="appendPin(2)">2</button>
                <button onclick="appendPin(3)">3</button>
                <button onclick="appendPin(4)">4</button>
                <button onclick="appendPin(5)">5</button>
                <button onclick="appendPin(6)">6</button>
                <button onclick="appendPin(7)">7</button>
                <button onclick="appendPin(8)">8</button>
                <button onclick="appendPin(9)">9</button>
                <button class="clear" onclick="clearPin()">C</button>
                <button onclick="appendPin(0)">0</button>
                <button class="confirm" onclick="confirmPin()">OK</button>
            </div>
        </div>
    </div>

    <!-- Viewer Modal -->
    <div id="viewerModal" class="modal viewer-modal-container">
        <div class="modal-content viewer-modal">
            <!-- Header fixo no topo -->
            <header class="viewer-header">
                <button id="closeViewerBtn" class="viewer-btn viewer-btn-close" aria-label="Fechar">
                    <svg viewBox="0 0 24 24" width="28" height="28">
                        <path fill="currentColor"
                            d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                    </svg>
                </button>
                <h2 id="viewerTitle" class="viewer-title">Documento</h2>
                <div class="viewer-header-actions">
                    <button id="viewerStampBtn" class="viewer-btn viewer-btn-action" title="Carimbo & Marca d'Água" aria-label="Carimbo" onclick="openStampModal()">
                        <svg viewBox="0 0 24 24" width="20" height="20">
                            <path fill="currentColor" d="M19.5 9.5c-1.03 0-1.9.62-2.29 1.5H6.79c-.39-.88-1.26-1.5-2.29-1.5C3.12 9.5 2 10.62 2 12s1.12 2.5 2.5 2.5c1.03 0 1.9-.62 2.29-1.5h10.42c.39.88 1.26 1.5 2.29 1.5 1.38 0 2.5-1.12 2.5-2.5s-1.12-2.5-2.5-2.5zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
                        </svg>
                    </button>
                    <button id="viewerThermalBtn" class="viewer-btn viewer-btn-action btn-thermal-print" title="Imprimir na Térmica (Bematech 80mm)" aria-label="Imprimir Térmica" onclick="printActiveDocThermal()">
                        <svg viewBox="0 0 24 24" width="20" height="20">
                            <path fill="currentColor" d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/>
                        </svg>
                    </button>
                    <button id="viewerPdfOptionsBtn" class="viewer-btn viewer-btn-action" title="Exportar PDF Avançado" aria-label="PDF" onclick="openPdfOptionsModal()">
                        <svg viewBox="0 0 24 24" width="20" height="20">
                            <path fill="currentColor" d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5z"/>
                        </svg>
                    </button>
                    <button id="viewerOcrBtn" class="viewer-btn viewer-btn-action" title="Extrair texto"
                        aria-label="OCR">
                        <svg viewBox="0 0 24 24" width="20" height="20">
                            <path fill="currentColor"
                                d="M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5C13 2.12 11.88 1 10.5 1S8 2.12 8 3.5V5H4c-1.1 0-1.99.9-1.99 2v3.8H3.5c1.49 0 2.7 1.21 2.7 2.7s-1.21 2.7-2.7 2.7H2V20c0 1.1.9 2 2 2h3.8v-1.5c0-1.49 1.21-2.7 2.7-2.7 1.49 0 2.7 1.21 2.7 2.7V22H17c1.1 0 2-.9 2-2v-4h1.5c1.38 0 2.5-1.12 2.5-2.5S21.88 11 20.5 11z" />
                        </svg>
                    </button>
                    <button id="viewerDriveBtn" class="viewer-btn viewer-btn-action" title="Salvar no Google Drive" aria-label="Google Drive" onclick="uploadCurrentViewerDocToDrive()">
                        <svg viewBox="0 0 24 24" width="20" height="20">
                            <path fill="currentColor" d="M7.71 3.5L1.15 15l3.43 6 6.55-11.5L7.71 3.5zm1.14 0l6.57 11.5h6.56l-6.57-11.5H8.85zm7.14 12.5H2.29l3.43 6h13.71l-3.44-6z" />
                        </svg>
                    </button>
                    <button id="viewerShareBtn" class="viewer-btn viewer-btn-action" title="Compartilhar"
                        aria-label="Compartilhar">
                        <svg viewBox="0 0 24 24" width="20" height="20">
                            <path fill="currentColor"
                                d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z" />
                        </svg>
                    </button>
                </div>
            </header>
            <!-- Conteúdo da imagem com zoom e pan -->
            <div class="viewer-content" id="viewerContent">
                <img id="viewerImage" src="" alt="Documento">
            </div>
            <!-- Barra de Navegação Multi-Páginas -->
            <div id="viewerPageBar" class="viewer-page-bar hidden">
                <button id="viewerPrevPageBtn" class="viewer-page-btn" title="Página Anterior" onclick="viewerNavigatePage(-1)">◀</button>
                <span id="viewerPageIndicator" class="viewer-page-indicator">Página 1 de 1</span>
                <button id="viewerNextPageBtn" class="viewer-page-btn" title="Próxima Página" onclick="viewerNavigatePage(1)">▶</button>
                <button id="viewerAddPageBtn" class="viewer-page-btn add-page" title="Adicionar Página" onclick="viewerAddPage()" data-i18n="viewer_add_page">+ Página</button>
                <button id="viewerDeletePageBtn" class="viewer-page-btn delete-page" title="Excluir Página Atual" onclick="viewerDeletePage()">🗑️</button>
            </div>
        </div>
    </div>

    <!-- OCR Modal -->
    <div id="ocrModal" class="modal">
        <div class="modal-content ocr-modal">
            <div class="modal-header">
                <button id="closeOcrBtn" class="icon-btn">
                    <svg viewBox="0 0 24 24">
                        <path
                            d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                    </svg>
                </button>
                <h2 data-i18n="ocr_title">Texto Extraído (OCR)</h2>
                <div></div>
            </div>
            <div class="ocr-content">
                <textarea id="ocrText" data-i18n-ph="ocr_placeholder" placeholder="O texto extraído aparecerá aqui..."></textarea>
                <div class="ocr-actions">
                    <button id="copyOcrBtn" class="ocr-action-btn primary">
                        <svg viewBox="0 0 24 24" width="18" height="18">
                            <path fill="currentColor"
                                d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" />
                        </svg>
                        <span data-i18n="copy_text">Copiar Texto</span>
                    </button>
                    <button id="shareOcrBtn" class="ocr-action-btn secondary">
                        <svg viewBox="0 0 24 24" width="18" height="18">
                            <path fill="currentColor"
                                d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z" />
                        </svg>
                        <span data-i18n="ctx_share">Compartilhar</span>
                    </button>
                    <button id="exportExcelBtn" class="ocr-action-btn" style="background: rgba(16, 185, 129, 0.15); color: #10b981;" onclick="exportOcrToExcel()">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14.5l-2.5-3.8-2.5 3.8H5l3.8-5.7L5.2 8h2l2.3 3.5L11.8 8h2l-3.6 5.8 3.8 5.7h-2zm7 .5h-4v-2h4v2zm0-4h-4v-2h4v2zm0-4h-4V8h4v2z"/>
                        </svg>
                        <span data-i18n="export_excel">Exportar Excel (.xlsx)</span>
                    </button>
                    <button id="printOcrThermalBtn" class="ocr-action-btn btn-thermal-print full-width" onclick="printOcrTextThermal()">
                        <svg viewBox="0 0 24 24" width="18" height="18">
                            <path fill="currentColor" d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/>
                        </svg>
                        <span data-i18n="print_btn">Imprimir</span>
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Payment Modal -->
    <div id="paymentModal" class="modal">
        <div class="modal-content payment-modal">
            <div class="modal-header">
                <button id="closePaymentBtn" class="icon-btn">
                    <svg viewBox="0 0 24 24">
                        <path
                            d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                    </svg>
                </button>
                <h2>Comprar Créditos</h2>
                <div></div>
            </div>
            <div class="payment-body">
                <div id="packageSelection">
                    <p class="payment-intro">Escolha um pacote de créditos para continuar digitalizando e usando OCR
                        ilimitado.</p>
                    <div class="package-grid">
                        <div class="package-card" data-amount="5.00" data-credits="10">
                            <div class="package-credits">10</div>
                            <div class="package-label">Créditos</div>
                            <div class="package-price">R$ 5,00</div>
                        </div>
                        <div class="package-card featured" data-amount="10.00" data-credits="25">
                            <div class="package-badge">MAIS POPULAR</div>
                            <div class="package-credits">25</div>
                            <div class="package-label">Créditos</div>
                            <div class="package-price">R$ 10,00</div>
                        </div>
                        <div class="package-card" data-amount="20.00" data-credits="60">
                            <div class="package-credits">60</div>
                            <div class="package-label">Créditos</div>
                            <div class="package-price">R$ 20,00</div>
                        </div>
                    </div>
                </div>

                <div id="pixPayment" class="hidden">
                    <div class="pix-qr-container">
                        <img id="pixQrImg" src="" alt="QR Code PIX">
                        <div class="pix-timer">Aguardando pagamento... <span id="pixCountdown">15:00</span></div>
                    </div>
                    <div class="pix-copy-paste">
                        <label>Código PIX Copia e Cola:</label>
                        <textarea id="pixCode" readonly></textarea>
                        <button id="copyPixBtn" class="action-btn primary">Copiar Código</button>
                    </div>
                    <button id="backToPackagesBtn" class="text-btn">Voltar aos pacotes</button>
                </div>

                <div id="paymentSuccess" class="hidden">
                    <div class="success-icon">✅</div>
                    <h3>Pagamento Aprovado!</h3>
                    <p>Seus créditos foram adicionados à sua conta.</p>
                    <button id="closeSuccessBtn" class="action-btn primary">Começar a usar</button>
                </div>
            </div>
        </div>
    </div>

    <!-- Settings Modal -->
    <div id="settingsModal" class="modal">
        <div class="modal-content settings-modal">
            <div class="modal-header">
                <button id="closeSettingsBtn" class="icon-btn">
                    <svg viewBox="0 0 24 24">
                        <path
                            d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                    </svg>
                </button>
                <h2 data-i18n="settings">Configurações</h2>
                <div></div>
            </div>
            <div class="settings-content">
                <div class="setting-group">
                    <h3 data-i18n="appearance">Aparência</h3>
                    <div class="setting-item">
                        <label data-i18n="theme">Tema</label>
                        <div class="theme-buttons">
                            <button class="theme-btn" data-theme="light">
                                <svg viewBox="0 0 24 24">
                                    <path
                                        d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z" />
                                </svg>
                                <span data-i18n="theme_light">Claro</span>
                            </button>
                            <button class="theme-btn active" data-theme="dark">
                                <svg viewBox="0 0 24 24">
                                    <path
                                        d="M9 2c-1.05 0-2.05.16-3 .46 4.06 1.27 7 5.06 7 9.54 0 4.48-2.94 8.27-7 9.54.95.3 1.95.46 3 .46 5.52 0 10-4.48 10-10S14.52 2 9 2z" />
                                </svg>
                                <span data-i18n="theme_dark">Escuro</span>
                            </button>
                            <button class="theme-btn" data-theme="auto">
                                <svg viewBox="0 0 24 24">
                                    <path
                                        d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1z" />
                                </svg>
                                <span data-i18n="theme_auto">Auto</span>
                            </button>
                        </div>
                    </div>
                </div>

                <div class="setting-group">
                    <h3 data-i18n="image_quality">Qualidade de Imagem</h3>
                    <div class="setting-item">
                        <label data-i18n="compression_label">Compressão (maior = melhor qualidade, maior tamanho)</label>
                        <input type="range" id="qualityRange" min="50" max="100" value="90" step="5">
                        <span id="qualityValue">90%</span>
                    </div>
                </div>

                <div class="setting-group">
                    <h3 data-i18n="watermark">Marca d'água</h3>
                    <div class="setting-item">
                        <label data-i18n="add_watermark">Adicionar marca d'água aos documentos</label>
                        <label class="switch">
                            <input type="checkbox" id="watermarkToggle">
                            <span class="slider"></span>
                        </label>
                    </div>
                    <div class="setting-item" id="watermarkTextGroup">
                        <label data-i18n="watermark_text">Texto da marca d'água</label>
                        <input type="text" id="watermarkText" placeholder="DocScan Pro">
                    </div>
                </div>

                <div class="setting-group">
                    <h3 data-i18n="autosave">Auto-salvamento</h3>
                    <div class="setting-item">
                        <label data-i18n="save_automatically">Salvar automaticamente no dispositivo</label>
                        <label class="switch">
                            <input type="checkbox" id="autoSaveToggle" checked>
                            <span class="slider"></span>
                        </label>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Stats Modal -->
    <div id="statsModal" class="modal">
        <div class="modal-content stats-modal">
            <div class="modal-header">
                <button id="closeStatsBtn" class="icon-btn">
                    <svg viewBox="0 0 24 24">
                        <path
                            d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                    </svg>
                </button>
                <h2 data-i18n="stats">Estatísticas</h2>
                <div></div>
            </div>
            <div class="stats-content">
                <div class="stat-card">
                    <div class="stat-icon">📄</div>
                    <div class="stat-info">
                        <div class="stat-value" id="totalDocs">0</div>
                        <div class="stat-label" data-i18n="stat_docs">Documentos</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">📁</div>
                    <div class="stat-info">
                        <div class="stat-value" id="totalFolders">0</div>
                        <div class="stat-label" data-i18n="stat_folders">Pastas</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">⭐</div>
                    <div class="stat-info">
                        <div class="stat-value" id="totalFavorites">0</div>
                        <div class="stat-label" data-i18n="stat_favs">Favoritos</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">📊</div>
                    <div class="stat-info">
                        <div class="stat-value" id="totalPages">0</div>
                        <div class="stat-label" data-i18n="stat_pages">Páginas</div>
                    </div>
                </div>
                <div class="stat-card full-width">
                    <div class="stat-icon">💾</div>
                    <div class="stat-info">
                        <div class="stat-value" id="storageUsed">0 KB</div>
                        <div class="stat-label" data-i18n="stat_storage">Armazenamento usado</div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- About Modal -->
    <div id="aboutModal" class="modal">
        <div class="modal-content about-modal" style="max-width: 460px; padding: 24px; text-align: center; border-radius: var(--radius-xl); background: var(--bg-secondary);">
            <div class="modal-header" style="justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <div style="display: flex; gap: 6px;">
                    <button type="button" id="aboutLangPt" class="ratio-btn active" style="padding: 4px 10px; font-size: 11px; min-width: auto;" onclick="setAboutLang('pt')">🇧🇷 Português</button>
                    <button type="button" id="aboutLangEn" class="ratio-btn" style="padding: 4px 10px; font-size: 11px; min-width: auto;" onclick="setAboutLang('en')">🇺🇸 English</button>
                </div>
                <button id="closeAboutBtn" class="icon-btn" onclick="closeModal('aboutModal')">
                    <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                </button>
            </div>
            <div style="font-size: 52px; margin-bottom: 8px;">📄</div>
            <h2 style="font-size: 22px; font-weight: 700; color: #fff; margin-bottom: 4px;">DocScan Pro</h2>
            <div style="display: inline-block; background: rgba(108, 92, 231, 0.2); color: var(--accent-secondary); border: 1px solid var(--accent-primary); border-radius: 999px; padding: 3px 12px; font-size: 12px; font-weight: 600; margin-bottom: 16px;" id="aboutVersionBadge">Versão 2.0.0 — Edição 2026</div>
            
            <!-- PT Content -->
            <div id="aboutContentPt">
                <p style="font-size: 13px; color: var(--text-secondary); line-height: 1.5; margin-bottom: 16px;">
                    Scanner de documentos profissional com processamento local em alta definição, OCR pesquisável, leitor de boletos bancários, assinatura digital touch e suporte nativo a impressão térmica de 80mm.
                </p>

                <div style="background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 12px; text-align: left; font-size: 12px; color: var(--text-muted); display: flex; flex-direction: column; gap: 6px; margin-bottom: 18px;">
                    <div>💎 <strong>100% Gratuito:</strong> Scanner, filtros, assinatura e PDF são gratuitos. Pagamentos apenas para IA (OCR).</div>
                    <div>🔒 <strong>Privacidade:</strong> 100% dos dados ficam no seu dispositivo</div>
                    <div>⚡ <strong>Modo Offline:</strong> Funciona sem conexão à internet</div>
                    <div>🖨️ <strong>Térmica:</strong> Integrado com Bematech MP-4200 TH</div>
                    <div>✨ <strong>Desenvolvido por:</strong> <a href="https://4u.ia.br" target="_blank" style="color: var(--accent-secondary); text-decoration: none; font-weight: 600;">4u.ia.br</a></div>
                    <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.08); display: flex; gap: 14px; font-size: 11px;">
                        <a href="/app/auth/privacidade.html" target="_blank" style="color: var(--accent-secondary); text-decoration: underline;">Política de Privacidade</a>
                        <a href="/app/auth/termos.html" target="_blank" style="color: var(--accent-secondary); text-decoration: underline;">Termos de Uso</a>
                    </div>
                </div>

                <button class="save-btn primary" style="width: 100%; justify-content: center;" onclick="closeModal('aboutModal')">Entendi</button>
            </div>

            <!-- EN Content -->
            <div id="aboutContentEn" style="display: none;">
                <p style="font-size: 13px; color: var(--text-secondary); line-height: 1.5; margin-bottom: 16px;">
                    Professional document scanner with high-definition local processing, searchable AI OCR, barcode and bank slip reader, touch digital signature, and native 80mm thermal printing.
                </p>

                <div style="background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 12px; text-align: left; font-size: 12px; color: var(--text-muted); display: flex; flex-direction: column; gap: 6px; margin-bottom: 18px;">
                    <div>💎 <strong>100% Free:</strong> Scanner, filters, signing, and PDF are free. Payments are strictly for AI processing (OCR).</div>
                    <div>🔒 <strong>Privacy:</strong> 100% of data remains on your device</div>
                    <div>⚡ <strong>Offline Mode:</strong> Works without an internet connection</div>
                    <div>🖨️ <strong>Thermal:</strong> Integrated with Bematech MP-4200 TH</div>
                    <div>✨ <strong>Developed by:</strong> <a href="https://4u.ia.br" target="_blank" style="color: var(--accent-secondary); text-decoration: none; font-weight: 600;">4u.ia.br</a></div>
                    <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.08); display: flex; gap: 14px; font-size: 11px;">
                        <a href="/app/auth/privacidade.html?lang=en" target="_blank" style="color: var(--accent-secondary); text-decoration: underline;">Privacy Policy</a>
                        <a href="/app/auth/termos.html?lang=en" target="_blank" style="color: var(--accent-secondary); text-decoration: underline;">Terms of Use</a>
                    </div>
                </div>

                <button class="save-btn primary" style="width: 100%; justify-content: center;" onclick="closeModal('aboutModal')">Got it</button>
            </div>
        </div>
    </div>

    <!-- Tutorial Modal -->
    <div id="tutorialModal" class="modal">
        <div class="modal-content tutorial-modal">
            <div class="tutorial-slides">
                <div class="tutorial-slide active" data-slide="0">
                    <div class="tutorial-icon">📸</div>
                    <h3>Bem-vindo ao DocScan Pro</h3>
                    <p>Digitalize documentos profissionalmente direto do seu celular</p>
                </div>
                <div class="tutorial-slide" data-slide="1">
                    <div class="tutorial-icon">✂️</div>
                    <h3>Corte Inteligente</h3>
                    <p>Ajuste as bordas automaticamente ou manualmente com 4 pontos de controle</p>
                </div>
                <div class="tutorial-slide" data-slide="2">
                    <div class="tutorial-icon">🎨</div>
                    <h3>Filtros Profissionais</h3>
                    <p>Aplique filtros especializados para documentos, quadros brancos e mais</p>
                </div>
                <div class="tutorial-slide" data-slide="3">
                    <div class="tutorial-icon">📄</div>
                    <h3>PDF Multi-Página</h3>
                    <p>Crie PDFs com várias páginas, adicione, remova e reorganize facilmente</p>
                </div>
                <div class="tutorial-slide" data-slide="4">
                    <div class="tutorial-icon">☁️</div>
                    <h3>Sincronização</h3>
                    <p>Salve localmente e sincronize com Google Drive quando quiser</p>
                </div>
            </div>
            <div class="tutorial-navigation">
                <button id="tutorialSkip" class="tutorial-btn-secondary">Pular</button>
                <div class="tutorial-dots">
                    <span class="dot active"></span>
                    <span class="dot"></span>
                    <span class="dot"></span>
                    <span class="dot"></span>
                    <span class="dot"></span>
                </div>
                <button id="tutorialNext" class="tutorial-btn-primary">Próximo</button>
            </div>
        </div>
    </div>

    <!-- Toast -->
    <div id="toast" class="toast hidden">
        <span id="toastMessage"></span>
    </div>

    <!-- Loading -->
    <div id="loading" class="loading hidden">
        <div class="loading-spinner"></div>
        <span id="loadingText">Processando...</span>
        <div id="loadingProgress" class="loading-progress hidden">
            <div class="progress-bar">
                <div id="progressFill" class="progress-fill"></div>
            </div>
            <span id="progressText">0%</span>
        </div>
    </div>

    <!-- QR Code Scanner Modal -->
    <div id="qrModal" class="modal">
        <div class="modal-content qr-modal">
            <div class="modal-header">
                <button id="closeQrBtn" class="icon-btn">
                    <svg viewBox="0 0 24 24">
                        <path
                            d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                    </svg>
                </button>
                <h2>Scanner QR Code</h2>
                <button id="switchCameraBtn" class="icon-btn">
                    <svg viewBox="0 0 24 24">
                        <path
                            d="M9 12c0 1.66 1.34 3 3 3s3-1.34 3-3-1.34-3-3-3-3 1.34-3 3zm13-2V7c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v3h2v7c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-7h2zM7 8H5V6h2v2zm0 6c0-2.76 2.24-5 5-5s5 2.24 5 5-2.24 5-5 5-5-2.24-5-5z" />
                    </svg>
                </button>
            </div>
            <div class="qr-scanner-container">
                <div id="qrReader"></div>
                <div class="qr-overlay">
                    <div class="qr-frame"></div>
                </div>
            </div>
            <div id="qrResult" class="qr-result hidden">
                <div class="qr-result-header">
                    <svg viewBox="0 0 24 24" width="32" height="32">
                        <path fill="#00d9a5" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                    </svg>
                    <span>QR Code Detectado!</span>
                </div>
                <div id="qrResultContent" class="qr-result-content"></div>
                <div class="qr-result-actions">
                    <button id="qrCopyBtn" class="qr-action-btn">
                        <svg viewBox="0 0 24 24">
                            <path
                                d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" />
                        </svg>
                        Copiar
                    </button>
                    <button id="qrOpenBtn" class="qr-action-btn primary hidden">
                        <svg viewBox="0 0 24 24">
                            <path
                                d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z" />
                        </svg>
                        Abrir Link
                    </button>
                    <button id="qrScanAgainBtn" class="qr-action-btn">
                        <svg viewBox="0 0 24 24">
                            <path
                                d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" />
                        </svg>
                        Escanear Outro
                    </button>
                </div>
            </div>
            <div class="qr-instructions">
                <p>Posicione o QR Code dentro da área demarcada</p>
            </div>
        </div>
    </div>

    <!-- Floating Action for New Folder -->
    <button id="newFolderFab" class="fab-secondary hidden" aria-label="Nova Pasta">
        <svg viewBox="0 0 24 24">
            <path
                d="M20 6h-8l-2-2H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-1 8h-3v3h-2v-3h-3v-2h3V9h2v3h3v2z" />
        </svg>
    </button>

    <!-- Signature Modal -->
    <div id="signatureModal" class="modal">
        <div class="modal-content signature-modal">
            <div class="modal-header">
                <h2>✍️ Assinatura Digital</h2>
                <button id="closeSignatureBtn" class="icon-btn" onclick="closeSignatureModal()">
                    <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                </button>
            </div>
            <div class="signature-pad-container">
                <canvas id="signatureCanvas" width="480" height="200"></canvas>
            </div>
            <div class="signature-controls">
                <div class="signature-colors">
                    <span style="font-size:12px; color:var(--text-secondary);">Cor:</span>
                    <button class="sig-color-btn sig-color-blue active" onclick="setSigColor('#1e3a8a')"></button>
                    <button class="sig-color-btn sig-color-black" onclick="setSigColor('#000000')"></button>
                    <button class="sig-color-btn sig-color-red" onclick="setSigColor('#dc2626')"></button>
                </div>
                <div style="display:flex; gap:8px;">
                    <button class="tool-btn" onclick="clearSignatureCanvas()">Limpar</button>
                    <button class="save-btn primary" onclick="applySignatureToDocument()">Aplicar na Imagem</button>
                </div>
            </div>
        </div>
    </div>

    <!-- Boleto / Barcode Scanner Modal -->
    <div id="barcodeModal" class="modal">
        <div class="modal-content boleto-modal">
            <div class="modal-header">
                <h2>Leitor de Boletos & Código de Barras</h2>
                <button id="closeBarcodeBtn" class="icon-btn" onclick="closeBarcodeModal()">
                    <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                </button>
            </div>
            <div class="qr-scanner-container">
                <div id="barcodeReader"></div>
            </div>
            <div id="barcodeResultCard" class="boleto-card hidden">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <strong style="color:#38bdf8;" id="barcodeTypeLabel">Linha Digitável / Código</strong>
                    <span style="font-size:12px; color:#34d399;">✔ Detectado</span>
                </div>
                <div class="boleto-code-box" id="barcodeCodeDisplay"></div>
                <div style="display:flex; gap:10px;">
                    <button class="btn-copy-code" style="flex:1;" onclick="copyBarcodeCode()">📋 Copiar para Pagar no Banco</button>
                    <button class="tool-btn" onclick="scanBarcodeAgain()">Escanear Outro</button>
                </div>
            </div>
        </div>
    </div>

    <!-- PDF Export Options Modal -->
    <div id="pdfOptionsModal" class="modal">
        <div class="modal-content pdf-options-modal">
            <div class="modal-header">
                <h2>Exportar PDF Avançado</h2>
                <button class="icon-btn" onclick="closePdfOptionsModal()">
                    <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                </button>
            </div>
            <div class="pdf-opt-row">
                <label>Resolução e Tamanho do Arquivo:</label>
                <div class="pdf-quality-grid">
                    <button class="pdf-quality-btn" data-quality="high" onclick="setPdfQuality('high')">Alta (300 DPI)</button>
                    <button class="pdf-quality-btn active" data-quality="medium" onclick="setPdfQuality('medium')">Padrão (150 DPI)</button>
                    <button class="pdf-quality-btn" data-quality="low" onclick="setPdfQuality('low')">WhatsApp (&lt; 1MB)</button>
                </div>
            </div>
            <div class="pdf-opt-row">
                <label class="setting-checkbox-row" style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                    <input type="checkbox" id="pdfSearchableOcrToggle" checked style="width:16px; height:16px;">
                    <span>Embutir Texto OCR Pesquisável (Ctrl+F)</span>
                </label>
            </div>
            <div class="pdf-opt-row">
                <label>Carimbo / Marca d'água:</label>
                <select id="pdfWatermarkSelect" style="background:var(--bg-tertiary); color:#fff; border:1px solid var(--border-color); border-radius:6px; padding:8px;">
                    <option value="none">Nenhuma (Original)</option>
                    <option value="COPIA INFORMATIVA">CÓPIA INFORMATIVA</option>
                    <option value="USO EXCLUSIVO">USO EXCLUSIVO</option>
                    <option value="CONFIDENCIAL">CONFIDENCIAL</option>
                </select>
            </div>
            <div style="margin-top:16px;">
                <button class="save-btn primary" style="width:100%; justify-content:center;" onclick="executePdfExportWithOptions()">📥 Gerar e Baixar PDF</button>
            </div>
        </div>
    </div>

    <!-- Stamp & Watermark Modal -->
    <div id="stampModal" class="modal" style="z-index: 1000;">
        <div class="modal-content stamp-modal">
            <div class="modal-header">
                <button id="closeStampBtn" class="icon-btn" onclick="closeModal('stampModal')">
                    <svg viewBox="0 0 24 24"><path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                </button>
                <h2 style="font-size: 15px; font-weight: 700; margin: 0; text-align: center; flex: 1;">🏷️ Carimbo & Marca d'Água</h2>
                <button id="applyStampBtn" class="btn-primary-sm" onclick="applyStampToActiveDoc()">Aplicar</button>
            </div>
            <div class="stamp-modal-body">
                <div class="stamp-presets-grid">
                    <button type="button" class="stamp-chip active" onclick="selectStampPreset('PAGO ✅', '#ef4444', this)">PAGO ✅</button>
                    <button type="button" class="stamp-chip" onclick="selectStampPreset('RECEBIDO 📥', '#10b981', this)">RECEBIDO 📥</button>
                    <button type="button" class="stamp-chip" onclick="selectStampPreset('CONFIDENCIAL 🔒', '#dc2626', this)">CONFIDENCIAL 🔒</button>
                    <button type="button" class="stamp-chip" onclick="selectStampPreset('CÓPIA 📄', '#64748b', this)">CÓPIA 📄</button>
                    <button type="button" class="stamp-chip" onclick="selectStampPreset('AUTENTICADO ⚖️', '#2563eb', this)">AUTENTICADO ⚖️</button>
                    <button type="button" class="stamp-chip" onclick="selectStampPreset('URGENTE 🚨', '#f59e0b', this)">URGENTE 🚨</button>
                    <button type="button" class="stamp-chip" onclick="selectStampPreset('DATA_HORA', '#475569', this)">DATA & HORA 🕒</button>
                </div>
                
                <div class="stamp-field-group">
                    <label>Texto do Carimbo:</label>
                    <input type="text" id="stampTextInput" class="stamp-input" value="PAGO ✅" oninput="updateStampPreview()">
                </div>

                <div class="stamp-field-group">
                    <label>Cor do Carimbo:</label>
                    <div class="stamp-color-picker">
                        <span class="color-dot active" style="background:#ef4444" onclick="selectStampColor('#ef4444', this)" title="Vermelho"></span>
                        <span class="color-dot" style="background:#2563eb" onclick="selectStampColor('#2563eb', this)" title="Azul"></span>
                        <span class="color-dot" style="background:#10b981" onclick="selectStampColor('#10b981', this)" title="Verde"></span>
                        <span class="color-dot" style="background:#64748b" onclick="selectStampColor('#64748b', this)" title="Cinza"></span>
                        <span class="color-dot" style="background:#f59e0b" onclick="selectStampColor('#f59e0b', this)" title="Laranja"></span>
                        <span class="color-dot" style="background:#0f172a" onclick="selectStampColor('#0f172a', this)" title="Preto"></span>
                    </div>
                </div>

                <div class="stamp-field-group">
                    <label>Posição no Documento:</label>
                    <select id="stampPositionSelect" class="stamp-select" onchange="updateStampPreview()">
                        <option value="bottom-right" selected>↘ Canto Inferior Direito (Padrão)</option>
                        <option value="center">✦ Centro (Diagonal 45°)</option>
                        <option value="top-right">↗ Canto Superior Direito</option>
                        <option value="bottom-left">↙ Canto Inferior Esquerdo</option>
                        <option value="top-left">↖ Canto Superior Esquerdo</option>
                    </select>
                </div>

                <div class="stamp-preview-wrapper">
                    <canvas id="stampPreviewCanvas"></canvas>
                </div>
            </div>
        </div>
    </div>

    <div id="modalOverlay" class="modal" style="z-index: 400;"></div>

    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
    <!-- Google Identity Services (OAuth 2.0 / Google Drive) -->
    <script src="https://accounts.google.com/gsi/client" async defer></script>
    <!-- Tesseract.js para OCR real -->
    <script src="https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js"></script>
    <!-- Html5-QRCode para leitura de QR Code -->
    <script src="https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
    <!-- OpenCV.js para detecção profissional de bordas e contornos (CamScanner-grade) -->
    <script src="https://cdn.jsdelivr.net/npm/@techstark/opencv-js@4.9.0-release.2/dist/opencv.js" async></script>
    <!-- PDF.js para importar e visualizar PDFs existentes -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
    <script>
        if (typeof pdfjsLib !== 'undefined') {
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }
    </script>
    <!-- SheetJS (xlsx) para exportação de tabelas e OCR para Excel -->
    <script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>
    <script src="script.js?v=<?php echo $v; ?>"></script>
</body>

</html>