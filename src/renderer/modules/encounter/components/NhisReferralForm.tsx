// =============================================================================
// NHIS REFERRAL FORM - XENOCARE BRANDED PRINTABLE COMPONENT
//
// Professional printable NHIS Referral Form with XenoCare
// branding. Uses inline styles for reliable printing across all browsers.
//
// Patient Display Logic:
//   Military: Rank + Full Name + Service Number + Branch of Service
//   Civilian: Title + Full Name (e.g., Mr. John Doe)
// =============================================================================

import React, { forwardRef } from 'react';

export interface NhisReferralFormData {
  // Header Info
  nhisReferralCode: string;
  nhisIdNo: string;
  hmoCode: string;
  date: string;

  // Facilities
  fromFacility: string;
  fromFacilityNhisId: string;
  fromFacilityAddress: string;
  referredTo: string;
  referredToNhisId?: string;
  referredToAddress?: string;

  // Patient Info
  fileNo: string;
  patientName: string;
  patientCategory?: string; // Military or Civilian
  patientTitle?: string; // Mr., Mrs., Dr., Prof., etc.
  patientRank?: string; // Military rank
  serviceNumber?: string; // Military service number
  militaryBranch?: string; // Army, Navy, Air Force
  patientAge?: number;
  patientGender?: string;
  dateOfBirth?: string; // ISO date string
  patientAddress: string;
  patientPhone: string;

  // Clinical Info
  clinicalFindings: string;
  investigation: string;
  provisionalDiagnosis: string;
  reasonForReferral: string;

  // Doctor Info
  doctorName: string;
  doctorSignature?: string;

  // Validity
  validFrom: string;
  validTo: string;
}

interface NhisReferralFormProps {
  data: NhisReferralFormData;
  showAcknowledgement?: boolean;
}

// XenoCare Logo path for embedding
export const NhisReferralForm = forwardRef<
  HTMLDivElement,
  NhisReferralFormProps
