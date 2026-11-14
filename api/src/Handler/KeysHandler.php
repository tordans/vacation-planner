<?php

declare(strict_types=1);

namespace VacationPlanner\Api\Handler;

use stdClass;
use VacationPlanner\Api\Access;
use VacationPlanner\Api\Db;
use VacationPlanner\Api\HttpException;
use VacationPlanner\Api\Keys;
use VacationPlanner\Api\Request;
use VacationPlanner\Api\Response;

/** POST /api/plan/keys: replaces the view or the edit key of the plan. The old key stops working at once. */
final class KeysHandler
{
    public function __construct(private readonly Db $db)
    {
    }

    public function rotate(Request $request, Access $access): Response
    {
        if (!$access->canEdit()) {
            throw new HttpException(403, 'forbidden');
        }

        $body = $request->json(false);
        $which = $body instanceof stdClass && isset($body->which) && is_string($body->which) ? $body->which : '';
        $column = match ($which) {
            'view' => 'view_key_sha256',
            'edit' => 'edit_key_sha256',
            default => throw new HttpException(422, 'invalid_request'),
        };

        $key = Keys::generate();
        $this->db->run("UPDATE plans SET $column = ? WHERE id = ?", [Keys::hash($key), $access->planId]);

        return Response::json(200, ['key' => $key]);
    }
}
