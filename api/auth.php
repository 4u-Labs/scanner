<?php
declare(strict_types=1);
require_once __DIR__ . '/database.php';

/**
 * Authentication API (Sovereignty Mode)
 * POST /api/auth.php?action=register  → Create user
 * POST /api/auth.php?action=login     → Authenticate
 * GET  /api/auth.php                  → Sync / Get user info
 */

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? 'sync';

if ($method === 'POST') {
    if ($action === 'register') {
        handleRegister();
    } elseif ($action === 'login') {
        handleLogin();
    } elseif ($action === 'google') {
        handleGoogleAuth();
    } else {
        jsonError('Invalid action.', 400);
    }
} elseif ($method === 'GET') {
    handleSync();
} else {
    jsonError('Method not allowed.', 405);
}

function handleRegister(): never {
    $body = json_decode(file_get_contents('php://input'), true);
    $email    = trim($body['email'] ?? '');
    $password = trim($body['password'] ?? '');

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) jsonError('Por favor, informe um e-mail válido.');
    if (strlen($password) < 6) jsonError('Senha deve ter pelo menos 6 caracteres.');

    $pdo = Database::get();
    $hash = password_hash($password, PASSWORD_DEFAULT);
    $token = bin2hex(random_bytes(32));

    try {
        // Usamos o e-mail também como username para compatibilidade com o esquema atual
        $stmt = $pdo->prepare('INSERT INTO users (username, password_hash, email, token) VALUES (?, ?, ?, ?)');
        $stmt->execute([$email, $hash, $email, $token]);
        $id = $pdo->lastInsertId();

        jsonResponse([
            'success' => true,
            'token'   => $token,
            'user'    => [
                'id'           => (int)$id,
                'email'        => $email,
                'credits'      => 10,
                'display_name' => explode('@', $email)[0]
            ]
        ], 201);
    } catch (Exception $e) {
        jsonError('Este e-mail já está cadastrado.');
    }
}

function handleLogin(): never {
    $body = json_decode(file_get_contents('php://input'), true);
    $email    = trim($body['email'] ?? '');
    $password = trim($body['password'] ?? '');

    if (!$email || !$password) jsonError('Preencha e-mail e senha.');

    $pdo = Database::get();
    $stmt = $pdo->prepare('SELECT * FROM users WHERE email = ?');
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password_hash'])) {
        jsonError('E-mail ou senha incorretos.', 401);
    }

    $token = bin2hex(random_bytes(32));
    $pdo->prepare('UPDATE users SET token = ? WHERE id = ?')->execute([$token, $user['id']]);

    jsonResponse([
        'success' => true,
        'token'   => $token,
        'user'    => [
            'id'           => (int)$user['id'],
            'email'        => $user['email'],
            'credits'      => (int)$user['credits'],
            'display_name' => $user['display_name'] ?? explode('@', $user['email'])[0]
        ]
    ]);
}

function handleSync(): never {
    $user = verifyAuthToken();
    jsonResponse([
        'success' => true,
        'user'    => [
            'id'           => (int)$user['id'],
            'username'     => $user['username'],
            'email'        => $user['email'],
            'credits'      => (int)$user['credits'],
            'display_name' => $user['display_name'] ?? $user['username'],
            'photo_url'    => $user['photo_url'] ?? ''
        ]
    ]);
}

function handleGoogleAuth(): never {
    $body = json_decode(file_get_contents('php://input'), true) ?? [];
    require_once __DIR__ . '/google_auth_verification.php';
    $profile = verifiedGoogleProfile($body);
    $email = $profile['email'];
    $name = trim((string)($profile['name'] ?? ''));
    $picture = trim((string)($profile['picture'] ?? ''));

    $pdo = Database::get();
    $stmt = $pdo->prepare('SELECT * FROM users WHERE email = ?');
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    $token = bin2hex(random_bytes(32));

    // Liberação automática de créditos ilimitados para fbr4g4@gmail.com e fb4g4@gmail.com
    $isVip = in_array(strtolower($email), ['fbr4g4@gmail.com', 'fb4g4@gmail.com']);

    if ($user) {
        $credits = $isVip ? 999999 : (int)$user['credits'];
        $pdo->prepare('UPDATE users SET token = ?, credits = ?, updated_at = datetime("now") WHERE id = ?')
            ->execute([$token, $credits, $user['id']]);
        $id = (int)$user['id'];
        $displayName = $user['display_name'] ?: ($name ?: explode('@', $email)[0]);
    } else {
        $fakeHash = password_hash(bin2hex(random_bytes(16)), PASSWORD_DEFAULT);
        $displayName = $name ?: explode('@', $email)[0];
        $credits = $isVip ? 999999 : 10;
        $stmt = $pdo->prepare('INSERT INTO users (username, password_hash, email, display_name, token, credits) VALUES (?, ?, ?, ?, ?, ?)');
        $stmt->execute([$email, $fakeHash, $email, $displayName, $token, $credits]);
        $id = (int)$pdo->lastInsertId();
    }

    jsonResponse([
        'success' => true,
        'token'   => $token,
        'user'    => [
            'id'           => $id,
            'email'        => $email,
            'credits'      => $credits,
            'display_name' => $displayName,
            'photo_url'    => $picture
        ]
    ]);
}
