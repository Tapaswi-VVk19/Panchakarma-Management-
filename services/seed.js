// Seed data for first run. Plain JS — no enums, no interfaces.

export function seedData() {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  const users = [
    {
      id: 'u_admin',
      name: 'Center Admin',
      email: 'admin@panchakarma.in',
      password: 'admin123',
      role: 'admin',
      phone: '+91-9000000001',
      channels: { inApp: true, sms: true, email: true },
    },
    {
      id: 'u_doc1',
      name: 'Dr. Vaidya Sharma',
      email: 'doctor@panchakarma.in',
      password: 'doctor123',
      role: 'practitioner',
      phone: '+91-9000000002',
      channels: { inApp: true, sms: false, email: true },
    },
    {
      id: 'u_pat1',
      name: 'Anita Verma',
      email: 'anita@example.com',
      password: 'patient123',
      role: 'patient',
      phone: '+91-9000000003',
      channels: { inApp: true, sms: true, email: true },
      // Each patient is bound to a primary practitioner. Set by admin when the
      // patient is created (or changed later from the User Management screen).
      assignedDoctorId: 'u_doc1',
      // Wellness packages this patient is currently enrolled in. The patient
      // dashboard / packages page only show items from this list — never the
      // full catalogue (that's an admin-only view).
      enrolledPackageIds: ['pkg_seed_1'],
    },
    {
      id: 'u_pat2',
      name: 'Ravi Kumar',
      email: 'ravi@example.com',
      password: 'patient123',
      role: 'patient',
      phone: '+91-9000000004',
      channels: { inApp: true, sms: false, email: true },
      assignedDoctorId: 'u_doc1',
      enrolledPackageIds: [],
    },
  ];

  // Therapy catalogue — protocol defines auto-scheduling cadence.
  const therapies = [
    {
      id: 't_abhyanga',
      name: 'Abhyanga (Full-Body Oil Massage)',
      description:
        'Warm medicated oil massage that pacifies Vata, improves circulation and prepares the body for deeper detox.',
      durationMinutes: 60,
      sessionsRecommended: 7,
      cadenceDays: 1,
      preCare: [
        'Avoid heavy meals 2 hours before the session.',
        'Hydrate well — drink warm water on waking.',
        'Wear loose, comfortable cotton clothing.',
      ],
      postCare: [
        'Rest for at least 30 minutes after the massage.',
        'Avoid cold water, AC and cold drinks for 2 hours.',
        'Eat a light, warm dinner of khichdi or moong soup.',
      ],
    },
    {
      id: 't_shirodhara',
      name: 'Shirodhara (Oil Stream on Forehead)',
      description:
        'Continuous warm oil stream on the forehead — relieves stress, anxiety and insomnia.',
      durationMinutes: 45,
      sessionsRecommended: 5,
      cadenceDays: 2,
      preCare: [
        'Avoid screens for 1 hour before the session.',
        'Empty the bladder before lying down.',
        'No caffeine on the day of treatment.',
      ],
      postCare: [
        'Keep the head covered for 2–3 hours.',
        'Avoid loud noise and bright light.',
        'Sleep early — the calming effect deepens overnight.',
      ],
    },
    {
      id: 't_virechana',
      name: 'Virechana (Purgation Therapy)',
      description:
        'Medicated purgation to eliminate excess Pitta and toxins from the small intestine.',
      durationMinutes: 240,
      sessionsRecommended: 1,
      cadenceDays: 7,
      preCare: [
        'Three days of internal oleation (ghee) as prescribed.',
        'Only liquid diet on the day before.',
        'Inform practitioner of any medication you are taking.',
      ],
      postCare: [
        'Strict Peyadi Karma (graduated diet) for 7 days.',
        'No cold food, curd, or heavy proteins.',
        'Complete rest — avoid travel and intense work.',
      ],
    },
    {
      id: 't_nasya',
      name: 'Nasya (Nasal Administration)',
      description:
        'Medicated oils/powders administered through the nostrils to clear head and sinus channels.',
      durationMinutes: 30,
      sessionsRecommended: 7,
      cadenceDays: 1,
      preCare: [
        'Light breakfast — no dairy.',
        'Steam inhalation 10 minutes prior.',
        'Blow the nose gently to clear passages.',
      ],
      postCare: [
        'Avoid exposure to dust, smoke and wind for 4 hours.',
        'Gargle with warm salt water.',
        'No head bath for the rest of the day.',
      ],
    },
  ];

  // Two pre-booked sessions for Anita so the dashboard is not empty.
  const sessions = [
    {
      id: 's_seed_1',
      patientId: 'u_pat1',
      practitionerId: 'u_doc1',
      therapyId: 't_abhyanga',
      startAt: new Date(now + 1 * day).toISOString(),
      status: 'scheduled', // scheduled | completed | cancelled | rescheduled
      notes: '',
      createdAt: new Date(now).toISOString(),
    },
    {
      id: 's_seed_2',
      patientId: 'u_pat1',
      practitionerId: 'u_doc1',
      therapyId: 't_abhyanga',
      startAt: new Date(now + 2 * day).toISOString(),
      status: 'scheduled',
      notes: '',
      createdAt: new Date(now).toISOString(),
    },
  ];

  const notifications = [];
  const feedback = [];

  // No diet plans are pre-seeded. Doctors must explicitly assign one from the
  // Patient Management screen — only then does a notification reach the patient.
  const dietPlans = [];

  // Patient-initiated appointment requests (e.g. "I have a new symptom").
  // The assigned doctor receives a notification and can accept or reject.
  const appointmentRequests = [];

  // Wellness packages displayed on the admin-curated public "blog" (read by
  // patients on their dashboard, written by the admin in the admin portal).
  const packages = [
    {
      id: 'pkg_seed_1',
      title: 'Classical 14-Day Panchakarma',
      tagline: 'The complete five-action detox & rejuvenation programme.',
      durationDays: 14,
      priceINR: 65000,
      includes: [
        'Daily Abhyanga & Swedana',
        'Virechana (medicated purgation)',
        'Personalised diet plan',
        'Daily vitals & feedback review',
      ],
      idealFor: 'Chronic stress, metabolic sluggishness, seasonal Pitta imbalance.',
      coverEmoji: '🌿',
      publishedAt: new Date(now).toISOString(),
    },
    {
      id: 'pkg_seed_2',
      title: 'Shirodhara Calm Week',
      tagline: 'A gentle 7-day reset for anxiety, insomnia and burnout.',
      durationDays: 7,
      priceINR: 28000,
      includes: [
        '5× Shirodhara sessions',
        '3× Abhyanga sessions',
        'Sleep & lifestyle coaching',
      ],
      idealFor: 'Working professionals, students before exams, post-illness recovery.',
      coverEmoji: '💆',
      publishedAt: new Date(now).toISOString(),
    },
    {
      id: 'pkg_seed_3',
      title: 'Joint Care 21-Day Protocol',
      tagline: 'Targeted Vata-pacifying therapy for back, knee and shoulder pain.',
      durationDays: 21,
      priceINR: 92000,
      includes: [
        'Daily Kati Basti / Janu Basti',
        '3× Pizhichil sessions',
        'Custom oil & internal medicine',
      ],
      idealFor: 'Osteoarthritis, sciatica, frozen shoulder, long-standing back pain.',
      coverEmoji: '🦴',
      publishedAt: new Date(now).toISOString(),
    },
  ];

  return {
    users,
    therapies,
    sessions,
    notifications,
    feedback,
    dietPlans,
    appointmentRequests,
    packages,
  };
}
