<?php

declare(strict_types=1);

namespace VacationPlanner\Api\Tests;

use PHPUnit\Framework\Attributes\DataProvider;
use VacationPlanner\Api\Request;
use VacationPlanner\Api\Tests\Support\ApiTestCase;

final class AuthTest extends ApiTestCase
{
    /** @return iterable<string, array{string, string, string|null}> */
    public static function planEndpoints(): iterable
    {
        yield 'plan get' => ['GET', '/api/plan', null];
        yield 'plan put' => ['PUT', '/api/plan', '{"data":{"v":1}}'];
    }

    #[DataProvider('planEndpoints')]
    public function testPlanEndpointsRequireAKnownKey(string $method, string $path, ?string $body): void
    {
        $none = $this->call($method, $path, rawBody: $body, headers: ['If-None-Match' => '*'], auth: false);
        self::assertSame(401, $none->status);
        self::assertSame(['error' => 'unauthorized'], $none->data());
        self::assertSame('Bearer', $none->header('WWW-Authenticate'));

        $wrong = $this->call($method, $path, rawBody: $body, headers: ['Authorization' => 'Bearer wrong'], auth: false);
        self::assertSame(401, $wrong->status);

        $notBearer = $this->call($method, $path, rawBody: $body, headers: ['Authorization' => 'Basic ' . self::EDIT_KEY], auth: false);
        self::assertSame(401, $notBearer->status);

        $deploy = $this->call($method, $path, rawBody: $body, headers: ['Authorization' => 'Bearer ' . self::DEPLOY_KEY], auth: false);
        self::assertSame(401, $deploy->status, 'the deploy key is not a plan key');
    }

    public function testEditAndViewKeysAreAccepted(): void
    {
        $edit = $this->call('GET', '/api/plan', headers: ['Authorization' => 'Bearer ' . self::EDIT_KEY], auth: false);
        self::assertSame(200, $edit->status);
        self::assertSame('edit', $this->data($edit)['role']);

        $view = $this->call('GET', '/api/plan', headers: ['Authorization' => 'Bearer ' . self::VIEW_KEY], auth: false);
        self::assertSame(200, $view->status);
        self::assertSame('view', $this->data($view)['role']);
    }

    public function testBearerSchemeIsCaseInsensitive(): void
    {
        $r = $this->call('GET', '/api/plan', headers: ['authorization' => 'bearer ' . self::EDIT_KEY], auth: false);
        self::assertSame(200, $r->status);
    }

    public function testEmptyConfiguredHashNeverAuthenticates(): void
    {
        $app = $this->makeApp($this->config(['edit_key_sha256' => '', 'view_key_sha256' => '', 'deploy_key_sha256' => '']), migrate: false);
        self::assertSame(401, $app->handle(new Request('GET', '/api/plan', ['Authorization' => 'Bearer ']))->status);
        self::assertSame(401, $app->handle(new Request('PUT', '/api/plan', ['Authorization' => 'Bearer ', 'If-None-Match' => '*']))->status);
        self::assertSame(401, $app->handle(new Request('POST', '/api/migrate', ['X-Deploy-Key' => '']))->status);
    }

    public function testUppercaseHashInConfigStillMatches(): void
    {
        $app = $this->makeApp($this->config(['edit_key_sha256' => strtoupper(hash('sha256', self::EDIT_KEY))]), migrate: false);
        $r = $app->handle(new Request('GET', '/api/plan', ['Authorization' => 'Bearer ' . self::EDIT_KEY]));
        self::assertSame(200, $r->status);
    }

    public function testDeployKeyOnlyForMigrate(): void
    {
        self::assertSame(401, $this->call('POST', '/api/migrate', auth: false)->status);
        self::assertSame(401, $this->call('POST', '/api/migrate', headers: ['X-Deploy-Key' => 'wrong'], auth: false)->status);
        self::assertSame(401, $this->call('POST', '/api/migrate', headers: ['X-Deploy-Key' => self::EDIT_KEY], auth: false)->status, 'an edit key is not a deploy key');
        self::assertSame(200, $this->call('POST', '/api/migrate', headers: ['X-Deploy-Key' => self::DEPLOY_KEY], auth: false)->status);
        self::assertSame(401, $this->call('GET', '/api/plan', headers: ['Authorization' => 'Bearer ' . self::DEPLOY_KEY], auth: false)->status);
    }
}
