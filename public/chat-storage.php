<?php
/**
 * chat-storage.php — Store AI Pet Expert chat sessions & images on cPanel
 * 
 * Deploy to: https://petsregistry.org/chat-storage.php
 * Storage:   /home/<user>/chat-data/sessions/  (JSON files)
 *            /home/<user>/chat-data/images/     (uploaded pet photos)
 *
 * Actions:
 *   list    — list sessions for a user
 *   load    — load a single session
 *   save    — create or update a session
 *   delete  — delete a session
 *   upload  — upload an image, returns its URL
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ── Auth ────────────────────────────────────────────────────────────────
$TOKEN = getenv('UPLOAD_TOKEN') ?: '522c46cb6b45cc0153a25483134e32d7bb6f17dcf0aa0f5a41cb4bf7cb3a5abd';

$auth = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
if (!str_starts_with($auth, 'Bearer ') || substr($auth, 7) !== $TOKEN) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

// ── Paths ───────────────────────────────────────────────────────────────
$BASE      = dirname(__FILE__) . '/chat-data';
$SESS_DIR  = $BASE . '/sessions';
$IMG_DIR   = $BASE . '/images';
$IMG_URL   = 'https://petsregistry.org/chat-data/images';

foreach ([$SESS_DIR, $IMG_DIR] as $d) {
    if (!is_dir($d)) mkdir($d, 0755, true);
}

// ── Action router ───────────────────────────────────────────────────────
$action  = $_POST['action'] ?? $_GET['action'] ?? '';
$user_id = $_POST['user_id'] ?? $_GET['user_id'] ?? '';

if (!$user_id && $action !== 'upload') {
    http_response_code(400);
    echo json_encode(['error' => 'user_id required']);
    exit;
}

// Sanitise user_id for filesystem safety
$safe_uid = preg_replace('/[^a-zA-Z0-9_-]/', '', $user_id);
$user_dir = $SESS_DIR . '/' . $safe_uid;

switch ($action) {

    // ── List sessions ───────────────────────────────────────────────────
    case 'list':
        if (!is_dir($user_dir)) {
            echo json_encode([]);
            exit;
        }
        $files = glob($user_dir . '/*.json');
        $sessions = [];
        foreach ($files as $f) {
            $data = json_decode(file_get_contents($f), true);
            $sessions[] = [
                'id'         => $data['id'] ?? basename($f, '.json'),
                'title'      => $data['title'] ?? 'Untitled',
                'created_at' => $data['created_at'] ?? date('c', filectime($f)),
                'updated_at' => $data['updated_at'] ?? date('c', filemtime($f)),
            ];
        }
        // Sort by updated_at descending
        usort($sessions, fn($a, $b) => strtotime($b['updated_at']) - strtotime($a['updated_at']));
        echo json_encode($sessions);
        break;

    // ── Load a session ──────────────────────────────────────────────────
    case 'load':
        $session_id = preg_replace('/[^a-zA-Z0-9_-]/', '', $_POST['session_id'] ?? $_GET['session_id'] ?? '');
        $path = $user_dir . '/' . $session_id . '.json';
        if (!file_exists($path)) {
            http_response_code(404);
            echo json_encode(['error' => 'Session not found']);
            exit;
        }
        echo file_get_contents($path);
        break;

    // ── Save (create / update) a session ────────────────────────────────
    case 'save':
        if (!is_dir($user_dir)) mkdir($user_dir, 0755, true);

        $session_id = preg_replace('/[^a-zA-Z0-9_-]/', '', $_POST['session_id'] ?? '');
        $title      = mb_substr($_POST['title'] ?? 'New Chat', 0, 200);
        $messages   = $_POST['messages'] ?? '[]';

        if (!$session_id) {
            $session_id = bin2hex(random_bytes(16));
        }

        $path = $user_dir . '/' . $session_id . '.json';
        $existing = file_exists($path) ? json_decode(file_get_contents($path), true) : null;

        $payload = [
            'id'         => $session_id,
            'user_id'    => $safe_uid,
            'title'      => $title,
            'messages'   => json_decode($messages, true) ?? [],
            'created_at' => $existing['created_at'] ?? date('c'),
            'updated_at' => date('c'),
        ];

        file_put_contents($path, json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        echo json_encode(['id' => $session_id, 'status' => 'saved']);
        break;

    // ── Delete a session ────────────────────────────────────────────────
    case 'delete':
        $session_id = preg_replace('/[^a-zA-Z0-9_-]/', '', $_POST['session_id'] ?? '');
        $path = $user_dir . '/' . $session_id . '.json';
        if (file_exists($path)) unlink($path);
        echo json_encode(['status' => 'deleted']);
        break;

    // ── Upload an image ─────────────────────────────────────────────────
    case 'upload':
        if (empty($_FILES['image'])) {
            http_response_code(400);
            echo json_encode(['error' => 'No image uploaded']);
            exit;
        }
        $file = $_FILES['image'];
        $ext  = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        $allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
        if (!in_array($ext, $allowed)) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid file type']);
            exit;
        }
        if ($file['size'] > 5 * 1024 * 1024) {
            http_response_code(400);
            echo json_encode(['error' => 'File too large (max 5MB)']);
            exit;
        }
        $name = bin2hex(random_bytes(16)) . '.' . $ext;
        $dest = $IMG_DIR . '/' . $name;
        move_uploaded_file($file['tmp_name'], $dest);
        echo json_encode(['url' => $IMG_URL . '/' . $name]);
        break;

    default:
        http_response_code(400);
        echo json_encode(['error' => 'Unknown action']);
}
