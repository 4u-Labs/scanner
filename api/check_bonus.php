<?php
/**
 * MP Anti-Cheat Bonus Check Bridge
 */

header('Content-Type: application/json');

$privateDir = dirname(__DIR__, 4) . '/private/docscan';
if (!is_dir($privateDir) && !mkdir($privateDir, 0700, true) && !is_dir($privateDir)) {
    http_response_code(500);
    echo json_encode(['error' => 'Bonus storage unavailable']);
    exit;
}
$usedBonusesFile = $privateDir . '/used_bonuses.json';

// Ensure the file exists
if (!file_exists($usedBonusesFile)) {
    file_put_contents($usedBonusesFile, json_encode([]));
}

// 1. Get request data
$input = json_decode(file_get_contents('php://input'), true);
$fingerprint = $input['fingerprint'] ?? '';

if (empty($fingerprint)) {
    echo json_encode(['error' => 'Missing fingerprint']);
    exit;
}

// 2. Identify user (IP + Fingerprint + UserAgent)
$ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
$ua = $_SERVER['HTTP_USER_AGENT'] ?? '';
$signature = hash('sha256', $ip . $fingerprint . $ua);

// 3. Check if bonus was already claimed
$usedBonuses = json_decode(file_get_contents($usedBonusesFile), true);

if (in_array($signature, $usedBonuses)) {
    echo json_encode([
        'eligible' => false,
        'message' => 'Bonus already claimed for this device/connection.'
    ]);
    exit;
}

// 4. Register claim and grant bonus
$usedBonuses[] = $signature;
file_put_contents($usedBonusesFile, json_encode($usedBonuses));

echo json_encode([
    'eligible' => true,
    'bonus' => 20,
    'message' => '🎉 Bem-vindo! Você ganhou 20 créditos gratuitos para experimentar o OCR.'
]);
