<?php

declare(strict_types=1);

namespace VacationPlanner\Api\Handler;

use Closure;
use stdClass;
use VacationPlanner\Api\Config;
use VacationPlanner\Api\Db;
use VacationPlanner\Api\HttpException;
use VacationPlanner\Api\Keys;
use VacationPlanner\Api\Request;
use VacationPlanner\Api\Response;

/**
 * POST /api/plans: creates a new plan for someone who knows the invite word.
 *
 * Limits (all in the database): 10 failed invite attempts per IP hash and hour, 5 new plans per
 * 24 hours, 100 plans in total. The IP address is never stored: only HMAC(date, secret) is used as
 * a salt for a hash of the address, so the hash changes every day. The counts are not atomic; two
 * requests at the very same moment may exceed a limit by one, which does not matter here.
 */
final class PlansHandler
{
    public const MAX_FAILED_PER_HOUR = 10;
    public const MAX_NEW_PER_DAY = 5;
    public const MAX_PLANS = 100;

    /** @param Closure(): \DateTimeImmutable $clock */
    public function __construct(
        private readonly Db $db,
        private readonly Config $config,
        private readonly Closure $clock,
    ) {
    }

    public function create(Request $request): Response
    {
        $body = $request->json(false);
        $now = ($this->clock)();
        $ipHash = $this->ipHash($request->ip, $now);

        $this->db->run('DELETE FROM invite_attempts WHERE attempted_at < ?', [Db::format($now->modify('-1 hour'))]);
        $failed = (int) ($this->db->one(
            'SELECT COUNT(*) AS n FROM invite_attempts WHERE ip_hash = ? AND attempted_at >= ?',
            [$ipHash, Db::format($now->modify('-1 hour'))],
        )['n'] ?? 0);
        if ($failed >= self::MAX_FAILED_PER_HOUR) {
            throw new HttpException(429, 'too_many_attempts', [], ['Retry-After' => '3600']);
        }

        $given = $body instanceof stdClass && isset($body->invite) && is_string($body->invite) ? $body->invite : '';
        if (!$this->inviteMatches($given)) {
            $this->db->run('INSERT INTO invite_attempts (ip_hash, attempted_at) VALUES (?, ?)', [$ipHash, Db::format($now)]);
            throw new HttpException(403, 'invalid_invite');
        }

        $stamp = $now->setTimezone(new \DateTimeZone('UTC'))->format('Y-m-d H:i:s.v');
        $total = (int) ($this->db->one('SELECT COUNT(*) AS n FROM plans')['n'] ?? 0);
        $today = (int) ($this->db->one(
            'SELECT COUNT(*) AS n FROM plans WHERE created_at >= ?',
            [$now->setTimezone(new \DateTimeZone('UTC'))->modify('-1 day')->format('Y-m-d H:i:s.v')],
        )['n'] ?? 0);
        if ($total >= self::MAX_PLANS || $today >= self::MAX_NEW_PER_DAY) {
            throw new HttpException(503, 'plans_full');
        }

        $editKey = Keys::generate();
        $viewKey = Keys::generate();
        $this->db->run(
            'INSERT INTO plans (id, edit_key_sha256, view_key_sha256, data, version, updated_at, created_at) VALUES (?, ?, ?, NULL, 0, NULL, ?)',
            [bin2hex(random_bytes(16)), Keys::hash($editKey), Keys::hash($viewKey), $stamp],
        );

        return Response::json(201, ['editKey' => $editKey, 'viewKey' => $viewKey]);
    }

    private function inviteMatches(string $given): bool
    {
        $expected = $this->config->inviteSha256();
        if ($given === '' || $expected === '') {
            return false;
        }

        return hash_equals($expected, hash('sha256', $given));
    }

    /** Hash of the address with a salt that is different every UTC day and unknown without the secret. */
    private function ipHash(string $ip, \DateTimeImmutable $now): string
    {
        $secret = $this->config->ipSaltSecret();
        if ($secret === '') {
            throw new \RuntimeException('ip_salt_secret is not configured');
        }
        $salt = hash_hmac('sha256', $now->setTimezone(new \DateTimeZone('UTC'))->format('Y-m-d'), $secret);

        return hash_hmac('sha256', $ip, $salt);
    }
}
