#!/usr/bin/env bash
# Nightly snapshot of the home-server stack (~/server) → ~/backups/server.
# Runs as root (systemd server-backup.timer): HA's .storage and recorder DB
# are root-owned. The recorder DB is hot-copied via sqlite's online backup
# API (python3 stdlib — consistent snapshot, no container stop); everything
# else is rsync'd into a staging dir and tarred.
#
# Layout:  ~/backups/server/daily/server-YYYY-MM-DD.tar.gz   (keep 7)
#          ~/backups/server/weekly/server-YYYY-MM-DD.tar.gz  (Sundays, keep 4)
# Restore: docker compose down; untar over ~/server; docker compose up -d.
#          The matter/ dir holds Matter fabric credentials — losing it means
#          re-commissioning every Matter device; it is always included here.
set -euo pipefail

SRC=/home/tmoots/server
ROOT=/home/tmoots/backups/server
STAMP=$(date +%F)
STAGE=$(mktemp -d /tmp/server-backup.XXXXXX)
trap 'rm -rf "$STAGE"' EXIT

mkdir -p "$ROOT"/daily "$ROOT"/weekly
chmod 700 "$ROOT" # tarballs contain .env (tunnel token) + HA auth store

# Everything except the live sqlite files (hot-copied below) and rebuildables.
rsync -a \
  --exclude 'homeassistant/home-assistant_v2.db*' \
  --exclude 'homeassistant/home-assistant.log*' \
  --exclude 'homeassistant/deps' \
  --exclude 'homeassistant/tts' \
  --exclude 'homeassistant/backups' \
  "$SRC"/ "$STAGE/server/"

python3 - "$SRC/homeassistant/home-assistant_v2.db" \
          "$STAGE/server/homeassistant/home-assistant_v2.db" <<'EOF'
import os, sqlite3, sys
src, dst = sys.argv[1], sys.argv[2]
if os.path.exists(src):
    s = sqlite3.connect(f"file:{src}?mode=ro", uri=True)
    d = sqlite3.connect(dst)
    s.backup(d)
    d.close(); s.close()
EOF

tar -C "$STAGE" -czf "$ROOT/daily/server-$STAMP.tar.gz" server
if [ "$(date +%u)" = 7 ]; then
  cp -l "$ROOT/daily/server-$STAMP.tar.gz" "$ROOT/weekly/server-$STAMP.tar.gz" 2>/dev/null || true
fi

# Retention: newest 7 dailies, newest 4 weeklies. (`|| true`: with pipefail,
# an empty glob makes ls exit 2 even though tail/xargs are happy.)
ls -1t "$ROOT"/daily/server-*.tar.gz 2>/dev/null | tail -n +8 | xargs -r rm -- || true
ls -1t "$ROOT"/weekly/server-*.tar.gz 2>/dev/null | tail -n +5 | xargs -r rm -- || true

echo "backup ok: $ROOT/daily/server-$STAMP.tar.gz ($(du -h "$ROOT/daily/server-$STAMP.tar.gz" | cut -f1))"
