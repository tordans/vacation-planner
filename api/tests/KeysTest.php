<?php

declare(strict_types=1);

namespace VacationPlanner\Api\Tests;

use PHPUnit\Framework\Attributes\DataProvider;
use VacationPlanner\Api\Tests\Support\ApiTestCase;

/** POST /api/plan/keys: renewing the view or edit key of a plan. */
final class KeysTest extends ApiTestCase
{
    private const DATA = ['v' => 1, 'trips' => [['name' => 'Ostsee']]];

    private function rotate(string $key, mixed $body): \VacationPlanner\Api\Response
    {
        return $this->call('POST', '/api/plan/keys', $body, self::bearer($key), auth: false);
    }

    private function role(string $key): int|string
    {
        $r = $this->call('GET', '/api/plan', headers: self::bearer($key), auth: false);

        return $r->status === 200 ? $this->data($r)['role'] : $r->status;
    }

    public function testRotatingTheViewKeyInvalidatesTheOldOne(): void
    {
        $keys = $this->newPlan();
        $this->call('PUT', '/api/plan', ['data' => self::DATA], ['If-None-Match' => '*', ...self::bearer($keys['editKey'])], auth: false);

        $r = $this->rotate($keys['editKey'], ['which' => 'view']);
        self::assertSame(200, $r->status);
        $body = $this->data($r);
        self::assertSame(['key'], array_keys($body));
        self::assertMatchesRegularExpression('/^[A-Za-z0-9_-]{43}$/', $body['key']);

        self::assertSame(401, $this->role($keys['viewKey']), 'the old view link stops working at once');
        self::assertSame('view', $this->role($body['key']));
        self::assertSame('edit', $this->role($keys['editKey']), 'the edit key is untouched');

        // Same plan behind the new key.
        $plan = $this->data($this->call('GET', '/api/plan', headers: self::bearer($body['key']), auth: false))['plan'];
        self::assertSame(self::DATA, $plan['data']);
    }

    public function testRotatingTheEditKeyInvalidatesTheOldOne(): void
    {
        $keys = $this->newPlan();
        $this->call('PUT', '/api/plan', ['data' => self::DATA], ['If-None-Match' => '*', ...self::bearer($keys['editKey'])], auth: false);

        $r = $this->rotate($keys['editKey'], ['which' => 'edit']);
        self::assertSame(200, $r->status);
        $new = $this->data($r)['key'];

        self::assertSame(401, $this->role($keys['editKey']), 'the old edit link stops working at once');
        self::assertSame('edit', $this->role($new));
        self::assertSame('view', $this->role($keys['viewKey']), 'the view key is untouched');

        // The old key can neither write nor rotate any more; the new one can.
        self::assertSame(401, $this->call('PUT', '/api/plan', ['data' => self::DATA], ['If-Match' => '"1"', ...self::bearer($keys['editKey'])], auth: false)->status);
        self::assertSame(401, $this->rotate($keys['editKey'], ['which' => 'view'])->status);
        self::assertSame(200, $this->call('PUT', '/api/plan', ['data' => self::DATA], ['If-Match' => '"1"', ...self::bearer($new)], auth: false)->status);
        self::assertSame(200, $this->rotate($new, ['which' => 'view'])->status);
    }

    public function testRotatingOnePlanLeavesOthersAlone(): void
    {
        $a = $this->newPlan();
        $b = $this->newPlan();

        $this->rotate($a['editKey'], ['which' => 'view']);
        $this->rotate($a['editKey'], ['which' => 'edit']);

        self::assertSame('edit', $this->role($b['editKey']));
        self::assertSame('view', $this->role($b['viewKey']));
    }

    public function testViewKeyCannotRotate(): void
    {
        $keys = $this->newPlan();
        $r = $this->rotate($keys['viewKey'], ['which' => 'view']);
        self::assertSame(403, $r->status);
        self::assertSame(['error' => 'forbidden'], $r->data());
        self::assertSame('view', $this->role($keys['viewKey']));
        self::assertSame('edit', $this->role($keys['editKey']));
    }

    public function testWithoutAKeyIs401(): void
    {
        self::assertSame(401, $this->call('POST', '/api/plan/keys', ['which' => 'view'], auth: false)->status);
    }

    /** @return iterable<string, array{string}> */
    public static function badBodies(): iterable
    {
        yield 'unknown value' => ['{"which":"admin"}'];
        yield 'no field' => ['{}'];
        yield 'number' => ['{"which":1}'];
        yield 'list' => ['[]'];
    }

    #[DataProvider('badBodies')]
    public function testInvalidWhichIs422AndChangesNothing(string $body): void
    {
        $keys = $this->newPlan();
        $r = $this->call('POST', '/api/plan/keys', rawBody: $body, headers: self::bearer($keys['editKey']), auth: false);
        self::assertSame(422, $r->status);
        self::assertSame(['error' => 'invalid_request'], $r->data());
        self::assertSame('view', $this->role($keys['viewKey']));
        self::assertSame('edit', $this->role($keys['editKey']));
    }

    public function testBrokenBodyIs400(): void
    {
        $keys = $this->newPlan();
        self::assertSame(400, $this->call('POST', '/api/plan/keys', rawBody: '', headers: self::bearer($keys['editKey']), auth: false)->status);
        self::assertSame(400, $this->call('POST', '/api/plan/keys', rawBody: '{"which":', headers: self::bearer($keys['editKey']), auth: false)->status);
    }
}
