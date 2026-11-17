import {
  Users,
  Stethoscope,
  Activity,
  Pill,
  FlaskConical,
  Scan,
  ListOrdered,
  CreditCard,
  BarChart3,
  FileText,
  Headset,
  Package,
  Settings,
  CalendarClock,
  Bed,
  Syringe,
  ClipboardList,
  UserCog,
  Eye,
  Smile,
  HeartPulse,
  FolderHeart,
  Shield,
  Scissors,
  Sparkles,
  MessageSquare,
  Microscope,
  Siren,
  Baby,
  Leaf,
  History,
} from 'lucide-react';

// Import NHIS Logo
import nhisLogo from '../../../assets/nhis_logo.png';
import {
  isEmergencyFeatureEnabled,
  isHygieneFeatureEnabled,
  isNhisFeatureEnabled,
  isSpecialtyModuleEnabled,
  SPECIALTY_CLINIC_MODULES,
} from './features';

export interface MenuItem {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  module: string;
  description?: string;
  color?: string;
  /** Optional image source to use instead of icon */
  imageSrc?: string;
}

const baseMenuItems: MenuItem[] = [
  {
    to: '/',
    icon: BarChart3,
    label: 'Dashboard',
    module: 'dashboard',
    description: 'Overview and analytics',
    color: 'bg-gray-500',
  },
  {
    to: '/registration',
    icon: Users,
    label: 'Patients',
    module: 'registration',
    description: 'Patient registration and management',
    color: 'bg-blue-500',
  },
  {
    to: '/medical-records',
    icon: FolderHeart,
    label: 'Medical Records',
    module: 'medical-records',
    description: 'Unified patient medical records (All Clinicians)',
    color: 'bg-rose-600',
  },
  {
    to: '/encounter',
    icon: CalendarClock,
    label: 'Visits',
    module: 'encounter',
    description: 'Patient visits and clinic management',
    color: 'bg-emerald-500',
  },
  {
    to: '/consultation',
    icon: Stethoscope,
    label: 'Consultation',
    module: 'consultation',
    description: 'Outpatient consultations and diagnosis',
    color: 'bg-green-500',
  },
  {
    to: '/specialty-clinic',
    icon: Microscope,
    label: 'Specialty Clinics',
    module: 'specialty-clinic',
    description:
      'Specialty OPD consultations with template-driven examinations',
    color: 'bg-violet-500',
  },
  {
    to: '/nursing',
    icon: Activity,
    label: 'Nursing Care',
    module: 'nursing',
    description: 'Nursing assessments and care plans',
    color: 'bg-pink-500',
  },
  {
    to: '/pharmacy',
    icon: Pill,
    label: 'Pharmacy',
    module: 'pharmacy',
    description: 'Medication dispensing and inventory',
    color: 'bg-purple-500',
  },
  {
    to: '/lab',
    icon: FlaskConical,
    label: 'Laboratory',
    module: 'lab',
    description: 'Lab tests and results management',
    color: 'bg-yellow-500',
  },
  {
    to: '/radiology',
    icon: Scan,
    label: 'Radiology',
    module: 'radiology',
    description: 'Imaging and radiology reports',
    color: 'bg-indigo-500',
  },
  {
    to: '/in-patient',
    icon: Bed,
    label: 'In-patients',
    module: 'in-patient',
    description: 'Ward management and admissions',
    color: 'bg-violet-500',
  },
  {
    to: '/surgery',
    icon: Scissors,
    label: 'Surgery/Theatre',
    module: 'surgery',
    description: 'Surgical procedures and theatre management',
    color: 'bg-red-600',
  },
  {
    to: '/hygiene',
    icon: Sparkles,
    label: 'Hygiene & IC',
    module: 'hygiene',
    description: 'Hygiene care and infection control surveillance',
    color: 'bg-teal-600',
  },
  {
    to: '/ae',
    icon: Siren,
    label: 'A&E',
    module: 'emergency',
    description: 'Accident & Emergency Department',
    color: 'bg-red-600',
  },
  {
    to: '/anc',
    icon: Baby,
    label: 'Antenatal Care',
    module: 'anc',
    description: 'Pregnancy care and monitoring',
    color: 'bg-pink-500',
  },
  {
    to: '/procedures',
    icon: Syringe,
    label: 'Procedures',
    module: 'procedures',
    description: 'Medical procedures and surgeries',
    color: 'bg-fuchsia-500',
  },
  {
    to: '/dental',
    icon: Smile,
    label: 'Dental',
    module: 'dental',
    description: 'Dental examinations and charting',
    color: 'bg-cyan-600',
  },
  {
    to: '/ophthalmology',
    icon: Eye,
    label: 'Ophthalmology',
    module: 'ophthalmology',
    description: 'Eye examinations and vision care',
    color: 'bg-indigo-600',
  },
  {
    to: '/physiotherapy',
    icon: HeartPulse,
    label: 'Physiotherapy',
    module: 'physiotherapy',
    description: 'Physical therapy and rehabilitation',
    color: 'bg-purple-600',
  },
  {
    to: '/nutrition',
    icon: Leaf,
    label: 'Nutrition',
    module: 'nutrition',
    description: 'Nutrition assessment, meal planning, and follow-up',
    color: 'bg-lime-600',
  },
  {
    to: '/clinical-requests',
    icon: ClipboardList,
    label: 'Requests',
    module: 'clinical-requests',
    description: 'Manage admission, procedure, and referral requests',
    color: 'bg-sky-500',
  },
  // {
  //   to: '/queue',
  //   icon: ListOrdered,
  //   label: 'Queue',
  //   module: 'queue',
  //   description: 'Patient queue management',
  //   color: 'bg-orange-500',
  // },
  {
    to: '/billing',
    icon: CreditCard,
    label: 'Billing & Payments',
    module: 'billing',
    description: 'Payments, invoicing, and receipts',
    color: 'bg-teal-500',
  },
  {
    to: '/nhis',
    icon: Shield,
    label: 'NHIS',
    module: 'nhis',
    description: 'National Health Insurance Scheme management',
    color: 'bg-green-600',
    imageSrc: nhisLogo,
  },
  {
    to: '/customer-service',
    icon: Headset,
    label: 'Customer Service',
    module: 'customer-service',
    description: 'Patient inquiries and support',
    color: 'bg-cyan-500',
  },
  {
    to: '/medical-reports',
    icon: FileText,
    label: 'Medical Reports',
    module: 'medical-reports',
    description: 'Generate and view medical reports',
    color: 'bg-slate-500',
  },
  {
    to: '/inventory',
    icon: Package,
    label: 'Inventory',
    module: 'inventory',
    description: 'Stock management and tracking',
    color: 'bg-amber-500',
  },
  {
    to: '/configurations',
    icon: Settings,
    label: 'Configurations',
    module: 'configurations',
    description: 'System settings and setup',
    color: 'bg-gray-500',
  },
  {
    to: '/staff',
    icon: UserCog,
    label: 'Staff',
    module: 'staff',
    description: 'Staff management and privileges',
    color: 'bg-blue-600',
  },
  {
    to: '/messaging',
    icon: MessageSquare,
    label: 'Messages',
    module: 'messaging',
    description: 'Internal staff messaging and notes',
    color: 'bg-violet-500',
  },
  {
    to: '/records-history',
    icon: History,
    label: 'Records History',
    module: 'records-history',
    description: 'Browse and export all clinical records',
    color: 'bg-slate-600',
  },
  {
    to: '/analytics',
    icon: BarChart3,
    label: 'Analytics',
    module: 'analytics',
    description: 'Data analysis and reporting',
    color: 'bg-rose-500',
  },
];

export const menuItems: MenuItem[] = baseMenuItems.filter((item) => {
  if (!isNhisFeatureEnabled() && item.module === 'nhis') return false;
  if (!isEmergencyFeatureEnabled() && item.module === 'emergency') return false;
  if (!isHygieneFeatureEnabled() && item.module === 'hygiene') return false;
  if (
    (SPECIALTY_CLINIC_MODULES as readonly string[]).includes(item.module) &&
    !isSpecialtyModuleEnabled(item.module)
  ) {
    return false;
  }
  return true;
});
