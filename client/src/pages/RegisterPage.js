import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ChevronLeft, ChevronRight, Check, Upload, X } from 'lucide-react';
import api from '../utils/api';
import BrandLogo from '../components/BrandLogo';

const STEPS = ['Personal', 'Sport', 'Guardian', 'Academic', 'Medical', 'Consent', 'Review'];

const SPORTS = ['Football', 'Basketball', 'Athletics', 'Swimming', 'Tennis'];
const TSHIRT_SIZES = ['Youth M', 'Youth L', 'Adult S', 'Adult M', 'Adult L', 'Adult XL', 'Adult XXL'];
const GENOTYPES = ['AA', 'AS', 'SS', 'AC', 'SC'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const INITIAL = {
  // A
  surname: '', first_name: '', middle_name: '', date_of_birth: '', gender: '',
  nationality: '', state_of_origin: '', lga: '', school: '', class_level: '',
  home_address: '', city: '', state: '',
  // B
  sport_selection: '', experience_level: '', previous_clinic: 'None', previous_clinic_other: '', tshirt_size: '',
  // C
  guardian_title: '', guardian_name: '', guardian_relationship: '', guardian_phone: '',
  guardian_whatsapp: '', guardian_email: '', guardian_occupation: '', guardian_office_address: '',
  emergency_name: '', emergency_phone: '', emergency_relationship: '',
  // D
  last_avg_score: '', class_position: '', best_subject: '', favourite_subject: '', academic_goal: '',
  // E
  blood_group: '', genotype: '',
  condition_asthma: false, condition_epilepsy: false, condition_diabetes: false,
  condition_hypertension: false, condition_heart: false,
  allergies: '', current_medications: '', past_injuries: '',
  on_medication: false, medication_detail: '',
  physical_disability: false, disability_detail: '',
  last_medical_checkup: '', family_doctor: '', family_doctor_phone: '',
  // F
  consent_medical: false, consent_conduct: false, consent_media: '', consent_indemnity: false,
};

const Field = ({ label, required, error, children }) => (
  <div className="form-field">
    <label>{label}{required && <span className="req">*</span>}</label>
    {children}
    {error && <span style={{ fontSize: 12, color: 'var(--red)' }}>{error}</span>}
  </div>
);

const Input = ({ ...props }) => <input className={`form-input ${props.error ? 'error' : ''}`} {...props} />;
const Select = ({ children, ...props }) => (
  <select className="form-input" {...props}>{children}</select>
);

export default function RegisterPage() {
  const [step, setStep]     = useState(0);
  const [data, setData]     = useState(() => {
    // Load saved form data from localStorage
    const saved = localStorage.getItem('registration_form_data');
    return saved ? JSON.parse(saved) : INITIAL;
  });
  const [files, setFiles]   = useState({ passport_photo: null, birth_certificate: null, school_result: null });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null);
  const [reviewing, setReviewing] = useState(false);
  const [acceptedPayload, setAcceptedPayload] = useState(null);
  const [locationLib, setLocationLib] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const mod = await import('country-state-city');
        if (mounted) setLocationLib(mod);
      } catch (err) {
        console.error('Failed to load location library:', err);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const countries = locationLib?.Country?.getAllCountries?.() || [];
  const selectedCountry = countries.find((c) => c.name === data.nationality);
  const states = selectedCountry && locationLib?.State
    ? locationLib.State.getStatesOfCountry(selectedCountry.isoCode)
    : [];
  const selectedStateOfOrigin = states.find((s) => s.name === data.state_of_origin);
  const localGovernments = (selectedCountry && selectedStateOfOrigin && locationLib?.City)
    ? locationLib.City.getCitiesOfState(selectedCountry.isoCode, selectedStateOfOrigin.isoCode)
    : [];

  const set = (k, v) => {
    setData(p => {
      const newData = { ...p, [k]: v };
      // Save to localStorage
      localStorage.setItem('registration_form_data', JSON.stringify(newData));
      return newData;
    });
  };
  const toggle = k => {
    setData(p => {
      const newData = { ...p, [k]: !p[k] };
      localStorage.setItem('registration_form_data', JSON.stringify(newData));
      return newData;
    });
  };

  const setNationality = (nationality) => {
    setData((p) => {
      const newData = {
        ...p,
        nationality,
        state_of_origin: '',
        lga: '',
        state: '',
      };
      localStorage.setItem('registration_form_data', JSON.stringify(newData));
      return newData;
    });
  };

  const setStateOfOrigin = (stateOfOrigin) => {
    setData((p) => {
      const newData = {
        ...p,
        state_of_origin: stateOfOrigin,
        lga: '',
      };
      localStorage.setItem('registration_form_data', JSON.stringify(newData));
      return newData;
    });
  };

  const ageCategory = () => {
    if (!data.date_of_birth) return null;
    const age = new Date().getFullYear() - new Date(data.date_of_birth).getFullYear();
    return age <= 17 ? 'Junior (6-17)' : 'Elite (18-23)';
  };

  const validateStep = () => {
    const e = {};
    if (step === 0) {
      if (!data.surname.trim()) e.surname = 'Required';
      if (!data.first_name.trim()) e.first_name = 'Required';
      if (!data.date_of_birth) e.date_of_birth = 'Required';
      if (!data.gender) e.gender = 'Required';
    }
    if (step === 1) {
      if (!data.sport_selection) e.sport_selection = 'Required';
      if (!data.tshirt_size) e.tshirt_size = 'Required';
      const cat = ageCategory();
      if (cat === 'Elite (18-23)' && !data.experience_level) e.experience_level = 'Required';
    }
    if (step === 2) {
      if (!data.guardian_name.trim()) e.guardian_name = 'Required';
      if (!data.guardian_phone.trim()) e.guardian_phone = 'Required';
      if (!data.guardian_email.trim()) e.guardian_email = 'Required';
      else if (!/\S+@\S+\.\S+/.test(data.guardian_email)) e.guardian_email = 'Invalid email';
    }
    if (step === 5) {
      if (!data.consent_medical) e.consent_medical = 'You must agree to medical consent';
      if (!data.consent_conduct) e.consent_conduct = 'You must agree to code of conduct';
      if (!data.consent_indemnity) e.consent_indemnity = 'You must agree to indemnity';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => { if (validateStep()) setStep(s => s + 1); };
  const back = () => setStep(s => s - 1);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const fd = new FormData();
      Object.entries(data).forEach(([k, v]) => fd.append(k, v));
      if (files.passport_photo)   fd.append('passport_photo',   files.passport_photo);
      if (files.birth_certificate) fd.append('birth_certificate', files.birth_certificate);
      if (files.school_result)     fd.append('school_result',     files.school_result);

      const { data: res } = await api.post('/applicants', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      // Clear saved form data on success
      localStorage.removeItem('registration_form_data');

      setReviewing(true);
      setTimeout(() => {
        setReviewing(false);
        if (res.auto_accepted || res.status === 'Admitted') {
          setAcceptedPayload({ ...res, guardian_email: data.guardian_email });
          return;
        }
        setResult(res);
      }, 2600);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const FileUpload = ({ field, label }) => (
    <div className="form-field">
      <label>{label}</label>
      <label style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 14px',
        border: '1.5px dashed var(--border)',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        background: 'var(--surface)',
        transition: 'border-color .15s',
      }}
        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--blue)'}
        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
      >
        <input type="file" accept=".jpg,.jpeg,.png,.pdf" hidden
          onChange={e => setFiles(p => ({ ...p, [field]: e.target.files[0] }))}
        />
        <Upload size={16} color="var(--text-3)" />
        <span style={{ fontSize: 13, color: files[field] ? 'var(--text-1)' : 'var(--text-3)' }}>
          {files[field] ? files[field].name : 'Click to upload (JPG, PNG, PDF — max 5MB)'}
        </span>
        {files[field] && (
          <X size={14} color="var(--text-3)" style={{ marginLeft: 'auto' }}
            onClick={e => { e.preventDefault(); setFiles(p => ({ ...p, [field]: null })); }}
          />
        )}
      </label>
    </div>
  );

  const Checkbox = ({ k, label, required }) => (
    <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer', padding: '12px 16px', background: data[k] ? 'rgba(10,37,64,0.04)' : 'var(--surface)', borderRadius: 'var(--radius-md)', border: `1.5px solid ${data[k] ? 'var(--navy)' : 'var(--border)'}`, transition: 'all .15s' }}>
      <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${data[k] ? 'var(--navy)' : 'var(--border)'}`, background: data[k] ? 'var(--navy)' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
        {data[k] && <Check size={11} color="white" strokeWidth={3} />}
      </div>
      <input type="checkbox" hidden checked={!!data[k]} onChange={() => toggle(k)} />
      <span style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text-1)' }}>
        {required && <strong>*</strong>} {label}
      </span>
    </label>
  );

  if (reviewing) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div className="card" style={{ maxWidth: 520, width: '100%', padding: '46px 36px', textAlign: 'center' }}>
          <div style={{ width: 62, height: 62, margin: '0 auto 18px', borderRadius: '50%', border: '5px solid rgba(10,37,64,.12)', borderTopColor: 'var(--navy)', animation: 'spin 1s linear infinite' }} />
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800, color: 'var(--navy)', marginBottom: 8 }}>Application Under Review</h2>
          <p style={{ color: 'var(--text-2)', lineHeight: 1.6 }}>
            Checking your submission details. This usually takes a few seconds.
          </p>
        </div>
      </div>
    );
  }

  if (acceptedPayload) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div className="card" style={{ maxWidth: 520, width: '100%', padding: '48px 40px', textAlign: 'center', animation: 'fadeUp 0.5s ease' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--green-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 22px' }}>
            <Check size={28} color="var(--green)" strokeWidth={2.5} />
          </div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800, color: 'var(--navy)', marginBottom: 8 }}>
            Application Accepted
          </h2>
          <p style={{ color: 'var(--text-2)', marginBottom: 20, lineHeight: 1.6 }}>
            Congratulations. Your application has been accepted based on your submitted details.
          </p>
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-md)', padding: '16px 20px', marginBottom: 26, textAlign: 'left' }}>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 4 }}>Application Form Number</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, color: 'var(--navy)' }}>{acceptedPayload.form_number}</div>
          </div>
          <Link to={`/payment?form_number=${encodeURIComponent(acceptedPayload.form_number || '')}&email=${encodeURIComponent(acceptedPayload.guardian_email || '')}`} className="btn btn-gold" style={{ width: '100%' }}>
            Proceed to Payment
          </Link>
        </div>
      </div>
    );
  }

  if (result) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div className="card" style={{ maxWidth: 520, width: '100%', padding: '48px 40px', textAlign: 'center', animation: 'fadeUp 0.5s ease' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--green-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            <Check size={28} color="var(--green)" strokeWidth={2.5} />
          </div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800, color: 'var(--navy)', marginBottom: 8 }}>
            Application Submitted!
          </h2>
          <p style={{ color: 'var(--text-2)', marginBottom: 24, lineHeight: 1.6 }}>
            Your application was submitted successfully and is awaiting manual review.
          </p>
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-md)', padding: '16px 20px', marginBottom: 24, textAlign: 'left' }}>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 4 }}>Application Form Number</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, color: 'var(--navy)' }}>{result.form_number}</div>
          </div>
          <div style={{ background: 'rgba(26,111,165,0.08)', border: '1px solid rgba(26,111,165,0.3)', borderRadius: 'var(--radius-md)', padding: '14px 16px', marginBottom: 24, textAlign: 'left' }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--blue)', marginBottom: 4 }}>Status: Under Review</p>
            <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>
              You will receive payment instructions once your application is approved.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <Link to="/status" className="btn btn-outline btn-sm">
              Check Status
            </Link>
            <Link to="/" className="btn btn-ghost btn-sm">
              Go Home Now
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const cat = ageCategory();

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface)' }}>
      {/* Header */}
      <div style={{ background: 'var(--navy)', padding: '20px 24px' }}>
        <div style={{ maxWidth: 680, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link to="/" className="btn btn-ghost btn-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
            <ChevronLeft size={16} /> Back
          </Link>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: 'white', fontSize: 16 }}>2026 Summer Sports Camp</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Registration Form</div>
          </div>
          <BrandLogo width={178} compact darkBackground />
        </div>
      </div>

      {/* Stepper */}
      <div style={{ background: 'var(--white)', borderBottom: '1px solid var(--border)', padding: '20px 24px' }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <div className="stepper">
            {STEPS.map((s, i) => (
              <div key={s} className={`step ${i < step ? 'done' : i === step ? 'active' : ''}`}>
                <div className="step-circle">{i < step ? <Check size={14} strokeWidth={3} /> : i + 1}</div>
                <div className="step-label">{s}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Form body */}
      <div style={{ maxWidth: 680, margin: '32px auto', padding: '0 24px 80px' }}>
        <div className="card" style={{ padding: '32px 36px' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, color: 'var(--navy)', marginBottom: 24 }}>
            {['Section A: Applicant Particulars', 'Section B: Sport Selection', 'Section C: Parent / Guardian', 'Section D: Academic Information', 'Section E: Medical History', 'Section F: Consent & Undertaking', 'Review & Submit'][step]}
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* STEP 0 — Personal */}
            {step === 0 && <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                <Field label="Surname" required error={errors.surname}>
                  <Input value={data.surname} onChange={e => set('surname', e.target.value)} placeholder="Adeyemi" />
                </Field>
                <Field label="First Name" required error={errors.first_name}>
                  <Input value={data.first_name} onChange={e => set('first_name', e.target.value)} placeholder="John" />
                </Field>
                <Field label="Middle Name">
                  <Input value={data.middle_name} onChange={e => set('middle_name', e.target.value)} />
                </Field>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                <Field label="Date of Birth" required error={errors.date_of_birth}>
                  <Input type="date" value={data.date_of_birth} onChange={e => set('date_of_birth', e.target.value)} max="2020-12-31" min="2003-01-01" />
                </Field>
                <Field label="Gender" required error={errors.gender}>
                  <Select value={data.gender} onChange={e => set('gender', e.target.value)}>
                    <option value="">Select</option>
                    <option>Male</option>
                    <option>Female</option>
                  </Select>
                </Field>
                <Field label="Nationality">
                  <Select value={data.nationality} onChange={e => setNationality(e.target.value)}>
                    <option value="">Select country</option>
                    {countries.map((country) => (
                      <option key={country.isoCode} value={country.name}>{country.name}</option>
                    ))}
                  </Select>
                </Field>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                <Field label="State of Origin">
                  <Select value={data.state_of_origin} onChange={e => setStateOfOrigin(e.target.value)} disabled={!data.nationality}>
                    <option value="">{data.nationality ? 'Select state / province' : 'Select nationality first'}</option>
                    {states.map((state) => (
                      <option key={state.isoCode} value={state.name}>{state.name}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Local Government / Region">
                  <Select value={data.lga} onChange={e => set('lga', e.target.value)} disabled={!data.state_of_origin}>
                    <option value="">{data.state_of_origin ? 'Select local government / region' : 'Select state first'}</option>
                    {localGovernments.map((city) => (
                      <option key={`${city.countryCode}-${city.stateCode}-${city.name}`} value={city.name}>{city.name}</option>
                    ))}
                  </Select>
                </Field>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="Current School / Institution">
                  <Input value={data.school} onChange={e => set('school', e.target.value)} />
                </Field>
                <Field label="Class / Level">
                  <Input value={data.class_level} onChange={e => set('class_level', e.target.value)} placeholder="e.g. JSS2, Year 3" />
                </Field>
              </div>
              <Field label="Home Address">
                <Input value={data.home_address} onChange={e => set('home_address', e.target.value)} />
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="City"><Input value={data.city} onChange={e => set('city', e.target.value)} /></Field>
                <Field label="State">
                  <Select value={data.state} onChange={e => set('state', e.target.value)} disabled={!data.nationality}>
                    <option value="">{data.nationality ? 'Select state / province' : 'Select nationality first'}</option>
                    {states.map((state) => (
                      <option key={`address-${state.isoCode}`} value={state.name}>{state.name}</option>
                    ))}
                  </Select>
                </Field>
              </div>
              {cat && (
                <div style={{ background: 'rgba(26,111,165,0.06)', borderRadius: 'var(--radius-md)', padding: '12px 16px', fontSize: 13, color: 'var(--blue)', fontWeight: 600 }}>
                  Age Category: {cat}
                </div>
              )}
            </>}

            {/* STEP 1 — Sport */}
            {step === 1 && <>
              {cat === 'Junior (6-17)' ? (
                <div>
                  <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12, padding: '12px 16px', background: 'var(--surface)', borderRadius: 'var(--radius-md)' }}>
                    <strong>Junior Champions (6–17):</strong> Participants will join a multi-sport developmental programme covering all 5 sports.
                  </div>
                  <Field label="Primary Sport Selection" required error={errors.sport_selection}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
                      {SPORTS.map(s => (
                        <button key={s} type="button" onClick={() => set('sport_selection', s)}
                          style={{ padding: '12px 8px', border: `2px solid ${data.sport_selection===s?'var(--navy)':'var(--border)'}`, borderRadius: 'var(--radius-md)', background: data.sport_selection===s?'var(--navy)':'white', color: data.sport_selection===s?'white':'var(--text-2)', fontWeight: 600, fontSize: 13, transition: 'all .15s' }}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </Field>
                </div>
              ) : (
                <>
                  <Field label="Select ONE Primary Sport" required error={errors.sport_selection}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
                      {SPORTS.map(s => (
                        <button key={s} type="button" onClick={() => set('sport_selection', s)}
                          style={{ padding: '12px 8px', border: `2px solid ${data.sport_selection===s?'var(--navy)':'var(--border)'}`, borderRadius: 'var(--radius-md)', background: data.sport_selection===s?'var(--navy)':'white', color: data.sport_selection===s?'white':'var(--text-2)', fontWeight: 600, fontSize: 13, transition: 'all .15s' }}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </Field>
                  <Field label="Experience Level" required error={errors.experience_level}>
                    <Select value={data.experience_level} onChange={e => set('experience_level', e.target.value)}>
                      <option value="">Select level</option>
                      <option>Beginner</option>
                      <option>Intermediate</option>
                      <option>Advanced</option>
                    </Select>
                  </Field>
                </>
              )}
              <Field label="Previous Sports Clinic">
                <Select value={data.previous_clinic} onChange={e => set('previous_clinic', e.target.value)}>
                  <option>None</option>
                  <option>UI Sports Clinic</option>
                  <option>Other</option>
                </Select>
              </Field>
              {data.previous_clinic === 'Other' && (
                <Field label="Specify Other Clinic">
                  <Input value={data.previous_clinic_other} onChange={e => set('previous_clinic_other', e.target.value)} />
                </Field>
              )}
              <Field label="T-Shirt / Jersey Size" required error={errors.tshirt_size}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {TSHIRT_SIZES.map(s => (
                    <button key={s} type="button" onClick={() => set('tshirt_size', s)}
                      style={{ padding: '6px 14px', border: `1.5px solid ${data.tshirt_size===s?'var(--navy)':'var(--border)'}`, borderRadius: 20, background: data.tshirt_size===s?'var(--navy)':'white', color: data.tshirt_size===s?'white':'var(--text-2)', fontWeight: 600, fontSize: 12, transition: 'all .15s' }}>
                      {s}
                    </button>
                  ))}
                </div>
              </Field>
            </>}

            {/* STEP 2 — Guardian */}
            {step === 2 && <>
              <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 14 }}>
                <Field label="Title">
                  <Select value={data.guardian_title} onChange={e => set('guardian_title', e.target.value)}>
                    <option value="">—</option>
                    {['Prof','Dr','Chief','Mr','Mrs','Ms','Engr','Barr','Pharm'].map(t => <option key={t}>{t}</option>)}
                  </Select>
                </Field>
                <Field label="Full Name" required error={errors.guardian_name}>
                  <Input value={data.guardian_name} onChange={e => set('guardian_name', e.target.value)} />
                </Field>
              </div>
              <Field label="Relationship to Applicant">
                <Select value={data.guardian_relationship} onChange={e => set('guardian_relationship', e.target.value)}>
                  <option value="">Select</option>
                  <option>Father</option><option>Mother</option><option>Guardian</option><option>Sponsor</option>
                </Select>
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="Phone Number" required error={errors.guardian_phone}>
                  <Input value={data.guardian_phone} onChange={e => set('guardian_phone', e.target.value)} placeholder="080XXXXXXXX" />
                </Field>
                <Field label="WhatsApp Number">
                  <Input value={data.guardian_whatsapp} onChange={e => set('guardian_whatsapp', e.target.value)} placeholder="080XXXXXXXX" />
                </Field>
              </div>
              <Field label="Email Address" required error={errors.guardian_email}>
                <Input type="email" value={data.guardian_email} onChange={e => set('guardian_email', e.target.value)} placeholder="parent@email.com" />
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="Occupation"><Input value={data.guardian_occupation} onChange={e => set('guardian_occupation', e.target.value)} /></Field>
                <Field label="Office Address"><Input value={data.guardian_office_address} onChange={e => set('guardian_office_address', e.target.value)} /></Field>
              </div>
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 18, marginTop: 4 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginBottom: 14 }}>Emergency Contact (if different from above)</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                  <Field label="Name"><Input value={data.emergency_name} onChange={e => set('emergency_name', e.target.value)} /></Field>
                  <Field label="Phone"><Input value={data.emergency_phone} onChange={e => set('emergency_phone', e.target.value)} /></Field>
                  <Field label="Relationship"><Input value={data.emergency_relationship} onChange={e => set('emergency_relationship', e.target.value)} /></Field>
                </div>
              </div>
            </>}

            {/* STEP 3 — Academic */}
            {step === 3 && <>
              <div style={{ background: 'rgba(26,111,165,0.05)', borderRadius: 'var(--radius-md)', padding: '12px 16px', fontSize: 13, color: 'var(--text-2)', marginBottom: 4 }}>
                UI Sports Academy promotes the Student-Athlete development model.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="Last Academic Average (%)">
                  <Input type="number" min="0" max="100" value={data.last_avg_score} onChange={e => set('last_avg_score', e.target.value)} placeholder="75" />
                </Field>
                <Field label="Position in Class">
                  <Input value={data.class_position} onChange={e => set('class_position', e.target.value)} placeholder="e.g. 5 out of 40" />
                </Field>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="Best Subject"><Input value={data.best_subject} onChange={e => set('best_subject', e.target.value)} /></Field>
                <Field label="Favourite Subject"><Input value={data.favourite_subject} onChange={e => set('favourite_subject', e.target.value)} /></Field>
              </div>
              <Field label="Academic Goal for Next Session">
                <textarea className="form-input" rows={3} value={data.academic_goal} onChange={e => set('academic_goal', e.target.value)} placeholder="I want to improve my grades in..." style={{ resize: 'vertical' }} />
              </Field>
            </>}

            {/* STEP 4 — Medical */}
            {step === 4 && <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="Blood Group">
                  <Select value={data.blood_group} onChange={e => set('blood_group', e.target.value)}>
                    <option value="">Select</option>
                    {BLOOD_GROUPS.map(b => <option key={b}>{b}</option>)}
                  </Select>
                </Field>
                <Field label="Genotype">
                  <Select value={data.genotype} onChange={e => set('genotype', e.target.value)}>
                    <option value="">Select</option>
                    {GENOTYPES.map(g => <option key={g}>{g}</option>)}
                  </Select>
                </Field>
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginBottom: 10 }}>Known Medical Conditions (check all that apply)</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {[['condition_asthma','Asthma'],['condition_epilepsy','Epilepsy'],['condition_diabetes','Diabetes'],['condition_hypertension','Hypertension'],['condition_heart','Heart Condition']].map(([k, l]) => (
                    <button key={k} type="button" onClick={() => toggle(k)}
                      style={{ padding: '7px 14px', border: `1.5px solid ${data[k]?'var(--red)':'var(--border)'}`, borderRadius: 20, background: data[k]?'var(--red-bg)':'white', color: data[k]?'var(--red)':'var(--text-2)', fontWeight: 600, fontSize: 13, transition: 'all .15s' }}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <Field label="Allergies (Food, Drug, or Insect)">
                <Input value={data.allergies} onChange={e => set('allergies', e.target.value)} placeholder="e.g. Penicillin, Peanuts" />
              </Field>
              <Field label="Current Medications & Dosage">
                <Input value={data.current_medications} onChange={e => set('current_medications', e.target.value)} />
              </Field>
              <Field label="Past Serious Injuries / Disabilities">
                <Input value={data.past_injuries} onChange={e => set('past_injuries', e.target.value)} />
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="Family Doctor / Hospital">
                  <Input value={data.family_doctor} onChange={e => set('family_doctor', e.target.value)} />
                </Field>
                <Field label="Doctor's Phone">
                  <Input value={data.family_doctor_phone} onChange={e => set('family_doctor_phone', e.target.value)} />
                </Field>
              </div>
              <Field label="Date of Last Medical Check-up">
                <Input type="date" value={data.last_medical_checkup} onChange={e => set('last_medical_checkup', e.target.value)} />
              </Field>
            </>}

            {/* STEP 5 — Consent */}
            {step === 5 && <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Checkbox k="consent_medical" required label="Medical Consent: I hereby authorize the UI Sports Academy medical team to administer first aid and, in emergency, to secure proper medical treatment for my child/ward." />
                {errors.consent_medical && <span style={{ fontSize: 12, color: 'var(--red)', marginTop: -4 }}>{errors.consent_medical}</span>}
                <Checkbox k="consent_conduct" required label="Code of Conduct: I/We agree that the applicant will abide by all rules and regulations of the UI Sports Academy. Indiscipline, bullying, or drug use will lead to immediate dismissal without refund." />
                {errors.consent_conduct && <span style={{ fontSize: 12, color: 'var(--red)', marginTop: -4 }}>{errors.consent_conduct}</span>}
                <Checkbox k="consent_indemnity" required label="Indemnity: I understand that sports participation involves inherent risks. I hereby indemnify the University of Ibadan, Sports Academy, coaches, and staff against any claims for injuries, loss, or damages during the clinic." />
                {errors.consent_indemnity && <span style={{ fontSize: 12, color: 'var(--red)', marginTop: -4 }}>{errors.consent_indemnity}</span>}
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>Media Release</p>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {['Yes', 'No'].map(v => (
                      <button key={v} type="button" onClick={() => set('consent_media', v)}
                        style={{ padding: '8px 24px', border: `1.5px solid ${data.consent_media===v?'var(--navy)':'var(--border)'}`, borderRadius: 'var(--radius-md)', background: data.consent_media===v?'var(--navy)':'white', color: data.consent_media===v?'white':'var(--text-2)', fontWeight: 600, fontSize: 14 }}>
                        {v}
                      </button>
                    ))}
                    <span style={{ fontSize: 12, color: 'var(--text-3)', alignSelf: 'center' }}>
                      Grant permission to use photos/videos for promotional purposes
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20, marginTop: 8 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginBottom: 12 }}>Section H: Document Uploads</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <FileUpload field="passport_photo" label="Passport Photograph (recent)" />
                  <FileUpload field="birth_certificate" label="Birth Certificate / Age Declaration" />
                  <FileUpload field="school_result" label="Last School Result" />
                </div>
              </div>
            </>}

            {/* STEP 6 — Review */}
            {step === 6 && <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {[
                  { title: 'Personal Details', rows: [
                    ['Name', `${data.first_name} ${data.middle_name} ${data.surname}`.trim()],
                    ['Date of Birth', data.date_of_birth],
                    ['Gender', data.gender],
                    ['Nationality', data.nationality],
                  ]},
                  { title: 'Sport Selection', rows: [
                    ['Category', cat],
                    ['Sport', data.sport_selection],
                    ['Experience', data.experience_level || 'N/A'],
                    ['T-Shirt Size', data.tshirt_size],
                  ]},
                  { title: 'Guardian Details', rows: [
                    ['Guardian', `${data.guardian_title} ${data.guardian_name}`.trim()],
                    ['Phone', data.guardian_phone],
                    ['Email', data.guardian_email],
                  ]},
                ].map(({ title, rows }) => (
                  <div key={title} style={{ background: 'var(--surface)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                    <div style={{ padding: '10px 16px', background: 'var(--navy)', color: 'white', fontSize: 12, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase' }}>{title}</div>
                    {rows.map(([k, v]) => v && (
                      <div key={k} style={{ display: 'flex', padding: '9px 16px', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                        <span style={{ color: 'var(--text-3)', width: 140, flexShrink: 0 }}>{k}</span>
                        <span style={{ color: 'var(--text-1)', fontWeight: 500 }}>{v}</span>
                      </div>
                    ))}
                  </div>
                ))}
                <div style={{ background: 'rgba(232,160,0,0.08)', border: '1.5px solid rgba(232,160,0,0.3)', borderRadius: 'var(--radius-md)', padding: '14px 16px', fontSize: 13, color: 'var(--amber)' }}>
                  By clicking <strong>Submit Registration</strong>, you confirm all information is accurate.
                </div>
              </div>
            </>}
          </div>

          {/* Navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 32, paddingTop: 24, borderTop: '1px solid var(--border)' }}>
            {step > 0
              ? <button type="button" className="btn btn-outline" onClick={back}><ChevronLeft size={16} /> Back</button>
              : <Link to="/" className="btn btn-outline"><ChevronLeft size={16} /> Home</Link>
            }
            {step < STEPS.length - 1
              ? <button type="button" className="btn btn-primary" onClick={next}>Continue <ChevronRight size={16} /></button>
              : <button type="button" className="btn btn-gold" onClick={handleSubmit} disabled={loading}>
                  {loading ? 'Submitting…' : 'Submit Registration'}
                  {!loading && <Check size={16} />}
                </button>
            }
          </div>
        </div>
      </div>
    </div>
  );
}
