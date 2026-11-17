# NDC Medical Centre EMR

This repository contains the NDC Medical Centre desktop EMR. This root README is written as both a product overview and a user training guide so staff, supervisors, trainers, administrators, and IT support teams can use one document as the starting point.

## Deployment notes (MUHEDA)

This installation is intentionally narrowed:

- **A&E** and **Hygiene & Infection Control** are hidden.
- **Specialty Clinics**, **Dental**, **Ophthalmology** and **Physiotherapy** are hidden.
- **NHIS** and **military-specific** fields/workflows are hidden.
- **In-Patient** uses a flat bed board — no ward selection is required.
- **Radiology** records external results (text + optional image) without internal scheduling/imaging phases.

These switches live in `src/renderer/config/features.ts`.

Module visibility in the app is role-based. If a module described below does not appear in the left sidebar for a user, that is usually expected behavior based on role, department, or specialty assignment.

## Table of Contents

- [System Overview](#system-overview)
- [Getting Started](#getting-started)
- [Navigation and Daily Use](#navigation-and-daily-use)
- [Standard Patient Journey](#standard-patient-journey)
- [Complete Module Directory](#complete-module-directory)
- [How Each Module Works](#how-each-module-works)
- [Department-by-Department Workflows](#department-by-department-workflows)
- [First-Time Click-by-Click Module Guide](#first-time-click-by-click-module-guide)
- [Front Desk and Patient Access](#front-desk-and-patient-access)
- [Clinical Care and Documentation](#clinical-care-and-documentation)
- [Diagnostics Pharmacy and Procedures](#diagnostics-pharmacy-and-procedures)
- [Specialty and Longitudinal Care](#specialty-and-longitudinal-care)
- [Finance Insurance and Operations](#finance-insurance-and-operations)
- [Settings Configuration and Audit](#settings-configuration-and-audit)
- [Role and Access Guide](#role-and-access-guide)
- [Common Questions and Troubleshooting](#common-questions-and-troubleshooting)
- [Technical Quick Start](#technical-quick-start)

## System Overview

The NDC Medical Centre EMR is a desktop hospital information system built to manage the patient journey from first contact through consultation, investigations, treatment, admission, follow-up, billing, and reporting.

At a high level, the application provides:

- Registration, encounter, queue, and customer service workflows for front-desk teams
- Medical records, consultation, nursing, specialty, inpatient, and procedure workflows for clinical teams
- Lab, radiology, pharmacy, and report workflows for diagnostic and treatment departments
- Billing, NHIS, inventory, analytics, staffing, configuration, and audit workflows for operational and administrative teams
- Internal messaging, notifications, profile management, search, and offline sync support across the system

The live application routing currently exposes these major areas:

- Dashboard
- Patients
- Encounters
- Medical Records
- OPD Consultation
- Specialty Clinics
- Nursing Care
- Pharmacy
- Laboratory
- Radiology
- In-Patient
- Surgery/Theatre
- Hygiene and Infection Control
- Accident and Emergency
- Antenatal Care
- Procedures
- Dental
- Ophthalmology
- Physiotherapy
- Nutrition
- Clinical Requests
- Queue
- Billing and Payments
- NHIS
- Customer Service
- Medical Reports
- Inventory
- Configurations
- Staff
- Messages
- Analytics
- Profile
- Sync Center

## Getting Started

For end users, the normal startup path is simple:

1. Launch the EMR desktop application.
2. Sign in with your assigned staff account.
3. Review the dashboard for the day’s workload, queue pressure, and quick navigation links.
4. Use the left sidebar to open the module for your current station or department.
5. Use the global search bar in the header to find patients, records, or workflows quickly.
6. Use the profile menu in the top-right corner for personal options such as themes and sign out.

Before training new users, confirm the following:

- Their account exists in the Staff module.
- Their role is correct.
- Their specialty or department assignment is correct if they should see a specialty clinic.
- They understand whether they are working in a cash, NHIS, or retainership workflow.

## Navigation and Daily Use

The application shell is consistent across modules.

- The left sidebar shows only the modules the current user can access.
- The current page title is derived from the active route and menu configuration.
- The header search box is used to search for patients, records, and workflows.
- The notification bell surfaces system or workflow alerts.
- The Messages module shows unread message badges directly in the sidebar.
- The user avatar opens the profile menu with theme controls and sign out.

Important navigation behaviors:

- Specialists may see a dynamic menu label such as `My Cardiology Clinic` instead of the generic `Specialty Clinics` label.
- Admin and medical director roles keep the broader specialty-clinic entry because they can access multiple specialty areas.
- The legacy `cashier` path redirects to the Billing module.
- If a user navigates directly to a restricted page, the app shows an Access Denied screen instead of exposing the module.

Useful personal and support locations:

- `Profile` lets staff update their profile photo and review their account information.
- `Profile` also includes application guidance settings.
- `Sync Center` shows queued saves, retries, failed background sync operations, and current online or offline state.
- The profile menu supports theme selection between Auto, Navy, and UI modes.

## Standard Patient Journey

The common patient flow in the EMR follows this pattern:

1. The patient is searched or registered in `Patients`.
2. A visit or encounter is opened in `Encounters`.
3. The patient is assigned a payer pathway such as cash, NHIS, or retainership.
4. Cash workflows usually require payment steps before downstream service completion.
5. The patient moves through `Queue` and `Nursing Care` for triage and vitals.
6. A doctor or specialist documents the visit in `OPD Consultation` or `Specialty Clinics`.
7. Orders may be created for `Laboratory`, `Radiology`, `Pharmacy`, or `Procedures`.
8. Results, treatment, and dispensing feed back into `Medical Records` for longitudinal review.
9. The patient may be discharged, followed up, referred, or admitted into `In-Patient` workflows.
10. Financial closure, reporting, insurance processing, and audit review are handled in the relevant operational modules.

Operational training note: users should be taught that the EMR is workflow-driven. Many downstream actions are unlocked only after the upstream task is complete, especially where payment status, encounter state, or approval state matters.

## Complete Module Directory

### Core Workflow Modules

| Module | Route | Main Users | Primary Use |
| --- | --- | --- | --- |
| Dashboard | `/` | All authenticated staff | Daily overview, quick access, workload visibility |
| Patients | `/registration` | Reception, clinicians, admins | Register, search, and update patient demographics |
| Encounters | `/encounter` | Reception, clinicians | Open visits, manage current encounter context, set visit flow |
| Medical Records | `/medical-records` | Clinicians | Review longitudinal patient information across visits |
| Queue | `/queue` | Front desk, clinical, operational staff | Track who is waiting at each station |
| Customer Service | `/customer-service` | Reception, support staff | Handle inquiries, service follow-up, and patient support tasks |
| Billing and Payments | `/billing` | Billing clerks, cashiers | Process charges, payments, receipts, and billing orders |
| Nursing Care | `/nursing` | Nurses, doctors | Capture vitals, triage details, and nursing documentation |
| OPD Consultation | `/consultation` | GOPD doctors, admins | Document consultations, diagnoses, plans, and orders |
| Specialty Clinics | `/specialty-clinic` or `/specialty-clinic/:specialtyCode` | Specialists, admins | Run specialty-specific consultations and template-driven assessments |
| Clinical Requests | `/clinical-requests` | Doctors, nurses, reception | Manage referrals, admissions, and procedure-related requests |
| Laboratory | `/lab` | Lab technicians, doctors | Receive test requests, process tests, and enter or validate results |
| Radiology | `/radiology` | Radiologists, doctors | Manage imaging orders, uploads, and reporting |
| Pharmacy | `/pharmacy` | Pharmacists, doctors | Dispense prescriptions and manage medication workflow |
| In-Patient | `/in-patient` | Doctors, nurses | Admission, ward, bed, and inpatient care workflow |
| Procedures | `/procedures` | Doctors, nurses | Track procedures and related scheduling or execution |
| Medical Reports | `/medical-reports` | Clinicians | Generate formal medical documents and reports |

### Specialty and Departmental Modules

| Module | Route | Main Users | Primary Use |
| --- | --- | --- | --- |
| Surgery and Theatre | `/surgery/*` | Surgeons, doctors, nurses | Theatre scheduling, surgical workflow, perioperative activities |
| Hygiene and Infection Control | `/hygiene/*` | Infection-control teams, clinicians | Hygiene monitoring and infection-control records |
| Accident and Emergency | `/ae` | Emergency clinicians | Manage urgent and emergency patient care |
| Antenatal Care | `/anc` | ANC and obstetric teams | Pregnancy monitoring, follow-up, and antenatal workflow |
| Dental | `/dental` | Dental teams | Dental review, documentation, and treatment-related workflows |
| Ophthalmology | `/ophthalmology` | Eye clinic teams | Eye examinations, visual-care workflow, and specialty review |
| Physiotherapy | `/physiotherapy` | Physiotherapy teams | Rehabilitation assessments and treatment follow-up |
| Nutrition | `/nutrition` | Nutritionists, doctors, nurses | Nutrition assessment, planning, and follow-up |

### Administrative and Support Modules

| Module | Route | Main Users | Primary Use |
| --- | --- | --- | --- |
| NHIS | `/nhis` | Billing, clinical, insurance-facing staff | Insurance approval, verification, and scheme-specific workflow |
| Inventory | `/inventory` | Inventory managers, admins | Stock visibility, stock control, and supply tracking |
| Configurations | `/configurations` | Super admin, admin, config admin | System settings, server connection, and audit review |
| Staff | `/staff` | Admins, medical director, config admin | Staff records, roles, and permission administration |
| Messages | `/messaging` | All staff | Internal messaging and communication |
| Analytics | `/analytics` | Leadership and admins | Operational analytics and reporting |
| Profile | `/profile` | All staff | Personal account management and guidance settings |
| Sync Center | `/sync-center` | All staff | Offline queue status, retries, and background sync visibility |

## How Each Module Works

This section explains the practical purpose of every exposed module, what users normally do there, and how work moves into or out of that module.

### Dashboard

The Dashboard is the home page after login. It is designed to help users understand the day’s workload before opening any module.

How it works:

- Shows role-aware summary cards such as patient counts, queue pressure, pending service work, and revenue-related metrics for authorized roles.
- Provides quick-access actions so users can jump straight into their most common modules.
- Surfaces operational pressure points such as pending laboratory work, triage load, queue waiting counts, and active service bottlenecks.
- Acts as the fastest way to refresh your situational awareness at the start of a shift.

Use the Dashboard when:

- Starting the day
- Monitoring overall workload
- Deciding which module needs attention first
- Checking whether the hospital is building queue pressure in specific departments

### Patients

The Patients module is the patient identity and demographic workspace. It is where staff register new patients, maintain patient records, and review core demographic information.

How it works:

- Users can search for an existing patient before creating a new record.
- New patient registration captures personal, contact, and payer-related information.
- Existing patients can be opened for detail review or edited when corrections are needed.
- Dependent records can be created under a principal patient when that relationship is supported.
- After a brand-new patient is created, the system prompts staff to create an encounter immediately so the patient can enter the care workflow without leaving the page.

Typical handoff:

- A newly created or identified patient moves next into Encounters.

### Encounters

The Encounters module manages the active visit itself. It is where the hospital defines why the patient is present today, where they should be seen, and what workflow path the visit should follow.

How it works:

- Staff create a new encounter for a patient and assign visit details such as clinic, priority, and visit type.
- Filters help staff search encounters by status, clinic, diagnosis, complaint, or operational state.
- The module includes dedicated views for patient encounters, today’s activity, clinic routing, and referral-related work.
- Internal and external referrals can be tracked from here, including referral queues that connect into NHIS or specialty workflows.
- Encounter context becomes the anchor record for downstream services such as consultation, laboratory, radiology, pharmacy, and admissions.

Typical handoff:

- Encounters move into Queue, Nursing Care, OPD Consultation, Specialty Clinics, Clinical Requests, or service modules depending on workflow state.

### Queue

The Queue module manages patient flow between departments. It is operational rather than narrative: its purpose is to show who is waiting, where they are, and who is being served.

How it works:

- Supports both board and list views so staff can manage queues visually or in detail.
- Department tabs segment work by service area such as reception, nursing, consultation, laboratory, radiology, pharmacy, and billing.
- Authorized users can add a patient directly into a queue.
- Queue status reflects real-time movement such as waiting, in progress, or completed.
- Display Mode can be used for a larger screen queue board.
- Payment-state checks can affect whether a queued patient can proceed to downstream services.

Typical handoff:

- Queue is the coordination layer between encounters and the department currently serving the patient.

### Customer Service

The Customer Service module supports patient-facing operational follow-up, especially complaints, service feedback, and appointment handling.

How it works:

- Contains at least two main working areas: feedback and appointments.
- Feedback records are logged, filtered, and tracked by status such as Open or In Progress.
- Appointment records capture date, time, patient, appointment type, and appointment status.
- Staff can create new feedback entries or new appointments from within the module.
- This module is especially useful for post-visit support, rescheduling, follow-up coordination, and service recovery.

Typical handoff:

- Appointment booking leads into Encounters on the visit date.
- Escalated feedback may require coordination with clinical or management teams.

### Medical Records

Medical Records is the unified longitudinal record view. It allows clinicians to review what has already happened across visits without rewriting or re-entering prior care.

How it works:

- Provides patient search and longitudinal record review.
- Supports an encounter-centric view for reviewing one patient’s full timeline of clinical activity.
- Brings together consultation records, results, orders, and outcomes across departments.
- Is intended primarily as a review surface rather than the main data-entry surface for active care.

Use it when:

- Reviewing past care before seeing a patient again
- Confirming earlier diagnoses or investigations
- Checking what was already ordered, dispensed, reported, or concluded

### Nursing Care

Nursing Care supports triage, nursing observations, and care documentation for active patients.

How it works:

- Typically starts in the nursing queue, where staff identify patients waiting for nursing attention.
- Staff can call a patient, start serving them, and complete the queue step when nursing work is done.
- Records vitals, nursing care details, and other nurse-led documentation.
- Includes a care-records view for previously created nursing records.
- Nursing actions influence the patient’s readiness for consultation or onward movement in the workflow.

Typical handoff:

- After triage and nursing documentation, the patient usually proceeds to consultation or another next-stage service.

### OPD Consultation

OPD Consultation is the main doctor-facing consultation workspace for standard outpatient clinical care.

How it works:

- Uses multiple working views such as queue-based patient selection, a My Patients view, consultation history, and consultation records.
- Opens a structured consultation wizard for clinical documentation.
- Allows doctors to record history, examination, assessment, and plans.
- Supports creation of prescriptions, lab orders, imaging orders, procedure orders, admission orders, referrals, follow-up plans, and treatment plans.
- Can open specialty-specific consultation flows automatically when a clinic configuration requires a specialty wizard.
- Includes AI-assisted support surfaces inside the workflow for users permitted to use them.

Typical handoff:

- Consultation creates downstream work in Billing, Pharmacy, Laboratory, Radiology, Clinical Requests, In-Patient, or NHIS depending on what is ordered.

### Specialty Clinics

Specialty Clinics extends consultation into specialty-specific practice. It is not just another list of patients; it is a template-driven consultation layer designed around the clinician’s specialty.

How it works:

- The menu label may change dynamically to `My [Specialty Name] Clinic` for specialist users.
- Specialty clinic routing can include specialty-specific dashboards and specialty-specific patient queues.
- Users enter structured findings using templates designed for that specialty.
- Specialty workflows can still generate the same downstream service orders as general consultation, including labs, imaging, pharmacy, procedures, and referrals.

Typical handoff:

- Specialty consultations feed into the same downstream services and records surfaces as general consultation, but with specialty-specific documentation and routing.

### Clinical Requests

Clinical Requests is the centralized request-tracking hub for requests that do not belong to only one module.

How it works:

- Tracks requests such as admissions, procedures, follow-up needs, internal referrals, external referrals, transfers, and discharge-related actions.
- Gives staff a unified place to watch request status move from pending through approval and completion.
- Helps prevent requests from being buried inside free-text consultation notes.
- Connects especially closely with consultation, inpatient, procedure, and referral workflows.

Typical handoff:

- Once approved or acted upon, requests drive downstream work in In-Patient, Procedures, Surgery, Specialty Clinics, or other receiving services.

### Laboratory

The Laboratory module manages lab requests from approval through result entry and reporting.

How it works:

- Receives lab requests generated from consultation workflows.
- Uses approval handling for incoming requests when required.
- Tracks sample collection, processing start, and result entry states.
- Supports rejection workflows when a test cannot be completed.
- Includes report-oriented views for completed results and exports.
- Payment and NHIS state can determine whether a request is truly ready to process.

Typical handoff:

- Completed lab results become visible in Medical Records and are available for doctor follow-up.

### Radiology

The Radiology module manages imaging orders from approval through scheduling, image handling, and reporting.

How it works:

- Organizes work into clear phases such as approval, scheduling, imaging, reporting, reports, and history.
- Imaging can be scheduled by modality and service state.
- Staff can start imaging, mark imaging complete, upload images, and submit or finalize reports.
- Supports rejection when an imaging request cannot proceed.
- Uses payment-state checks to control when imaging can be scheduled or performed.

Typical handoff:

- Finalized reports and uploaded imaging outputs feed back into Medical Records and the referring clinician’s review workflow.

### Pharmacy

Pharmacy handles prescription review, approval, dispensing, stock-aware drug handling, and pharmacy-side audit visibility.

How it works:

- Receives prescriptions created in consultation workflows.
- Separates approval work from ready-to-dispense work.
- Supports single-item or batch dispensing.
- Uses batch-aware stock logic where applicable.
- Includes inventory-oriented views, low-stock visibility, and drug catalogue management.
- Also includes financial and audit-oriented surfaces for pharmacy review.
- Payment or NHIS approval status can determine whether a prescription is actually dispensable.

Typical handoff:

- Dispensing updates the patient’s treatment completion state and contributes to Medical Records and billing-linked operational history.

### In-Patient

The In-Patient module manages admissions, ward placement, bed allocation, ward-round documentation, and discharge processes.

How it works:

- Uses admission and ward structures rather than simple outpatient visit flow.
- Includes ward dashboards, admission forms, bed management, transfer logic, ward-round notes, discharge checklists, and discharge summaries.
- Supports the operational side of inpatient care by making bed status and discharge readiness visible.

Typical handoff:

- Admission usually begins from consultation or clinical request workflows.
- Discharge feeds into billing closure, summaries, and ongoing follow-up planning.

### Surgery and Theatre

The Surgery and Theatre module supports planned and active theatre workflows.

How it works:

- Covers scheduling and operational theatre preparation.
- Includes surgery registration, pre-operative review, safe-surgery checklist behavior, and theatre-side documentation.
- Can track anaesthesia, intra-operative details, post-operative steps, and theatre consumables.
- Works best as the controlled operating environment after a clinical or procedure decision has already been made.

Typical handoff:

- Surgery requests usually originate from consultation or procedures.
- Post-operative outcomes may continue into In-Patient, Pharmacy, Laboratory, Radiology, or follow-up review.

### Hygiene and Infection Control

Hygiene and Infection Control is the surveillance and hygiene-monitoring module.

How it works:

- Tracks hygiene-care tasks, records, and infection-control activities.
- Supports operational surveillance, incident tracking, and hygiene history review.
- Helps hospital teams capture infection-control activity in a dedicated place instead of burying it inside unrelated notes.

Typical handoff:

- Findings may escalate to operational or clinical governance teams and influence wider hospital policy or corrective action.

### Accident and Emergency

The A&E module supports rapid assessment and acute care for emergency arrivals.

How it works:

- Uses a faster intake pattern than routine clinic workflows.
- Supports arrival registration, triage-oriented views, active emergency documentation, and patient-board style oversight.
- Helps emergency teams move quickly from arrival through assessment to disposition.

Typical handoff:

- Emergency patients may be discharged, admitted, referred, or sent into consultation or specialty care depending on severity and outcome.

### Antenatal Care

ANC supports pregnancy monitoring and structured maternal-care follow-up.

How it works:

- Handles pregnancy enrollment and maternal history capture.
- Supports longitudinal pregnancy follow-up rather than one-off single-visit documentation only.
- Can track details relevant to ANC planning, risk monitoring, and maternity follow-up.
- Works closely with inpatient or obstetric escalation when the pregnancy becomes high risk or labour-related admission is required.

Typical handoff:

- High-risk, labour, or complication cases can move into inpatient or related obstetric workflows.

### Procedures

Procedures supports clinical procedures that need their own operational handling outside standard consultation note entry.

How it works:

- Tracks procedure registration, preparation, documentation, and procedure history.
- May include checklist behavior and consumable-aware steps depending on the procedure context.
- Acts as a focused place to document what was done, rather than leaving procedure detail scattered across consultation notes.

Typical handoff:

- Procedure requests often start in consultation or clinical requests and then return completed details to Medical Records and billing-linked workflow.

### Dental

Dental is the dedicated dental-care module.

How it works:

- Supports dental examination and tooth-specific documentation.
- Uses dental charting concepts rather than generic medical note structure alone.
- Can drive treatment-related actions such as dental procedures or related billing.

Typical handoff:

- Dental findings may create procedure or billing actions and remain visible in the patient’s broader record history.

### Ophthalmology

Ophthalmology handles eye-clinic workflows.

How it works:

- Supports eye-exam documentation, visual findings, and vision-care-specific records.
- Can include refraction-style or surgery-related follow-up within ophthalmic practice.
- Keeps eye-care details within a dedicated specialty context instead of forcing them into general consultation forms.

Typical handoff:

- Ophthalmology may create surgery, report, or treatment-related actions depending on the outcome of the visit.

### Physiotherapy

Physiotherapy manages rehabilitation-oriented assessments and treatment plans.

How it works:

- Supports therapy assessment, treatment planning, session recording, and follow-up.
- Tracks progress across sessions rather than only documenting one visit at a time.
- Often begins from a referral or treatment-plan decision made elsewhere in the clinical workflow.

Typical handoff:

- Progress notes and therapy outcomes feed back into longitudinal patient care review.

### Nutrition

Nutrition supports dietary and nutritional review, care planning, and follow-up.

How it works:

- Captures nutritional assessment data and care recommendations.
- Supports meal or diet planning and follow-up over time.
- Works especially well for chronic follow-up, supportive care, and admission-related nutrition oversight.

Typical handoff:

- Nutrition may begin from a doctor referral and continue as part of outpatient or inpatient care planning.

### Billing and Payments

Billing and Payments is the operational finance control center for service-linked charges and payment recording.

How it works:

- Manages pending billing orders generated from services.
- Creates and reviews invoices.
- Records payments by method and status.
- Supports verification of billing items and receipt-related workflows.
- Includes history, analysis, and export-oriented views.
- Can surface approved-request history and service-price management in the billing environment.
- Has direct impact on downstream service readiness when workflows are payment-gated.

Typical handoff:

- Billing status affects whether Lab, Radiology, Pharmacy, or other services can proceed.

### NHIS

NHIS is the scheme-management and authorization module for insured patient workflows.

How it works:

- Includes dashboard, verification, specialty referral review, outgoing referrals, service approvals, provisional queue, claims, profiles, postings, and pre-auth configuration.
- Verifies patient insurance state and scheme eligibility.
- Tracks approvals that gate specialist care or service delivery.
- Provides a dedicated workflow for claim-oriented and approval-oriented scheme administration.

Typical handoff:

- NHIS status feeds back into Billing and also determines whether clinical or service workflows can move forward under scheme rules.

### Medical Reports

Medical Reports is the formal document-generation module.

How it works:

- Supports a list of created reports plus a report-creation flow.
- Filters report work by patient, type, status, and search term.
- Opens report details for review and allows download when an issued document exists.
- Includes a template-oriented area for users with higher privileges.
- Best used when clinicians or records teams need formal letters, summaries, or official report documents.

Typical handoff:

- Issued documents are shared externally or stored as part of the patient’s record trail.

### Inventory

Inventory manages non-drug stock and supply items.

How it works:

- Tracks item codes, categories, stock levels, and reorder levels.
- Filters by category and low-stock state.
- Supports creation of new inventory items.
- Surfaces low-stock risk so operational teams can reorder before depletion.

Typical handoff:

- Inventory supports hospital operations broadly, especially where non-pharmaceutical consumables must be monitored.

### Configurations

Configurations is the system-administration module for setup and oversight.

How it works:

- Has three main tabs: System Settings, Server Connection, and Audit Trail.
- System Settings lets authorized users search, filter, and edit configuration keys and values.
- Server Connection focuses on server-related or connection-related operational settings.
- Audit Trail shows historical configuration and system changes for compliance and troubleshooting.

Use it when:

- Changing organization-wide behavior
- Verifying server-related settings
- Investigating who changed a system setting and when

### Staff

Staff is the administrative staff-management module.

How it works:

- Maintains staff records, roles, departmental placement, and specialty assignment.
- Determines which modules become visible after login.
- Supports operational user administration rather than clinical documentation.

Typical handoff:

- Changes made here affect authentication context, access control, specialty routing, and module visibility across the app.

### Messages

Messages is the internal communication module.

How it works:

- Supports inbox-style and sent-message workflows.
- Allows message composition to individuals, roles, or departments.
- Tracks unread state and exposes unread counts in the sidebar.
- Supports threaded reply behavior and archived-message style organization.
- Includes notification-related settings for message handling.

Typical handoff:

- Messages support coordination around work that originates in other modules rather than replacing those modules.

### Analytics

Analytics is the executive and operational reporting workspace.

How it works:

- Includes multiple analysis surfaces such as comprehensive analytics, summary statistics, encounter analytics, pharmacy analytics, billing analytics, and operational analytics.
- Supports period-based filtering such as recent-day trend windows.
- Uses charts and summary cards to turn transactional activity into management insight.
- Is primarily read-only and suited to leadership, oversight, and performance review.

Use it when:

- Reviewing service demand patterns
- Monitoring revenue or outstanding balances
- Comparing departmental activity
- Tracking clinical and operational trends over time

### Profile

Profile is the personal account page for staff.

How it works:

- Shows personal identity and account details.
- Allows staff to upload, change, or remove a profile photo.
- Includes guidance-related settings for in-app assistance.
- Complements the top-right avatar menu, which handles theme choice and sign out.

Use it when:

- Updating your picture
- Confirming your role or department details
- Adjusting your personal guidance-related preferences

### Sync Center

Sync Center is the background-sync and offline troubleshooting surface.

How it works:

- Shows whether the app is currently online or offline.
- Breaks queued work into pending, queued, syncing, retrying, failed, and saved counts.
- Lists background mutation records with timestamps, retry state, and error details where available.
- Lets users retry failed work or dismiss completed or failed records that no longer need attention.

Use it when:

- A save seems delayed
- The device has been offline
- You need to confirm whether a background action actually synchronized

## Department-by-Department Workflows

This section is written for training and daily operations. It tells each department where to start in the EMR, what order to do work in, and where the patient or task usually goes next.

### Reception and Registration Desk

Main modules: `Patients`, `Encounters`, `Queue`, `Customer Service`

Daily workflow:

1. Open `Patients` and search first before creating a new record.
2. If the patient already exists, confirm demographics, contact details, and payer category.
3. If the patient is new, register them completely and save the patient profile.
4. Create the visit in `Encounters` and set the clinic, priority, and visit type.
5. Move the patient into the correct next stage, usually queue, billing, or nursing depending on the visit flow.
6. Use `Customer Service` if the patient also needs appointment help, complaint resolution, or follow-up service support.

Before handoff, confirm:

- The patient identity is correct.
- The encounter has been created successfully.
- The payer path is correct: cash, NHIS, or retainership.
- The receiving department knows the patient is on the way.

### Customer Service Desk

Main modules: `Customer Service`, `Patients`, `Encounters`

Daily workflow:

1. Open `Customer Service` and choose either the feedback side or the appointments side.
2. Log patient complaints, compliments, or service issues with the correct subject, priority, and status.
3. Create appointments for future visits or follow-up reviews.
4. Confirm the patient exists in `Patients` before saving an appointment when needed.
5. On the appointment date, confirm the patient can move into `Encounters` for the new visit.
6. Escalate unresolved complaints to management or the responsible clinical team.

### Queue Coordination and Patient Flow

Main modules: `Queue`

Daily workflow:

1. Open `Queue` and select the relevant department tab.
2. Choose `Board` view for fast operational movement or `List` view for more detail.
3. Add patients to queue if your role allows it.
4. Watch waiting and in-progress counts to identify bottlenecks early.
5. Move patients only when the receiving department is ready to continue care.
6. Investigate delays by checking payment status, encounter status, or the receiving department’s workload.

Use Display Mode when:

- You need a large-screen queue display.
- The department wants a visible waiting-board experience.

### Nursing Station

Main modules: `Nursing Care`, `Medical Records`, `Queue`

Daily workflow:

1. Open `Nursing Care` and start from the queue view.
2. Call the patient or mark that you have started serving them.
3. Review important prior history in `Medical Records` if the case is complex or recurrent.
4. Record vitals, triage information, nursing observations, and required care notes.
5. Save the nursing record and complete the queue step when the patient is ready to move on.
6. Review past nursing entries from the care-records view if the patient has repeat visits.

Typical next step:

- The patient moves to consultation or another assigned next-stage service.

### GOPD Doctor Workflow

Main modules: `OPD Consultation`, `Medical Records`, `Clinical Requests`

Daily workflow:

1. Open `OPD Consultation` and select the patient from the queue or My Patients view.
2. Review the patient’s prior history in `Medical Records` before entering a new clinical note.
3. Use the consultation wizard to record the history, examination, assessment, and plan.
4. Create orders for lab, radiology, pharmacy, procedures, admission, or follow-up where needed.
5. Use `Clinical Requests` when an action needs tracked approval or handoff, such as admissions, referrals, procedures, or transfers.
6. Confirm the patient’s next destination before closing the workflow.

Possible handoffs:

- `Billing and Payments`
- `Laboratory`
- `Radiology`
- `Pharmacy`
- `Clinical Requests`
- `In-Patient`
- `Specialty Clinics`

### Specialty Clinic Doctor Workflow

Main modules: `Specialty Clinics`, `Medical Records`, `Clinical Requests`

Daily workflow:

1. Open your specialty menu entry in the sidebar.
2. Select the patient from the specialty queue or clinic-specific dashboard.
3. Review prior history in `Medical Records`.
4. Use the specialty template to capture findings in the correct specialty-specific format.
5. Create service orders, follow-up plans, or referrals as needed.
6. Track downstream requests in `Clinical Requests` when they require formal status management.

Important note:

- Some specialists will see a personalized menu label such as `My Cardiology Clinic` instead of the generic specialty-clinic label.

### Laboratory Department

Main modules: `Laboratory`, `Medical Records`

Daily workflow:

1. Open `Laboratory` and start in the incoming request or approval view.
2. Confirm the request is valid and ready to proceed.
3. Check that payment or NHIS approval has cleared the request for processing.
4. Collect the sample.
5. Start processing and then enter the result.
6. Reject with a reason if the test cannot be performed.
7. Make sure completed results are finalized so clinicians can review them.

Typical next step:

- Results become available in `Medical Records` and doctor follow-up workflows.

### Radiology Department

Main modules: `Radiology`, `Medical Records`

Daily workflow:

1. Open `Radiology` and review the correct work phase: approval, scheduling, imaging, or reporting.
2. Confirm payment or NHIS authorization before scheduling the study.
3. Schedule the study by modality and timing.
4. Start imaging and mark imaging as complete after acquisition.
5. Upload images and then submit or finalize the report.
6. Reject or delay with a reason if the study cannot continue.

Typical next step:

- The finalized report returns to the referring clinician through the patient record.

### Pharmacy Department

Main modules: `Pharmacy`

Daily workflow:

1. Open `Pharmacy` and begin in the approval or ready-to-dispense view.
2. Confirm the prescription is valid and eligible for dispensing.
3. Check payment status or NHIS approval before releasing medication.
4. Review stock and batch availability.
5. Dispense one item or a full batch of items as appropriate.
6. Use the history, inventory, audit, or financial views when reconciling work.
7. Update the drug catalogue or respond to low-stock alerts when necessary.

### Billing and Cashier Desk

Main modules: `Billing and Payments`

Daily workflow:

1. Open `Billing and Payments` and start in the billing-orders queue or invoice area.
2. Review pending service-linked charges.
3. Create or inspect the invoice.
4. Record payment using the correct payment method or billing state.
5. Verify the payment and print or open the receipt.
6. Use history and analysis views for reconciliation, outstanding items, and follow-up.

Important reminder:

- Billing state can determine whether downstream services are allowed to continue.

### NHIS or Insurance Desk

Main modules: `NHIS`, `Billing and Payments`

Daily workflow:

1. Open `NHIS` and start in the appropriate queue: verification, approvals, specialty referrals, or provisional queue.
2. Verify patient eligibility and scheme details.
3. Approve or reject referral or service requests according to policy.
4. Monitor outgoing referrals and claims progress.
5. Review postings and scheme profiles where needed.
6. Coordinate with `Billing and Payments` when scheme decisions affect patient charging or service release.

### In-Patient or Ward Team

Main modules: `In-Patient`, `Medical Records`

Daily workflow:

1. Open `In-Patient` when an admission request has been accepted.
2. Assign the patient to a ward and bed.
3. Review prior history in `Medical Records`.
4. Record ward-round notes, changes in status, and transfers where needed.
5. Use discharge checklist and discharge summary tools before releasing the patient.
6. Confirm the patient is handed back into billing closure or follow-up planning as required.

### Surgery and Theatre Team

Main modules: `Surgery and Theatre`, `Procedures`, `In-Patient`

Daily workflow:

1. Open `Surgery and Theatre` for scheduled cases.
2. Confirm pre-operative readiness and checklist completion.
3. Record theatre documentation, anaesthesia details, operative findings, and consumables used.
4. Complete post-operative notes and recovery handoff.
5. Coordinate with `In-Patient` if the patient returns to the ward.
6. Use `Procedures` when the case belongs in the procedure workflow instead of full theatre workflow.

### Hygiene and Infection Control Unit

Main modules: `Hygiene and Infection Control`

Daily workflow:

1. Open the hygiene or surveillance view.
2. Record infection-control activities, hygiene tasks, and observed incidents.
3. Update work history so the team can trace what was done and when.
4. Escalate important infection-control findings to the responsible operational or clinical team.

### Accident and Emergency Department

Main modules: `A&E`, `In-Patient`, `OPD Consultation`

Daily workflow:

1. Open `A&E` for rapid arrival intake and triage.
2. Confirm the patient record or register urgently if needed.
3. Document acute findings and emergency actions quickly.
4. Decide disposition: discharge, admit, refer to consultation, or route to another specialty.
5. Handoff admitted patients into `In-Patient` and referred patients into the receiving workflow.

### Antenatal Care Department

Main modules: `Antenatal Care`, `In-Patient`

Daily workflow:

1. Open `Antenatal Care` to enroll a new pregnancy or continue follow-up.
2. Record maternal history, pregnancy details, and visit findings.
3. Track risk indicators and follow-up milestones over time.
4. Escalate high-risk, labour-related, or unstable cases into inpatient obstetric care when needed.

### Dental Clinic

Main modules: `Dental`

Daily workflow:

1. Open `Dental` and select the patient.
2. Record charting and dental examination findings.
3. Document the treatment plan or needed dental procedure.
4. Route the patient into billing, procedure, or follow-up workflow as needed.

### Ophthalmology Clinic

Main modules: `Ophthalmology`

Daily workflow:

1. Open `Ophthalmology` and select the patient.
2. Record visual findings and eye-specific examination details.
3. Add refraction or other ophthalmic documentation where required.
4. Route the patient into surgery, reporting, or follow-up workflow when indicated.

### Physiotherapy Unit

Main modules: `Physiotherapy`

Daily workflow:

1. Open `Physiotherapy` from the referral or treatment-plan pathway.
2. Perform the assessment and create or update the treatment plan.
3. Record sessions and patient progress over time.
4. Continue scheduled follow-up until the episode is complete.

### Nutrition Unit

Main modules: `Nutrition`

Daily workflow:

1. Open `Nutrition` from a referral or ongoing follow-up list.
2. Record nutritional assessment findings.
3. Create dietary plans, recommendations, or supportive nutrition actions.
4. Review adherence and outcomes during follow-up or inpatient support.

### Procedure Room or Minor Procedure Team

Main modules: `Procedures`

Daily workflow:

1. Open `Procedures` for approved or scheduled procedure work.
2. Confirm the patient, indication, preparation, and required supplies.
3. Record the checklist and procedural details.
4. Close the procedure record and confirm the outcome returns to the patient’s record and related billing workflow.

### Medical Reports or Records Office

Main modules: `Medical Reports`, `Medical Records`

Daily workflow:

1. Open `Medical Reports` and choose the correct report type.
2. Search or filter existing reports by patient, type, or status.
3. Open report details to review completion and issue status.
4. Download or print issued documents when they are ready.
5. Use `Medical Records` to confirm the clinical history while preparing formal documentation.

### Inventory and Store Unit

Main modules: `Inventory`

Daily workflow:

1. Open `Inventory` and search or filter items by category or low-stock state.
2. Review stock level against reorder level.
3. Create new inventory items or update stock-related details as needed.
4. Act on low-stock alerts before supply shortages disrupt care.

### Staff Administration

Main modules: `Staff`

Daily workflow:

1. Open `Staff` and search for the relevant staff member.
2. Create or update staff records, roles, departments, and specialty assignments.
3. Confirm the assigned role matches the intended access level.
4. Tell the user to sign out and sign back in if role or specialty changes need to take effect.

### System Administration and Configuration

Main modules: `Configurations`, `Staff`, `Audit Trail`

Daily workflow:

1. Open `Configurations` and choose the correct tab.
2. Use `System Settings` for organization-wide behavior changes.
3. Use `Server Connection` for connection or server-related settings.
4. Use `Audit Trail` to verify who changed what and when.
5. Open `Staff` when the real issue is access, role assignment, or specialty mapping rather than a configuration value.

### Management and Leadership

Main modules: `Dashboard`, `Analytics`, `Billing and Payments`, `NHIS`, `Configurations`

Daily workflow:

1. Start with `Dashboard` for live operational awareness.
2. Open `Analytics` for trends, throughput, and summary review.
3. Check `Billing and Payments` or `NHIS` when reviewing finance or scheme performance.
4. Use `Configurations` and `Audit Trail` only when operational investigation or governance review is required.

### Shared Tools for All Departments

Main modules: `Messages`, `Profile`, `Sync Center`

Daily workflow:

1. Use `Messages` for internal coordination.
2. Use `Profile` for personal details, profile photo, and guidance settings.
3. Use the avatar menu for themes and sign out.
4. Use `Sync Center` when work appears delayed, the device goes offline, or background retry activity needs review.

## First-Time Click-by-Click Module Guide

This section is the practical user manual. It assumes the reader is using the EMR for the first time and needs to know what to click, what they will see, and what happens after they complete the task.

### Dashboard

What you will see first:

- Summary cards and operational counts
- Quick-navigation shortcuts
- Role-specific widgets such as patient, queue, or finance indicators

How to use it the first time:

1. Sign in and let the dashboard finish loading.
2. Review the key counts first: waiting patients, pending work, and any role-specific metrics.
3. Use the quick links or the sidebar to open the module that matches your station.
4. Use the refresh action when you need a fresh operational snapshot.

Main features:

- Real-time overview
- Quick links to major modules
- Department pressure visibility

### Patients

What you will see first:

- Patient list
- Search controls
- Buttons for new patient, view, edit, and dependent management

How to register a patient the first time:

1. Open `Patients`.
2. Use the search bar before creating a new record.
3. If the patient does not exist, click `New Patient`.
4. Complete demographic fields, contact information, and payer-related details.
5. Save the patient record.
6. Open the patient detail panel to verify the saved information.
7. If the patient should continue immediately, click the encounter-related action to create a visit.

Key features:

- New patient registration
- Existing patient search
- Patient detail view
- Patient edit flow
- Dependent registration where applicable

What happens next:

- The patient usually moves into `Encounters`.

### Encounters

What you will see first:

- Encounter list or default encounter workspace
- Search and filters
- Encounter creation action
- Views for referrals and clinic routing

How to create an encounter the first time:

1. Open `Encounters`.
2. Click `New Encounter`.
3. Search for and select the patient.
4. Choose the clinic or service area.
5. Select visit type and priority.
6. Assign the encounter correctly and save it.
7. Review the created encounter in the list.
8. Move the patient into the next workflow from the encounter context.

Key features:

- New encounter form
- Encounter filters by clinic, status, diagnosis, or complaint
- Today’s encounters view
- Referral-related queues
- Encounter detail and patient summary

What happens next:

- The patient is handed to queue, nursing, consultation, or another downstream service.

### Queue

What you will see first:

- Department tabs
- Board view and list view options
- Queue actions like add, refresh, or display mode

How to use it the first time:

1. Open `Queue`.
2. Select the department you are managing.
3. Choose `Board` if you want a fast visual view or `List` for detail.
4. Add a patient if your role allows it.
5. Mark a patient as the next person to be served.
6. Complete the queue step after the department finishes with the patient.

Key features:

- Department queue tabs
- Board and list modes
- Add-to-queue action
- Display mode for queue boards
- Queue movement tracking

What happens next:

- The patient moves to the department currently serving them or to the next stage afterward.

### Customer Service

What you will see first:

- Tabs for feedback and appointments
- Search and status filters
- Buttons for new feedback or new appointment

How to use it the first time:

1. Open `Customer Service`.
2. Choose `Feedback` if the patient has a complaint or service issue.
3. Choose `Appointments` if you are booking or reviewing future visits.
4. Click the correct create button.
5. Fill the form with patient context, date or subject, and status-related information.
6. Save and confirm the new record appears in the list.

Key features:

- Patient feedback logging
- Appointment booking
- Status tracking
- Search and filter tools

### Medical Records

What you will see first:

- Search and advanced filters
- A patient-focused results table
- Actions to view, export, or print records

How to use it the first time:

1. Open `Medical Records`.
2. Search by patient name, EMR number, phone, or other available identifiers.
3. Apply filters if the patient set is large.
4. Click the patient or record row to open the encounter-centric record.
5. Review the timeline of consultations, results, medications, and other events.
6. Export or print only if you need a formal copy.

Key features:

- Longitudinal record review
- Encounter-centric patient timeline
- Export and print support
- Filtered record search

### Nursing Care

What you will see first:

- Nursing queue and care-record views
- Actions to call, start, or complete nursing work
- Record-creation flow for vitals and care notes

How to use it the first time:

1. Open `Nursing Care`.
2. Start in the queue view.
3. Select or call the patient you are about to assess.
4. Click the action to start serving the patient.
5. Create a new nursing care record.
6. Enter vitals, notes, or care information.
7. Save the record.
8. Complete the queue step when nursing work is done.

Key features:

- Nursing queue control
- Vitals and nursing record entry
- Nursing record history
- Clinical alert visibility when present

### OPD Consultation

What you will see first:

- Queue, My Patients, consultations, or history view
- Consultation creation or selection actions
- Clinical wizard and order tools

How to use it the first time:

1. Open `OPD Consultation`.
2. Select the patient from queue or My Patients.
3. Open the consultation wizard.
4. Enter history and examination findings.
5. Record assessment and diagnosis.
6. Move to the plan or orders step.
7. Add lab, imaging, pharmacy, procedure, admission, referral, or follow-up actions.
8. Save draft or submit the consultation.

Key features:

- Consultation wizard
- Patient queue integration
- My Patients list
- Diagnostic and treatment order creation
- Referrals, admissions, and follow-up planning
- AI-assisted clinical support where enabled

### Specialty Clinics

What you will see first:

- A specialty-specific clinic entry or the general specialty-clinic entry
- Specialty queue or specialty dashboard
- Structured template-driven consultation forms

How to use it the first time:

1. Open your specialty clinic from the sidebar.
2. Select the patient from the clinic queue or referral list.
3. Review the patient’s history if needed.
4. Open the specialty consultation form.
5. Complete the specialty-specific structured fields.
6. Add specialty-related orders, referrals, and plans.
7. Submit the consultation.

Key features:

- Specialty dashboards
- Specialty patient queues
- Template-driven documentation
- Specialty-specific referrals and orders

### Clinical Requests

What you will see first:

- Request list or request workflow view
- Request categories such as admissions, procedures, referrals, transfers, and discharge actions
- Detail modals and execution modals for specific request types

How to use it the first time:

1. Open `Clinical Requests`.
2. Review the request list by status.
3. Open a request detail to understand what action is required.
4. For an admission request, continue into the admission execution flow.
5. For a procedure request, use the procedure approval or scheduling flow.
6. For discharge or transfer requests, open the relevant execution modal and complete the required information.
7. Update the request so the receiving team can see the new status.

Key features:

- Central request tracking
- Request detail modal
- Admission execution
- Procedure approval and scheduling
- Discharge execution

### Laboratory

What you will see first:

- Approval tab or request list
- Status filters and request cards
- Actions such as accept, collect sample, start processing, enter result, and reject

How to use it the first time:

1. Open `Laboratory`.
2. Start in the approval area and review the incoming request.
3. Confirm payment or NHIS readiness.
4. Accept the request.
5. Use `Collect Sample` when the specimen is taken.
6. Use `Start Processing` when the test begins.
7. Enter the result through the result form.
8. Finalize the result or report.
9. Reject only if the request cannot proceed.

Key features:

- Approval workflow
- Sample collection
- Processing state control
- Result entry form
- Report and export views
- Encounter-level batch approval support

### Radiology

What you will see first:

- Tabs for approval, scheduling, imaging, reporting, reports, and history
- Request cards with modality and status
- Scheduling and upload-related actions

How to use it the first time:

1. Open `Radiology`.
2. Begin in the correct phase tab for the request.
3. Accept the request if appropriate.
4. Schedule the study.
5. Start imaging when the patient is ready.
6. Mark imaging complete after acquisition.
7. Upload scan images.
8. Submit and finalize the report.
9. Use rejection only when the study cannot continue.

Key features:

- Modality-aware scheduling
- Imaging start and completion controls
- Image upload modal
- Report writing and finalization
- History and report views

### Pharmacy

What you will see first:

- Prescription views divided into approval, all prescriptions, or dispense-oriented views
- Stock and inventory panels
- Drug catalogue and history options

How to use it the first time:

1. Open `Pharmacy`.
2. Start in the prescription approval view.
3. Review the prescription and confirm safety, stock, and payment status.
4. Accept or reject the prescription.
5. Move to the dispense view for approved items.
6. Select the correct batch and quantity.
7. Confirm dispense notes if needed.
8. Submit the dispense action.
9. Review dispense history or stock dashboards when reconciling.

Key features:

- Prescription approval
- Ready-to-dispense workflow
- Batch dispensing
- Drug catalogue management
- Inventory dashboard
- Financial and audit review areas

### In-Patient

What you will see first:

- Tabs such as pending admissions, ward dashboard, active patients, and bed management
- Admission and discharge actions
- Ward and bed controls

How to use it the first time:

1. Open `In-Patient`.
2. Start in `Pending Admissions` if a new admission needs processing.
3. Open the admission flow and assign ward and bed.
4. Use active-patient views to manage admitted patients.
5. Open ward-round note tools when documenting reviews.
6. Use transfer tools if the patient changes bed or ward.
7. Open discharge forms and checklists when discharge is due.

Key features:

- Pending admissions queue
- Ward dashboard
- Bed management
- Ward-round notes
- Transfer workflow
- Discharge checklist and summary

### Surgery and Theatre

What you will see first:

- A surgery dashboard as the default route
- Dedicated internal routes for schedule, rooms, history, new surgery, pre-op, checklist, anesthesia, intra-op, post-op, and consumables

How to use it the first time:

1. Open `Surgery and Theatre`.
2. Review the dashboard for current cases.
3. Open `Schedule` when planning theatre timing.
4. Open `Rooms` to review or manage theatre rooms.
5. Use `New Surgery` to register a new case.
6. Open the case-specific routes in order: pre-op, checklist, anesthesia, intra-op, post-op.
7. Add consumables when they are used.
8. Review history for completed cases.

Key features:

- Surgery dashboard
- Theatre schedule calendar
- Theatre rooms management
- Full perioperative documentation flow
- Consumables tracking
- Surgery history

### Hygiene and Infection Control

What you will see first:

- Hygiene dashboard by default
- Routes for care record entry, records list, infection surveillance, infection reporting, and worklist

How to use it the first time:

1. Open `Hygiene and Infection Control`.
2. Review the dashboard.
3. Use `Record` to enter a new hygiene-care activity.
4. Use `Records` to review prior documentation.
5. Use `Infections` to review surveillance items.
6. Use the infection report route when logging a new infection-related report.
7. Use `Worklist` to see prioritized hygiene tasks.

Key features:

- Hygiene dashboard
- Hygiene care form
- Care records list
- Infection surveillance list
- Infection reporting
- Hygiene worklist

### Accident and Emergency

What you will see first:

- Header with `New Emergency Arrival`, `Dashboard`, and `Patient Board`
- Full encounter view after selecting a patient

How to use it the first time:

1. Open `A&E`.
2. Click `New Emergency Arrival` for a fresh acute case.
3. Complete the arrival form.
4. Return to the dashboard or patient board.
5. Select the encounter to open the full emergency encounter view.
6. Continue acute documentation and disposition from there.

Key features:

- New emergency arrival registration
- Emergency dashboard
- Patient board
- Full emergency encounter view

### Antenatal Care

What you will see first:

- Dashboard with a `New Enrollment` action
- Pregnancy detail view after selecting an episode

How to use it the first time:

1. Open `Antenatal Care`.
2. Click `New Enrollment` for a new pregnancy episode.
3. Complete the pregnancy enrollment form.
4. Save and move into the pregnancy detail view.
5. Use the detail view for ongoing visit-by-visit monitoring.
6. Return to the dashboard when you need to select a different pregnancy episode.

Key features:

- ANC dashboard
- Pregnancy enrollment form
- Pregnancy detail view

### Procedures

What you will see first:

- Procedure scheduling and detail surfaces depending on the route and workflow state
- Request-linked procedure actions from consultation and clinical requests

How to use it the first time:

1. Open `Procedures`.
2. Review scheduled or requested procedures.
3. Open the relevant procedure entry.
4. Confirm patient, indication, readiness, and supplies.
5. Document the procedure steps and notes.
6. Close or complete the procedure record.

Key features:

- Procedure scheduling
- Procedure documentation
- Procedure history
- Request-driven procedure routing

### Dental

What you will see first:

- Tabs such as queue, referrals, procedures, exams, history, and care plans
- Search and status filters
- Dental exam wizard and specialty timeline views

How to use it the first time:

1. Open `Dental`.
2. Start in the queue or referrals tab.
3. Select the patient.
4. Open the dental exam wizard.
5. Complete complaint, oral findings, charting, and diagnosis details.
6. Add any related orders, referrals, or procedures.
7. Save the exam and review history or care-plan views if needed.

Key features:

- Queue intake
- Referral intake
- Dental procedures review
- Dental exam wizard
- Specialty consultation timeline
- Care-plan dashboard
- Export panel

### Ophthalmology

What you will see first:

- Tabs such as queue, referrals, procedures, exams, and history
- Exam wizard, patient record modal, and consultant record views

How to use it the first time:

1. Open `Ophthalmology`.
2. Start in queue or referrals.
3. Select the patient.
4. Open the eye exam wizard.
5. Complete the exam in the correct mode.
6. Review the saved exam in the view modal if needed.
7. Use the consultant record or export views for follow-up review.

Key features:

- Queue intake
- Referral intake
- Eye procedure approval
- Eye exam wizard
- Eye exam viewer
- Consultant record view
- Export panel

### Physiotherapy

What you will see first:

- Tabs such as queue, referrals, assessments, and plans
- Assessment wizard, treatment plan dashboard, and billing-related actions

How to use it the first time:

1. Open `Physiotherapy`.
2. Choose a patient from queue or referrals.
3. Open the physiotherapy assessment wizard.
4. Complete the assessment.
5. Create the treatment plan after the assessment.
6. Review plan details in the plan dashboard.
7. Record session-related outcomes over time.

Key features:

- Queue and referral intake
- Assessment wizard
- Assessment viewer
- Treatment plan dashboard
- Session and billing actions
- Export panel

### Nutrition

What you will see first:

- Tabs for clinic queue, referrals, and care plans
- Plan-create modal and care-plan dashboard
- Optional lab-order creation path from nutrition care

How to use it the first time:

1. Open `Nutrition`.
2. Choose whether you are working from queue, referrals, or existing care plans.
3. Select the patient.
4. Open the nutrition plan creation modal.
5. Complete the nutrition care plan.
6. Save and continue follow-up from the care-plan dashboard.
7. If needed, place a lab order from the nutrition context when a valid encounter exists.

Key features:

- Queue intake
- Referral intake
- Nutrition care-plan dashboard
- Nutrition plan creation modal
- Nutrition follow-up workflow
- Lab-order support from nutrition

### Billing and Payments

What you will see first:

- Queue, invoices, receipts, approved requests, financials, and service pricing areas
- Create-invoice and record-payment actions

How to use it the first time:

1. Open `Billing and Payments`.
2. Start in the queue and select the patient or service bundle.
3. Click `Create Invoice`.
4. Review the auto-built charge list and save the invoice.
5. Open `Record Payment` when the patient settles.
6. Choose payment method and record the payment.
7. Verify the payment if required.
8. Print or download the receipt.
9. Use invoice or receipt history for later reconciliation.

Key features:

- Billing-orders queue
- Invoice creation
- Payment recording
- Payment verification
- Receipt printing and download
- Financial dashboard and service-price management

### NHIS

What you will see first:

- Tabs for dashboard, verification, specialty referrals, outgoing referrals, approvals, provisional queue, claims, postings, profiles, and pre-auth config

How to use it the first time:

1. Open `NHIS`.
2. Choose the correct working tab.
3. For eligibility work, use `Verification` and search the patient’s NHIS ID.
4. For referral approvals, open `Specialty Referrals` and approve or reject.
5. For service authorizations, work from `Service Approvals` or `Provisional Queue`.
6. Use `Claims` and `Postings` for reimbursement tracking.
7. Use `Pre-Auth Config` only if you are authorized to adjust pre-authorization rules.

Key features:

- NHIS verification
- Specialty referral approval
- Outgoing referral management
- Service approvals
- Claims and postings
- Pre-auth configuration

### Medical Reports

What you will see first:

- Medical reports list and a templates area for higher roles
- Search, patient filter, type filter, and status filter
- Report detail and create-report actions

How to use it the first time:

1. Open `Medical Reports`.
2. Click `New Report` if creating a new document.
3. Select the patient.
4. Choose the report type.
5. Complete or review the report content.
6. Save draft or submit for review if your workflow requires it.
7. Open the report detail to review the result.
8. Download when the document is issued.

Key features:

- Report creation form
- Report status tracking
- Patient and type filters
- Report detail view
- Template management for higher roles

### Inventory

What you will see first:

- Item table with category and stock filters
- Low-stock toggle
- New-item modal

How to use it the first time:

1. Open `Inventory`.
2. Search or filter for the item you need.
3. Use the low-stock toggle to review risk items.
4. Click `New Item` to create a new supply item.
5. Complete item code, category, stock, and reorder details.
6. Save and verify the item appears in the list.

Key features:

- Inventory item list
- Category filters
- Low-stock view
- Inventory item creation

### Configurations

What you will see first:

- Tabs for system settings, server connection, and audit trail
- Search and filters in the system-settings area
- Configuration edit modal

How to use it the first time:

1. Open `Configurations`.
2. Start in `System Settings`.
3. Search for the configuration key you want.
4. Filter by category or active state.
5. Open the configuration row and edit the value.
6. Save the change.
7. Use `Server Connection` when the task is infrastructure-related.
8. Use `Audit Trail` to confirm historical changes.

Key features:

- Configuration search and filter
- Key-value editing
- Server settings view
- Comprehensive audit viewer

### Staff

What you will see first:

- Staff list and related staff-management actions

How to use it the first time:

1. Open `Staff`.
2. Search for the staff member or begin a new staff creation flow.
3. Review or update role, department, and specialty assignment.
4. Save the staff record.
5. Ask the affected user to log out and sign back in if access needs to refresh.

Key features:

- Staff record management
- Role assignment
- Department assignment
- Specialty assignment

### Messages

What you will see first:

- Messages view and settings view toggle
- Inbox, sent, and archived folders
- Compose button and search box

How to use it the first time:

1. Open `Messages`.
2. Stay in the `Messages` view for normal communication.
3. Click `Compose`.
4. Select recipient type and enter the message.
5. Send the message.
6. Return to inbox to read replies.
7. Use `Mark all as read` when clearing unread items.
8. Open the `Settings` view if adjusting notification preferences.

Key features:

- Inbox
- Sent items
- Archived items
- Compose and reply flow
- Mark-all-read action
- Notification settings view

### Analytics

What you will see first:

- Tabbed analytics areas such as comprehensive, summary, encounter, pharmacy, billing, and operational views
- Trend-period selectors and chart cards

How to use it the first time:

1. Open `Analytics`.
2. Choose the tab that matches the question you are trying to answer.
3. Adjust the date or trend window.
4. Review the top summary cards first.
5. Move into charts and grouped statistics afterward.
6. Use billing or operational tabs for finance and throughput review.

Key features:

- Summary statistics
- Encounter analytics
- Pharmacy analytics
- Billing analytics
- Operational analytics
- Trend-window filtering

### Profile

What you will see first:

- Personal account details and profile-photo area
- Upload, change, and remove-photo actions
- Guidance settings section

How to use it the first time:

1. Open `Profile`.
2. Review your displayed personal information.
3. Click the photo action if you need to upload or replace your picture.
4. Save or confirm the upload.
5. Review guidance settings and adjust if needed.

Key features:

- Personal profile information
- Profile photo upload and removal
- Guidance settings

### Sync Center

What you will see first:

- Online or offline indicator
- Summary cards for pending, queued, syncing, failed, and saved work
- Queue records with retry and dismiss actions

How to use it the first time:

1. Open `Sync Center`.
2. Check whether the system is online or offline.
3. Review the summary counts.
4. Open the queue records list.
5. Retry failed records if needed.
6. Dismiss saved or failed records that no longer need attention.

Key features:

- Sync status indicator
- Background queue summary
- Failed-record retry
- Record dismissal

## Front Desk and Patient Access

Use the following modules for first-contact and visit-initiation work:

- `Patients`: register new patients, search returning patients, confirm demographics, and maintain identifying data.
- `Encounters`: create or open the visit for the day, set the current encounter context, and prepare the patient for downstream workflow.
- `Queue`: track patient movement between stations and identify waiting bottlenecks.
- `Customer Service`: handle patient-facing service tasks, support issues, and operational follow-up.

Recommended training sequence for front-desk users:

1. Search before creating a new patient to avoid duplicates.
2. Confirm payer category and visit details while creating the encounter.
3. Move the patient into the correct operational flow.
4. Watch queue state changes and communicate delays early.

## Clinical Care and Documentation

The main clinical work is centered in these areas:

- `Medical Records` is the unified place to review prior visits, results, and patient history.
- `Nursing Care` is used for triage, vitals, nursing observations, and care-support documentation.
- `OPD Consultation` is the standard clinical workspace for GOPD doctors.
- `Specialty Clinics` is the specialty-driven consultation workspace for non-GOPD specialty doctors.
- `Clinical Requests` manages requests such as referrals, admissions, and procedure-related actions.

Important clinical workflow notes:

- Some doctors will see a personalized specialty menu entry instead of the general specialty-clinic label.
- Specialty access depends on both role and specialty assignment.
- Embedded tools such as AI assistance, treatment planning, or specialty templates may appear inside clinical workflows rather than as standalone sidebar modules.
- `Medical Records` should be the first stop when a clinician needs longitudinal context before continuing care.

## Diagnostics Pharmacy and Procedures

These modules handle ordered services and service completion:

- `Laboratory`: manage investigation queues, enter results, and validate completed tests.
- `Radiology`: manage imaging requests, images, and radiology reporting.
- `Pharmacy`: review prescriptions, dispense medication, and coordinate medication fulfillment.
- `Procedures`: manage clinical procedures that sit outside standard consultation notes.
- `Medical Reports`: generate formal patient-facing or institution-facing reports after care is delivered.

Training emphasis for service departments:

- Confirm patient and encounter identity before processing an order.
- Confirm whether payment or approval prerequisites are complete before proceeding.
- Ensure results and completion updates return to the broader patient record so the treating clinician can follow up.

## Specialty and Longitudinal Care

This group covers extended, specialized, or department-specific care:

- `In-Patient` for ward and admission workflows
- `Surgery and Theatre` for surgical scheduling and theatre operations
- `Hygiene and Infection Control` for surveillance and compliance-related tracking
- `Accident and Emergency` for urgent and emergency care
- `Antenatal Care` for pregnancy follow-up and maternal-care workflow
- `Dental`, `Ophthalmology`, `Physiotherapy`, and `Nutrition` for department-specific care delivery

Operational note: these modules are not universally visible. Many are restricted by role, and some are further narrowed by department or specialty assignment.

## Finance Insurance and Operations

The non-clinical backbone of the EMR is handled here:

- `Billing and Payments` processes consultation fees, order-linked payments, receipts, and payment state transitions.
- `NHIS` supports insurance and approval workflows for covered services.
- `Inventory` manages stock visibility and stock governance.
- `Analytics` gives leadership and admins a higher-level view of throughput and performance.

Finance training notes:

- The app supports payment-gated workflows, so staff should understand when a downstream service cannot continue until a payment or scheme state is satisfied.
- Legacy cashier bookmarks now resolve into the Billing module.
- Insurance workflows are handled in `NHIS`, not in the general clinical screens.

## Settings Configuration and Audit

Users regularly ask where settings live. The app has several settings locations depending on the type of change required.

### Personal Settings

- Open the user avatar in the top-right corner to access theme controls and sign out.
- Open `Profile` to manage your own profile details and profile photo.
- `Profile` also includes application guidance settings.

### System Settings

Open `Configurations` if you are an authorized admin user. The module currently provides three main tabs:

- `System Settings`: search, filter, review, and edit configuration keys and values.
- `Server Connection`: review or update server-connection-related settings.
- `Audit Trail`: review configuration and system audit history for compliance and troubleshooting.

### Administrative Setup

- Use `Staff` to create staff records, assign roles, and control access.
- Use `Configurations` for organization-wide settings rather than personal preferences.
- Use `Analytics` and `Audit Trail` for oversight, review, and operations monitoring.

## Role and Access Guide

The app uses explicit module-level permission checks. The following summary matches the live role and module access rules in the renderer.

| Role | Typical Access Pattern |
| --- | --- |
| Super Admin | Full access to all major modules |
| Admin | Broad access across clinical, operational, financial, staffing, and configuration modules |
| Medical Director | Broad clinical and oversight access including analytics |
| Doctor | Registration, encounter, consultation, specialty, records, diagnostics view, procedures, inpatient, and related clinical requests |
| Nurse | Registration, encounter, nursing, procedures, queue, inpatient, ANC, and other nurse-facing workflows |
| Receptionist | Dashboard, patients, encounters, queue, customer service, and selected request workflows |
| Lab Technician | Dashboard, queue, laboratory, and medical-record visibility for lab operations |
| Radiologist | Dashboard, queue, radiology, and medical-record visibility for imaging operations |
| Pharmacist | Dashboard, pharmacy, queue, and medical-record visibility for dispensing workflows |
| Billing Clerk or Cashier | Billing, queue, and scheme-related financial workflows |
| Customer Service | Customer service, queue, and front-desk support workflows |
| Inventory Manager | Inventory-focused access |
| Config Admin | Configurations and staff administration |

Important access notes:

- Module visibility depends on role.
- Some specialty modules depend on department or specialty assignment in addition to role.
- All authenticated staff can access `Messages`.
- If a user can log in but cannot find a module, check the Staff role and specialty assignment first.

## Common Questions and Troubleshooting

### A module is missing from the sidebar

Possible causes:

- The user role does not include that module.
- The user is a specialist and the module label has been replaced with a dynamic specialty label.
- The user is missing the specialty or department mapping needed for that clinic.

### A service department cannot continue an order

Check the following:

- The patient is in the correct encounter.
- The billing or insurance prerequisite has been satisfied.
- The request is in the correct queue state.

### A saved action does not appear immediately

Open `Sync Center` and review:

- Whether the device is online or offline
- Whether the action is queued, syncing, failed, or saved
- Whether the record should be retried or dismissed

### A user needs personal preferences or training guidance

Send them to:

- `Profile` for personal details, profile photo, and guidance settings
- The avatar menu for theme changes and sign out

### An administrator needs system-level settings or audit history

Send them to `Configurations` and choose the appropriate tab:

- `System Settings`
- `Server Connection`
- `Audit Trail`

## Technical Quick Start

This section is for IT support, admins, or developers working with the repository rather than daily end users.

### Stack

- Electron desktop shell
- React and TypeScript renderer
- Supabase backend services
- React Query for server-state management

### Prerequisites

- Node.js
- npm
- Valid environment configuration in `.env`

Expected environment variables include the Supabase URL and key settings used by the app. Do not commit real secrets into documentation or code.

### Install and Run

```bash
npm install
npm start
```

### Run a Windows server (LAN)

One PC runs the database/API with Docker; every other PC runs the app as a
client and joins it from **Server settings** on the login screen.

```powershell
npm install
powershell -NoProfile -ExecutionPolicy Bypass `
  -File .\scripts\local-db\install-server-task.ps1
```

That adds the firewall rules, registers a start-at-sign-in task, starts the
stack, seeds the database only if it is empty, and prints the LAN URL and anon
key. Full details: `scripts/local-db/README.md`.

### Package the Desktop App

```bash
npm run package
```

### Useful Repository Notes

- The main desktop shell lives in `src/main`.
- The React application lives in `src/renderer`.
- User-facing routes are defined in `src/renderer/App.tsx`.
- Sidebar navigation is defined in `src/renderer/config/menu.ts` and adjusted dynamically for specialists.

## Summary

If you are training a new user, focus on four ideas first:

1. Use the correct module for the current station in the patient journey.
2. Know that access is role-based, so not every user sees the same sidebar.
3. Use `Medical Records` for longitudinal review and `Sync Center` when data seems delayed.
4. Use `Configurations`, `Staff`, and `Audit Trail` only for controlled administrative work.

This README is intended to be the main written user guide for the current EMR surface. If the app menu, routes, or module ownership changes, update this file so it stays aligned with the live product.
