<?php
/**
 * upload.php — Generic file storage endpoint for Pets Registry on cPanel
 *
 * Deploy to: https://petsregistry.org/upload.php
 *
 * Storage layout:
 *   /home/<cpanel_user>/public_html/uploads/<bucket>/<path>
 *
 * Public URL pattern returned to the client:
 *   https://petsregistry.org/uploads/<bucket>/<path>
 *
 * Supported requests:
 *   POST   multipart/form-data with fields:
 *            file    — binary blob (required)
 *            bucket  — folder category, e.g. "pet-photos" (required)
 *            path    — path inside bucket, e.g. "user-id/pet-id/0.webp" (required)
 *            upsert  — "true" to overwrite, anything else = reject duplicates
 *          Returns: { "publicUrl": "https://..." }
 *
 *   DELETE application/json with body:
 *            { "bucket": "...", "paths": ["a/b.webp", "c/d.webp"] }
 *          Returns: { "deleted": <count> }
 *
 *   OPTIONS — CORS preflight (returns 204)
 *
 * Authentication:
 *   Every request MUST include header:
 *     Authorization: Bearer <UPLOAD_TOKEN>
 *   The token must match the UPLOAD_TOKEN constant below (or env var).
 */

/* ─── CORS ───────────────────────────────────────────────────────────── */
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

/* ─── Authentication ─────────────────────────────────────────────────── */
// IMPORTANT: change this to a long random string and set the SAME value
// in Lovable as VITE_UPLOAD_TOKEN. Or set it as an env var on cPanel.
$TOKEN = getenv('UPLOAD_TOKEN') ?: 'CHANGE_ME_TO_A_LONG_RANDOM_STRING';

$auth = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
if (!preg_match('/^Bearer\s+(.+)$/i', $auth, $m) || !hash_equals($TOKEN, $m[1])) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

/* ─── Configuration ──────────────────────────────────────────────────── */
$BASE_DIR    = dirname(__FILE__) . '/uploads';
$BASE_URL    = 'https://petsregistry.org/uploads';
$MAX_BYTES   = 10 * 1024 * 1024; // 10 MB hard cap per file

// Whitelist of allowed bucket names — must match the buckets your app uses
$ALLOWED_BUCKETS = [
    'pet-photos',
    'flyer-templates',
    'business-listings',
    'admin-attachments',
    'membership-badges',
    'product-images',
    'certificate-backgrounds',
    'blog-images',
];

// Allowed file extensions
$ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'pdf'];

if (!is_dir($BASE_DIR)) {
    mkdir($BASE_DIR, 0755, true);
}

/* ─── Helpers ────────────────────────────────────────────────────────── */
function bail($code, $msg) {
    http_response_code($code);
    echo json_encode(['error' => $msg]);
    exit;
}

/** Sanitise a path segment: keep [a-zA-Z0-9._-/] only, no traversal. */
function safe_path($p) {
    $p = str_replace('\\', '/', (string) $p);
    $p = preg_replace('#/+#', '/', $p);              // collapse slashes
    $p = preg_replace('#(^|/)\.\.(/|$)#', '/', $p);  // strip ..
    $p = ltrim($p, '/');
    $p = preg_replace('#[^A-Za-z0-9._/\-]#', '_', $p);
    return $p;
}

/* ─── DELETE: remove files ───────────────────────────────────────────── */
if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $body = json_decode(file_get_contents('php://input'), true);
    $bucket = $body['bucket'] ?? '';
    $paths  = $body['paths']  ?? [];

    if (!in_array($bucket, $ALLOWED_BUCKETS, true)) bail(400, 'Invalid bucket');
    if (!is_array($paths) || !count($paths))        bail(400, 'No paths supplied');

    $deleted = 0;
    foreach ($paths as $rel) {
        $full = $BASE_DIR . '/' . $bucket . '/' . safe_path($rel);
        if (is_file($full) && @unlink($full)) $deleted++;
    }
    echo json_encode(['deleted' => $deleted]);
    exit;
}

/* ─── POST: upload a file ────────────────────────────────────────────── */
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    bail(405, 'Method not allowed');
}

if (empty($_FILES['file']))               bail(400, 'No file uploaded');
if ($_FILES['file']['error'] !== UPLOAD_ERR_OK) bail(400, 'Upload error code ' . $_FILES['file']['error']);

$file   = $_FILES['file'];
$bucket = $_POST['bucket'] ?? '';
$path   = $_POST['path']   ?? '';
$upsert = ($_POST['upsert'] ?? 'false') === 'true';

if (!in_array($bucket, $ALLOWED_BUCKETS, true)) bail(400, 'Invalid bucket');
if (!$path)                                     bail(400, 'Missing path');
if ($file['size'] > $MAX_BYTES)                 bail(400, 'File too large (max 10 MB)');

$rel  = safe_path($path);
$ext  = strtolower(pathinfo($rel, PATHINFO_EXTENSION));
if (!in_array($ext, $ALLOWED_EXT, true))        bail(400, 'Disallowed file type: .' . $ext);

$dir  = $BASE_DIR . '/' . $bucket . '/' . dirname($rel);
$dest = $BASE_DIR . '/' . $bucket . '/' . $rel;

if (!is_dir($dir) && !mkdir($dir, 0755, true))  bail(500, 'Failed to create folder');
if (file_exists($dest) && !$upsert)             bail(409, 'File exists (set upsert=true to overwrite)');

if (!move_uploaded_file($file['tmp_name'], $dest)) bail(500, 'Failed to write file');

echo json_encode([
    'publicUrl' => $BASE_URL . '/' . $bucket . '/' . $rel,
    'bucket'    => $bucket,
    'path'      => $rel,
    'size'      => filesize($dest),
]);
