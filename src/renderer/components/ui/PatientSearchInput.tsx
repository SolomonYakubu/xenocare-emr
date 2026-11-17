// =============================================================================
// XENOCARE EMR - Patient Search Input Component
// Reusable patient search component for use across all modules
// Searches by: Patient number, Name, Phone
// =============================================================================

import React, { useState, useRef, useEffect } from 'react';
import { Search, User, Loader2, X, Phone, IdCard } from 'lucide-react';
import { usePatientSearch } from '../../modules/patient-registration/hooks/usePatient';
import { useDebounce } from '../../hooks/useDebounce';
import type { PatientDTO } from '../../modules/patient-registration/dtos/patient.dto';

interface PatientSearchInputProps {
  value: string;
  onChange: (patientId: string, patient: PatientDTO | null) => void;
  selectedPatient?: PatientDTO | null;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  autoFocus?: boolean;
}

const PatientSearchInput: React.FC<PatientSearchInputProps> = ({
  value,
  onChange,
  selectedPatient,
  placeholder = 'Search by patient number, name, or phone...',
  disabled = false,
  className = '',
  autoFocus = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce search for performance
  const debouncedSearch = useDebounce(searchTerm, 300);
  const { data: searchResults, isLoading } = usePatientSearch(debouncedSearch);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto focus
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleSelect = (patient: PatientDTO) => {
    onChange(patient.id || '', patient);
    setSearchTerm('');
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange('', null);
    setSearchTerm('');
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchTerm(newValue);
    setIsOpen(newValue.length >= 1);
  };

  // Calculate age from date of birth
  const calculateAge = (dateOfBirth: string | null | undefined): string => {
    if (!dateOfBirth) return '';
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let years = today.getFullYear() - birthDate.getFullYear();
    let months = today.getMonth() - birthDate.getMonth();
    let days = today.getDate() - birthDate.getDate();
    if (days < 0) {
      months--;
      const prev = new Date(today.getFullYear(), today.getMonth(), 0);
      days += prev.getDate();
    }
    if (months < 0) {
      years--;
      months += 12;
    }
    if (years === 0 && months === 0) {
      const weeks = Math.floor(days / 7);
      const rem = days % 7;
      if (weeks > 0 && rem > 0) return `${weeks}w ${rem}d`;
      if (weeks > 0) return `${weeks}w`;
      return `${days}d`;
    }
    if (years === 0) {
      const parts = [`${months}m`];
      if (days > 0) parts.push(`${days}d`);
      return parts.join(' ');
    }
    const parts = [`${years}y`];
    if (months > 0) parts.push(`${months}m`);
    if (days > 0) parts.push(`${days}d`);
    return parts.join(' ');
  };

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      {/* Selected Patient Display */}
      {selectedPatient ? (
        <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <User className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">
                {selectedPatient.surname}, {selectedPatient.first_name}
                {selectedPatient.middle_name &&
                  ` ${selectedPatient.middle_name}`}
              </p>
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <IdCard className="h-3.5 w-3.5" />
                  {selectedPatient.emr_number || selectedPatient.patient_id}
                </span>
                {selectedPatient.contact_phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" />
                    {selectedPatient.contact_phone}
                  </span>
                )}
                {selectedPatient.date_of_birth && (
                  <span>{calculateAge(selectedPatient.date_of_birth)}</span>
                )}
              </div>
            </div>
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full"
              title="Clear selection"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      ) : (
        /* Search Input */
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={handleInputChange}
            onFocus={() => searchTerm.length >= 1 && setIsOpen(true)}
            placeholder={placeholder}
            disabled={disabled}
            className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-10 text-sm outline-none transition-colors focus:border-[#E9783F] focus:ring-2 focus:ring-[#E9783F]/15 disabled:cursor-not-allowed disabled:bg-slate-100"
          />
          {isLoading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 animate-spin" />
          )}
        </div>
      )}

      {/* Search Results Dropdown */}
      {isOpen && !selectedPatient && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />
              <span className="ml-2 text-gray-500">Searching...</span>
            </div>
          ) : searchResults && searchResults.length > 0 ? (
            <ul className="divide-y divide-gray-100">
              {searchResults.map((patient) => (
                <li key={patient.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(patient)}
                    className="w-full px-4 py-2.5 text-left transition-colors hover:bg-[#FBF1E9]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                        <User className="h-5 w-5 text-gray-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {patient.surname}, {patient.first_name}
                          {patient.middle_name && ` ${patient.middle_name}`}
                        </p>
                        <div className="flex items-center gap-3 text-sm text-gray-500">
                          <span className="flex items-center gap-1 text-blue-600 font-medium">
                            <IdCard className="h-3.5 w-3.5" />
                            {patient.emr_number || patient.patient_id}
                          </span>
                          {patient.contact_phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3.5 w-3.5" />
                              {patient.contact_phone}
                            </span>
                          )}
                          {patient.date_of_birth && (
                            <span>{calculateAge(patient.date_of_birth)}</span>
                          )}
                          <span
                            className={`px-1.5 py-0.5 rounded text-xs ${
                              (() => {
                                const t = (patient.insurance_type || '')
                                  .toLowerCase()
                                  .replace(/_/g, ' ')
                                  .trim();
                                return (
                                  t.includes('nhis') ||
                                  t === 'dhml' ||
                                  t === 'gifship'
                                );
                              })()
                                ? 'bg-green-100 text-green-700'
                                : patient.insurance_type === 'Private'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {patient.insurance_type ||
                              patient.patient_category ||
                              'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : debouncedSearch.length >= 1 ? (
            <div className="py-8 text-center">
              <User className="h-10 w-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500">No patients found</p>
              <p className="text-sm text-gray-400 mt-1">
                Try searching by patient number, name, or phone
              </p>
            </div>
          ) : (
            <div className="py-8 text-center">
              <Search className="h-10 w-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500">Start typing to search</p>
              <p className="text-sm text-gray-400 mt-1">
                Search by patient number (e.g., NDC-0001), name, or phone
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PatientSearchInput;
