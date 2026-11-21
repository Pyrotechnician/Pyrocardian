#!/usr/bin/env bash
# 无 root 在 Ubuntu 上安装 Node.js（用户态，解压到 ~/.local）
# 用法: bash scripts/setup-node.sh   （之后把输出的 export PATH 加进 ~/.bashrc）
set -euo pipefail

NODE_VERSION="${NODE_VERSION:-v22.12.0}"

if command -v node >/dev/null 2>&1; then
  echo "node already installed: $(node -v)"
  exit 0
fi

ARCH="x64"
case "$(uname -m)" in
  aarch64|arm64) ARCH="arm64" ;;
esac

DIR="$HOME/.local/node-$NODE_VERSION"
if [ ! -x "$DIR/bin/node" ]; then
  echo "downloading node $NODE_VERSION linux-$ARCH ..."
  mkdir -p "$HOME/.local"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "https://nodejs.org/dist/$NODE_VERSION/node-$NODE_VERSION-linux-$ARCH.tar.xz" -o /tmp/node.tar.xz
  else
    wget -q "https://nodejs.org/dist/$NODE_VERSION/node-$NODE_VERSION-linux-$ARCH.tar.xz" -O /tmp/node.tar.xz
  fi
  tar -xJf /tmp/node.tar.xz -C "$HOME/.local"
  rm -f /tmp/node.tar.xz
fi

export PATH="$DIR/bin:$PATH"
echo "node: $(node -v), npm: $(npm -v)"
echo
echo "Add this line to your ~/.bashrc so it persists:"
echo "  export PATH=\"$DIR/bin:\$PATH\""
