#!/usr/bin/env python3
"""Local-only Telegram user relay for dashboard voice commands."""

from __future__ import annotations

import argparse
import asyncio
import getpass
import json
import os
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from aiohttp import web

try:
    from relay_core import TokenBucket, collect_quiescent, secure_compare
except ImportError:  # imported as relay.relay in tests/tools
    from .relay_core import TokenBucket, collect_quiescent, secure_compare

try:
    from telethon import TelegramClient, events
    from telethon.errors import SessionPasswordNeededError
except ImportError:  # helpers remain importable by unit tests
    TelegramClient = None
    events = None
    SessionPasswordNeededError = Exception


def load_env(path: Path) -> None:
    if not path.exists():
        return
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


@dataclass(frozen=True)
class Settings:
    api_id: int
    api_hash: str
    relay_secret: str
    port: int = 8787
    bot_username: str = "mootsfambot"
    session_path: str = "~/.hermes-relay/tim.session"

    @classmethod
    def from_env(cls) -> "Settings":
        required = ["TG_API_ID", "TG_API_HASH", "RELAY_SECRET"]
        missing = [key for key in required if not os.environ.get(key)]
        if missing:
            raise RuntimeError(f"missing configuration: {', '.join(missing)}")
        return cls(
            api_id=int(os.environ["TG_API_ID"]),
            api_hash=os.environ["TG_API_HASH"],
            relay_secret=os.environ["RELAY_SECRET"],
            port=int(os.environ.get("RELAY_PORT", "8787")),
            bot_username=os.environ.get("BOT_USERNAME", "mootsfambot").lstrip("@"),
            session_path=os.path.expanduser(os.environ.get("SESSION_PATH", "~/.hermes-relay/tim.session")),
        )


class RelayService:
    def __init__(self, settings: Settings, client: Any):
        self.settings = settings
        self.client = client
        self.bot = None
        self.bucket = TokenBucket()
        self.command_lock = asyncio.Lock()

    async def start(self) -> None:
        await self.client.connect()
        if not await self.client.is_user_authorized():
            raise RuntimeError("Telegram session is not authorized; run relay.py --login")
        self.bot = await self.client.get_entity(self.settings.bot_username)

    async def health(self, _request: web.Request) -> web.Response:
        connected = bool(self.client.is_connected() and self.bot is not None)
        return web.json_response({"ok": connected, "connected": connected}, status=200 if connected else 503)

    async def command(self, request: web.Request) -> web.Response:
        if not secure_compare(request.headers.get("X-Relay-Secret", ""), self.settings.relay_secret):
            return web.json_response({"error": "unauthorized"}, status=401)
        try:
            body = await request.json()
        except (json.JSONDecodeError, ValueError):
            return web.json_response({"error": "invalid JSON"}, status=400)
        text = str(body.get("text", "")).strip()
        if not 1 <= len(text) <= 1000:
            return web.json_response({"error": "text must be 1..1000 characters"}, status=400)
        if not self.client.is_connected() or self.bot is None:
            return web.json_response({"error": "Telegram disconnected"}, status=503)
        if not self.bucket.allow():
            return web.json_response({"error": "rate limited"}, status=429)
        if self.command_lock.locked():
            return web.json_response({"error": "another command is in flight"}, status=503)

        started = time.monotonic()
        async with self.command_lock:
            queue: asyncio.Queue[str] = asyncio.Queue()

            async def on_reply(event: Any) -> None:
                await queue.put(event.raw_text or "")

            handler = events.NewMessage(from_users=self.bot)
            self.client.add_event_handler(on_reply, handler)
            try:
                # self.bot is resolved once at startup and cannot be overridden
                # by request data: the relay has exactly one destination.
                await self.client.send_message(self.bot, text)
                replies = await collect_quiescent(queue)
            finally:
                self.client.remove_event_handler(on_reply, handler)

        elapsed_ms = round((time.monotonic() - started) * 1000)
        status = "replied" if replies else "sent"
        audit = {"event": "command", "status": status, "elapsedMs": elapsed_ms, "chars": len(text), "replies": len(replies)}
        print(json.dumps(audit, separators=(",", ":")), flush=True)
        return web.json_response({"status": status, "reply": "\n\n".join(replies) or None, "elapsedMs": elapsed_ms})


async def login(settings: Settings) -> None:
    if TelegramClient is None:
        raise RuntimeError("Telethon is not installed; install relay/requirements.txt")
    client = TelegramClient(settings.session_path, settings.api_id, settings.api_hash)
    await client.connect()
    if not await client.is_user_authorized():
        phone = input("Telegram phone number (international format): ").strip()
        await client.send_code_request(phone)
        code = input("Login code: ").strip()
        try:
            await client.sign_in(phone, code)
        except SessionPasswordNeededError:
            await client.sign_in(password=getpass.getpass("Telegram 2FA password: "))
    await client.disconnect()
    session = Path(settings.session_path)
    if session.exists():
        session.chmod(0o600)
    print(f"authorized; session secured at {session}")


async def serve(settings: Settings) -> None:
    if TelegramClient is None:
        raise RuntimeError("Telethon is not installed; install relay/requirements.txt")
    client = TelegramClient(settings.session_path, settings.api_id, settings.api_hash)
    service = RelayService(settings, client)
    await service.start()
    app = web.Application(client_max_size=16 * 1024)
    app.router.add_get("/healthz", service.health)
    app.router.add_post("/command", service.command)
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "127.0.0.1", settings.port)
    await site.start()
    print(json.dumps({"event": "started", "host": "127.0.0.1", "port": settings.port, "bot": f"@{settings.bot_username}"}), flush=True)
    try:
        await asyncio.Event().wait()
    finally:
        await runner.cleanup()
        await client.disconnect()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--login", action="store_true", help="create/authorize the Telethon user session")
    parser.add_argument("--env", default="~/.hermes-relay/.env")
    args = parser.parse_args()
    load_env(Path(args.env).expanduser())
    settings = Settings.from_env()
    asyncio.run(login(settings) if args.login else serve(settings))


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        pass
    except Exception as exc:
        print(f"relay failed: {exc}", file=sys.stderr)
        raise
