// The checks drop and recreate the inventory tables, so only accept a database named *_test.
export function testDatabaseUrl() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url)
    throw new Error("Set TEST_DATABASE_URL to a throwaway Postgres database.");
  if (!/_test$/.test(new URL(url).pathname.slice(1)))
    throw new Error(
      "TEST_DATABASE_URL must point at a database whose name ends in _test.",
    );
  return url;
}
