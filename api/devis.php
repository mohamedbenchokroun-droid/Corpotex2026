<?php
/**
 * Corpotex — réception des demandes de devis / contact.
 *
 * 1. Sauvegarde chaque demande (JSON + fichiers) dans /var/www/data : aucun prospect n'est perdu.
 * 2. Envoie un email HTML à l'équipe (contact@yatesgroup.ma) via le relais SMTP Google Workspace.
 * 3. Envoie un accusé de réception au client.
 *
 * Configuration (hors du dossier public) : /var/www/config/smtp.php, qui retourne un tableau.
 * Sans identifiant, l'envoi passe par smtp-relay.gmail.com, autorisé par l'adresse IP du serveur.
 */
header('Content-Type: application/json; charset=utf-8');

$cfgFile = '/var/www/config/smtp.php';
$cfg = (is_file($cfgFile) ? require $cfgFile : []) + [
  'host' => 'smtp-relay.gmail.com', 'port' => 587, 'user' => '', 'pass' => '',
  'from' => 'contact@yatesgroup.ma', 'fromName' => 'Corpotex', 'to' => 'contact@yatesgroup.ma',
  'ehlo' => 'corpotex.ma', 'ack' => true,
];
const DATA_DIR = '/var/www/data';
const MAX_FILE = 10 * 1024 * 1024;
const ALLOWED = ['png', 'jpg', 'jpeg', 'pdf', 'ai', 'eps', 'svg'];

const MAX_FILES = 5;
const MIMES = [
  'png' => ['image/png'], 'jpg' => ['image/jpeg'], 'jpeg' => ['image/jpeg'], 'pdf' => ['application/pdf'],
  'ai' => ['application/pdf', 'application/postscript', 'application/illustrator'], 'eps' => ['application/postscript', 'image/x-eps', 'application/eps'],
  'svg' => ['image/svg+xml', 'text/xml', 'application/xml', 'text/plain', 'text/html'],
];

function out($code, $arr) { http_response_code($code); echo json_encode($arr); exit; }
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');
if ($_SERVER['REQUEST_METHOD'] !== 'POST') out(405, ['ok' => false]);

// Uniquement depuis le site (contrôle de provenance du navigateur)
$from = $_SERVER['HTTP_ORIGIN'] ?? ($_SERVER['HTTP_REFERER'] ?? '');
$fromHost = strtolower((string)parse_url($from, PHP_URL_HOST));
if (!in_array($fromHost, ['corpotex.ma', 'www.corpotex.ma'], true)) out(403, ['ok' => false, 'error' => 'origin']);

// Limitation du nombre d'envois (par adresse IP et au global), stockée hors du dossier public
function rate_ok(string $key, int $max, int $window): bool {
  $dir = DATA_DIR . '/.rl';
  if (!is_dir($dir)) @mkdir($dir, 0700, true);
  $h = @fopen($dir . '/' . hash('sha256', $key), 'c+');
  if (!$h) return true;
  flock($h, LOCK_EX);
  $now = time();
  $t = array_values(array_filter(json_decode(stream_get_contents($h) ?: '[]', true) ?: [], fn($x) => is_int($x) && $x > $now - $window));
  $ok = count($t) < $max;
  if ($ok) $t[] = $now;
  ftruncate($h, 0); rewind($h); fwrite($h, json_encode($t)); flock($h, LOCK_UN); fclose($h);
  return $ok;
}
$ip = $_SERVER['REMOTE_ADDR'] ?? '0';
if (!rate_ok('ip:' . $ip, 6, 3600) || !rate_ok('ipday:' . $ip, 20, 86400) || !rate_ok('global', 300, 86400)) out(429, ['ok' => false, 'error' => 'rate']);

$d = json_decode($_POST['payload'] ?? '', true);
if (!is_array($d)) out(400, ['ok' => false, 'error' => 'payload']);
if (!empty($d['website'])) out(200, ['ok' => true]); // pot de miel anti-robots

// Bornes de taille sur toutes les valeurs reçues
$lim = function ($v, $depth = 0) use (&$lim) {
  if (is_array($v)) return $depth > 3 ? [] : array_slice(array_map(fn($x) => $lim($x, $depth + 1), $v), 0, 100, true);
  if (is_string($v)) return mb_substr($v, 0, 4000);
  return is_scalar($v) ? $v : null;
};
$d = $lim($d);

$h = fn($s) => htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');
$clean = fn($s) => trim(preg_replace('/[\r\n]+/', ' ', (string)$s));
foreach (['company', 'contactName', 'phone', 'email'] as $k) if (empty($d[$k])) out(422, ['ok' => false, 'error' => "missing $k"]);
if (!filter_var($d['email'], FILTER_VALIDATE_EMAIL)) out(422, ['ok' => false, 'error' => 'email']);

$isQuote = ($d['type'] ?? '') === 'quote';
$id = date('Ymd-His') . '-' . bin2hex(random_bytes(3));

