<?php

declare(strict_types=1);

namespace VacationPlanner\Api\Tests;

use PHPUnit\Framework\Attributes\DataProvider;
use VacationPlanner\Api\Handler\PlansHandler;
use VacationPlanner\Api\Migrator;
use VacationPlanner\Api\Tests\Support\ApiTestCase;

/** POST /api/plans: creating plans with the invite word, and its limits. */
final class PlansTest extends ApiTestCase
{
    private function invite(string $word, ?string $ip = null): \VacationPlanner\Api\Response
    {
        return $this->call('POST', '/api/plans', ['invite' => $word], auth: false, ip: $ip);
    }

    public function testRightInviteWordCreatesAPlanWithTwoKeys(): void
    {
        $r = $this->invite(self::INVITE);
        self::assertSame(201, $r->status);
        $keys = $this->data($r);
        self::assertSame(['editKey', 'viewKey'], array_keys($keys));
        self::assertMatchesRegularExpression('/^[A-Za-z0-9_-]{43}$/', $keys['editKey'], '32 random bytes as base64url');
        self::assertMatchesRegularExpression('/^[A-Za-z0-9_-]{43}$/', $keys['viewKey']);
        self::assertNotSame($keys['editKey'], $keys['viewKey']);

        // The new keys work, the plan is empty.
        $get = $this->call('GET', '/api/plan', headers: self::bearer($keys['editKey']), auth: false);
        self::assertSame(['role' => 'edit', 'plan' => null], $this->data($get));
    }

    public function testEachPlanGetsNewKeys(): void
    {
        $a = $this->data($this->invite(self::INVITE));
        $b = $this->data($this->invite(self::INVITE));
        self::assertCount(4, array_unique([$a['editKey'], $a['viewKey'], $b['editKey'], $b['viewKey']]));
    }

    public function testWrongInviteWordIs403AndCreatesNothing(): void
    {
        $r = $this->invite('not-the-word');
        self::assertSame(403, $r->status);
        self::assertSame(['error' => 'invalid_invite'], $r->data());
        self::assertSame(0, (int) $this->db->one('SELECT COUNT(*) AS n FROM plans')['n']);
        self::assertSame(1, (int) $this->db->one('SELECT COUNT(*) AS n FROM invite_attempts')['n']);
    }

    /** @return iterable<string, array{string}> */
    public static function badInvites(): iterable
    {
        yield 'no invite field' => ['{}'];
        yield 'invite is empty' => ['{"invite":""}'];
        yield 'invite is a number' => ['{"invite":1}'];
        yield 'invite is null' => ['{"invite":null}'];
        yield 'invite is a list' => ['{"invite":["test-invite-word"]}'];
        yield 'body is a list' => ['[]'];
    }

    #[DataProvider('badInvites')]
    public function testMissingOrMalformedInviteIs403(string $body): void
    {
        $r = $this->call('POST', '/api/plans', rawBody: $body, auth: false);
        self::assertSame(403, $r->status);
        self::assertSame(['error' => 'invalid_invite'], $r->data());
    }

    public function testEmptyOrBrokenBodyIs400(): void
    {
        self::assertSame(400, $this->call('POST', '/api/plans', rawBody: '', auth: false)->status);
        self::assertSame(400, $this->call('POST', '/api/plans', rawBody: '{"invite":', auth: false)->status);
    }

    public function testNoInviteConfiguredMeansNobodyCanCreateAPlan(): void
    {
        $this->app = $this->makeApp($this->config(['invite_sha256' => '']));
        self::assertSame(403, $this->invite('')->status);
        self::assertSame(403, $this->invite(self::INVITE)->status);
        self::assertSame(403, $this->invite(hash('sha256', ''))->status);
    }

    public function testUppercaseDigestInConfigStillMatches(): void
    {
        $this->app = $this->makeApp($this->config(['invite_sha256' => strtoupper(hash('sha256', self::INVITE))]));
        self::assertSame(201, $this->invite(self::INVITE)->status);
    }

    public function testMissingIpSaltSecretFailsClosed(): void
    {
        $this->app = $this->makeApp($this->config(['ip_salt_secret' => '']));
        $r = $this->invite(self::INVITE);
        self::assertSame(500, $r->status);
        self::assertSame(['error' => 'internal_error'], $r->data());
        self::assertSame(0, (int) $this->db->one('SELECT COUNT(*) AS n FROM plans')['n']);
    }

    public function testTenFailedAttemptsPerIpAndHourThen429(): void
    {
        for ($i = 0; $i < PlansHandler::MAX_FAILED_PER_HOUR; $i++) {
            self::assertSame(403, $this->invite('wrong-' . $i)->status);
        }

        $blocked = $this->invite('wrong-again');
        self::assertSame(429, $blocked->status);
        self::assertSame(['error' => 'too_many_attempts'], $blocked->data());
        self::assertSame('3600', $blocked->header('Retry-After'));

        // Even the right word is refused while blocked: guessing must not be answerable.
        self::assertSame(429, $this->invite(self::INVITE)->status);
        self::assertSame(0, (int) $this->db->one('SELECT COUNT(*) AS n FROM plans')['n']);

        // Another address is not affected.
        self::assertSame(201, $this->invite(self::INVITE, '198.51.100.9')->status);

        // After an hour the block is gone and the old rows are deleted.
        $this->now = $this->now->modify('+61 minutes');
        self::assertSame(201, $this->invite(self::INVITE)->status);
        self::assertSame(0, (int) $this->db->one('SELECT COUNT(*) AS n FROM invite_attempts')['n']);
    }

