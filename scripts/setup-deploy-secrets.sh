#!/usr/bin/env bash
# Guided setup of the GitHub environment secrets for the deploy workflow (docs/deploy.md, sections 2 + 3).
# Asks for the FTP and database values and for the invite word (or makes one up), and stores
# everything with `gh secret set --env production`. Only the SHA-256 of the invite word goes to
# GitHub. Plan keys are not part of this: each plan gets its own keys in the app. Nothing is
# written to disk.
#
# Usage: [FTP_SERVER=… FTP_USERNAME=… DB_HOST=… DB_NAME=… DB_USER=…] scripts/setup-deploy-secrets.sh [owner/repo]
# Values given as environment variables are not asked for; passwords always are.
set -euo pipefail

REPO="${1:-$(gh repo view --json nameWithOwner -q .nameWithOwner)}"
ENV_NAME=production
SITE_URL=https://vacation.ingsparks.de
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
random_word() { # 12 characters without look-alikes (no l, o, 0, 1), written like abcd-efgh-jkmn
  local raw
  raw=$(openssl rand -base64 96 | tr -dc 'a-km-np-z2-9')
  printf '%s-%s-%s' "${raw:0:4}" "${raw:4:4}" "${raw:8:4}"
}
sha256() { printf '%s' "$1" | shasum -a 256 | cut -d' ' -f1; }
put() { printf '%s' "$2" | gh secret set "$1" --env "$ENV_NAME" --repo "$REPO" >/dev/null && echo "  ✓ $1"; }

echo "Secrets für $REPO (Environment: $ENV_NAME)"
echo
echo "1/3 FTP (KAS > FTP-Nutzer)"
FTP_SERVER=${FTP_SERVER:-$(ask "  Servername" "")}
FTP_USERNAME=${FTP_USERNAME:-$(ask "  Benutzername" "")}
FTP_PASSWORD=$(ask_secret "  Passwort")
echo
echo "2/3 Datenbank (KAS > Datenbank)"
DB_HOST=${DB_HOST:-$(ask "  Host" "localhost")}
DB_NAME=${DB_NAME:-$(ask "  Datenbank" "")}
DB_USER=${DB_USER:-$(ask "  Login" "$DB_NAME")}
DB_PASSWORD=$(ask_secret "  Passwort")
echo
echo "3/3 Einladungswort (wer es kennt, kann einen eigenen Plan anlegen)"
read -r -s -p "  Einladungswort (Eingabe unsichtbar, leer = eines erzeugen): " INVITE
echo >&2
GENERATED=
if [ -z "$INVITE" ]; then
  INVITE=$(random_word)
  GENERATED=1
fi

echo
echo "Speichere Secrets in GitHub …"
put FTP_SERVER "$FTP_SERVER"
put FTP_USERNAME "$FTP_USERNAME"
put FTP_PASSWORD "$FTP_PASSWORD"
put DB_HOST "$DB_HOST"
put DB_NAME "$DB_NAME"
put DB_USER "$DB_USER"
put DB_PASSWORD "$DB_PASSWORD"
put INVITE_SHA256 "$(sha256 "$INVITE")"

cat <<EOF

Fertig. Das Einladungswort jetzt in den Passwort-Manager übernehmen. In GitHub liegt nur sein Hash${GENERATED:+, und hier wird es nur dieses eine Mal angezeigt}:

  Einladungswort:  $INVITE

Nach dem ersten Deploy:
  1. $SITE_URL öffnen.
  2. „Neuen Plan anlegen“ wählen und das Einladungswort eingeben.
  3. Beide Links (Bearbeiten und Ansehen) im Passwort-Manager speichern.
  4. Den Ansehen-Link an die Familie schicken; das Einladungswort nur persönlich weitergeben.

Danach dieses Terminal leeren (Cmd+K).
EOF
