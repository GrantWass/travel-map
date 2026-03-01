from contextlib import contextmanager

import psycopg2
from psycopg2.extras import RealDictCursor

from config import DB_CONFIG


@contextmanager
def get_cursor(*, commit: bool = False):
    conn = psycopg2.connect(**DB_CONFIG)
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
        conn.close()
