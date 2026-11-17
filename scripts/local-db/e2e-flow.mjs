/**
 * XenoCare — Local Supabase E2E flow
 *
 * Exercises the real backend contracts used by the app:
 *   registration -> encounter -> billing gate -> nursing -> consultation
 *   -> lab -> pharmacy -> radiology -> closure -> medical records
 *   -> messaging/notifications -> specialty/ANC smoke checks.
 *
 * Usage: node scripts/local-db/e2e-flow.mjs
 * Requires the local Supabase stack (`supabase start`) and seeded demo users.
 */
import fs from 'fs';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Env / clients
// ---------------------------------------------------------------------------
const env = Object.fromEntries(
  fs
    .readFileSync(process.env.SB_ENV_FILE || '/tmp/xeno-db/sb.env', 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const i = line.indexOf('=');
      return [line.slice(0, i), line.slice(i + 1).replace(/^"|"$/g, '')];
    }),
);

const URL = env.API_URL;
const ANON = env.ANON_KEY;
const SERVICE = env.SERVICE_ROLE_KEY;

const svc = createClient(URL, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const PASSWORD = 'Demo@123';
const EMAILS = {
  reception: 'reception@ndchospital.com',
  billing: 'billing@ndchospital.com',
  nurse: 'nurse@ndchospital.com',
  doctor: 'doctor@ndchospital.com',
  lab: 'lab@ndchospital.com',
  pharmacy: 'pharmacy@ndchospital.com',
  radiology: 'radiology@ndchospital.com',
  admin: 'admin@ndchospital.com',
};

async function signIn(email) {
  const client = createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password: PASSWORD,
  });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return { client, user: data.user };
}

const results = [];
async function phase(name, fn) {
  process.stdout.write(`\n▶ ${name}\n`);
  try {
    const value = await fn();
    results.push({ name, ok: true, value });
    console.log(`  ✅ ${name}`);
    return value;
  } catch (error) {
    results.push({ name, ok: false, error: error.message });
    console.log(`  ❌ ${name}: ${error.message}`);
    throw error;
  }
}

const now = new Date().toISOString();
const ts = Date.now();
const uniq = (p) => `${p}-${ts}`;

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
const actors = {};
for (const [role, email] of Object.entries(EMAILS)) {
  actors[role] = await signIn(email);
}
console.log(
  'Signed in:',
  Object.entries(actors)
    .map(([r, a]) => `${r}=${a.user.email}`)
    .join(', '),
);

const { data: staffRows, error: staffErr } = await svc
  .from('staff')
  .select('id,staff_id,role,department,user_id,email')
  .in('role', [
    'super_admin',
    'admin',
    'medical_director',
    'doctor',
    'nurse',
    'lab_technician',
    'radiologist',
    'pharmacist',
    'billing_clerk',
    'receptionist',
  ]);
if (staffErr) throw staffErr;
const staffByRole = Object.fromEntries(staffRows.map((s) => [s.role, s]));

const { data: clinicRows, error: clinicErr } = await svc
  .from('clinics')
  .select('id,clinic_id,clinic_name,clinic_code,consultation_fee,department_id')
  .eq('is_active', true)
  .order('clinic_id', { ascending: true });
if (clinicErr) throw new Error(`clinics: ${clinicErr.message}`);
const clinic =
  clinicRows.find((c) => c.clinic_code === 'GOP') ||
  clinicRows.find((c) => /general out/i.test(c.clinic_name)) ||
  clinicRows[0];
if (!clinic) throw new Error('no active clinic found');

const { data: labTest, error: labTestErr } = await svc
  .from('lab_test_catalogue')
  .select('id,name,code,price')
  .not('price', 'is', null)
  .order('price', { ascending: true })
  .limit(1)
  .maybeSingle();
if (labTestErr || !labTest) throw new Error('lab catalogue empty');

const { data: drug, error: drugErr } = await svc
  .from('drug_catalogue')
  .select('id,name,code,selling_price,stock_quantity')
  .gt('stock_quantity', 0)
  .order('stock_quantity', { ascending: false })
  .limit(1)
  .maybeSingle();
if (drugErr || !drug) throw new Error('drug catalogue has no in-stock drug');

const { data: imaging, error: imagingErr } = await svc
  .from('imaging_catalogue')
  .select('id,name,code,price,modality')
  .not('price', 'is', null)
  .order('price', { ascending: true })
  .limit(1)
  .maybeSingle();
if (imagingErr || !imaging) throw new Error('imaging catalogue empty');

