import asyncio
import unittest

try:
    from relay.relay_core import TokenBucket, collect_quiescent, secure_compare
except ModuleNotFoundError:  # deployed flat under ~/.hermes-relay/app
    from relay_core import TokenBucket, collect_quiescent, secure_compare


class RelayCoreTests(unittest.TestCase):
    def test_secure_compare(self):
        self.assertTrue(secure_compare("correct", "correct"))
        self.assertFalse(secure_compare("wrong", "correct"))
        self.assertFalse(secure_compare("", "correct"))

    def test_token_bucket_burst_and_refill(self):
        now = [0.0]
        bucket = TokenBucket(rate_per_minute=6, burst=3, clock=lambda: now[0])
        self.assertEqual([bucket.allow() for _ in range(4)], [True, True, True, False])
        now[0] = 10.0
        self.assertTrue(bucket.allow())
        self.assertFalse(bucket.allow())

    def test_quiescence_collector_joins_progress_messages(self):
        async def scenario():
            queue = asyncio.Queue()
            await queue.put("Working on it…")

            async def later():
                await asyncio.sleep(0.01)
                await queue.put("Done")

            asyncio.create_task(later())
            return await collect_quiescent(queue, quiet_seconds=0.03, cap_seconds=0.2)

        self.assertEqual(asyncio.run(scenario()), ["Working on it…", "Done"])

    def test_quiescence_collector_returns_empty_at_cap(self):
        async def scenario():
            return await collect_quiescent(asyncio.Queue(), quiet_seconds=0.01, cap_seconds=0.02)
        result = asyncio.run(scenario())
        self.assertEqual(result, [])


if __name__ == "__main__":
    unittest.main()
