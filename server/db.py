from contextlib import contextmanager
import time

import psycopg2
from psycopg2 import pool
from psycopg2.extras import RealDictCursor

from config import DB_CONFIG

_pool: pool.ThreadedConnectionPool | None = None

# How long to wait for a connection before giving up (seconds).
_POOL_TIMEOUT = 5.0
# How long to sleep between retries when the pool is exhausted.
_POOL_RETRY_INTERVAL = 0.05


def _get_pool() -> pool.ThreadedConnectionPool:
    global _pool
    if _pool is None or _pool.closed:
        # minconn=2, maxconn=10.
        # A single page-load can fire ~5 parallel API requests; each needs its
        # own connection while in flight. 10 gives comfortable headroom for
        # concurrent warm Lambda invocations without exhausting Supabase's limit.
        _pool = pool.ThreadedConnectionPool(2, 10, **DB_CONFIG)
    return _pool


@contextmanager
def get_cursor(*, commit: bool = False):
    p = _get_pool()

    # psycopg2's ThreadedConnectionPool raises PoolError immediately when all
    # connections are busy. Retry with a short sleep so bursts of parallel
    # requests queue up rather than failing outright.
    conn = None
    deadline = time.monotonic() + _POOL_TIMEOUT
    while conn is None:
        try:
            conn = p.getconn()
        except pool.PoolError:
            if time.monotonic() >= deadline:
                raise
            time.sleep(_POOL_RETRY_INTERVAL)

    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        try:
            yield cur
            if commit:
                conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            cur.close()
    finally:
        p.putconn(conn)
