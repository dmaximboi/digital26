-- Private-table RLS for Neon / Postgres.
-- Public verify APIs only read agreements_public / certificates_public (no RLS force needed there for app owner).
-- Prisma uses the DB owner role; policies allow that role. Anonymous roles get nothing.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'people',
    'agreements',
    'certificates',
    'admin_audit_log',
    'email_otps',
    'admin_allowlist',
    'contact_messages',
    'site_visits',
    'evidence_images',
    'id_sequences'
  ]
  LOOP
    EXECUTE format('ALTER TABLE IF EXISTS %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE IF EXISTS %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS app_owner_all ON %I', t);
    EXECUTE format(
      'CREATE POLICY app_owner_all ON %I FOR ALL TO CURRENT_USER USING (true) WITH CHECK (true)',
      t
    );
    EXECUTE format('REVOKE ALL ON TABLE %I FROM PUBLIC', t);
  END LOOP;
END $$;

-- Public mirror tables: still RLS-enabled; app owner can read/write. No PUBLIC grants.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['agreements_public', 'certificates_public']
  LOOP
    EXECUTE format('ALTER TABLE IF EXISTS %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS app_owner_all ON %I', t);
    EXECUTE format(
      'CREATE POLICY app_owner_all ON %I FOR ALL TO CURRENT_USER USING (true) WITH CHECK (true)',
      t
    );
    EXECUTE format('REVOKE ALL ON TABLE %I FROM PUBLIC', t);
  END LOOP;
END $$;
