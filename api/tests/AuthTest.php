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
        $app = $this->makeApp($this->config(['edit_key_sha256' => '', 'view_key_sha256' => '']));
        self::assertSame(401, $app->handle(new Request('GET', '/api/plan', ['Authorization' => 'Bearer ']))->status);
        self::assertSame(401, $app->handle(new Request('PUT', '/api/plan', ['Authorization' => 'Bearer ', 'If-None-Match' => '*']))->status);
    }

    public function testUppercaseHashInConfigStillMatches(): void
    {
        $app = $this->makeApp($this->config(['edit_key_sha256' => strtoupper(hash('sha256', self::EDIT_KEY))]));
        $r = $app->handle(new Request('GET', '/api/plan', ['Authorization' => 'Bearer ' . self::EDIT_KEY]));
        self::assertSame(200, $r->status);
    }

    public function testDeployKeyHeaderIsIgnored(): void
    {
        // The X-Deploy-Key header is gone: it grants nothing, on any route.
        self::assertSame(401, $this->call('GET', '/api/plan', headers: ['X-Deploy-Key' => self::EDIT_KEY], auth: false)->status);
    }
}