    public function testSuccessfulCreationsDoNotCountAsFailures(): void
    {
        for ($i = 0; $i < PlansHandler::MAX_NEW_PER_DAY; $i++) {
            self::assertSame(201, $this->invite(self::INVITE)->status);
        }
        self::assertSame(0, (int) $this->db->one('SELECT COUNT(*) AS n FROM invite_attempts')['n']);
    }

    public function testFiveNewPlansPerDayThen503(): void
    {
        for ($i = 0; $i < PlansHandler::MAX_NEW_PER_DAY; $i++) {
            self::assertSame(201, $this->invite(self::INVITE)->status, "plan $i");
        }

        $r = $this->invite(self::INVITE);
        self::assertSame(503, $r->status);
        self::assertSame(['error' => 'plans_full'], $r->data());
        self::assertSame(5, (int) $this->db->one('SELECT COUNT(*) AS n FROM plans')['n']);

        // A wrong word still gets 403, not a hint about free places.
        self::assertSame(403, $this->invite('wrong')->status);

        // The window moves on: a day later it works again.
        $this->now = $this->now->modify('+25 hours');
        self::assertSame(201, $this->invite(self::INVITE)->status);
    }

    public function testHundredPlansInTotalThen503(): void
    {
        (new Migrator($this->db, $this->migrationsDir))->migrate();
        $stmt = $this->db->pdo->prepare('INSERT INTO plans (id, edit_key_sha256, view_key_sha256, data, version, updated_at, created_at) VALUES (?, ?, ?, NULL, 0, NULL, ?)');
        for ($i = 0; $i < PlansHandler::MAX_PLANS - 1; $i++) {
            $stmt->execute([sprintf('%032d', $i), hash('sha256', "e$i"), hash('sha256', "v$i"), '2026-01-01 00:00:00.000']);
        }

        self::assertSame(201, $this->invite(self::INVITE)->status, 'the 100th plan fits');
        $r = $this->invite(self::INVITE);
        self::assertSame(503, $r->status);
        self::assertSame(['error' => 'plans_full'], $r->data());
        self::assertSame(100, (int) $this->db->one('SELECT COUNT(*) AS n FROM plans')['n']);
    }

    public function testKeysAndInviteWordAreNeverStoredInClear(): void
    {
        $keys = $this->newPlan();
        $this->call('PUT', '/api/plan', ['data' => ['v' => 1]], ['If-None-Match' => '*', ...self::bearer($keys['editKey'])], auth: false);
        $rotated = $this->data($this->call('POST', '/api/plan/keys', ['which' => 'view'], self::bearer($keys['editKey']), auth: false))['key'];
        $this->invite('a-wrong-word-to-store');

        $row = $this->db->one('SELECT * FROM plans');
        self::assertSame(hash('sha256', $keys['editKey']), $row['edit_key_sha256']);
        self::assertSame(hash('sha256', $rotated), $row['view_key_sha256']);

        // No table holds a key or a word in clear: look through the complete contents.
        $dump = '';
        foreach (['plans', 'invite_attempts', 'migrations'] as $table) {
            $dump .= json_encode($this->db->all("SELECT * FROM $table"), JSON_THROW_ON_ERROR);
        }
        foreach ([$keys['editKey'], $keys['viewKey'], $rotated, self::INVITE, 'a-wrong-word-to-store', self::IP] as $secret) {
            self::assertStringNotContainsString($secret, $dump);
        }
    }

    public function testIpIsStoredOnlyAsADailySaltedHash(): void
    {
        $this->invite('wrong');
        $day1 = (string) $this->db->one('SELECT ip_hash FROM invite_attempts')['ip_hash'];
        self::assertMatchesRegularExpression('/^[0-9a-f]{64}$/', $day1);
        self::assertNotSame(hash('sha256', self::IP), $day1, 'not a plain sha256 of the address');

        // Same address, next day: a different hash (the old rows are deleted after an hour).
        $this->now = $this->now->modify('+1 day');
        $this->invite('wrong');
        $hashes = array_column($this->db->all('SELECT ip_hash FROM invite_attempts'), 'ip_hash');
        self::assertCount(1, $hashes);
        self::assertNotSame($day1, $hashes[0]);

        // Another secret gives another hash for the same day and address.
        $this->now = $this->now->modify('+1 day');
        $this->invite('wrong');
        $withSecretA = (string) $this->db->one('SELECT ip_hash FROM invite_attempts')['ip_hash'];
        $this->db->run('DELETE FROM invite_attempts');
        $this->app = $this->makeApp($this->config(['ip_salt_secret' => 'another-secret']));
        $this->invite('wrong');
        self::assertNotSame($withSecretA, (string) $this->db->one('SELECT ip_hash FROM invite_attempts')['ip_hash']);
    }
}
