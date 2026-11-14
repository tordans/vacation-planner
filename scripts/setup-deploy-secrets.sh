#!/usr/bin/env bash
# Guided setup of the GitHub environment secrets for the deploy workflow (docs/deploy.md, sections 2 + 3).
# Generates the edit and view keys, asks for the FTP and database values, and stores
# everything with `gh secret set --env production`. Nothing is written to disk.
#
# Usage: [FTP_SERVER=… FTP_USERNAME=… DB_HOST=… DB_NAME=… DB_USER=…] scripts/setup-deploy-secrets.sh [owner/repo]
# Values given as environment variables are not asked for; passwords always are.
set -euo pipefail

REPO="${1:-$(gh repo view --json nameWithOwner -q .nameWithOwner)}"
ENV_NAME=production
SITE_URL=https://urlaub.ingsparks.de
cd "$(dirname "$0")/.."

ask() { # ask <prompt> <default>
  local answer
  read -r -p "$1${2:+ [$2]}: " answer
  printf '%s' "${answer:-$2}"
}
ask_secret() { # ask_secret <prompt>
  local answer
  read -r -s -p "$1 (Eingabe unsichtbar): " answer
  echo >&2
  [ -n "$answer" ] || { echo "Leer – abgebrochen." >&2; exit 1; }
  printf '%s' "$answer"
}
random_key() { openssl rand -base64 36 | tr '+/' '-_' | tr -d '=\n'; }
sha256() { printf '%s' "$1" | shasum -a 256 | cut -d' ' -f1; }
put() { printf '%s' "$2" | gh secret set "$1" --env "$ENV_NAME" --repo "$REPO" >/dev/null && echo "  ✓ $1"; }

echo "Secrets für $REPO (Environment: $ENV_NAME)"
echo
echo "1/2 FTP (KAS > FTP-Nutzer)"
FTP_SERVER=${FTP_SERVER:-$(ask "  Servername" "")}
FTP_USERNAME=${FTP_USERNAME:-$(ask "  Benutzername" "")}
FTP_PASSWORD=$(ask_secret "  Passwort")
echo
echo "2/2 Datenbank (KAS > Datenbank)"
DB_HOST=${DB_HOST:-$(ask "  Host" "localhost")}
DB_NAME=${DB_NAME:-$(ask "  Datenbank" "")}
DB_USER=${DB_USER:-$(ask "  Login" "$DB_NAME")}
DB_PASSWORD=$(ask_secret "  Passwort")

echo
echo "Erzeuge Schlüssel …"
EDIT_KEY=$(random_key)
VIEW_KEY=$(random_key)

echo "Speichere Secrets in GitHub …"
put FTP_SERVER "$FTP_SERVER"
put FTP_USERNAME "$FTP_USERNAME"
put FTP_PASSWORD "$FTP_PASSWORD"
put DB_HOST "$DB_HOST"
put DB_NAME "$DB_NAME"
put DB_USER "$DB_USER"
put DB_PASSWORD "$DB_PASSWORD"
put EDIT_KEY_SHA256 "$(sha256 "$EDIT_KEY")"
put VIEW_KEY_SHA256 "$(sha256 "$VIEW_KEY")"

cat <<EOF

Fertig. Diese Werte jetzt in den Passwort-Manager übernehmen – sie werden nirgends gespeichert:

  Bearbeiten-Schlüssel:  $EDIT_KEY
  Lese-Schlüssel:        $VIEW_KEY

Links für die Familie:
  Eltern (bearbeiten):        $SITE_URL/#key=$EDIT_KEY
  Großeltern (nur ansehen):   $SITE_URL/#key=$VIEW_KEY

Danach dieses Terminal leeren (Cmd+K).
EOF
