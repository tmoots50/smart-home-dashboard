"""Dependency-free security and timing primitives for the Hermes relay."""

import asyncio
import hmac
import time


def secure_compare(received: str, expected: str) -> bool:
    return bool(received and expected) and hmac.compare_digest(received.encode(), expected.encode())


class TokenBucket:
    """Six commands/minute, with at most three immediate commands."""

    def __init__(self, rate_per_minute: float = 6, burst: float = 3, clock=time.monotonic):
        self.rate = rate_per_minute / 60
        self.capacity = burst
        self.tokens = burst
        self.updated = clock()
        self.clock = clock

    def allow(self) -> bool:
        now = self.clock()
        self.tokens = min(self.capacity, self.tokens + (now - self.updated) * self.rate)
        self.updated = now
        if self.tokens < 1:
            return False
        self.tokens -= 1
        return True


async def collect_quiescent(queue: asyncio.Queue, quiet_seconds: float = 2, cap_seconds: float = 20) -> list[str]:
    """Collect bot messages until two seconds of quiet or the overall cap."""
    replies: list[str] = []
    started = time.monotonic()
    while True:
        remaining = cap_seconds - (time.monotonic() - started)
        if remaining <= 0:
            return replies
        timeout = min(remaining, quiet_seconds if replies else remaining)
        try:
            text = await asyncio.wait_for(queue.get(), timeout=timeout)
            if text.strip():
                replies.append(text.strip())
        except asyncio.TimeoutError:
            return replies

