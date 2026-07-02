import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ChevronLeft, User, Dumbbell, Heart, FileText, CheckCircle,
  XCircle, Clock, Edit3, ExternalLink, Save, Edit, Mail
} from 'lucide-react';
import api from '../../utils/api';

const BADGE_MAP = {
  'Pending':            'badge-pending',
  'Payment Submitted':  'badge-submitted',
  'Payment Verified':   'badge-verified',
  'Medical Cleared':    'badge-cleared',
  'Admitted':           'badge-admitted',
  'Rejected':           'badge-rejected',
};

const Section = ({ title, icon: Icon, children }) => (
  <div className="card" style={{ marginBottom: 16, overflow: 'hidden' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
      <Icon size={16} color="var(--navy)" />
      <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--navy)', textTransform: 'uppercase', letterSpacing: '.5px' }}>{title}</span>
    </div>
    <div style={{ padding: '16px 20px' }}>{children}</div>
  </div>
);

const Row = ({ label, value, editing, field, val, onChange }) => (
  <div style={{ display: 'flex', gap: 16, padding: '7px 0', borderBottom: '1px solid var(--surface-2)', alignItems: 'center' }}>
    <span style={{ color: 'var(--text-3)', fontSize: 13, width: 180, flexShrink: 0 }}>{label}</span>
    {editing ? (
      <input
        className="form-input"
        style={{ height: 32, fontSize: 13, flex: 1 }}
        value={val || ''}
        onChange={e => onChange(field, e.target.value)}
      />
    ) : (
      <span style={{ color: 'var(--text-1)', fontSize: 13, fontWeight: 500, flex: 1 }}>{value || '—'}</span>
    )}
  </div>
);

const Bool = ({ val }) => {
  const normalized = String(val ?? '').trim().toLowerCase();
  const isYes = val === true || val === 1 || ['true', '1', 'yes', 'on'].includes(normalized);
  return isYes
    ? <span style={{ color: 'var(--green)', fontWeight: 600 }}>Yes</span>
    : <span style={{ color: 'var(--text-3)' }}>No</span>;
};

const serverUrl = process.env.REACT_APP_SERVER_URL || 'http://localhost:5000';

const FileRow = ({ label, field, current, editing, onFile }) => (
  <div style={{ display: 'flex', gap: 16, padding: '7px 0', borderBottom: '1px solid var(--surface-2)', alignItems: 'center' }}>
    <span style={{ color: 'var(--text-3)', fontSize: 13, width: 180, flexShrink: 0 }}>{label}</span>
    {editing ? (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
        <input type="file" onChange={e => onFile(field, e.target.files[0])} style={{ fontSize: 12 }} />
        {current && <span style={{ fontSize: 11, color: 'var(--green)' }}>(Existing file will be kept if none uploaded)</span>}
      </div>
    ) : (
      <div style={{ flex: 1 }}>
        {current ? (
          <a href={current.startsWith('http') ? current : `${serverUrl}/${current}`} target="_blank" rel="noreferrer" 
            style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 500 }}>
            View Current File <ExternalLink size={12} style={{ verticalAlign: 'middle', marginLeft: 4 }} />
          </a>
        ) : (
          <span style={{ color: 'var(--text-3)', fontSize: 13 }}>Not uploaded</span>
        )}
      </div>
    )}
  </div>
);