>(({ data, showAcknowledgement = true }, ref) => {
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '________________';
    try {
      return new Date(dateStr).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  // Build the display name based on patient category
  const getDisplayName = () => {
    const isMilitary = data.patientCategory?.toLowerCase() === 'military';
    if (isMilitary && data.patientRank) {
      return `${data.patientRank} ${data.patientName}`;
    }
    if (!isMilitary && data.patientTitle) {
      return `${data.patientTitle} ${data.patientName}`;
    }
    return data.patientName || '';
  };

  // Colours
  const BRAND_NAVY = '#006838';
  const BRAND_NAVY_LIGHT = '#008545';
  const BRAND_ACCENT = '#C5A44E';
  const BORDER_COLOR = '#d1d5db';
  const LABEL_COLOR = '#374151';
  const MUTED_COLOR = '#6b7280';

  return (
    <div
      ref={ref}
      style={{
        background: '#fff',
        padding: '28px 32px',
        maxWidth: '850px',
        margin: '0 auto',
        fontFamily: "'Segoe UI', Arial, Helvetica, sans-serif",
        fontSize: '13px',
        color: '#1f2937',
        lineHeight: '1.5',
      }}
    >
      {/* ===== MAIN FORM ===== */}
      <div
        style={{
          border: `2px solid ${BRAND_NAVY}`,
          borderRadius: '6px',
          overflow: 'hidden',
        }}
      >
        {/* ── HEADER BAND ── */}
        <div
          style={{
            background: `linear-gradient(135deg, ${BRAND_NAVY} 0%, ${BRAND_NAVY_LIGHT} 100%)`,
            padding: '16px 24px',
            textAlign: 'center',
            color: '#fff',
            position: 'relative',
          }}
        >
          {/* Left logo */}
          <div
            style={{
              position: 'absolute',
              left: '20px',
              top: '50%',
              transform: 'translateY(-50%)',
            }}
          >
            
          </div>
          {/* Right logo */}
          <div
            style={{
              position: 'absolute',
              right: '20px',
              top: '50%',
              transform: 'translateY(-50%)',
            }}
          >
            
          </div>

          <div
            style={{
              letterSpacing: '3px',
              fontSize: '18px',
              fontWeight: 800,
              textTransform: 'uppercase' as const,
            }}
          >
            XenoCare
          </div>
          <div
            style={{
              fontSize: '11px',
              letterSpacing: '1.5px',
              opacity: 0.85,
              marginTop: '2px',
              textTransform: 'uppercase' as const,
            }}
          >
            Medical Centre, Abuja
          </div>
          <div
            style={{
              marginTop: '8px',
              borderTop: '1px solid rgba(255,255,255,0.3)',
              paddingTop: '6px',
            }}
          >
            <span
              style={{
                fontSize: '14px',
                fontWeight: 700,
                letterSpacing: '4px',
                textTransform: 'uppercase' as const,
                color: BRAND_ACCENT,
              }}
            >
              NHIS Referral Form
            </span>
          </div>
        </div>

        {/* ── BODY ── */}
        <div style={{ padding: '20px 24px' }}>
          {/* ═══ SECTION 1: PATIENT BIO-DATA ═══ */}
          <div
            style={{
              border: `1px solid ${BORDER_COLOR}`,
              borderRadius: '4px',
              overflow: 'hidden',
              marginBottom: '16px',
            }}
          >
            <div
              style={{
                background: BRAND_NAVY,
                color: '#fff',
                padding: '6px 12px',
                fontSize: '10px',
                fontWeight: 700,
                textTransform: 'uppercase' as const,
                letterSpacing: '1.5px',
              }}
            >
              Patient Bio-Data
            </div>
            <div style={{ padding: '12px 14px' }}>
              {/* Full Name */}
              <div
                style={{
                  display: 'flex',
                  marginBottom: '10px',
                  alignItems: 'baseline',
                }}
              >
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: '11px',
                    color: LABEL_COLOR,
                    width: '140px',
                    flexShrink: 0,
                    textTransform: 'uppercase' as const,
                  }}
                >
                  Full Name:
                </span>
                <span
                  style={{
                    flex: 1,
                    borderBottom: `1px solid ${BORDER_COLOR}`,
                    padding: '0 6px 2px',
                    fontWeight: 700,
                    fontSize: '13px',
                  }}
                >
                  {getDisplayName()}
                </span>
              </div>

              {/* Category row — Military or Civilian */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '10px',
                  marginBottom: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline' }}>
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: '11px',
                      color: LABEL_COLOR,
                      width: '140px',
                      flexShrink: 0,
                      textTransform: 'uppercase' as const,
                    }}
                  >
                    Category:
                  </span>
                  <span
                    style={{
                      flex: 1,
                      borderBottom: `1px solid ${BORDER_COLOR}`,
                      padding: '0 6px 2px',
                      fontSize: '12px',
                      fontWeight: 600,
                    }}
                  >
                    {data.patientCategory || '—'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline' }}>
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: '11px',
                      color: LABEL_COLOR,
                      width: '130px',
                      flexShrink: 0,
                      textTransform: 'uppercase' as const,
                    }}
                  >
                    File No. (EMR):
                  </span>
                  <span
                    style={{
                      flex: 1,
                      borderBottom: `1px solid ${BRAND_NAVY}`,
                      padding: '0 6px 2px',
                      fontSize: '12px',
                      fontWeight: 700,
                      fontFamily: "'Courier New', monospace",
                      color: BRAND_NAVY,
                    }}
                  >
                    {data.fileNo || '—'}
                  </span>
                </div>
              </div>

              {/* Military-specific: Service No + Arm of Service */}
              {data.patientCategory?.toLowerCase() === 'military' && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '10px',
                    marginBottom: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'baseline' }}>
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: '11px',
                        color: LABEL_COLOR,
                        width: '140px',
                        flexShrink: 0,
                        textTransform: 'uppercase' as const,
                      }}
                    >
                      Service No:
                    </span>
                    <span
                      style={{
                        flex: 1,
                        borderBottom: `1px solid ${BORDER_COLOR}`,
                        padding: '0 6px 2px',
                        fontWeight: 600,
                        fontSize: '12px',
                        fontFamily: "'Courier New', monospace",
                      }}
                    >
                      {data.serviceNumber || '—'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline' }}>
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: '11px',
                        color: LABEL_COLOR,
                        width: '130px',
                        flexShrink: 0,
                        textTransform: 'uppercase' as const,
                      }}
                    >
                      Arm of Service:
                    </span>
                    <span
                      style={{
                        flex: 1,
                        borderBottom: `1px solid ${BORDER_COLOR}`,
                        padding: '0 6px 2px',
                        fontWeight: 600,
                        fontSize: '12px',
                      }}
                    >
                      {data.militaryBranch || '—'}
                    </span>
                  </div>
                </div>
              )}

              {/* Age / Gender / DOB */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: '10px',
                  marginBottom: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline' }}>
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: '11px',
                      color: LABEL_COLOR,
                      width: '50px',
                      flexShrink: 0,
                      textTransform: 'uppercase' as const,
                    }}
                  >
                    Age:
                  </span>
                  <span
                    style={{
                      flex: 1,
                      borderBottom: `1px solid ${BORDER_COLOR}`,
                      padding: '0 6px 2px',
                      fontSize: '12px',
                    }}
                  >
                    {(() => {
                      if (!data.dateOfBirth)
                        return data.patientAge ? `${data.patientAge} yrs` : '—';
                      const dob = new Date(data.dateOfBirth);
                      const today = new Date();
                      let years = today.getFullYear() - dob.getFullYear();
                      let months = today.getMonth() - dob.getMonth();
                      let days = today.getDate() - dob.getDate();
                      if (days < 0) {
                        months--;
                        const prev = new Date(
                          today.getFullYear(),
                          today.getMonth(),
                          0,
                        );
                        days += prev.getDate();
                      }
                      if (months < 0) {
                        years--;
                        months += 12;
                      }
                      if (years === 0 && months === 0) {
                        const weeks = Math.floor(days / 7);
                        const rem = days % 7;
                        if (weeks > 0 && rem > 0)
                          return `${weeks} wk${weeks > 1 ? 's' : ''}, ${rem} day${rem > 1 ? 's' : ''}`;
                        if (weeks > 0)
                          return `${weeks} wk${weeks > 1 ? 's' : ''}`;
                        return `${days} day${days !== 1 ? 's' : ''}`;
                      }
                      if (years === 0) {
                        const parts = [`${months} mth${months > 1 ? 's' : ''}`];
                        if (days > 0)
                          parts.push(`${days} day${days > 1 ? 's' : ''}`);
                        return parts.join(', ');
                      }
                      const parts = [`${years} yr${years > 1 ? 's' : ''}`];
                      if (months > 0)
                        parts.push(`${months} mth${months > 1 ? 's' : ''}`);
                      if (days > 0)
                        parts.push(`${days} day${days > 1 ? 's' : ''}`);
                      return parts.join(', ');
                    })()}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline' }}>
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: '11px',
                      color: LABEL_COLOR,
                      width: '65px',
                      flexShrink: 0,
                      textTransform: 'uppercase' as const,
                    }}
                  >
                    Gender:
                  </span>
                  <span
                    style={{
                      flex: 1,
                      borderBottom: `1px solid ${BORDER_COLOR}`,
                      padding: '0 6px 2px',
                      fontSize: '12px',
                    }}
                  >
                    {data.patientGender || '—'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline' }}>
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: '11px',
                      color: LABEL_COLOR,
                      width: '50px',
                      flexShrink: 0,
                      textTransform: 'uppercase' as const,
                    }}
                  >
                    DOB:
                  </span>
                  <span
                    style={{
                      flex: 1,
                      borderBottom: `1px solid ${BORDER_COLOR}`,
                      padding: '0 6px 2px',
                      fontSize: '12px',
                    }}
                  >
                    {data.dateOfBirth ? formatDate(data.dateOfBirth) : '—'}
                  </span>
                </div>
              </div>

              {/* Address */}
              <div
                style={{
                  display: 'flex',
                  marginBottom: '10px',
                  alignItems: 'baseline',
                }}
              >
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: '11px',
                    color: LABEL_COLOR,
                    width: '140px',
                    flexShrink: 0,
                    textTransform: 'uppercase' as const,
                  }}
                >
                  Address:
                </span>
                <span
                  style={{
                    flex: 1,
                    borderBottom: `1px solid ${BORDER_COLOR}`,
                    padding: '0 6px 2px',
                    fontSize: '12px',
                  }}
                >
                  {data.patientAddress || ''}
                </span>
              </div>

              {/* Phone */}
              <div style={{ display: 'flex', alignItems: 'baseline' }}>
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: '11px',
                    color: LABEL_COLOR,
                    width: '140px',
                    flexShrink: 0,
                    textTransform: 'uppercase' as const,
                  }}
                >
                  Phone:
                </span>
                <span
                  style={{
                    flex: 1,
                    borderBottom: `1px solid ${BORDER_COLOR}`,
                    padding: '0 6px 2px',
                    fontSize: '12px',
                  }}
                >
                  {data.patientPhone || ''}
                </span>
              </div>
            </div>
          </div>

          {/* ═══ SECTION 2: NHIS DETAILS ═══ */}
          <div
            style={{
              border: `1px solid ${BORDER_COLOR}`,
              borderRadius: '4px',
              overflow: 'hidden',
              marginBottom: '16px',
            }}
          >
            <div
              style={{
                background: BRAND_NAVY,
                color: '#fff',
                padding: '6px 12px',
                fontSize: '10px',
                fontWeight: 700,
                textTransform: 'uppercase' as const,
                letterSpacing: '1.5px',
              }}
            >
              NHIS Details
            </div>
            <div style={{ padding: '12px 14px' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '10px',
                  marginBottom: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline' }}>
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: '11px',
                      color: LABEL_COLOR,
                      width: '140px',
                      flexShrink: 0,
                      textTransform: 'uppercase' as const,
                    }}
                  >
                    Referral Code:
                  </span>
                  <span
                    style={{
                      flex: 1,
                      borderBottom: `2px solid ${BRAND_NAVY}`,
                      padding: '0 6px 2px',
                      fontWeight: 700,
                      fontSize: '13px',
                      fontFamily: "'Courier New', monospace",
                      color: BRAND_NAVY,
                    }}
                  >
                    {data.nhisReferralCode || '—'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline' }}>
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: '11px',
                      color: LABEL_COLOR,
                      width: '130px',
                      flexShrink: 0,
                      textTransform: 'uppercase' as const,
                    }}
                  >
                    NHIS ID No:
                  </span>
                  <span
                    style={{
                      flex: 1,
                      borderBottom: `1px solid ${BORDER_COLOR}`,
                      padding: '0 6px 2px',
                      fontWeight: 600,
                      fontSize: '12px',
                    }}
                  >
                    {data.nhisIdNo || '—'}
                  </span>
                </div>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '10px',
                  marginBottom: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline' }}>
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: '11px',
                      color: LABEL_COLOR,
                      width: '140px',
                      flexShrink: 0,
                      textTransform: 'uppercase' as const,
                    }}
                  >
                    HMO / Scheme:
                  </span>
                  <span
                    style={{
                      flex: 1,
                      borderBottom: `1px solid ${BORDER_COLOR}`,
                      padding: '0 6px 2px',
                      fontWeight: 600,
                      fontSize: '12px',
                    }}
                  >
                    {data.hmoCode || '—'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline' }}>
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: '11px',
                      color: LABEL_COLOR,
                      width: '130px',
                      flexShrink: 0,
                      textTransform: 'uppercase' as const,
                    }}
                  >
                    Dest. Facility NHIS ID:
                  </span>
                  <span
                    style={{
                      flex: 1,
                      borderBottom: `1px solid ${BORDER_COLOR}`,
                      padding: '0 6px 2px',
                      fontWeight: 600,
                      fontSize: '12px',
                    }}
                  >
                    {data.referredToNhisId || '—'}
                  </span>
                </div>
              </div>
              {/* Validity / Dates inside NHIS section */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '10px',
                  padding: '8px 0 0',
                  borderTop: `1px dashed ${BORDER_COLOR}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline' }}>
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: '11px',
                      color: BRAND_NAVY,
                      width: '160px',
                      flexShrink: 0,
                      textTransform: 'uppercase' as const,
                    }}
                  >
                    Date Code Issued:
                  </span>
                  <span
                    style={{
                      flex: 1,
                      borderBottom: `1px solid ${BRAND_NAVY}`,
                      padding: '0 6px 2px',
                      fontWeight: 600,
                      fontSize: '12px',
                    }}
                  >
                    {formatDate(data.validFrom || data.date)}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline' }}>
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: '11px',
                      color: '#b91c1c',
                      width: '170px',
                      flexShrink: 0,
                      textTransform: 'uppercase' as const,
                    }}
                  >
                    Code Expiry (30 Days):
                  </span>
                  <span
                    style={{
                      flex: 1,
                      borderBottom: `1px solid #b91c1c`,
                      padding: '0 6px 2px',
                      fontWeight: 600,
                      fontSize: '12px',
                      color: '#b91c1c',
                    }}
                  >
                    {(() => {
                      if (data.validTo) return formatDate(data.validTo);
                      const issueDate = data.validFrom || data.date;
                      if (!issueDate) return '—';
                      const d = new Date(issueDate);
                      d.setDate(d.getDate() + 30);
                      return formatDate(d.toISOString());
                    })()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ═══ SECTION 3: FACILITY INFORMATION ═══ */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '14px',
              marginBottom: '16px',
            }}
          >
            {/* FROM */}
            <div
              style={{
                border: `1px solid ${BORDER_COLOR}`,
                borderRadius: '4px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  background: BRAND_NAVY,
                  color: '#fff',
                  padding: '5px 10px',
                  fontSize: '10px',
                  fontWeight: 700,
                  textTransform: 'uppercase' as const,
                  letterSpacing: '1px',
                }}
              >
                From (Health Facility)
              </div>
              <div style={{ padding: '10px' }}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: '12px',
                    marginBottom: '2px',
                  }}
                >
                  {data.fromFacility ||
                    'XenoCare'}
                </div>
                {data.fromFacilityNhisId && (
                  <div style={{ fontSize: '11px', color: MUTED_COLOR }}>
                    NHIS ID: {data.fromFacilityNhisId}
                  </div>
                )}
                <div style={{ fontSize: '11px', color: MUTED_COLOR }}>
                  {data.fromFacilityAddress || 'XenoCare'}
                </div>
              </div>
            </div>
            {/* REFERRED TO */}
            <div
              style={{
                border: `1px solid ${BORDER_COLOR}`,
                borderRadius: '4px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  background: BRAND_NAVY,
                  color: '#fff',
                  padding: '5px 10px',
                  fontSize: '10px',
                  fontWeight: 700,
                  textTransform: 'uppercase' as const,
                  letterSpacing: '1px',
                }}
              >
                Referred To
              </div>
              <div style={{ padding: '10px' }}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: '12px',
                    marginBottom: '2px',
                  }}
                >
                  {data.referredTo || '________________________________'}
                </div>
                {data.referredToAddress && (
                  <div style={{ fontSize: '11px', color: MUTED_COLOR }}>
                    {data.referredToAddress}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Referring Doctor — below facilities */}
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              marginBottom: '16px',
              marginTop: '-8px',
            }}
          >
            <span
              style={{
                fontWeight: 700,
                fontSize: '11px',
                color: LABEL_COLOR,
                width: '140px',
                flexShrink: 0,
                textTransform: 'uppercase' as const,
              }}
            >
              Referring Doctor:
            </span>
            <span
              style={{
                flex: 1,
                borderBottom: `1px solid ${BORDER_COLOR}`,
                padding: '0 6px 2px',
                fontWeight: 600,
                fontSize: '12px',
              }}
            >
              {data.doctorName || '—'}
            </span>
          </div>

          {/* ═══ SECTION 4: CLINICAL DETAILS ═══ */}
          <div
            style={{
              border: `1px solid ${BORDER_COLOR}`,
              borderRadius: '4px',
              overflow: 'hidden',
              marginBottom: '16px',
            }}
          >
            <div
              style={{
                background: BRAND_NAVY,
                color: '#fff',
                padding: '6px 12px',
                fontSize: '10px',
                fontWeight: 700,
                textTransform: 'uppercase' as const,
                letterSpacing: '1.5px',
              }}
            >
              Clinical Details
            </div>
            <div style={{ padding: '12px 14px' }}>
              {/* Clinical Findings */}
              <div style={{ marginBottom: '12px' }}>
                <div
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    color: '#fff',
                    textTransform: 'uppercase' as const,
                    letterSpacing: '1.5px',
                    background: BRAND_NAVY,
                    padding: '4px 10px',
                    borderRadius: '3px 3px 0 0',
                    display: 'inline-block',
                  }}
                >
                  Clinical Findings
                </div>
                <div
                  style={{
                    border: `1px solid ${BORDER_COLOR}`,
                    borderTop: `2px solid ${BRAND_NAVY}`,
                    borderRadius: '0 4px 4px 4px',
                    padding: '10px 12px',
                    minHeight: '60px',
                    whiteSpace: 'pre-wrap' as const,
                    fontSize: '12px',
                    background: '#fafafa',
                  }}
                >
                  {data.clinicalFindings || ''}
                </div>
              </div>

              {/* Investigation */}
              <div style={{ marginBottom: '12px' }}>
                <div
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    color: '#fff',
                    textTransform: 'uppercase' as const,
                    letterSpacing: '1.5px',
                    background: BRAND_NAVY,
                    padding: '4px 10px',
                    borderRadius: '3px 3px 0 0',
                    display: 'inline-block',
                  }}
                >
                  Investigation
                </div>
                <div
                  style={{
                    border: `1px solid ${BORDER_COLOR}`,
                    borderTop: `2px solid ${BRAND_NAVY}`,
                    borderRadius: '0 4px 4px 4px',
                    padding: '10px 12px',
                    minHeight: '50px',
                    whiteSpace: 'pre-wrap' as const,
                    fontSize: '12px',
                    background: '#fafafa',
                  }}
                >
                  {data.investigation || ''}
                </div>
              </div>

              {/* Provisional Diagnosis */}
              <div style={{ marginBottom: '12px' }}>
                <div
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    color: '#fff',
                    textTransform: 'uppercase' as const,
                    letterSpacing: '1.5px',
                    background: BRAND_NAVY,
                    padding: '4px 10px',
                    borderRadius: '3px 3px 0 0',
                    display: 'inline-block',
                  }}
                >
                  Provisional Diagnosis
                </div>
                <div
                  style={{
                    border: `1px solid ${BORDER_COLOR}`,
                    borderTop: `2px solid ${BRAND_NAVY}`,
                    borderRadius: '0 4px 4px 4px',
                    padding: '10px 12px',
                    minHeight: '40px',
                    whiteSpace: 'pre-wrap' as const,
                    fontSize: '12px',
                    background: '#fafafa',
                  }}
                >
                  {data.provisionalDiagnosis || ''}
                </div>
              </div>

              {/* Reason for Referral */}
              <div>
                <div
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    color: '#fff',
                    textTransform: 'uppercase' as const,
                    letterSpacing: '1.5px',
                    background: BRAND_NAVY,
                    padding: '4px 10px',
                    borderRadius: '3px 3px 0 0',
                    display: 'inline-block',
                  }}
                >
                  Reason for Referral
                </div>
                <div
                  style={{
                    border: `1px solid ${BORDER_COLOR}`,
                    borderTop: `2px solid ${BRAND_NAVY}`,
                    borderRadius: '0 4px 4px 4px',
                    padding: '10px 12px',
                    minHeight: '50px',
                    whiteSpace: 'pre-wrap' as const,
                    fontSize: '12px',
                    background: '#fafafa',
                  }}
                >
                  {data.reasonForReferral || ''}
                </div>
              </div>
            </div>
            {/* end clinical details inner padding div */}
          </div>
          {/* end clinical details bordered section */}

          {/* SIGNATURE SECTION */}
          <div
            style={{
              borderTop: `2px solid ${BRAND_NAVY}`,
              paddingTop: '16px',
              marginTop: '20px',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '32px',
              }}
            >
              <div style={{ textAlign: 'center' as const }}>
                <div
                  style={{
                    borderBottom: `1px solid ${BORDER_COLOR}`,
                    height: '56px',
                    marginBottom: '4px',
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'center',
                    paddingBottom: '4px',
                  }}
                >
                  {/* Signature placeholder */}
                </div>
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: LABEL_COLOR,
                  }}
                >
                  Referring Doctor's Signature
                </div>
                <div
                  style={{
                    fontSize: '11px',
                    color: MUTED_COLOR,
                    marginTop: '2px',
                  }}
                >
                  {data.doctorName || ''}
                </div>
              </div>
              <div style={{ textAlign: 'center' as const }}>
                <div
                  style={{
                    borderBottom: `1px solid ${BORDER_COLOR}`,
                    height: '56px',
                    marginBottom: '4px',
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'center',
                    paddingBottom: '4px',
                  }}
                >
                  <div
                    style={{
                      width: '48px',
                      height: '48px',
                      border: `1px dashed ${BORDER_COLOR}`,
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <span style={{ fontSize: '9px', color: '#9ca3af' }}>
                      STAMP
                    </span>
                  </div>
                </div>
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: LABEL_COLOR,
                  }}
                >
                  Official Stamp
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* GREEN FOOTER BAND */}
        <div
          style={{
            background: BRAND_NAVY,
            padding: '4px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '9px',
            color: 'rgba(255,255,255,0.7)',
            letterSpacing: '0.5px',
          }}
        >
          <span>XenoCare — NHIS Referral Form</span>
          <span>
            Printed:{' '}
            {new Date().toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}
          </span>
        </div>
      </div>

      {/* ===== ACKNOWLEDGEMENT SLIP ===== */}
      {showAcknowledgement && (
        <>
          {/* Perforation Line */}
          <div
            style={{
              margin: '16px 0',
              borderTop: '2px dashed #9ca3af',
              position: 'relative' as const,
              textAlign: 'center' as const,
            }}
          >
            <span
              style={{
                position: 'absolute' as const,
                left: '50%',
                transform: 'translateX(-50%)',
                top: '-10px',
                background: '#fff',
                padding: '0 12px',
                fontSize: '10px',
                color: '#9ca3af',
                textTransform: 'uppercase' as const,
                letterSpacing: '1.5px',
              }}
            >
              ✂ Cut Here — Acknowledgement Slip
            </span>
          </div>

          <div
            style={{
              border: `2px solid ${BRAND_NAVY}`,
              borderRadius: '6px',
              overflow: 'hidden',
            }}
          >
            {/* Ack Header */}
            <div
              style={{
                background: `linear-gradient(135deg, ${BRAND_NAVY} 0%, ${BRAND_NAVY_LIGHT} 100%)`,
                padding: '8px 16px',
                textAlign: 'center' as const,
              }}
            >
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 800,
                  color: '#fff',
                  textTransform: 'uppercase' as const,
                  letterSpacing: '2px',
                }}
              >
                Acknowledgement Slip
              </div>
              <div
                style={{
                  fontSize: '10px',
                  color: 'rgba(255,255,255,0.8)',
                  marginTop: '2px',
                }}
              >
                To be completed by receiving facility and returned to referring
                facility
              </div>
            </div>

            <div style={{ padding: '14px 16px' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '12px',
                  marginBottom: '12px',
                  fontSize: '12px',
                }}
              >
                <div>
                  <span style={{ fontWeight: 700 }}>Referral Code: </span>
                  <span
                    style={{
                      borderBottom: `1px solid ${BORDER_COLOR}`,
                      padding: '0 4px',
                      fontFamily: "'Courier New', monospace",
                      fontWeight: 600,
                      color: BRAND_NAVY,
                    }}
                  >
                    {data.nhisReferralCode}
                  </span>
                </div>
                <div>
                  <span style={{ fontWeight: 700 }}>Patient: </span>
                  <span
                    style={{
                      borderBottom: `1px solid ${BORDER_COLOR}`,
                      padding: '0 4px',
                    }}
                  >
                    {getDisplayName()}
                  </span>
                </div>
              </div>

              <div style={{ fontSize: '12px' }}>
                {['Date Received', 'Received By', 'Signature & Stamp'].map(
                  (label) => (
                    <div
                      key={label}
                      style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        marginBottom: '10px',
                      }}
                    >
                      <span
                        style={{
                          fontWeight: 700,
                          width: '140px',
                          flexShrink: 0,
                        }}
                      >
                        {label}:
                      </span>
                      <span
                        style={{
                          flex: 1,
                          borderBottom: `1px solid ${BORDER_COLOR}`,
                        }}
                      >
                        ___________________
                      </span>
                    </div>
                  ),
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
});

NhisReferralForm.displayName = 'NhisReferralForm';

export default NhisReferralForm;