// ---------- pièces jointes ----------
$files = [];
if (!empty($_FILES['attachments']['name'])) {
  $f = $_FILES['attachments'];
  $fi = class_exists('finfo') ? new finfo(FILEINFO_MIME_TYPE) : null;
  for ($i = 0; $i < count((array)$f['name']) && count($files) < MAX_FILES; $i++) {
    if ($f['error'][$i] !== UPLOAD_ERR_OK || $f['size'][$i] > MAX_FILE || !is_uploaded_file($f['tmp_name'][$i])) continue;
    $ext = strtolower(pathinfo($f['name'][$i], PATHINFO_EXTENSION));
    if (!in_array($ext, ALLOWED, true)) continue;
    if ($fi && !in_array($fi->file($f['tmp_name'][$i]), MIMES[$ext], true)) continue; // le contenu réel doit correspondre à l'extension
    $base = substr(preg_replace('/[^A-Za-z0-9_-]/', '_', pathinfo($f['name'][$i], PATHINFO_FILENAME)), 0, 60);
    $files[] = ['name' => 'pj' . (count($files) + 1) . '-' . $base . '.' . $ext, 'data' => file_get_contents($f['tmp_name'][$i])];
  }
}

// ---------- 1. sauvegarde ----------
$saved = false;
if (is_dir(DATA_DIR) && is_writable(DATA_DIR)) {
  $dir = DATA_DIR . '/' . $id; @mkdir($dir, 0750, true);
  $saved = (bool)file_put_contents($dir . '/demande.json', json_encode($d + ['id' => $id, 'ip' => $_SERVER['REMOTE_ADDR'] ?? ''], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
  foreach ($files as $fl) file_put_contents($dir . '/' . $fl['name'], $fl['data']);
}

// ---------- 2. email équipe ----------
$rows = '';
foreach ((array)($d['products'] ?? []) as $p) {
  if (!is_array($p)) continue;
  $td = 'style="padding:10px;border-bottom:1px solid #eee"';
  $purl = (string)($p['url'] ?? '');
  if (!preg_match('~^https://(www\.)?corpotex\.ma/~', $purl)) $purl = 'https://corpotex.ma/catalogue'; // pas de lien extérieur dans l'email
  $rows .= "<tr><td $td><b>" . max(0, (int)($p['quantity'] ?? 0)) . "</b></td><td $td><a href=\"" . $h($purl) . "\">" . $h($p['name'] ?? '') . "</a></td><td $td>" . $h($p['reference'] ?? '') . "</td><td $td>" . $h($p['brand'] ?? '') . "</td></tr>";
}
$cust = $d['optionalCustomization'] ?? [];
$line = fn($l, $v) => ($v === '' || $v === null) ? '' : '<tr><td style="padding:6px 16px 6px 0;color:#6B7280">' . $l . '</td><td style="padding:6px 0"><b>' . $h($v) . '</b></td></tr>';
$wa = 'https://wa.me/' . preg_replace('/\D/', '', preg_replace('/^0/', '212', $clean($d['phone'])));
$html = '<div style="font-family:Arial,sans-serif;color:#0D1B2A;max-width:680px">'
  . '<div style="background:#0D1B2A;color:#fff;padding:20px 24px;border-bottom:6px solid #F2B705"><b style="font-size:20px">CORPOTEX</b><br><span style="color:#F2B705">' . ($isQuote ? 'Nouvelle demande de devis' : 'Nouveau message') . ' · ' . $id . '</span></div>'
  . '<table style="margin:18px 0">' . $line('Entreprise', $d['company']) . $line('Contact', $d['contactName']) . $line('Téléphone', $d['phone'])
  . $line('Email', $d['email']) . $line('Ville', $d['city'] ?? '') . $line('Date souhaitée', $d['desiredDate'] ?? '') . '</table>'
  . '<p><a href="mailto:' . $h($d['email']) . '" style="background:#F2B705;color:#0D1B2A;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:bold">Répondre par email</a> &nbsp; '
  . '<a href="' . $h($wa) . '" style="background:#1FAF5A;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:bold">Écrire sur WhatsApp</a></p>';
if ($rows) $html .= '<h3>Produits demandés</h3><table style="width:100%;border-collapse:collapse"><tr style="background:#F2F2F2"><th align="left" style="padding:10px">Qté</th><th align="left" style="padding:10px">Produit</th><th align="left" style="padding:10px">Réf.</th><th align="left" style="padding:10px">Marque</th></tr>' . $rows . '</table>';
if (!empty($d['quickNeeds'])) $html .= '<p><b>Besoin :</b> ' . $h(implode(', ', $d['quickNeeds'])) . (!empty($d['estimatedQuantity']) ? ' — environ ' . $h($d['estimatedQuantity']) . ' pièces' : '') . '</p>';
if (!empty($d['message'])) $html .= '<h3>Message</h3><p style="background:#FFF3D6;padding:14px;border-radius:8px">' . nl2br($h($d['message'])) . '</p>';
if ($isQuote) $html .= '<p><b>Personnalisation :</b> ' . $h($cust['tech'] ?? 'Je ne sais pas') . (!empty($cust['zone']) ? ' — ' . $h(implode(', ', $cust['zone'])) : '') . '</p>';
if ($files) $html .= '<p><b>Fichiers joints :</b> ' . $h(implode(', ', array_column($files, 'name'))) . '</p>';
$html .= '<p style="color:#6B7280;font-size:12px">Page d’origine : ' . $h($d['source'] ?? '') . '</p></div>';

$subject = ($isQuote ? 'Demande de devis — ' : 'Message site — ') . $clean($d['company']) . ' (' . $clean($d['contactName']) . ')';
$sent = smtp_send($cfg, $cfg['to'], $subject, $html, $files, $clean($d['email']));

// ---------- 3. accusé de réception client ----------
if ($sent && $cfg['ack'] && rate_ok('ack:' . strtolower($clean($d['email'])), 2, 86400)) { // pas plus de 2 accusés par jour et par adresse
  $ack = '<div style="font-family:Arial,sans-serif;color:#0D1B2A;max-width:600px">'
    . '<div style="background:#0D1B2A;color:#fff;padding:20px 24px;border-bottom:6px solid #F2B705"><b style="font-size:20px">CORPOTEX</b><br><span style="color:#F2B705">CONSTRUIRE. INNOVER. PROPULSER.</span></div>'
    . '<p style="margin-top:20px">Bonjour ' . $h($d['contactName']) . ',</p>'
    . '<p>Nous avons bien reçu votre ' . ($isQuote ? 'demande de devis' : 'message') . '. Un conseiller Corpotex l’étudie et revient vers vous <b>sous 24H ouvrées</b> avec une proposition personnalisée.</p>'
    . ($rows ? '<table style="width:100%;border-collapse:collapse;margin:14px 0">' . $rows . '</table>' : '')
    . '<p>Besoin d’une réponse plus rapide ? Écrivez-nous sur <a href="https://wa.me/212662746731">WhatsApp</a> ou appelez le +212 6 62 74 67 31.</p>'
    . '<p>L’équipe Corpotex<br><a href="https://corpotex.ma">corpotex.ma</a></p></div>';
  smtp_send($cfg, $clean($d['email']), 'Corpotex — nous avons bien reçu votre demande', $ack, [], $cfg['to']);
}

out(($sent || $saved) ? 200 : 502, ['ok' => (bool)($sent || $saved), 'mail' => (bool)$sent, 'saved' => $saved, 'id' => $id]);

// =====================================================================
function smtp_send(array $c, string $to, string $subject, string $html, array $files, string $replyTo): bool {
  $b = 'b' . bin2hex(random_bytes(12));
  $enc = fn($s) => '=?UTF-8?B?' . base64_encode($s) . '?=';
  $msg = 'Date: ' . date('r') . "\r\n"
    . 'From: ' . $enc($c['fromName']) . ' <' . $c['from'] . ">\r\n"
    . 'To: <' . $to . ">\r\n"
    . 'Reply-To: <' . $replyTo . ">\r\n"
    . 'Subject: ' . $enc($subject) . "\r\n"
    . 'Message-ID: <' . bin2hex(random_bytes(8)) . '@' . $c['ehlo'] . ">\r\n"
    . "MIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary=\"$b\"\r\n\r\n"
    . "--$b\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" . chunk_split(base64_encode($html));
  foreach ($files as $f) {
    $msg .= "--$b\r\nContent-Type: application/octet-stream; name=\"{$f['name']}\"\r\nContent-Transfer-Encoding: base64\r\nContent-Disposition: attachment; filename=\"{$f['name']}\"\r\n\r\n" . chunk_split(base64_encode($f['data']));
  }
  $msg .= "--$b--\r\n";

  $s = @stream_socket_client('tcp://' . $c['host'] . ':' . $c['port'], $en, $es, 15);
  if (!$s) { error_log("smtp connect: $es"); return false; }
  stream_set_timeout($s, 20);
  $read = function () use ($s) { $r = ''; while (($l = fgets($s, 515)) !== false) { $r .= $l; if (isset($l[3]) && $l[3] === ' ') break; } return $r; };
  $cmd = function ($line, $expect) use ($s, $read) { if ($line !== null) fwrite($s, $line . "\r\n"); $r = $read(); if ((int)substr($r, 0, 3) !== $expect) { error_log('smtp: ' . trim($line ?? '') . ' => ' . trim($r)); return false; } return true; };
  $ok = $cmd(null, 220) && $cmd('EHLO ' . $c['ehlo'], 250) && $cmd('STARTTLS', 220)
    && stream_socket_enable_crypto($s, true, STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT | STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT)
    && $cmd('EHLO ' . $c['ehlo'], 250);
  if ($ok && $c['user'] !== '') $ok = $cmd('AUTH LOGIN', 334) && $cmd(base64_encode($c['user']), 334) && $cmd(base64_encode($c['pass']), 235);
  $ok = $ok && $cmd('MAIL FROM:<' . $c['from'] . '>', 250) && $cmd('RCPT TO:<' . $to . '>', 250) && $cmd('DATA', 354)
    && $cmd(preg_replace('/^\./m', '..', $msg) . "\r\n.", 250);
  @fwrite($s, "QUIT\r\n"); fclose($s);
  return $ok;
}
