import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ChevronLeft, Upload, X, Check, Search, FileImage } from 'lucide-react';
import api from '../utils/api';
import BrandLogo from '../components/BrandLogo';

export default function UpdateDocumentsPage() {
  const [lookup, setLookup]   = useState({ form_number: '', guardian_email: '' });
  const [applicant, setApplicant] = useState(null);
  const [searching, setSearching] = useState(false);
  const [files, setFiles]     = useState({ passport_photo: null, birth_certificate: null, school_result: null });
  const [uploading, setUploading] = useState(false);
  const [done, setDone]       = useState(false);

  // Step 1 — find the applicant
  const handleLookup = async (e) => {
    e.preventDefault();
    setSearching(true);
    try {
      const { data } = await api.get('/applicants/lookup', {
        params: {
          email: lookup.guardian_email.trim(),
          // Use email alone to get all records, then filter by form_number below
          phone: '0000000000', // placeholder — we'll match by form_number instead
        },
      });
      // /lookup needs phone; use the dedicated guardian lookup differently.
      // Actually hit the /:id route isn't public. Use a direct form_number search.
      // We'll POST to a dedicated endpoint that authenticates by form_number + email.
      // For the lookup step, call the server with a dedicated query.
      const rows = Array.isArray(data) ? data : [data];
      const match = rows.find(
        r => r.form_number?.toLowerCase() === lookup.form_number.trim().toLowerCase()
      );
      if (match) {
        setApplicant(match);
      } else {
        toast.error('Form number not found for that email address.');
      }
    } catch {
      // Fallback: try a dedicated endpoint
      toast.error('Application not found. Check your form number and email.');
    } finally {
      setSearching(false);
    }
  };

  // Better lookup: use a dedicated public endpoint
  const handleLookupV2 = async (e) => {
    e.preventDefault();
    setSearching(true);
    try {
      const { data } = await api.get('/applicants/lookup-by-form', {
        params: {
          form_number:    lookup.form_number.trim(),
          guardian_email: lookup.guardian_email.trim(),
        },
      });
      setApplicant(data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Application not found. Check your form number and email.');
    } finally {
      setSearching(false);
    }
  };

  const FileUpload = ({ field, label, required }) => (
    <div className="form-field">
      <label style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-1)', marginBottom: 6, display: 'block' }}>
        {label}{required && <span style={{ color: 'var(--red)', marginLeft: 3 }}>*</span>}
      </label>
      <label style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 14px',
        border: `1.5px dashed ${required && !files[field] ? 'var(--red)' : files[field] ? 'var(--green)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        background: files[field] ? 'rgba(22,163,74,0.04)' : 'var(--surface)',
        transition: 'border-color .15s',
      }}>
        <input type="file" accept=".jpg,.jpeg,.png,.pdf" hidden
          onChange={e => setFiles(p => ({ ...p, [field]: e.target.files[0] }))}
        />
        {files[field]
          ? <Check size={16} color="var(--green)" />
          : <Upload size={16} color="var(--text-3)" />
        }
        <span style={{ fontSize: 13, color: files[field] ? 'var(--green)' : 'var(--text-3)', flex: 1 }}>
          {files[field] ? files[field].name : 'Click to upload (JPG, PNG, PDF — max 5MB)'}
        </span>
        {files[field] && (
          <X size={14} color="var(--text-3)"
            onClick={e => { e.preventDefault(); setFiles(p => ({ ...p, [field]: null })); }}
          />
        )}
      </label>
    </div>
  );

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!files.passport_photo) {
      toast.error('Passport photo is required');
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('form_number',    applicant.form_number);
      fd.append('guardian_email', applicant.guardian_email);
      if (files.passport_photo)    fd.append('passport_photo',    files.passport_photo);
      if (files.birth_certificate) fd.append('birth_certificate', files.birth_certificate);
      if (files.school_result)     fd.append('school_result',     files.school_result);

      await api.patch(`/applicants/${applicant.id}/documents`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setDone(true);
      toast.success('Documents updated successfully');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface)' }}>
      {/* Header */}
      <div style={{ background: 'var(--navy)', padding: '20px 24px' }}>
        <div style={{ maxWidth: 560, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link to="/" className="btn btn-ghost btn-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
            <ChevronLeft size={16} /> Home
          </Link>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: 'white', fontSize: 16 }}>
              Update Documents
            </div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>2026 Summer Sports Camp</div>
          </div>
          <BrandLogo width={170} compact darkBackground />
        </div>
      </div>

      <div style={{ maxWidth: 560, margin: '40px auto', padding: '0 24px 80px' }}>

        {/* Success state */}
        {done && (
          <div className="card" style={{ padding: '48px 40px', textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--green-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <Check size={28} color="var(--green)" strokeWidth={2.5} />
            </div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, color: 'var(--navy)', marginBottom: 10 }}>
              Documents Updated
            </h2>
            <p style={{ color: 'var(--text-2)', marginBottom: 24, lineHeight: 1.6 }}>
              Your documents have been updated for <strong>{applicant?.first_name} {applicant?.surname}</strong> ({applicant?.form_number}).
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <Link to="/status" className="btn btn-primary btn-sm">Check Application Status</Link>
              <button className="btn btn-outline btn-sm" onClick={() => { setDone(false); setFiles({ passport_photo: null, birth_certificate: null, school_result: null }); }}>
                Update Another
              </button>
            </div>
          </div>
        )}

        {/* Step 1 — Lookup */}
        {!done && !applicant && (
          <div className="card" style={{ padding: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(10,61,98,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FileImage size={18} color="var(--navy)" />
              </div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, color: 'var(--navy)' }}>
                Find Your Application
              </h3>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 24 }}>
              Enter your form number and the guardian email address used during registration.
            </p>
            <form onSubmit={handleLookupV2} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-field">
                <label style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, display: 'block' }}>
                  Form Number <span style={{ color: 'var(--red)' }}>*</span>
                </label>
                <input
                  className="form-input"
                  placeholder="UI/SA/2026/0001"
                  value={lookup.form_number}
                  onChange={e => setLookup(p => ({ ...p, form_number: e.target.value }))}
                  required
                />
              </div>
              <div className="form-field">
                <label style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, display: 'block' }}>
                  Guardian Email Address <span style={{ color: 'var(--red)' }}>*</span>
                </label>
                <input
                  className="form-input"
                  type="email"
                  placeholder="parent@email.com"
                  value={lookup.guardian_email}
                  onChange={e => setLookup(p => ({ ...p, guardian_email: e.target.value }))}
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={searching}>
                {searching ? 'Searching…' : <><Search size={15} /> Find Application</>}
              </button>
            </form>
          </div>
        )}

        {/* Step 2 — Upload */}
        {!done && applicant && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Applicant card */}
            <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'rgba(10,61,98,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--navy)', fontSize: 15 }}>
                  {applicant.first_name?.[0]}{applicant.surname?.[0]}
                </span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-1)' }}>{applicant.first_name} {applicant.surname}</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{applicant.form_number} · {applicant.sport_selection}</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setApplicant(null)} style={{ fontSize: 12 }}>
                Change
              </button>
            </div>

            {/* Upload form */}
            <div className="card" style={{ padding: '28px 28px' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, color: 'var(--navy)', marginBottom: 6 }}>
                Upload Documents
              </h3>
              <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 22 }}>
                Only upload files you want to replace. Existing documents will be kept for fields left blank.
              </p>
              <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <FileUpload field="passport_photo"    label="Passport Photograph (recent)"        required />
                <FileUpload field="birth_certificate" label="Birth Certificate / Age Declaration" />
                <FileUpload field="school_result"     label="Last School Result" />
                <button type="submit" className="btn btn-primary" disabled={uploading} style={{ marginTop: 4 }}>
                  {uploading ? 'Uploading…' : <><Upload size={15} /> Update Documents</>}
                </button>
              </form>
            </div>
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: 'var(--text-3)' }}>
          Need help? Call <strong>08036870535</strong> or email{' '}
          <a href="mailto:uisportsacademy@gmail.com" style={{ color: 'var(--blue)' }}>uisportsacademy@gmail.com</a>
        </div>
      </div>
    </div>
  );
}
