DELETE FROM bed_transfers;
UPDATE admissions SET current_bed_id = NULL, current_ward_id = NULL;
DELETE FROM beds;
INSERT INTO beds (ward_id, bed_number, bed_type, status, daily_rate, is_active)
SELECT w.id, 'Bed ' || g, 'standard', 'Available', 0, true
FROM (
  SELECT id FROM wards
  WHERE facility_id = (SELECT id FROM facilities WHERE code = 'MHC' LIMIT 1)
  ORDER BY name LIMIT 1
) w, generate_series(1, 20) g;
