"""Two competing PostgreSQL sessions against the loopback-only AOUN CI fixture."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
import time
import uuid

import psycopg


@contextmanager
def session(port):
    with psycopg.connect(
        host="127.0.0.1", hostaddr="127.0.0.1", port=port, dbname="aoun_ci",
        user="postgres", sslmode="disable", autocommit=True, connect_timeout=3,
    ) as connection:
        marker = connection.execute("""
            select inet_server_addr() = '127.0.0.1'::inet
               and to_regprocedure('storage.aoun_review_photo_ci_fixture()') is not null
        """).fetchone()
        if marker != (True,):
            raise RuntimeError("Refusing to run outside the disposable loopback AOUN CI fixture")
        yield connection


def begin_mutation(connection, owner, isolation, *, worker=False):
    connection.execute(f"begin isolation level {isolation}")
    connection.execute("set local lock_timeout = '8s'")
    connection.execute("set local statement_timeout = '10s'")
    connection.execute("set local role service_role" if worker else "set local role authenticated")
    connection.execute("select set_config('request.jwt.claim.sub', %s, true)", (owner,))
    connection.execute("set local storage.test_operation = 'storage.object.delete_many'")


def wait_until_blocked(winner, waiter_pid):
    deadline = time.monotonic() + 5
    while time.monotonic() < deadline:
        blocked = winner.execute(
            "select pg_backend_pid() = any(pg_blocking_pids(%s))", (waiter_pid,),
        ).fetchone()
        if blocked == (True,):
            return
        time.sleep(0.025)
    raise AssertionError("The losing session did not wait on the winning transaction")


def expect_sqlstate(future, expected):
    try:
        future.result(timeout=12)
    except psycopg.Error as error:
        if error.sqlstate == expected:
            return
        raise
    raise AssertionError(f"The losing mutation unexpectedly succeeded (expected {expected})")


def verify_race(port, isolation, attach_first, cleanup_worker):
    owner = str(uuid.uuid4())
    with session(port) as setup:
        try:
            setup.execute("insert into auth.users(id,raw_user_meta_data) values (%s,'{}')", (owner,))
            [rating] = setup.execute("""
                insert into public.ratings(user_id,place_id,score) values (%s,1,4) returning id
            """, (owner,)).fetchone()
            key = f"{rating}/{uuid.uuid4()}.jpg"
            setup.execute("""
                insert into storage.objects(bucket_id,name,owner_id,metadata,created_at)
                values ('review-photos',%s,%s,'{"mimetype":"image/jpeg"}',now()-interval '25 hours')
            """, (key, owner))

            setup.execute(
                "select public.record_review_photo_verification(%s,%s,%s,'fixture-version')",
                (key, rating, owner),
            )

            def attach(connection):
                return connection.execute(
                    "update public.ratings set photo_paths = array[%s] where id = %s", (key, rating),
                )

            def retire(connection):
                if cleanup_worker:
                    return connection.execute("select * from public.claim_review_photo_cleanup(10)")
                return connection.execute("select public.retire_review_photo(%s)", (key,))

            with session(port) as winner, session(port) as waiter, ThreadPoolExecutor(1) as worker:
                waiter_pid = waiter.info.backend_pid
                begin_mutation(winner, owner, "read committed", worker=cleanup_worker and not attach_first)
                begin_mutation(waiter, owner, isolation, worker=cleanup_worker and attach_first)
                # Establish a stale snapshot before the winner touches the registry.
                waiter.execute("select 1 from pg_catalog.pg_class limit 1")
                winning_result = (attach if attach_first else retire)(winner)
                if cleanup_worker and not attach_first:
                    assert winning_result.fetchall() == [(key,)], "Worker failed to retire the orphan"
                losing_write = worker.submit(retire if attach_first else attach, waiter)
                wait_until_blocked(winner, waiter_pid)
                winner.execute("commit")
                if cleanup_worker and attach_first and isolation == "read committed":
                    assert losing_write.result(timeout=12).fetchall() == [], "Worker claimed an attached photo"
                else:
                    expect_sqlstate(losing_write, "23514" if isolation == "read committed" else "40001")
                waiter.execute("rollback")

                begin_mutation(winner, owner, "read committed")
                removed = winner.execute("""
                    delete from storage.objects where bucket_id = 'review-photos' and name = %s
                    returning name
                """, (key,)).fetchall()
                saved_paths = winner.execute(
                    "select photo_paths from public.ratings where id = %s", (rating,),
                ).fetchone()
                if attach_first:
                    assert removed == [] and saved_paths == ([key],), (
                        "Storage removed an attached photo or the winning attachment was lost"
                    )
                else:
                    assert removed == [(key,)] and saved_paths == ([],), (
                        "Storage could not remove the retired photo or a reference remained"
                    )
                winner.execute("commit")
        finally:
            setup.execute("delete from auth.users where id = %s", (owner,))
            setup.execute("delete from public.review_photo_keys where owner_id = %s", (owner,))
            setup.execute("""
                delete from storage.objects where bucket_id = 'review-photos' and owner_id = %s
            """, (owner,))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=5432)
    args = parser.parse_args()
    for isolation in ("read committed", "repeatable read", "serializable"):
        for cleanup_worker in (False, True):
            source = "worker claim" if cleanup_worker else "owner retirement"
            for attach_first in (True, False):
                verify_race(args.port, isolation, attach_first, cleanup_worker)
                winner = "attachment" if attach_first else source
                print(f"PASS: {winner} wins ({source}, waiter at {isolation.upper()})")


if __name__ == "__main__":
    main()
