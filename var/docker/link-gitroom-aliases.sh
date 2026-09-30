#!/bin/sh
# Point @gitroom/* at the compiled output for one app.
#
# nest build (tsc) keeps path aliases in the emitted require() calls, and the
# package.json start command runs node with no tsconfig-paths register. Node
# resolves @gitroom/<name>/<rest> from node_modules. The alias maps to
# <library>/src/<rest>, which is exactly the directory layout under dist.
set -eu

target="$1"
root="$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)"
dist="$root/apps/$target/dist"
link_root="$root/node_modules/@gitroom"

if [ ! -d "$dist" ]; then
  echo "missing build output: $dist" >&2
  exit 1
fi

mkdir -p "$link_root"

link() {
  name="$1"
  src="$2"
  if [ -d "$src" ]; then
    ln -sfn "$src" "$link_root/$name"
  fi
}

link nestjs-libraries "$dist/libraries/nestjs-libraries/src"
link helpers "$dist/libraries/helpers/src"
link plugins "$dist/libraries/plugins/src"
link react "$dist/libraries/react-shared-libraries/src"
link backend "$dist/apps/backend/src"
link orchestrator "$dist/apps/orchestrator/src"
link frontend "$dist/apps/frontend/src"
link extension "$dist/apps/extension/src"

echo "linked @gitroom aliases for $target"
