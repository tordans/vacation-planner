<?php

declare(strict_types=1);

namespace VacationPlanner\Api;

/** What a valid key gives: the plan it belongs to and the role ('edit' or 'view'). */
final class Access
{
    public function __construct(public readonly string $planId, public readonly string $role)
    {
    }

    public function canEdit(): bool
    {
        return $this->role === 'edit';
    }
}
