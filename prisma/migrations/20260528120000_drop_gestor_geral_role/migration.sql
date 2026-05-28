-- Remove a role gestor_geral e suas atribuições.
-- Spec 2026-05-28: presidencia passa a usar /poncio direto; Raquel rebaixada a só gestor_unidade:medico.
-- Idempotente — se a role não existir, não faz nada.

DELETE FROM "UserRole" WHERE "roleId" IN (SELECT id FROM "Role" WHERE name = 'gestor_geral');
DELETE FROM "Role" WHERE name = 'gestor_geral';
