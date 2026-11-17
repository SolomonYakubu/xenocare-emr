-- =============================================================================
-- SEED ADMIN & STAFF USERS
-- =============================================================================
-- This script seeds demo users into auth.users, auth.identities, and staff tables.
-- Password for all users: Demo@123
--
-- IMPORTANT: Run this in the Supabase Dashboard SQL Editor with superuser privileges.
-- =============================================================================

-- Step 1: Clean up any existing users with these emails first
DELETE FROM auth.identities WHERE user_id IN (SELECT id FROM auth.users WHERE email IN ('superadmin@ndchospital.com', 'admin@ndchospital.com', 'director@ndchospital.com', 'doctor@ndchospital.com', 'nurse@ndchospital.com', 'lab@ndchospital.com', 'radiology@ndchospital.com', 'pharmacy@ndchospital.com', 'billing@ndchospital.com', 'reception@ndchospital.com'));
DELETE FROM auth.users WHERE email IN ('superadmin@ndchospital.com', 'admin@ndchospital.com', 'director@ndchospital.com', 'doctor@ndchospital.com', 'nurse@ndchospital.com', 'lab@ndchospital.com', 'radiology@ndchospital.com', 'pharmacy@ndchospital.com', 'billing@ndchospital.com', 'reception@ndchospital.com');

