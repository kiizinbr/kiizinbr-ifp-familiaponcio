#!/usr/bin/env bash
# Habilita o firewall ufw na VM SEM trancar SSH nem o Tailscale.
# RODE NA VM (sudo). Libera o SSH ANTES de ativar (por isso e seguro).
# Se algo der errado e voce perder acesso: console Hyper-V -> `sudo ufw disable`.
set -e
sudo ufw allow 22/tcp comment 'SSH'
sudo ufw allow in on tailscale0 comment 'Tailscale tailnet/funnel'
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw --force enable
sudo ufw status verbose
echo "OK. Confirme num 2o terminal que o SSH ainda conecta antes de fechar este."
