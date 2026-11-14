<?php

declare(strict_types=1);

namespace VacationPlanner\Api\Tests;

use PHPUnit\Framework\Attributes\DataProvider;
use VacationPlanner\Api\Tests\Support\ApiTestCase;

final class AuthTest extends ApiTestCase
{
    /** @return iterable<string, array{string, string, string|null}> */
    public static function keyEndpoints(): iterable
    {
        yield 'plan get' => ['GET', '/api/plan', null];
        yield 'plan put' => ['PUT', '/api/plan', '{"data":{"v":1}}'];
        yield 'keys post' => ['POST', '/api/plan/keys', '{"which":"view"}'];
    }

    #[DataProvider('keyEndpoints')]
    public function testKeyEndpointsRequireAKnownKey(string $method, string $path, ?string $body): void
    {
        $edit = $this->editKey();

        $none = $this->call($method, $path, rawBody: $body, headers: ['If-None-Match' => '*'], auth: false);
        self::assertSame(401, $none->status);
        self::assertSame(['error' => 'unauthorized'], $none->data());
        self::assertSame('Bearer', $none->header('WWW-Authenticate'));

        $wrong = $this->call($method, $path, rawBody: $body, headers: self::bearer('wrong'), auth: false);
        self::assertSame(401, $wrong->status);

        $notBearer = $this->call($method, $path, rawBody: $body, headers: ['Authorization' => 'Basic ' . $edit], auth: false);
        self::assertSame(401, $notBearer->status);
    }

    public function testEditAndViewKeysGiveTheirRole(): void
    {
        $edit = $this->call('GET', '/api/plan', headers: self::bearer($this->editKey()), auth: false);
        self::assertSame(200, $edit->status);
        self::assertSame('edit', $this->data($edit)['role']);

        $view = $this->call('GET', '/api/plan', headers: self::bearer($this->viewKey()), auth: false);
        self::assertSame(200, $view->status);
        self::assertSame('view', $this->data($view)['role']);
    }

    public function testBearerSchemeIsCaseInsensitive(): void
    {
        $r = $this->call('GET', '/api/plan', headers: ['authorization' => 'bearer ' . $this->editKey()], auth: false);
        self::assertSame(200, $r->status);
    }

    public function testEmptyAndMalformedBearerNeverAuthenticate(): void
    {
        $this->editKey();
        self::assertSame(401, $this->call('GET', '/api/plan', headers: ['Authorization' => 'Bearer '], auth: false)->status);
        self::assertSame(401, $this->call('GET', '/api/plan', headers: ['Authorization' => 'Bearer a b'], auth: false)->status);
    }

    public function testTheHashOfAKeyIsNotAKey(): void
    {
        // The database holds sha256(key): sending that digest as the key must not work.
        $this->editKey();
        $digest = (string) $this->db->one('SELECT edit_key_sha256 AS h FROM plans')['h'];
        self::assertSame(401, $this->call('GET', '/api/plan', headers: self::bearer($digest), auth: false)->status);
    }

    public function testDeployKeyHeaderIsIgnored(): void
    {
        // The X-Deploy-Key header is gone: it grants nothing, on any route.
        self::assertSame(401, $this->call('GET', '/api/plan', headers: ['X-Deploy-Key' => $this->editKey()], auth: false)->status);
    }
}
