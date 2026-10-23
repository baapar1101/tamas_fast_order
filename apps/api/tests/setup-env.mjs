// Unit tests do not need real production credentials or a running database.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'postgres://test:test@127.0.0.1:1/tamas_unit_tests';
process.env.APP_SECRET ??= 'tamas-unit-tests-only-not-for-deployment';
