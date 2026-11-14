<?php

declare(strict_types=1);

namespace VacationPlanner\Api;

use Closure;
use VacationPlanner\Api\Handler\CalendarHandler;
use VacationPlanner\Api\Handler\KeysHandler;
use VacationPlanner\Api\Handler\PlanHandler;
use VacationPlanner\Api\Handler\PlansHandler;

/** Front controller: routing, auth, size limit, error mapping. */
final class App
{
    private const AUTH_NONE = 'none';
    private const AUTH_KEY = 'key';
    private const AUTH_INVITE = 'invite';

    private ?Db $db = null;

    /**
     * @param Closure(): Db $dbFactory called lazily, so /api/health works without a database
     * @param Closure(): \DateTimeImmutable $clock
     */
    public function __construct(
        private readonly Config $config,
        private readonly Closure $dbFactory,
        private readonly Closure $clock,
        private readonly Logger $logger,
        private readonly string $migrationsDir,
    ) {
    }

    /** Production wiring. */
    public static function fromConfig(Config $config, string $apiRoot): self
    {
        $logger = new Logger($config->logFile());

        return new self(
            $config,
            static fn (): Db => Db::connect($config),
            static fn (): \DateTimeImmutable => new \DateTimeImmutable('now', new \DateTimeZone('UTC')),
            $logger,
            $apiRoot . '/migrations',
        );
    }

    public function handle(Request $request): Response
    {
        try {
            $response = $this->dispatch($request);
        } catch (HttpException $e) {
            $response = Response::json($e->status, ['error' => $e->error] + $e->extra, $e->headers);
        } catch (\Throwable $e) {
            $this->logger->exception($e);
            $response = Response::json(500, ['error' => 'internal_error']);
        }

        return $this->decorate($response);
    }

    private function dispatch(Request $request): Response
    {
        $path = $request->path === '/' ? '/' : rtrim($request->path, '/');

        // The calendar feed carries its key in the path, because calendar apps cannot send headers.
        if (preg_match('#^/api/calendar/([A-Za-z0-9_-]{43})\.ics$#', $path, $m) === 1) {
            if ($request->method !== 'GET' && $request->method !== 'HEAD') {
                throw new HttpException(405, 'method_not_allowed', [], ['Allow' => 'GET, HEAD']);
            }

            return (new CalendarHandler($this->db(), $this->clock))->feed($request, $m[1]);
        }
        $routes = array_filter($this->routes(), static fn (array $r): bool => $r['path'] === $path);
        if ($routes === []) {
            throw new HttpException(404, 'not_found');
        }

        $route = null;
        foreach ($routes as $candidate) {
            if (in_array($request->method, $candidate['methods'], true)) {
                $route = $candidate;
                break;
            }
        }
        if ($route === null) {
            $allowed = array_merge(...array_column($routes, 'methods'));
            throw new HttpException(405, 'method_not_allowed', [], ['Allow' => implode(', ', array_unique($allowed))]);
        }

        if ($request->tooLarge()) {
            throw new HttpException(413, 'payload_too_large');
        }

        // Key routes need a known key (edit or view; a view key on a write gets 403 in the handler).
        // The invite route has no key: its handler checks the invite word.
        $access = null;
        if ($route['auth'] === self::AUTH_KEY) {
            $token = $request->bearerToken();
            $access = $token === null ? null : (new Auth($this->db()))->resolve($token);
            if ($access === null) {
                throw new HttpException(401, 'unauthorized', [], ['WWW-Authenticate' => 'Bearer']);
            }
        }

        return ($route['handler'])($request, $access);
    }

    /**
     * @return list<array{path: string, methods: list<string>, auth: string, handler: Closure(Request, ?Access): Response}>
     */
    private function routes(): array
    {
        return [
            ['path' => '/api/health', 'methods' => ['GET'], 'auth' => self::AUTH_NONE,
                'handler' => fn (): Response => Response::json(200, ['ok' => true, 'commit' => $this->config->commit()])],
            ['path' => '/api/plans', 'methods' => ['POST'], 'auth' => self::AUTH_INVITE,
                'handler' => fn (Request $r): Response => (new PlansHandler($this->db(), $this->config, $this->clock))->create($r)],
            ['path' => '/api/plan', 'methods' => ['GET'], 'auth' => self::AUTH_KEY,
                'handler' => fn (Request $r, ?Access $a): Response => $this->plan()->get($a ?? self::noAccess())],
            ['path' => '/api/plan', 'methods' => ['PUT'], 'auth' => self::AUTH_KEY,
                'handler' => fn (Request $r, ?Access $a): Response => $this->plan()->put($r, $a ?? self::noAccess())],
            ['path' => '/api/plan/keys', 'methods' => ['POST'], 'auth' => self::AUTH_KEY,
                'handler' => fn (Request $r, ?Access $a): Response => (new KeysHandler($this->db()))->rotate($r, $a ?? self::noAccess())],
        ];
    }

    /** Key routes never run without Access (dispatch answers 401 first). */
    private static function noAccess(): never
    {
        throw new HttpException(401, 'unauthorized', [], ['WWW-Authenticate' => 'Bearer']);
    }

    /**
     * The database with pending migrations applied. Only routes that need the database get here,
     * never /api/health. Runs once per request (the app is built per request); when nothing is
     * pending, the migrator costs one query for the names already applied.
     */
    private function db(): Db
    {
        if ($this->db === null) {
            $db = ($this->dbFactory)();
            (new Migrator($db, $this->migrationsDir))->migrate();
            $this->db = $db;
        }

        return $this->db;
    }

    private function plan(): PlanHandler
    {
        return new PlanHandler($this->db(), $this->clock);
    }

    /** Security headers and no caching. The API is same-origin only, so no CORS headers. */
    private function decorate(Response $response): Response
    {
        $response->headers['Cache-Control'] = 'no-store';
        $response->headers['X-Content-Type-Options'] = 'nosniff';

        return $response;
    }
}
