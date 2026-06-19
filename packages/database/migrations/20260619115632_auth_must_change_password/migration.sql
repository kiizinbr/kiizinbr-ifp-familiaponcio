-- Primeiro acesso (go-live de auth): senha provisória definida pelo admin/gestor.
-- Enquanto `mustChangePassword` for true, o login obriga a troca de senha.
ALTER TABLE "usuarios" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