export default function AdminApplicantDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [appl, setAppl]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusForm, setStatusForm] = useState({ 
    status: '', 
    is_medical_cleared: false,
    is_admitted: false,
    is_payment_verified: false,
    group_assigned: '', 
    room_number: '', 
    coach_assigned: '', 
    rejection_reason: '' 
  });
  const [saving, setSaving]   = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [files, setFiles] = useState({
    passport_photo: null,
    birth_certificate: null,
    school_result: null,
    receipt: null
  });

  const fetch = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/applicants/${id}`);
      setAppl(data);
      setStatusForm({
        status: data.status,
        is_medical_cleared: !!data.is_medical_cleared,
        is_admitted: !!data.is_admitted,
        is_payment_verified: !!data.is_payment_verified,
        group_assigned: data.group_assigned || '',
        room_number: data.room_number || '',
        coach_assigned: data.coach_assigned || '',
        rejection_reason: '',
      });
      setEditForm({ ...data });
    } catch { toast.error('Failed to load applicant'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, [id]);

  const handleEditSave = async () => {
    setSaving(true);
    try {
      const fd = new FormData();
      Object.keys(editForm).forEach(k => {
        if (editForm[k] !== null && editForm[k] !== undefined) {
          fd.append(k, editForm[k]);
        }
      });
      if (files.passport_photo)    fd.append('passport_photo',    files.passport_photo);
      if (files.birth_certificate) fd.append('birth_certificate', files.birth_certificate);
      if (files.school_result)     fd.append('school_result',     files.school_result);
      if (files.receipt)           fd.append('receipt',           files.receipt);

      await api.patch(`/applicants/${id}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Applicant details updated');
      setIsEditing(false);
      setFiles({ passport_photo: null, birth_certificate: null, school_result: null, receipt: null });
      fetch();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Update failed');
    } finally { setSaving(false); }
  };

  const handleStatusSave = async () => {
    setSaving(true);
    try {
      const { data } = await api.patch(`/applicants/${id}/status`, statusForm);
      toast.success('Status updated successfully');
      if (data?.id_card) {
        toast.success(`ID card generated: ${data.id_card.card_number}`);
      }
      setShowStatusModal(false);
      fetch();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Update failed');
    } finally { setSaving(false); }
  };

  const openStatusModal = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setShowStatusModal(true);
  };

  const triggerEmail = async (type) => {
    try {
      await api.post(`/applicants/${id}/send-email`, { type });
      toast.success('Email triggered successfully');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send email');
    }
  };

  if (loading) return <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)' }}>Loading…</div>;
  if (!appl) return <div style={{ padding: 48, textAlign: 'center', color: 'var(--red)' }}>Applicant not found</div>;

  const fullName = `${appl.first_name} ${appl.middle_name || ''} ${appl.surname}`.trim();

  return (
    <div className="page-enter">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}><ChevronLeft size={16} /> Back</button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, color: 'var(--navy)' }}>{fullName}</h1>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 4 }}>
            <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-3)', background: 'var(--surface-2)', padding: '2px 8px', borderRadius: 4 }}>{appl.form_number}</span>
            <span className={`badge ${BADGE_MAP[appl.status]}`}>{appl.status}</span>
            {appl.is_payment_verified ? <span className="badge badge-verified">Payment Verified</span> : (appl.payment_status && <span className={`badge ${appl.payment_status === 'Verified' ? 'badge-verified' : appl.payment_status === 'Rejected' ? 'badge-rejected' : 'badge-submitted'}`}>Payment: {appl.payment_status}</span>)}
            {!!appl.is_medical_cleared && <span className="badge badge-cleared">Medical Cleared</span>}
            {!!appl.is_admitted && <span className="badge badge-admitted">Admitted</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {isEditing ? (
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => { setIsEditing(false); setEditForm({ ...appl }); }}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={handleEditSave} disabled={saving}>
                <Save size={14} /> {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => setIsEditing(true)}>
                <Edit size={14} /> Edit Info
              </button>
              <button className="btn btn-primary btn-sm" onClick={openStatusModal}>
                <Edit3 size={14} /> Update Status
              </button>
            </>
          )}
        </div>
      </div>

      {/* Two column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>

        {/* LEFT */}
        <div>
          <Section title="Applicant Particulars" icon={User}>
            <Row label="Full Name" value={fullName} />
            <Row 
              label="First Name" 
              editing={isEditing} 
              field="first_name" 
              val={editForm.first_name} 
              onChange={(f,v) => setEditForm(p => ({...p, [f]:v}))}
              value={appl.first_name} 
            />
            <Row 
              label="Middle Name" 
              editing={isEditing} 
              field="middle_name" 
              val={editForm.middle_name} 
              onChange={(f,v) => setEditForm(p => ({...p, [f]:v}))}
              value={appl.middle_name} 
            />
            <Row 
              label="Surname" 
              editing={isEditing} 
              field="surname" 
              val={editForm.surname} 
              onChange={(f,v) => setEditForm(p => ({...p, [f]:v}))}
              value={appl.surname} 
            />
            <Row 
              label="Date of Birth" 
              editing={isEditing} 
              field="date_of_birth" 
              val={editForm.date_of_birth} 
              onChange={(f,v) => setEditForm(p => ({...p, [f]:v}))}
              value={appl.date_of_birth} 
            />
            <Row label="Age" value={appl.age} />
            <Row 
              label="Gender" 
              editing={isEditing} 
              field="gender" 
              val={editForm.gender} 
              onChange={(f,v) => setEditForm(p => ({...p, [f]:v}))}
              value={appl.gender} 
            />
            <Row 
              label="Nationality" 
              editing={isEditing} 
              field="nationality" 
              val={editForm.nationality} 
              onChange={(f,v) => setEditForm(p => ({...p, [f]:v}))}
              value={appl.nationality} 
            />
            <Row 
              label="State of Origin" 
              editing={isEditing} 
              field="state_of_origin" 
              val={editForm.state_of_origin} 
              onChange={(f,v) => setEditForm(p => ({...p, [f]:v}))}
              value={appl.state_of_origin} 
            />
            <Row 
              label="LGA" 
              editing={isEditing} 
              field="lga" 
              val={editForm.lga} 
              onChange={(f,v) => setEditForm(p => ({...p, [f]:v}))}
              value={appl.lga} 
            />
            <Row 
              label="School" 
              editing={isEditing} 
              field="school" 
              val={editForm.school} 
              onChange={(f,v) => setEditForm(p => ({...p, [f]:v}))}
              value={appl.school} 
            />
            <Row 
              label="Class/Level" 
              editing={isEditing} 
              field="class_level" 
              val={editForm.class_level} 
              onChange={(f,v) => setEditForm(p => ({...p, [f]:v}))}
              value={appl.class_level} 
            />
            <Row 
              label="Home Address" 
              editing={isEditing} 
              field="home_address" 
              val={editForm.home_address} 
              onChange={(f,v) => setEditForm(p => ({...p, [f]:v}))}
              value={appl.home_address} 
            />
            <Row 
              label="City" 
              editing={isEditing} 
              field="city" 
              val={editForm.city} 
              onChange={(f,v) => setEditForm(p => ({...p, [f]:v}))}
              value={appl.city} 
            />
            <Row 
              label="State" 
              editing={isEditing} 
              field="state" 
              val={editForm.state} 
              onChange={(f,v) => setEditForm(p => ({...p, [f]:v}))}
              value={appl.state} 
            />
          </Section>

          <Section title="Sport Selection" icon={Dumbbell}>
            <Row 
              label="Age Category" 
              editing={isEditing} 
              field="age_category" 
              val={editForm.age_category} 
              onChange={(f,v) => setEditForm(p => ({...p, [f]:v}))}
              value={appl.age_category} 
            />
            <Row 
              label="Sport" 
              editing={isEditing} 
              field="sport_selection" 
              val={editForm.sport_selection} 
              onChange={(f,v) => setEditForm(p => ({...p, [f]:v}))}
              value={appl.sport_selection} 
            />
            <Row 
              label="Experience Level" 
              editing={isEditing} 
              field="experience_level" 
              val={editForm.experience_level} 
              onChange={(f,v) => setEditForm(p => ({...p, [f]:v}))}
              value={appl.experience_level} 
            />
            <Row 
              label="Previous Clinic" 
              editing={isEditing} 
              field="previous_clinic" 
              val={editForm.previous_clinic} 
              onChange={(f,v) => setEditForm(p => ({...p, [f]:v}))}
              value={appl.previous_clinic} 
            />
            <Row 
              label="T-Shirt Size" 
              editing={isEditing} 
              field="tshirt_size" 
              val={editForm.tshirt_size} 
              onChange={(f,v) => setEditForm(p => ({...p, [f]:v}))}
              value={appl.tshirt_size} 
            />
          </Section>

          <Section title="Parent / Guardian" icon={User}>
            <Row 
              label="Guardian Name" 
              editing={isEditing} 
              field="guardian_name" 
              val={editForm.guardian_name} 
              onChange={(f,v) => setEditForm(p => ({...p, [f]:v}))}
              value={appl.guardian_name} 
            />
            <Row 
              label="Relationship" 
              editing={isEditing} 
              field="guardian_relationship" 
              val={editForm.guardian_relationship} 
              onChange={(f,v) => setEditForm(p => ({...p, [f]:v}))}
              value={appl.guardian_relationship} 
            />
            <Row 
              label="Phone" 
              editing={isEditing} 
              field="guardian_phone" 
              val={editForm.guardian_phone} 
              onChange={(f,v) => setEditForm(p => ({...p, [f]:v}))}
              value={appl.guardian_phone} 
            />
            <Row 
              label="WhatsApp" 
              editing={isEditing} 
              field="guardian_whatsapp" 
              val={editForm.guardian_whatsapp} 
              onChange={(f,v) => setEditForm(p => ({...p, [f]:v}))}
              value={appl.guardian_whatsapp} 
            />
            <Row 
              label="Email" 
              editing={isEditing} 
              field="guardian_email" 
              val={editForm.guardian_email} 
              onChange={(f,v) => setEditForm(p => ({...p, [f]:v}))}
              value={appl.guardian_email} 
            />
            <Row 
              label="Occupation" 
              editing={isEditing} 
              field="guardian_occupation" 
              val={editForm.guardian_occupation} 
              onChange={(f,v) => setEditForm(p => ({...p, [f]:v}))}
              value={appl.guardian_occupation} 
            />
            <Row 
              label="Emergency Contact" 
              editing={isEditing} 
              field="emergency_name" 
              val={editForm.emergency_name} 
              onChange={(f,v) => setEditForm(p => ({...p, [f]:v}))}
              value={appl.emergency_name} 
            />
            <Row 
              label="Emergency Phone" 
              editing={isEditing} 
              field="emergency_phone" 
              val={editForm.emergency_phone} 
              onChange={(f,v) => setEditForm(p => ({...p, [f]:v}))}
              value={appl.emergency_phone} 
            />
          </Section>

          <Section title="Academic Information" icon={FileText}>
            <Row label="Last Avg Score" value={appl.last_avg_score ? `${appl.last_avg_score}%` : null} />
            <Row label="Class Position" value={appl.class_position} />
            <Row label="Best Subject" value={appl.best_subject} />
            <Row label="Favourite Subject" value={appl.favourite_subject} />
            <Row label="Academic Goal" value={appl.academic_goal} />
          </Section>

          <Section title="Medical History" icon={Heart}>
            <Row label="Blood Group" value={appl.blood_group} />
            <Row label="Genotype" value={appl.genotype} />
            <div style={{ marginTop: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--text-3)' }}>Conditions: </span>
              {[
                ['Asthma', appl.condition_asthma],
                ['Epilepsy', appl.condition_epilepsy],
                ['Diabetes', appl.condition_diabetes],
                ['Hypertension', appl.condition_hypertension],
                ['Heart', appl.condition_heart],
              ].filter(([,v]) => v).map(([k]) => (
                <span key={k} style={{ display: 'inline-block', background: 'var(--red-bg)', color: 'var(--red)', borderRadius: 12, padding: '2px 10px', fontSize: 12, fontWeight: 600, marginRight: 6 }}>{k}</span>
              ))}
              {![appl.condition_asthma,appl.condition_epilepsy,appl.condition_diabetes,appl.condition_hypertension,appl.condition_heart].some(Boolean) && <span style={{ fontSize: 13, color: 'var(--text-3)' }}>None reported</span>}
            </div>
            <Row label="Allergies" value={appl.allergies} />
            <Row label="Medications" value={appl.current_medications} />
            <Row label="Past Injuries" value={appl.past_injuries} />
            <Row label="Physical Disability" value={appl.physical_disability ? `Yes — ${appl.disability_detail || ''}` : 'No'} />
            <Row label="Last Checkup" value={appl.last_medical_checkup} />
            <Row label="Family Doctor" value={appl.family_doctor} />
            <Row label="Doctor Phone" value={appl.family_doctor_phone} />
          </Section>

          <Section title="Consent" icon={CheckCircle}>
            {[
              ['Medical Consent',  appl.consent_medical],
              ['Code of Conduct',  appl.consent_conduct],
              ['Media Release',    appl.consent_media],
              ['Indemnity',        appl.consent_indemnity],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--surface-2)', fontSize: 13 }}>
                <span style={{ color: 'var(--text-2)' }}>{k}</span>
                <Bool val={v} />
              </div>
            ))}
          </Section>
        </div>

        {/* RIGHT sidebar */}
        <div style={{ position: 'sticky', top: 88 }}>

          {/* Assignments */}
          <div className="card" style={{ padding: '18px 20px', marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--navy)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '.5px' }}>Camp Assignments</div>
            {[
              ['Group', appl.group_assigned],
              ['Room Number', appl.room_number],
              ['Coach Assigned', appl.coach_assigned],
            ].map(([k, v]) => (
              <div key={k} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '.3px' }}>{k}</div>
                <div style={{ fontSize: 14, fontWeight: 500, color: v ? 'var(--text-1)' : 'var(--text-3)' }}>{v || 'Not assigned'}</div>
              </div>
            ))}
          </div>

          {/* Payment */}
          {appl.payment_id && (
            <div className="card" style={{ padding: '18px 20px', marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--navy)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '.5px' }}>Payment</div>
              {[
                ['Amount', appl.amount_paid ? `₦${parseFloat(appl.amount_paid).toLocaleString()}` : '—'],
                ['Receipt Amount (OCR)', appl.receipt_amount ? `₦${parseFloat(appl.receipt_amount).toLocaleString()}` : '—'],
                ['Fee Type', appl.fee_type],
                ['Date', appl.payment_date],
                ['Reference', appl.transaction_ref],
                ['Receipt Reference (OCR)', appl.receipt_transaction_ref],
                ['Status', appl.verification_status],
                ['Verified', appl.verified_at ? new Date(appl.verified_at).toLocaleString() : '—'],
              ].map(([k, v]) => v && (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--surface-2)', fontSize: 13 }}>
                  <span style={{ color: 'var(--text-3)' }}>{k}</span>
                  <span style={{ fontWeight: 500, color: 'var(--text-1)' }}>{v}</span>
                </div>
              ))}
              {appl.receipt_path && (
                <a href={appl.receipt_path.startsWith('http') ? appl.receipt_path : `${serverUrl}/${appl.receipt_path}`} target="_blank" rel="noreferrer"
                  className="btn btn-outline btn-sm" style={{ width: '100%', marginTop: 14, justifyContent: 'center' }}>
                  <ExternalLink size={13} /> View Receipt
                </a>
              )}
              {appl.rejection_reason && (
                <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--red-bg)', borderRadius: 'var(--radius-md)', fontSize: 12, color: 'var(--red)' }}>
                  <strong>Rejection reason:</strong> {appl.rejection_reason}
                </div>
              )}
            </div>
          )}

          {/* Documents */}
          <div className="card" style={{ padding: '18px 20px', marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--navy)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '.5px' }}>Documents</div>
            <FileRow label="Passport Photo" field="passport_photo" current={appl.passport_photo} editing={isEditing} onFile={(f,v) => setFiles(p => ({...p,[f]:v}))} />
            <FileRow label="Birth Certificate" field="birth_certificate" current={appl.birth_certificate} editing={isEditing} onFile={(f,v) => setFiles(p => ({...p,[f]:v}))} />
            <FileRow label="School Result" field="school_result" current={appl.school_result} editing={isEditing} onFile={(f,v) => setFiles(p => ({...p,[f]:v}))} />
            <FileRow label="Payment Receipt" field="receipt" current={appl.receipt_path} editing={isEditing} onFile={(f,v) => setFiles(p => ({...p,[f]:v}))} />
          </div>

          {/* Communication */}
          <div className="card" style={{ padding: '18px 20px', marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--navy)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '.5px' }}>Communication</div>
            <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 12 }}>Manually trigger notification emails to the guardian.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button className="btn btn-outline btn-sm" style={{ justifyContent: 'flex-start' }} onClick={() => triggerEmail('registration_received')}>
                <Mail size={13} style={{ marginRight: 8 }} /> Registration Confirmation
              </button>
              <button className="btn btn-outline btn-sm" style={{ justifyContent: 'flex-start' }} onClick={() => triggerEmail('payment_submitted')}>
                <Mail size={13} style={{ marginRight: 8 }} /> Receipt Acknowledgment
              </button>
              <button className="btn btn-outline btn-sm" style={{ justifyContent: 'flex-start' }} onClick={() => triggerEmail('payment_verified')}>
                <Mail size={13} style={{ marginRight: 8 }} /> Payment Verification
              </button>
              <button className="btn btn-outline btn-sm" style={{ justifyContent: 'flex-start' }} onClick={() => triggerEmail('admitted')}>
                <Mail size={13} style={{ marginRight: 8 }} /> Admission Letter
              </button>
            </div>
          </div>

          {/* Meta */}
          <div className="card" style={{ padding: '14px 18px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.5px', fontWeight: 600 }}>Record Info</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
              <div>Registered: {new Date(appl.created_at).toLocaleString('en-NG')}</div>
              <div style={{ marginTop: 4 }}>Updated: {new Date(appl.updated_at).toLocaleString('en-NG')}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Status Update Modal */}
      {showStatusModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px', overflowY: 'auto' }}>
          <div className="card" style={{ width: '100%', maxWidth: 480, padding: '32px 28px', maxHeight: 'calc(100vh - 48px)', overflowY: 'auto' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, color: 'var(--navy)', marginBottom: 20 }}>Update Application Status</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              
              <div style={{ padding: '12px', border: '1px solid var(--surface-2)', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)', marginBottom: 4 }}>Independent Status Checkpoints</span>
                
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14 }}>
                  <input type="checkbox" checked={!!statusForm.is_payment_verified} onChange={e => setStatusForm(p => ({ ...p, is_payment_verified: e.target.checked }))} />
                  Payment Verified
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14 }}>
                  <input type="checkbox" checked={!!statusForm.is_medical_cleared} onChange={e => setStatusForm(p => ({ ...p, is_medical_cleared: e.target.checked }))} />
                  Medical Cleared
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14 }}>
                  <input type="checkbox" checked={!!statusForm.is_admitted} onChange={e => setStatusForm(p => ({ ...p, is_admitted: e.target.checked }))} />
                  Admitted
                </label>
              </div>

              <div className="form-field">
                <label>Lifecycle Status (Primary)</label>
                <select className="form-input" value={statusForm.status} onChange={e => setStatusForm(p => ({ ...p, status: e.target.value }))}>
                  {['Pending','Payment Submitted','Payment Verified','Medical Cleared','Admitted','Rejected'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {(statusForm.is_admitted || statusForm.status === 'Admitted') && <>
                <div className="form-field">
                  <label>Group Assigned</label>
                  <input className="form-input" placeholder="e.g. Group A" value={statusForm.group_assigned} onChange={e => setStatusForm(p => ({ ...p, group_assigned: e.target.value }))} />
                </div>
                <div className="form-field">
                  <label>Room Number</label>
                  <input className="form-input" placeholder="e.g. Room 12B" value={statusForm.room_number} onChange={e => setStatusForm(p => ({ ...p, room_number: e.target.value }))} />
                </div>
                <div className="form-field">
                  <label>Coach Assigned</label>
                  <input className="form-input" placeholder="Coach name" value={statusForm.coach_assigned} onChange={e => setStatusForm(p => ({ ...p, coach_assigned: e.target.value }))} />
                </div>
              </>}
              {statusForm.status === 'Rejected' && (
                <div className="form-field">
                  <label>Rejection Reason</label>
                  <textarea className="form-input" rows={3} value={statusForm.rejection_reason} onChange={e => setStatusForm(p => ({ ...p, rejection_reason: e.target.value }))} style={{ resize: 'vertical' }} />
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button className="btn btn-outline" onClick={() => setShowStatusModal(false)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleStatusSave} disabled={saving} style={{ flex: 1 }}>
                {saving ? 'Saving…' : <><Save size={14} /> Save Status</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
