#!/usr/bin/env bash
# Upload a proof image to the proof-assets branch and print Markdown for a PR comment.
# Usage: scripts/publish-proof.sh <pr-number> <image-file>
# The repo is public, so these images are public and stay in its history. Check them first.
set -euo pipefail

if [ "$#" -ne 2 ] || [ ! -f "$2" ]; then
	echo "Usage: $0 <pr-number> <image-file>" >&2
	exit 1
fi

pr="$1"
file="$2"
case "$file" in
*.png | *.jpg | *.jpeg | *.gif | *.webp) ;;
*)
	echo "Only images are allowed: $file" >&2
	exit 1
	;;
esac

repo="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"
name="$(date +%Y%m%d-%H%M%S)-$(basename "$file")"
path="proofs/pr-$pr/$name"
payload="$(mktemp)"
trap 'rm -f "$payload"' EXIT
printf '{"message":"Add proof for PR #%s","branch":"proof-assets","content":"%s"}' \
	"$pr" "$(base64 <"$file" | tr -d '\n')" >"$payload"

gh api --method PUT "repos/$repo/contents/$path" --input "$payload" --silent
echo "![$(basename "$file")](https://github.com/$repo/raw/proof-assets/$path)"
