<?php

declare(strict_types=1);

/**
 * Shared bootstrap for the web entry. Finds the api root (the folder with src/, vendor/,
 * migrations/) in both layouts and runs the app.
 *
 *   repository:  api/public/index.php            -> api root = api/
 *   deployed:    urlaub/public/api/index.php     -> api root = urlaub/api/
 */

use VacationPlanner\Api\App;
use VacationPlanner\Api\Config;
use VacationPlanner\Api\Logger;
use VacationPlanner\Api\Request;
use VacationPlanner\Api\Response;

return static function (string $entryDir): void {
    $apiRoot = is_dir($entryDir . '/../src') ? realpath($entryDir . '/..') : realpath($entryDir . '/../../api');
    if ($apiRoot === false || !is_file($apiRoot . '/vendor/autoload.php')) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        echo '{"error":"internal_error"}';
        error_log('Vacation Planner API: vendor/autoload.php not found');

        return;
    }
    require $apiRoot . '/vendor/autoload.php';

    try {
        $config = Config::fromFile(Config::locate($apiRoot));
        $response = App::fromConfig($config, $apiRoot)->handle(Request::fromGlobals());
    } catch (Throwable $e) {
        (new Logger())->exception($e);
        $response = Response::json(500, ['error' => 'internal_error'], ['Cache-Control' => 'no-store']);
    }
    $response->send();
};