-- Step 2: Insert auth.users with proper password hashing
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES 
('00000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'superadmin@ndchospital.com', crypt('Demo@123', gen_salt('bf')), now(), '{"provider": "email", "providers": ["email"]}', '{"role": "super_admin", "full_name": "Super Admin"}', now(), now()),
('00000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'admin@ndchospital.com', crypt('Demo@123', gen_salt('bf')), now(), '{"provider": "email", "providers": ["email"]}', '{"role": "admin", "full_name": "System Manager"}', now(), now()),
('00000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'director@ndchospital.com', crypt('Demo@123', gen_salt('bf')), now(), '{"provider": "email", "providers": ["email"]}', '{"role": "medical_director", "full_name": "Medical Director"}', now(), now()),
('00000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'doctor@ndchospital.com', crypt('Demo@123', gen_salt('bf')), now(), '{"provider": "email", "providers": ["email"]}', '{"role": "doctor", "full_name": "Chidi Okonkwo"}', now(), now()),
('00000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'nurse@ndchospital.com', crypt('Demo@123', gen_salt('bf')), now(), '{"provider": "email", "providers": ["email"]}', '{"role": "nurse", "full_name": "Funke Adeyemi"}', now(), now()),
('00000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', 'lab@ndchospital.com', crypt('Demo@123', gen_salt('bf')), now(), '{"provider": "email", "providers": ["email"]}', '{"role": "lab_technician", "full_name": "Musa Ibrahim"}', now(), now()),
('00000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000007', 'authenticated', 'authenticated', 'radiology@ndchospital.com', crypt('Demo@123', gen_salt('bf')), now(), '{"provider": "email", "providers": ["email"]}', '{"role": "radiologist", "full_name": "Emeka Nwosu"}', now(), now()),
('00000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000008', 'authenticated', 'authenticated', 'pharmacy@ndchospital.com', crypt('Demo@123', gen_salt('bf')), now(), '{"provider": "email", "providers": ["email"]}', '{"role": "pharmacist", "full_name": "Aisha Bello"}', now(), now()),
('00000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000009', 'authenticated', 'authenticated', 'billing@ndchospital.com', crypt('Demo@123', gen_salt('bf')), now(), '{"provider": "email", "providers": ["email"]}', '{"role": "billing_clerk", "full_name": "Ngozi Eze"}', now(), now()),
('00000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000010', 'authenticated', 'authenticated', 'reception@ndchospital.com', crypt('Demo@123', gen_salt('bf')), now(), '{"provider": "email", "providers": ["email"]}', '{"role": "receptionist", "full_name": "Fatima Ahmed"}', now(), now());


-- Step 3: Insert auth.identities (using exact VALUES format from working database)
INSERT INTO auth.identities VALUES 
('b0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '{"sub": "b0000000-0000-0000-0000-000000000001", "email": "superadmin@ndchospital.com", "email_verified": false, "phone_verified": false}', 'email', now(), now(), now(), DEFAULT, gen_random_uuid()),
('b0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', '{"sub": "b0000000-0000-0000-0000-000000000002", "email": "admin@ndchospital.com", "email_verified": false, "phone_verified": false}', 'email', now(), now(), now(), DEFAULT, gen_random_uuid()),
('b0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000003', '{"sub": "b0000000-0000-0000-0000-000000000003", "email": "director@ndchospital.com", "email_verified": false, "phone_verified": false}', 'email', now(), now(), now(), DEFAULT, gen_random_uuid()),
('b0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000004', '{"sub": "b0000000-0000-0000-0000-000000000004", "email": "doctor@ndchospital.com", "email_verified": false, "phone_verified": false}', 'email', now(), now(), now(), DEFAULT, gen_random_uuid()),
('b0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000005', '{"sub": "b0000000-0000-0000-0000-000000000005", "email": "nurse@ndchospital.com", "email_verified": false, "phone_verified": false}', 'email', now(), now(), now(), DEFAULT, gen_random_uuid()),
('b0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000006', '{"sub": "b0000000-0000-0000-0000-000000000006", "email": "lab@ndchospital.com", "email_verified": false, "phone_verified": false}', 'email', now(), now(), now(), DEFAULT, gen_random_uuid()),
('b0000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000007', '{"sub": "b0000000-0000-0000-0000-000000000007", "email": "radiology@ndchospital.com", "email_verified": false, "phone_verified": false}', 'email', now(), now(), now(), DEFAULT, gen_random_uuid()),
('b0000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000008', '{"sub": "b0000000-0000-0000-0000-000000000008", "email": "pharmacy@ndchospital.com", "email_verified": false, "phone_verified": false}', 'email', now(), now(), now(), DEFAULT, gen_random_uuid()),
('b0000000-0000-0000-0000-000000000009', 'b0000000-0000-0000-0000-000000000009', '{"sub": "b0000000-0000-0000-0000-000000000009", "email": "billing@ndchospital.com", "email_verified": false, "phone_verified": false}', 'email', now(), now(), now(), DEFAULT, gen_random_uuid()),
('b0000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0000-000000000010', '{"sub": "b0000000-0000-0000-0000-000000000010", "email": "reception@ndchospital.com", "email_verified": false, "phone_verified": false}', 'email', now(), now(), now(), DEFAULT, gen_random_uuid());


-- Step 4: Insert staff records

DO $$
DECLARE
    v_dept_id UUID;
BEGIN
    -- Super Admin
    INSERT INTO staff (staff_id, user_id, first_name, last_name, email, phone, role, department_id, is_active)
    VALUES ('STAFF001', 'b0000000-0000-0000-0000-000000000001', 'Super', 'Admin', 'superadmin@ndchospital.com', '+234-800-000-0001', 'super_admin', NULL, true)
    ON CONFLICT (email) DO UPDATE SET user_id = 'b0000000-0000-0000-0000-000000000001', is_active = true;

    -- Admin
    INSERT INTO staff (staff_id, user_id, first_name, last_name, email, phone, role, department_id, is_active)
    VALUES ('STAFF002', 'b0000000-0000-0000-0000-000000000002', 'System', 'Manager', 'admin@ndchospital.com', '+234-800-000-0002', 'admin', NULL, true)
    ON CONFLICT (email) DO UPDATE SET user_id = 'b0000000-0000-0000-0000-000000000002', is_active = true;

    -- Medical Director
    SELECT id INTO v_dept_id FROM departments WHERE name ILIKE '%Internal Medicine%' OR code = 'DEPT001' LIMIT 1;
    INSERT INTO staff (staff_id, user_id, first_name, last_name, email, phone, role, department_id, is_active)
    VALUES ('STAFF003', 'b0000000-0000-0000-0000-000000000003', 'Medical', 'Director', 'director@ndchospital.com', '+234-800-000-0003', 'medical_director', v_dept_id, true)
    ON CONFLICT (email) DO UPDATE SET user_id = 'b0000000-0000-0000-0000-000000000003', is_active = true;

    -- Doctor
    SELECT id INTO v_dept_id FROM departments WHERE code = 'DEPT001' OR name ILIKE '%GOPD%' OR name ILIKE '%General%' LIMIT 1;
    INSERT INTO staff (staff_id, user_id, first_name, last_name, email, phone, role, department_id, is_active)
    VALUES ('STAFF004', 'b0000000-0000-0000-0000-000000000004', 'Chidi', 'Okonkwo', 'doctor@ndchospital.com', '+234-800-000-0004', 'doctor', v_dept_id, true)
    ON CONFLICT (email) DO UPDATE SET user_id = 'b0000000-0000-0000-0000-000000000004', is_active = true;

    -- Nurse
    SELECT id INTO v_dept_id FROM departments WHERE code = 'DEPT010' OR name ILIKE '%Nursing%' LIMIT 1;
    INSERT INTO staff (staff_id, user_id, first_name, last_name, email, phone, role, department_id, is_active)
    VALUES ('STAFF005', 'b0000000-0000-0000-0000-000000000005', 'Funke', 'Adeyemi', 'nurse@ndchospital.com', '+234-800-000-0005', 'nurse', v_dept_id, true)
    ON CONFLICT (email) DO UPDATE SET user_id = 'b0000000-0000-0000-0000-000000000005', is_active = true;

    -- Lab Technician
    SELECT id INTO v_dept_id FROM departments WHERE code = 'DEPT007' OR name ILIKE '%Lab%' LIMIT 1;
    INSERT INTO staff (staff_id, user_id, first_name, last_name, email, phone, role, department_id, is_active)
    VALUES ('STAFF006', 'b0000000-0000-0000-0000-000000000006', 'Musa', 'Ibrahim', 'lab@ndchospital.com', '+234-800-000-0006', 'lab_technician', v_dept_id, true)
    ON CONFLICT (email) DO UPDATE SET user_id = 'b0000000-0000-0000-0000-000000000006', is_active = true;

    -- Radiologist
    SELECT id INTO v_dept_id FROM departments WHERE code = 'DEPT008' OR name ILIKE '%Radiology%' LIMIT 1;
    INSERT INTO staff (staff_id, user_id, first_name, last_name, email, phone, role, department_id, is_active)
    VALUES ('STAFF007', 'b0000000-0000-0000-0000-000000000007', 'Emeka', 'Nwosu', 'radiology@ndchospital.com', '+234-800-000-0007', 'radiologist', v_dept_id, true)
    ON CONFLICT (email) DO UPDATE SET user_id = 'b0000000-0000-0000-0000-000000000007', is_active = true;

    -- Pharmacist
    SELECT id INTO v_dept_id FROM departments WHERE code = 'DEPT009' OR name ILIKE '%Pharmacy%' LIMIT 1;
    INSERT INTO staff (staff_id, user_id, first_name, last_name, email, phone, role, department_id, is_active)
    VALUES ('STAFF008', 'b0000000-0000-0000-0000-000000000008', 'Aisha', 'Bello', 'pharmacy@ndchospital.com', '+234-800-000-0008', 'pharmacist', v_dept_id, true)
    ON CONFLICT (email) DO UPDATE SET user_id = 'b0000000-0000-0000-0000-000000000008', is_active = true;

    -- Billing Clerk
    SELECT id INTO v_dept_id FROM departments WHERE code = 'DEPT012' OR name ILIKE '%Billing%' OR name ILIKE '%Finance%' LIMIT 1;
    INSERT INTO staff (staff_id, user_id, first_name, last_name, email, phone, role, department_id, is_active)
    VALUES ('STAFF009', 'b0000000-0000-0000-0000-000000000009', 'Ngozi', 'Eze', 'billing@ndchospital.com', '+234-800-000-0009', 'billing_clerk', v_dept_id, true)
    ON CONFLICT (email) DO UPDATE SET user_id = 'b0000000-0000-0000-0000-000000000009', is_active = true;

    -- Receptionist
    SELECT id INTO v_dept_id FROM departments WHERE code = 'DEPT011' OR name ILIKE '%Medical Records%' OR name ILIKE '%Reception%' LIMIT 1;
    INSERT INTO staff (staff_id, user_id, first_name, last_name, email, phone, role, department_id, is_active)
    VALUES ('STAFF010', 'b0000000-0000-0000-0000-000000000010', 'Fatima', 'Ahmed', 'reception@ndchospital.com', '+234-800-000-0010', 'receptionist', v_dept_id, true)
    ON CONFLICT (email) DO UPDATE SET user_id = 'b0000000-0000-0000-0000-000000000010', is_active = true;

    RAISE NOTICE 'Successfully seeded all staff records!';
END $$;

-- ---------------------------------------------------------------------------
-- Local Docker compatibility fixes
-- ---------------------------------------------------------------------------
-- GoTrue scans token columns into strings; NULL breaks login with
-- "Database error querying schema".
UPDATE auth.users
SET confirmation_token = COALESCE(confirmation_token, ''),
    recovery_token = COALESCE(recovery_token, ''),
    email_change_token_new = COALESCE(email_change_token_new, ''),
    email_change = COALESCE(email_change, ''),
    email_change_token_current = COALESCE(email_change_token_current, ''),
    reauthentication_token = COALESCE(reauthentication_token, ''),
    phone_change = COALESCE(phone_change, ''),
    phone_change_token = COALESCE(phone_change_token, '')
WHERE email IN (
  'superadmin@ndchospital.com','admin@ndchospital.com','director@ndchospital.com',
  'doctor@ndchospital.com','nurse@ndchospital.com','lab@ndchospital.com',
  'radiology@ndchospital.com','pharmacy@ndchospital.com','billing@ndchospital.com',
  'reception@ndchospital.com'
);

-- The app's access checks read staff.department (text) as well as department_id.
UPDATE staff SET department = 'Administration', department_id = (SELECT id FROM departments WHERE code='ADMIN' LIMIT 1)
  WHERE role IN ('super_admin','admin','medical_director','config_admin','customer_service','inventory_manager');
UPDATE staff SET department = 'GOPD', department_id = (SELECT id FROM departments WHERE code='GOPD' LIMIT 1)
  WHERE role='doctor';
UPDATE staff SET department = 'Nursing', department_id = (SELECT id FROM departments WHERE code='NURS' LIMIT 1)
  WHERE role='nurse';
UPDATE staff SET department = 'Laboratory', department_id = (SELECT id FROM departments WHERE code='LAB' LIMIT 1)
  WHERE role='lab_technician';
UPDATE staff SET department = 'Radiology', department_id = (SELECT id FROM departments WHERE code='RAD' LIMIT 1)
  WHERE role='radiologist';
UPDATE staff SET department = 'Pharmacy', department_id = (SELECT id FROM departments WHERE code='PHARM' LIMIT 1)
  WHERE role='pharmacist';
UPDATE staff SET department = 'Billing', department_id = (SELECT id FROM departments WHERE code='ADMIN' LIMIT 1)
  WHERE role IN ('billing_clerk','cashier');
UPDATE staff SET department = 'Reception', department_id = (SELECT id FROM departments WHERE code='ADMIN' LIMIT 1)
  WHERE role='receptionist';

NOTIFY pgrst, 'reload schema';

-- Facility scoping: RLS on visits/encounters requires staff.facility_id.
UPDATE staff
SET facility_id = (SELECT id FROM facilities WHERE code = 'MHC' LIMIT 1)
WHERE facility_id IS NULL;
