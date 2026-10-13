<?php
declare(strict_types=1);

/** Verify a GIS access token with Google before creating a local session. */
function verifiedGoogleProfile(array $body): array
{
    $accessToken = $body['access_token'] ?? '';
    if (!is_string($accessToken) || $accessToken === '' || strlen($accessToken) > 4096) {
        jsonError('Token Google ausente ou inválido.', 401);
    }

    $tokenInfo = googleAuthRequest(
        'https://oauth2.googleapis.com/tokeninfo',
        ['Content-Type: application/x-www-form-urlencoded'],
        http_build_query(['access_token' => $accessToken])
    );
    $clientId = '569266864432-pd09jbb5no9ekdhdr018fj643nopp817.apps.googleusercontent.com';
    if (($tokenInfo['audience'] ?? $tokenInfo['issued_to'] ?? '') !== $clientId
        || (int)($tokenInfo['expires_in'] ?? 0) < 1) {
        jsonError('Token Google não pertence a este aplicativo.', 401);
    }

    $profile = googleAuthRequest(
        'https://www.googleapis.com/oauth2/v3/userinfo',
        ['Authorization: Bearer ' . $accessToken]
    );
    $email = $profile['email'] ?? '';
    if (!is_string($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)
        || ($profile['email_verified'] ?? false) !== true
        || !is_string($profile['sub'] ?? null) || $profile['sub'] === '') {
        jsonError('Conta Google sem e-mail verificado.', 401);
    }
    if (isset($tokenInfo['user_id']) && !hash_equals((string)$tokenInfo['user_id'], $profile['sub'])) {
        jsonError('Identidade Google inconsistente.', 401);
    }
    return $profile;
}

function googleAuthRequest(string $url, array $headers, ?string $postData = null): array
{
    $curl = curl_init($url);
    curl_setopt_array($curl, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_CONNECTTIMEOUT => 4,
        CURLOPT_TIMEOUT => 8,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);
    if ($postData !== null) {
        curl_setopt($curl, CURLOPT_POST, true);
        curl_setopt($curl, CURLOPT_POSTFIELDS, $postData);
    }
    $response = curl_exec($curl);
    $status = curl_getinfo($curl, CURLINFO_HTTP_CODE);
    curl_close($curl);
    if ($response === false || $status !== 200) {
        jsonError('Não foi possível validar a conta Google. Tente novamente.', 401);
    }
    $data = json_decode($response, true);
    if (!is_array($data)) {
        jsonError('Resposta inválida da autenticação Google.', 502);
    }
    return $data;
}
