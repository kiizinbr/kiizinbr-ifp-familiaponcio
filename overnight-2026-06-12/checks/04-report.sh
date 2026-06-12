#!/usr/bin/env bash
set -e
cd /mnt/c/Users/Administrador/.config/superpowers/worktrees/ifp-connect/overnight-20260612
pnpm prettier --write overnight-2026-06-12/REPORT.md
pnpm prettier --check overnight-2026-06-12/REPORT.md
echo REPORT_OK