console.log('Fixtures:', {
  clinic: clinic.clinic_name,
  lab: labTest.name,
  drug: drug.name,
  imaging: imaging.name,
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function createOrder(client, {
  orderNumber,
  patientId,
  visitId,
  sourceModule,
  itemType,
  itemName,
  amount,
  serviceReferenceId,
  serviceCode,
}) {
  const { data: order, error } = await client
    .from('billing_orders')
    .insert({
      order_number: orderNumber,
      patient_id: patientId,
      visit_id: visitId,
      encounter_id: visitId,
      source_module: sourceModule,
      total_amount: amount,
      net_amount: amount,
      balance_amount: amount,
      paid_amount: 0,
      nhis_covered: false,
      nhis_percentage: 0,
      nhis_payable: 0,
      patient_payable: amount,
      status: 'Pending',
    })
    .select('*')
    .single();
  if (error) throw new Error(`order ${orderNumber}: ${error.message}`);

  const { error: itemErr } = await client.from('billing_items').insert({
    billing_order_id: order.id,
    item_type: itemType,
    item_id: serviceReferenceId || visitId,
    service_reference_id: serviceReferenceId || null,
    item_name: itemName,
    service_name: itemName,
    quantity: 1,
    unit_price: amount,
    unit_cost: amount,
    gross_amount: amount,
    total_price: amount,
    patient_payable: amount,
    status: 'Unpaid',
  });
  if (itemErr) throw new Error(`order item ${orderNumber}: ${itemErr.message}`);
  return order;
}

async function verifyOrder(billingId, key, staffId) {
  const { data, error } = await actors.billing.client.rpc('verify_payment_and_route', {
    p_billing_id: billingId,
    p_payment_method: 'Cash',
    p_idempotency_key: key,
    p_verified_by_staff_id: staffId,
  });
  if (error) throw new Error(`verify RPC: ${error.message}`);
  if (!data?.success) throw new Error(`verify RPC failed: ${JSON.stringify(data)}`);
  return data;
}

async function queueTicket(client, { patientId, visitId, dept, notes }) {
  const { data, error } = await client.rpc('create_queue_ticket', {
    p_dept: dept,
    p_patient_id: patientId,
    p_visit_id: visitId,
    p_encounter_id: visitId,
    p_clinic_id: clinic.id,
    p_priority: 'Normal',
    p_notes: notes || null,
  });
  if (error) throw new Error(`queue ticket ${dept}: ${error.message}`);
  if (!data?.success) throw new Error(`queue ticket ${dept} failed: ${JSON.stringify(data)}`);
  return data;
}

async function activeQueue(patientId, dept) {
  const { data, error } = await svc
    .from('queue')
    .select('*')
    .eq('encounter_id', visitId)
    .eq('location', dept)
    .in('status', ['Waiting', 'Called', 'In Progress', 'Ready_For_Consultation'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

let patient;
let visit;
let visitId;
let consultOrder;
let labRequest;
let prescription;
let radiologyRequest;
const orders = {};

// ---------------------------------------------------------------------------
// 1. Registration + encounter + consultation fee + billing queue
// ---------------------------------------------------------------------------
await phase('1. Registration + encounter + billing queue', async () => {
  const emrNumber = `MHC-E2E-${ts}`;
  const { data: p, error: pErr } = await actors.reception.client
    .from('patients')
    .insert({
      first_name: 'E2E',
      middle_name: 'Flow',
      surname: `Patient${ts}`,
      gender: 'Male',
      date_of_birth: '1990-01-01',
      contact_phone: '08030000000',
      patient_type: 'Principal',
      emr_number: emrNumber,
      patient_category: 'Civilian',
    })
    .select('*')
    .single();
  if (pErr) throw new Error(`patient insert: ${pErr.message}`);
  patient = p;

  const { data: v, error: vErr } = await actors.reception.client
    .from('visits')
    .insert({
      patient_id: patient.id,
      clinic_id: clinic.id,
      visit_type: 'New Visit',
      payment_category: 'Cash',
      priority: 'Normal',
      status: 'Active',
      current_stage: 'registration',
      chief_complaint: 'Fever and headache',
    })
    .select('*')
    .single();
  if (vErr) throw new Error(`visit insert: ${vErr.message}`);
  visit = v;
  visitId = v.id;

  assert.ok(visit.visit_id?.startsWith('VIS-'), 'visit_id generated');
  assert.ok(visit.encounter_number?.startsWith('ENC-'), 'encounter_number generated');
  assert.ok(visit.facility_id, 'facility_id auto-filled');

  consultOrder = await createOrder(actors.reception.client, {
    orderNumber: uniq('E2E-CONS'),
    patientId: patient.id,
    visitId: visit.id,
    sourceModule: 'consultation',
    itemType: 'Consultation',
    itemName: 'E2E Consultation Fee',
    amount: Number(clinic.consultation_fee || 5000),
    serviceReferenceId: visit.id,
  });
  orders.consultation = consultOrder;

  await queueTicket(actors.reception.client, {
    patientId: patient.id,
    visitId: visit.id,
    dept: 'Billing',
    notes: 'New encounter - awaiting payment verification',
  });

  const q = await activeQueue(patient.id, 'Billing');
  assert.equal(q?.status, 'Waiting');
  return { patientId: patient.patient_id, visitId: visit.visit_id };
});

// ---------------------------------------------------------------------------
// 2. Billing gate -> receipt -> auto-route to Nursing
// ---------------------------------------------------------------------------
await phase('2. Billing verification + auto-route to Nursing', async () => {
  const res = await verifyOrder(
    consultOrder.id,
    uniq('E2E-PAY-CONS'),
    staffByRole.billing_clerk.staff_id,
  );

  const { data: order } = await svc
    .from('billing_orders')
    .select('*')
    .eq('id', consultOrder.id)
    .single();
  assert.equal(order.status, 'Paid');
  assert.ok(Number(order.paid_amount) >= Number(order.net_amount));

  const { data: receipt, error: rErr } = await svc
    .from('receipts')
    .select('*')
    .eq('billing_order_id', consultOrder.id)
    .maybeSingle();
  if (rErr) throw rErr;
  assert.ok(receipt?.receipt_number, 'receipt created');
  orders.consultation = order;
  orders.consultationReceipt = receipt;

  const q = await activeQueue(patient.id, 'Nursing');
  assert.ok(q, `nursing queue created (rpc=${JSON.stringify(res)})`);
  assert.ok(['Waiting', 'Called'].includes(q.status));

  const { data: v } = await svc.from('visits').select('current_stage').eq('id', visitId).single();
  assert.ok(['queue_waiting', 'nursing_vitals'].includes(v.current_stage), `stage ${v.current_stage}`);
  return { receipt: receipt.receipt_number, nursingTicket: q.ticket_number };
});

// ---------------------------------------------------------------------------
// 3. Nursing: triage + vitals -> Consultation
// ---------------------------------------------------------------------------
await phase('3. Nursing triage + vitals -> Consultation queue', async () => {
  const nurseId = staffByRole.nurse.id;
  const { error: vitErr } = await actors.nurse.client.from('vitals').insert({
    encounter_id: visitId,
    patient_id: patient.id,
    temperature: 38.2,
    blood_pressure: '120/80',
    blood_pressure_systolic: 120,
    blood_pressure_diastolic: 80,
    pulse: 88,
    respiratory_rate: 18,
    oxygen_saturation: 98,
    weight: 70,
    height: 175,
    bmi: 22.9,
    nurse_id: nurseId,
    notes: 'E2E vitals',
  });
  if (vitErr) throw new Error(`vitals: ${vitErr.message}`);

  const { error: triErr } = await actors.nurse.client.from('triage_assessments').insert({
    visit_id: visitId,
    patient_id: patient.id,
    temperature: 38.2,
    pulse_rate: 88,
    respiratory_rate: 18,
    blood_pressure_systolic: 120,
    blood_pressure_diastolic: 80,
    oxygen_saturation: 98,
    weight: 70,
    height: 175,
    chief_complaint_text: 'Fever and headache',
    triage_level: 3,
    triage_color: 'Green',
    status: 'Completed',
    triaged_by: nurseId,
  });
  if (triErr) throw new Error(`triage: ${triErr.message}`);

  const nursingQueue = await activeQueue(patient.id, 'Nursing');
  const { error: qErr } = await actors.nurse.client
    .from('queue')
    .update({ status: 'Completed', completed_at: now })
    .eq('id', nursingQueue.id);
  if (qErr) throw new Error(`nursing queue complete: ${qErr.message}`);

  await queueTicket(actors.nurse.client, {
    patientId: patient.id,
    visitId,
    dept: 'Consultation',
    notes: 'Triage complete - ready for doctor',
  });

  const doctorQueue = await activeQueue(patient.id, 'Consultation');
  assert.ok(doctorQueue, 'consultation queue created');

  const { error: stageErr } = await actors.nurse.client
    .from('visits')
    .update({ current_stage: 'consultation' })
    .eq('id', visitId);
  if (stageErr) throw new Error(`stage: ${stageErr.message}`);
  return { doctorTicket: doctorQueue.ticket_number };
});

// ---------------------------------------------------------------------------
// 4. Doctor consultation + CPOE orders
// ---------------------------------------------------------------------------
await phase('4. Consultation + lab/pharmacy/radiology orders', async () => {
  const doctorId = staffByRole.doctor.staff_id;
  const { data: consult, error: cErr } = await actors.doctor.client
    .from('consultations')
    .insert({
      encounter_id: visitId,
      patient_id: patient.patient_id,
      visit_id: visit.visit_id,
      doctor_id: doctorId,
      clinic_id: clinic.clinic_id,
      complaints: 'Fever, headache, body aches',
      history_of_present_illness: 'Gradual onset, no vomiting',
      examination_findings: 'Febrile, no rash',
      assessment: 'Malaria',
      diagnosis: ['Malaria'],
      diagnosis_text: 'Malaria',
      treatment_plan: 'ACT + analgesics, review in 3 days',
      clinical_notes: 'E2E consultation',
      status: 'Completed',
    })
    .select('*')
    .single();
  if (cErr) throw new Error(`consultation: ${cErr.message}`);

  const { error: qErr } = await actors.doctor.client
    .from('queue')
    .update({ status: 'In Progress', started_at: now, assigned_to: staffByRole.doctor.id })
    .eq('encounter_id', visitId)
    .eq('location', 'Consultation');
  if (qErr) throw new Error(`consult queue: ${qErr.message}`);

  const { data: lr, error: lErr } = await actors.doctor.client
    .from('lab_requests')
    .insert({
      encounter_id: visitId,
      patient_id: patient.patient_id,
      test_id: labTest.id,
      ordered_by: doctorId,
      clinical_notes: 'E2E rule-out malaria',
      priority: 'Normal',
      status: 'Pending',
      diagnosis: ['Malaria'],
    })
    .select('*')
    .single();
  if (lErr) throw new Error(`lab request: ${lErr.message}`);
  labRequest = lr;

  const { data: rx, error: rxErr } = await actors.doctor.client
    .from('prescriptions')
    .insert({
      encounter_id: visitId,
      patient_id: patient.patient_id,
      drug_id: drug.id,
      drug_name: drug.name,
      dosage: '500mg',
      frequency: 'BD',
      duration: '5 days',
      route: 'Oral',
      quantity_prescribed: 2,
      doctor_id: doctorId,
      status: 'Pending',
      diagnosis: ['Malaria'],
    })
    .select('*')
    .single();
  if (rxErr) throw new Error(`prescription: ${rxErr.message}`);
  prescription = rx;

  const { data: rr, error: rErr } = await actors.doctor.client
    .from('radiology_requests')
    .insert({
      encounter_id: visitId,
      patient_id: patient.patient_id,
      imaging_id: imaging.id,
      imaging_type: imaging.modality || 'X-Ray',
      body_part: 'Chest',
      clinical_indication: 'Cough and fever',
      ordered_by: doctorId,
      priority: 'Normal',
      status: 'Pending',
    })
    .select('*')
    .single();
  if (rErr) throw new Error(`radiology request: ${rErr.message}`);
  radiologyRequest = rr;

  return {
    consultation: consult.consultation_id,
    lab: labRequest.request_id,
    rx: prescription.prescription_id,
    rad: radiologyRequest.request_id,
  };
});

// ---------------------------------------------------------------------------
// 5. Lab: accept -> charge -> pay -> collect -> result
// ---------------------------------------------------------------------------
await phase('5. Laboratory: accept, charge, pay, result', async () => {
  const staffId = staffByRole.lab_technician.staff_id;
  const staffUuid = staffByRole.lab_technician.id;

  const { error: aErr } = await actors.lab.client
    .from('lab_requests')
    .update({ status: 'Accepted', accepted_by: staffUuid, accepted_at: now })
    .eq('request_id', labRequest.request_id);
  if (aErr) throw new Error(`accept: ${aErr.message}`);

  const order = await createOrder(actors.lab.client, {
    orderNumber: uniq('E2E-LAB'),
    patientId: patient.id,
    visitId,
    sourceModule: 'lab',
    itemType: 'Laboratory',
    itemName: `Lab Test: ${labTest.name}`,
    amount: Number(labTest.price || 1000),
    serviceReferenceId: labRequest.request_id,
    serviceCode: labTest.code,
  });
  orders.lab = order;

  await verifyOrder(order.id, uniq('E2E-PAY-LAB'), staffByRole.billing_clerk.staff_id);

  const { error: sErr } = await actors.lab.client
    .from('lab_requests')
    .update({
      status: 'Sample Collected',
      sample_collected_by: staffUuid,
      sample_collected_at: new Date().toISOString(),
    })
    .eq('request_id', labRequest.request_id);
  if (sErr) throw new Error(`collect: ${sErr.message}`);

  const { error: pErr } = await actors.lab.client
    .from('lab_requests')
    .update({ status: 'In Progress', processing_started_at: new Date().toISOString() })
    .eq('request_id', labRequest.request_id);
  if (pErr) throw new Error(`process: ${pErr.message}`);

  const { error: resErr } = await svc.from('lab_results').insert({
    request_id: labRequest.request_id,
    test_id: labTest.id,
    patient_id: patient.id,
    result_value: 'Negative',
    unit: '',
    reference_range: 'Negative',
    is_abnormal: false,
    technician_id: staffUuid,
    workflow_status: 'Completed',
    interpretation: 'No malaria parasites seen',
  });
  if (resErr) throw new Error(`lab result: ${resErr.message}`);

  const { error: cErr } = await actors.lab.client
    .from('lab_requests')
    .update({
      status: 'Completed',
      result: { value: 'Negative' },
      result_value: 0,
      result_unit: '',
      result_status: 'Normal',
      reference_range: 'Negative',
      interpretation: 'No malaria parasites seen',
      result_entered_by: staffUuid,
      result_entered_at: new Date().toISOString(),
      result_date: new Date().toISOString(),
    })
    .eq('request_id', labRequest.request_id);
  if (cErr) throw new Error(`complete lab: ${cErr.message}`);

  const { data: final } = await svc
    .from('lab_requests')
    .select('status')
    .eq('request_id', labRequest.request_id)
    .single();
  assert.equal(final.status, 'Completed');
  return { labOrder: order.order_number };
});

// ---------------------------------------------------------------------------
// 6. Pharmacy: accept -> charge -> pay -> dispense
// ---------------------------------------------------------------------------
await phase('6. Pharmacy: accept, charge, pay, dispense', async () => {
  const staffUuid = staffByRole.pharmacist.id;
  const staffId = staffByRole.pharmacist.staff_id;

  const { error: aErr } = await actors.pharmacy.client
    .from('prescriptions')
    .update({ status: 'Accepted', verified_by: staffUuid, verified_at: now })
    .eq('prescription_id', prescription.prescription_id);
  if (aErr) throw new Error(`accept rx: ${aErr.message}`);

  const order = await createOrder(actors.pharmacy.client, {
    orderNumber: uniq('E2E-RX'),
    patientId: patient.id,
    visitId,
    sourceModule: 'pharmacy',
    itemType: 'Pharmacy',
    itemName: `Medication: ${drug.name} (Qty: 2)`,
    amount: Number(drug.selling_price || 500) * 2,
    serviceReferenceId: prescription.prescription_id,
    serviceCode: drug.code,
  });
  orders.pharmacy = order;

  await verifyOrder(order.id, uniq('E2E-PAY-RX'), staffByRole.billing_clerk.staff_id);

  const { error: dErr } = await actors.pharmacy.client
    .from('prescriptions')
    .update({
      status: 'Dispensed',
      quantity_dispensed: 2,
      dispensed_by: staffUuid,
      dispensed_at: new Date().toISOString(),
      allergy_checked: true,
      drug_interaction_checked: true,
    })
    .eq('prescription_id', prescription.prescription_id);
  if (dErr) throw new Error(`dispense rx: ${dErr.message}`);

  const { data: dispense, error: dispErr } = await actors.pharmacy.client
    .from('dispenses')
    .insert({
      prescription_id: prescription.prescription_id,
      patient_id: patient.id,
      pharmacist_id: staffUuid,
      status: 'Dispensed',
      notes: 'E2E dispense',
    })
    .select('*')
    .single();
  if (dispErr) throw new Error(`dispense record: ${dispErr.message}`);

  const { error: itemErr } = await actors.pharmacy.client.from('dispense_items').insert({
    dispense_id: dispense.id,
    drug_id: drug.id,
    quantity_dispensed: 2,
  });
  if (itemErr) throw new Error(`dispense item: ${itemErr.message}`);

  const { data: final } = await svc
    .from('prescriptions')
    .select('status,quantity_dispensed')
    .eq('prescription_id', prescription.prescription_id)
    .single();
  assert.equal(final.status, 'Dispensed');
  assert.equal(final.quantity_dispensed, 2);
  return { rxOrder: order.order_number, dispenseId: dispense.id };
});

// ---------------------------------------------------------------------------
// 7. External radiology: accept/charge -> record external result (text + image)
// ---------------------------------------------------------------------------
await phase('7. External radiology result (text + image)', async () => {
  const staffUuid = staffByRole.radiologist.id;
  const staffId = staffByRole.radiologist.staff_id;

  const { error: aErr } = await actors.radiology.client
    .from('radiology_requests')
    .update({ status: 'Accepted', accepted_by: staffUuid, accepted_at: now })
    .eq('request_id', radiologyRequest.request_id);
  if (aErr) throw new Error(`accept imaging: ${aErr.message}`);

  const order = await createOrder(actors.radiology.client, {
    orderNumber: uniq('E2E-RAD'),
    patientId: patient.id,
    visitId,
    sourceModule: 'radiology',
    itemType: 'Radiology',
    itemName: `Imaging: ${imaging.name}`,
    amount: Number(imaging.price || 8000),
    serviceReferenceId: radiologyRequest.request_id,
    serviceCode: imaging.code,
  });
  orders.radiology = order;
  await verifyOrder(order.id, uniq('E2E-PAY-RAD'), staffByRole.billing_clerk.staff_id);

  // Upload a tiny 1x1 PNG as the returned external image.
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=',
    'base64',
  );
  const imagePath = `e2e/${radiologyRequest.request_id}/external-result.png`;
  const { error: uploadError } = await svc.storage
    .from('radiology-images')
    .upload(imagePath, png, { contentType: 'image/png', upsert: true });
  if (uploadError) throw new Error(`radiology image: ${uploadError.message}`);
  const { data: publicUrlData } = svc.storage
    .from('radiology-images')
    .getPublicUrl(imagePath);
  const imageUrl = publicUrlData.publicUrl;

  const { error: repErr } = await actors.radiology.client
    .from('radiology_requests')
    .update({
      status: 'Final Report',
      findings: 'No acute fracture or dislocation.',
      impression: 'Normal study.',
      report: 'External report: No acute fracture or dislocation. Normal study.',
      result_file_url: imageUrl,
      performed_at: new Date().toISOString(),
      performed_by: staffId,
      report_uploaded_at: new Date().toISOString(),
      report_uploaded_by: staffUuid,
    })
    .eq('request_id', radiologyRequest.request_id);
  if (repErr) throw new Error(`external report: ${repErr.message}`);



  const { data: final } = await svc
    .from('radiology_requests')
    .select('status,report,result_file_url')
    .eq('request_id', radiologyRequest.request_id)
    .single();
  assert.equal(final.status, 'Final Report');
  assert.ok(final.report.includes('External report'));
  assert.ok(final.result_file_url?.includes('radiology-images'));

  // Leave one pending external study for the UI sweep to complete.
  const { error: pendingErr } = await actors.doctor.client
    .from('radiology_requests')
    .insert({
      encounter_id: visitId,
      patient_id: patient.patient_id,
      imaging_id: imaging.id,
      imaging_type: imaging.modality || 'X-Ray',
      body_part: 'Left knee',
      clinical_indication: 'E2E UI pending result',
      ordered_by: staffByRole.doctor.staff_id,
      priority: 'Normal',
      status: 'Pending',
    });
  if (pendingErr) throw new Error(`pending radiology: ${pendingErr.message}`);

  return { radOrder: order.order_number, imageUrl };
});

// ---------------------------------------------------------------------------
// 8. Closure + medical records + audit
// ---------------------------------------------------------------------------
await phase('8. Encounter closure + medical records', async () => {
  const { error: qErr } = await actors.doctor.client
    .from('queue')
    .update({ status: 'Completed', completed_at: new Date().toISOString() })
    .eq('encounter_id', visitId)
    .in('status', ['In Progress', 'Waiting', 'Called']);
  if (qErr) throw new Error(`queue close: ${qErr.message}`);

  const { error: vErr } = await actors.doctor.client
    .from('visits')
    .update({
      status: 'Completed',
      current_stage: 'completed',
      end_time: new Date().toISOString(),
    })
    .eq('id', visitId);
  if (vErr) throw new Error(`visit close: ${vErr.message}`);

  const { data: finalVisit } = await svc
    .from('visits')
    .select('status,current_stage')
    .eq('id', visitId)
    .single();
  assert.equal(finalVisit.status, 'Completed');
  assert.equal(finalVisit.current_stage, 'completed');

  const { data: paidOrders } = await svc
    .from('billing_orders')
    .select('id,status,source_module,net_amount')
    .eq('encounter_id', visitId);
  const unpaid = (paidOrders || []).filter((o) => o.status !== 'Paid');
  assert.equal(unpaid.length, 0, `unpaid orders: ${JSON.stringify(unpaid)}`);
  assert.ok((paidOrders || []).length >= 4, 'consult + 3 service orders');

  const { data: receipts } = await svc
    .from('receipts')
    .select('receipt_id,receipt_number')
    .in('billing_order_id', paidOrders.map((o) => o.id));
  assert.equal(receipts.length, paidOrders.length, 'one receipt per order');

  const { data: records } = await svc
    .from('consultations')
    .select('consultation_id,diagnosis,plan')
    .eq('encounter_id', visitId);
  assert.ok(records.length >= 1, 'consultation record linked to encounter');

  const { data: labs } = await svc
    .from('lab_requests')
    .select('request_id,status,lab_results(result_value)')
    .eq('encounter_id', visitId);
  assert.ok(labs.length >= 1 && labs[0].status === 'Completed');

  return {
    orders: paidOrders.length,
    receipts: receipts.length,
    consultations: records.length,
    labs: labs.length,
  };
});

// ---------------------------------------------------------------------------
// 9. Messaging + notifications
// ---------------------------------------------------------------------------
await phase('9. Messaging + notifications', async () => {
  const doctor = staffByRole.doctor;
  const admin = staffByRole.admin;

  const { data: msg, error: mErr } = await actors.doctor.client
    .from('staff_messages')
    .insert({
      sender_id: doctor.id,
      recipient_id: admin.id,
      subject: `E2E message ${ts}`,
      message: 'Patient flow completed successfully.',
      priority: 'normal',
      status: 'sent',
    })
    .select('*')
    .single();
  if (mErr) throw new Error(`message: ${mErr.message}`);

  const { data: recipients, error: rErr } = await svc
    .from('message_recipients')
    .select('id,recipient_id')
    .eq('message_id', msg.id);
  if (rErr) throw new Error(`message recipient: ${rErr.message}`);
  assert.ok((recipients || []).length >= 1, 'message recipient auto-created');

  const { data: notes, error: nErr } = await svc
    .from('notifications')
    .insert({
      type: 'SystemAlert',
      priority: 'Normal',
      title: `E2E notification ${ts}`,
      message: 'Workflow completed.',
      target_user_id: admin.id,
      entity_type: 'encounter',
      entity_id: visitId,
      patient_id: patient.patient_id,
      encounter_id: visitId,
      is_read: false,
    })
    .select('*')
    .single();
  if (nErr) throw new Error(`notification: ${nErr.message}`);

  return { messageId: msg.id, notificationId: notes.id };
});

// ---------------------------------------------------------------------------
// 10. ANC + audit log
// ---------------------------------------------------------------------------
await phase('10. ANC + audit log', async () => {
  const { error: ancErr } = await actors.doctor.client
    .from('pregnancy_episodes')
    .insert({
      patient_id: patient.id,
      enrollment_date: new Date().toISOString().slice(0, 10),
      lmp: '2026-09-01',
      gravida: 1,
      parity: 0,
    });
  if (ancErr) throw new Error(`ANC episode: ${ancErr.message}`);

  const { data: audit, error: aErr } = await svc
    .from('audit_logs')
    .select('id')
    .limit(1);
  if (aErr) throw new Error(`audit_logs: ${aErr.message}`);

  return { anc: true, auditLogReadable: true };
});

// ---------------------------------------------------------------------------
// 11. In-patient: bed-only admission, transfer, discharge
// ---------------------------------------------------------------------------
await phase('11. In-patient bed-only admission/transfer/discharge', async () => {
  const { data: ipVisit, error: ipVisitErr } = await svc
    .from('visits')
    .insert({
      patient_id: patient.id,
      clinic_id: clinic.id,
      visit_type: 'New Visit',
      payment_category: 'Cash',
      priority: 'Normal',
      status: 'Active',
      current_stage: 'consultation',
      chief_complaint: 'E2E inpatient admission',
    })
    .select('*')
    .single();
  if (ipVisitErr) throw new Error(`inpatient visit: ${ipVisitErr.message}`);

  const { data: availableBeds, error: bedErr } = await svc
    .from('beds')
    .select('id,ward_id,bed_number,status')
    .eq('status', 'Available')
    .limit(2);
  if (bedErr) throw new Error(`beds: ${bedErr.message}`);
  if (!availableBeds || availableBeds.length < 2) {
    throw new Error('Need at least two available beds for the transfer test');
  }
  const [bed1, bed2] = availableBeds;

  const { data: admission, error: admErr } = await actors.doctor.client
    .from('admissions')
    .insert({
      facility_id: ipVisit.facility_id,
      admission_number: `ADM-E2E-${ts}`,
      patient_id: patient.id,
      encounter_id: ipVisit.id,
      admission_type: 'elective',
      admission_source: 'outpatient',
      current_ward_id: bed1.ward_id,
      current_bed_id: bed1.id,
      admitting_diagnosis: 'E2E observation',
      admitting_doctor_id: staffByRole.doctor.id,
      admission_status: 'admitted',
      created_by: staffByRole.doctor.id,
    })
    .select('*')
    .single();
  if (admErr) throw new Error(`admission: ${admErr.message}`);

  await svc
    .from('beds')
    .update({
      status: 'Occupied',
      current_patient_id: patient.id,
      current_admission_id: admission.id,
    })
    .eq('id', bed1.id);

  // Transfer to the second bed.
  const { error: transferErr } = await svc
    .from('admissions')
    .update({
      current_bed_id: bed2.id,
      current_ward_id: bed2.ward_id,
    })
    .eq('id', admission.id);
  if (transferErr) throw new Error(`transfer: ${transferErr.message}`);
  await svc
    .from('beds')
    .update({
      status: 'Available',
      current_patient_id: null,
      current_admission_id: null,
    })
    .eq('id', bed1.id);
  await svc
    .from('beds')
    .update({
      status: 'Occupied',
      current_patient_id: patient.id,
      current_admission_id: admission.id,
    })
    .eq('id', bed2.id);

  // Discharge.
  const { error: disErr } = await svc
    .from('admissions')
    .update({
      admission_status: 'discharged',
      actual_discharge_date: new Date().toISOString(),
      discharge_type: 'home',
    })
    .eq('id', admission.id);
  if (disErr) throw new Error(`discharge: ${disErr.message}`);
  await svc
    .from('beds')
    .update({
      status: 'Available',
      current_patient_id: null,
      current_admission_id: null,
    })
    .eq('id', bed2.id);

  const { data: finalAdmission } = await svc
    .from('admissions')
    .select('admission_status,current_bed_id')
    .eq('id', admission.id)
    .single();
  assert.equal(finalAdmission.admission_status, 'discharged');
  assert.equal(finalAdmission.current_bed_id, bed2.id);

  const { data: finalBeds } = await svc
    .from('beds')
    .select('id,status,current_patient_id')
    .in('id', [bed1.id, bed2.id]);
  assert.ok((finalBeds || []).every((bed) => bed.status === 'Available'));
  assert.ok((finalBeds || []).every((bed) => !bed.current_patient_id));

  return { admission: admission.admission_number, beds: [bed1.bed_number, bed2.bed_number] };
});

// ---------------------------------------------------------------------------
// 12. Every active module has a readable backing table
// ---------------------------------------------------------------------------
await phase('12. Every active module backend check', async () => {
  const moduleTables = [
    ['Dashboard', 'visits'],
    ['Patients', 'patients'],
    ['Medical Records', 'consultations'],
    ['Encounters', 'visits'],
    ['OPD Consultation', 'consultations'],
    ['Nursing', 'vitals'],
    ['Pharmacy', 'prescriptions'],
    ['Laboratory', 'lab_requests'],
    ['Radiology', 'radiology_requests'],
    ['In-Patient', 'admissions'],
    ['Surgery', 'surgeries'],
    ['Procedures', 'procedure_requests'],
    ['ANC', 'pregnancy_episodes'],
    ['Nutrition', 'queue'],
    ['Clinical Requests', 'clinical_requests'],
    ['Queue', 'queue'],
    ['Billing', 'billing_orders'],
    ['Customer Service', 'customer_feedback'],
    ['Medical Reports', 'medical_reports'],
    ['Inventory', 'inventory_items'],
    ['Configurations', 'system_configurations'],
    ['Staff', 'staff'],
    ['Messages', 'staff_messages'],
    ['Records History', 'visits'],
    ['Analytics', 'billing_orders'],
    ['Profile', 'staff'],
    ['Sync Center', 'notifications'],
  ];

  const failures = [];
  for (const [label, table] of moduleTables) {
    const { error } = await svc
      .from(table)
      .select('*', { count: 'exact', head: true })
      .limit(1);
    if (error) failures.push(`${label} (${table}): ${error.message}`);
  }
  if (failures.length) {
    throw new Error(`Module table checks failed: ${failures.join('; ')}`);
  }

  assert.ok(moduleTables.length >= 25, 'all active modules covered');
  return { modulesChecked: moduleTables.length };
});

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
console.log('\n============================================');
console.log(' E2E SUMMARY');
console.log('============================================');
for (const r of results) {
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}`);
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} phases passed`);
if (failed.length) {
  console.log(JSON.stringify(failed, null, 2));
  process.exit(1);
}
