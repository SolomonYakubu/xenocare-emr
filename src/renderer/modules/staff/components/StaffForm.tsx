import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff, Camera, Upload, Trash2, User } from 'lucide-react';
import { Button, Input, Select } from '../../../components/ui/FormElements';
import {
  useCreateStaff,
  useUpdateStaff,
  useNextStaffId,
  useClinics,
} from '../hooks/useStaff';
import {
  Staff,
  UserRole,
  StaffCategory,
  MilitaryBranch,
} from '../../../types/database.types';
import { useToast } from '../../../components/ui/Toast';
import { useSpecialtyDepartments } from '../../specialty-clinic/hooks/useSpecialtyDashboard';
import {
  isMilitaryFeatureEnabled,
  isSpecialtyClinicsEnabled,
} from '../../../config/features';

interface StaffFormProps {
  initialData?: Staff | null;
  onSuccess: () => void;
  onCancel: () => void;
}

const ROLES: { value: UserRole; label: string }[] = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'medical_director', label: 'Medical Director' },
  { value: 'doctor', label: 'Doctor' },
  { value: 'nurse', label: 'Nurse' },
  { value: 'lab_technician', label: 'Lab Technician' },
  { value: 'radiologist', label: 'Radiologist' },
  { value: 'pharmacist', label: 'Pharmacist' },
  { value: 'billing_clerk', label: 'Billing Clerk' },
  { value: 'receptionist', label: 'Receptionist' },
  { value: 'cashier', label: 'Cashier' },
  { value: 'customer_service', label: 'Customer Service' },
  { value: 'inventory_manager', label: 'Inventory Manager' },
  { value: 'config_admin', label: 'Config Admin' },
  // Specialty clinical roles
  { value: 'dentist', label: 'Dentist' },
  { value: 'ophthalmologist', label: 'Ophthalmologist' },
  { value: 'physiotherapist', label: 'Physiotherapist' },
];

const STAFF_CATEGORIES: { value: StaffCategory; label: string }[] = [
  { value: 'Military', label: 'Military' },
  { value: 'Civilian', label: 'Civilian' },
  { value: 'DS', label: 'DS' },
  { value: 'Guest Lecturer', label: 'Guest Lecturer' },
].filter(
  (category) =>
    isMilitaryFeatureEnabled() ||
    !['Military', 'DS'].includes(category.value),
) as { value: StaffCategory; label: string }[];


const MILITARY_BRANCHES: { value: MilitaryBranch; label: string }[] = [
  { value: 'Army', label: 'Army' },
  { value: 'Navy', label: 'Navy' },
  { value: 'Air Force', label: 'Air Force' },
];

