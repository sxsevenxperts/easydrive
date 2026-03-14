#!/bin/bash
# ─── Script de Deploy Automático EasyDrive ──────────────────────────────

set -e  # Exit se qualquer comando falhar

echo "🚀 EasyDrive — Iniciando Deploy..."
echo ""

# ─── 1. Atualizar repositório ────────────────────────────────────────────
echo "📦 Atualizando código do GitHub..."
cd /var/www/easydrive  # Ajuste este caminho conforme necessário
git pull origin main --force

# ─── 2. Instalar dependências ────────────────────────────────────────────
echo "📥 Instalando dependências..."
npm install --production

# ─── 3. Build ───────────────────────────────────────────────────────────
echo "🔨 Buildando aplicação..."
npm run build

# ─── 4. Copiar dist para public ──────────────────────────────────────────
echo "📂 Copiando arquivos compilados..."
rm -rf public/*
cp -r dist/* public/

# ─── 5. Limpar cache (se usando nginx) ──────────────────────────────────
echo "🧹 Limpando cache..."
sudo systemctl reload nginx 2>/dev/null || echo "⚠️  nginx não encontrado"

# ─── 6. Verificar status ────────────────────────────────────────────────
echo ""
echo "✅ Deploy completo!"
echo ""
echo "📊 Verificando arquivos..."
ls -lh public/index.html
echo ""
echo "🌐 URL: http://187.77.32.172:3000"
echo "📝 Log: tail -f /var/log/nginx/error.log"
echo ""