export default function StaffForm({
  initialData,
  onSuccess,
  onCancel,
}: StaffFormProps) {
  const { register, handleSubmit, reset, watch, setValue } = useForm<
    Partial<Staff> & { password?: string }
  >({
    defaultValues: initialData || {
      is_active: true,
      role: 'doctor',
      staff_category: 'Civilian',
    },
  });

  const [showPassword, setShowPassword] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(
    initialData?.photo_url || null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const createStaff = useCreateStaff();
  const updateStaff = useUpdateStaff();
  const { data: clinics } = useClinics();
  const { data: specialtyDepartments } = useSpecialtyDepartments();
  const { showToast } = useToast();

  // Handle photo upload
  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        showToast({
          title: 'Please select an image file',
          message: 'Please select an image file',
          type: 'error',
        });
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        showToast({
          title: 'Image size should be less than 5MB',
          message: 'Image size should be less than 5MB',
          type: 'error',
        });
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        setPhotoPreview(base64);
        setValue('photo_url', base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = () => {
    setPhotoPreview(null);
    setValue('photo_url', null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const staffCategory = watch('staff_category');
  const selectedRole = watch('role');
  const currentStaffId = watch('staff_id');

  const clinicOptions = useMemo(() => {
    if (!clinics) return [];
    return clinics.map((clinic) => ({
      value: clinic.clinic_name, // Storing name as department for now
      label: clinic.clinic_name,
    }));
  }, [clinics]);

  // Specialty options for doctors
  const specialtyOptions = useMemo(() => {
    if (!specialtyDepartments) return [];
    return specialtyDepartments.map((dept) => ({
      value: dept.specialty_code,
      label: dept.specialty_name,
    }));
  }, [specialtyDepartments]);

  // Role prefix mapping for staff ID generation
  const getRolePrefix = (role: string): string => {
    const prefixes: Record<string, string> = {
      super_admin: 'ADM',
      admin: 'ADM',
      medical_director: 'MDR',
      doctor: 'DOC',
      nurse: 'NUR',
      lab_technician: 'LAB',
      radiologist: 'RAD',
      pharmacist: 'PHM',
      billing_clerk: 'BIL',
      receptionist: 'REC',
      cashier: 'CSH',
      customer_service: 'CSV',
      inventory_manager: 'INV',
      config_admin: 'CFG',
      // Specialty roles
      dentist: 'DEN',
      ophthalmologist: 'OPH',
      physiotherapist: 'PHY',
    };
    return prefixes[role] || 'STF';
  };

  // Fetch next staff ID when role changes (only for new staff)
  const { data: nextStaffId, isError: staffIdError } = useNextStaffId(
    selectedRole || '',
  );

  // Generate a fallback ID if the RPC fails or is not available
  const generateFallbackId = (role: string): string => {
    const prefix = getRolePrefix(role);
    const timestamp = Date.now().toString().slice(-4);
    return `${prefix}-${timestamp}`;
  };

  useEffect(() => {
    if (!initialData && selectedRole) {
      if (nextStaffId) {
        setValue('staff_id', nextStaffId, {
          shouldValidate: true,
          shouldDirty: true,
        });
      } else if (staffIdError) {
        // Use fallback if RPC failed
        const fallbackId = generateFallbackId(selectedRole);
        setValue('staff_id', fallbackId, {
          shouldValidate: true,
          shouldDirty: true,
        });
      }
    }
  }, [nextStaffId, staffIdError, selectedRole, initialData, setValue]);

  // Set initial staff ID on mount for new staff
  useEffect(() => {
    if (!initialData && selectedRole && !currentStaffId) {
      const fallbackId = generateFallbackId(selectedRole);
      setValue('staff_id', fallbackId, {
        shouldValidate: true,
        shouldDirty: true,
      });
    }
  }, []);

  useEffect(() => {
    if (initialData) {
      reset(initialData);
      setPhotoPreview(initialData.photo_url || null);
    }
  }, [initialData, reset]);

  const onSubmit = async (data: Partial<Staff> & { password?: string }) => {
    try {
      // Sanitize specialty_code: convert empty string to null to avoid FK violation
      if (!data.specialty_code) {
        data.specialty_code = null as any;
      }

      if (initialData?.id) {
        // Remove password from updates if it's empty or present (password update not supported here yet)
        const { password, ...updates } = data;
        await updateStaff.mutateAsync({ id: initialData.id, updates });
        showToast({
          title: 'Staff updated successfully',
          message: 'Staff updated successfully',
          type: 'success',
        });
      } else {
        // Always fetch a fresh staff_id at submission time to avoid stale/duplicate IDs
        if (data.role) {
          try {
            const { getNextStaffId } = await import('../api/staff.api');
            const freshId = await getNextStaffId(data.role);
            data.staff_id = freshId;
          } catch {
            // Fallback: use form value or generate temp ID
            if (!data.staff_id) {
              data.staff_id =
                nextStaffId || `S-${Date.now().toString().slice(-6)}`;
            }
          }
        } else if (!data.staff_id) {
          data.staff_id = nextStaffId || `S-${Date.now().toString().slice(-6)}`;
        }
        await createStaff.mutateAsync(data);
        showToast({
          title: 'Staff created successfully',
          message: 'Staff created successfully',
          type: 'success',
        });
      }
      onSuccess();
    } catch (error: any) {
      console.error(error);
      const errorMsg =
        error?.message ||
        (typeof error === 'string' ? error : 'Operation failed');

      // Specifically check if it's an IPC/Backend error from createAuthUser
      if (errorMsg.includes('Invalid admin:createUser payload')) {
        alert(
          `Action Failed: Missing permissions or invalid user data.\n\n${
            errorMsg
          }`,
        );
      } else {
        alert(`Error: ${errorMsg}`);
      }

      showToast({
        title: 'Operation failed',
        message: 'Failed. See alert for details.',
        type: 'error',
      });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Profile Photo Section */}
      <div className="flex items-start gap-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
        <div className="relative group">
          {photoPreview ? (
            <img
              src={photoPreview}
              alt="Profile"
              className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white shadow-lg border-4 border-white">
              <User className="w-10 h-10" />
            </div>
          )}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
          >
            <Camera className="w-8 h-8 text-white" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoChange}
            className="hidden"
          />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 mb-1">Profile Photo</h3>
          <p className="text-sm text-gray-500 mb-3">
            Upload a profile photo for easy identification. Max 5MB, JPG/PNG
            recommended.
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              {photoPreview ? 'Change Photo' : 'Upload Photo'}
            </Button>
            {photoPreview && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRemovePhoto}
                className="flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
                Remove
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="First Name"
          {...register('first_name', { required: 'First name is required' })}
        />
        <Input
          label="Last Name"
          {...register('last_name', { required: 'Last name is required' })}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Email"
          type="email"
          {...register('email', { required: 'Email is required' })}
        />
        <Input label="Phone" {...register('phone')} />
      </div>

      {!initialData && (
        <div className="grid grid-cols-1 gap-4">
          <Input
            label="Password"
            type={showPassword ? 'text' : 'password'}
            rightIcon={showPassword ? EyeOff : Eye}
            onRightIconClick={() => setShowPassword(!showPassword)}
            {...register('password', {
              required: 'Password is required for new staff',
              minLength: {
                value: 8,
                message: 'Password must be at least 8 characters',
              },
            })}
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Staff ID"
          value={currentStaffId || ''}
          onChange={(e) => setValue('staff_id', e.target.value)}
          disabled={!!initialData}
        />
        <Select
          label="Role"
          {...register('role', { required: 'Role is required' })}
          options={ROLES.filter(
            (role) =>
              isSpecialtyClinicsEnabled() ||
              !['dentist', 'ophthalmologist', 'physiotherapist'].includes(
                role.value,
              ),
          )}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Category"
          {...register('staff_category')}
          options={STAFF_CATEGORIES}
        />
        <Select
          label="Clinic"
          {...register('department')}
          options={clinicOptions}
          placeholder="Select Clinic"
        />
      </div>

      {/* Specialty selection for doctors */}
      {isSpecialtyClinicsEnabled() && selectedRole === 'doctor' && (
        <div className="grid grid-cols-1 gap-4">
          <Select
            label="Specialty"
            {...register('specialty_code')}
            options={specialtyOptions}
            placeholder="Select Specialty (required for doctors)"
          />
          <p className="text-xs text-gray-500 -mt-2">
            Assigning a specialty enables the dynamic specialty clinic dashboard
            for this doctor.
          </p>
        </div>
      )}

      {isMilitaryFeatureEnabled() && staffCategory === 'Military' && (
        <div className="grid grid-cols-3 gap-4">
          <Select
            label="Branch"
            {...register('military_branch')}
            options={MILITARY_BRANCHES}
          />
          <Input label="Rank" {...register('rank')} />
          <Input label="Service Number" {...register('service_number')} />
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="is_active"
          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          {...register('is_active')}
        />
        <label
          htmlFor="is_active"
          className="text-sm font-medium text-gray-700"
        >
          Active Account
        </label>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          isLoading={createStaff.isPending || updateStaff.isPending}
        >
          {initialData ? 'Update Staff' : 'Create Staff'}
        </Button>
      </div>
    </form>
  );
}
