const dotenv = require('dotenv');
dotenv.config();
const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
const userRepository = require('../repositories/user.repository');
const companyRepository = require('../repositories/company.repository');
const fileRepository = require('../repositories/file.repository');
const companyDocumentRepository = require('../repositories/companyDocument.repository');
const galleryRepository = require('../repositories/companyGallery.repository');
const contributionRepository = require('../repositories/companyContribution.repository');
const contributionMediaRepository = require('../repositories/companyContributionMedia.repository');
const reviewRepository = require('../repositories/companyReview.repository');
const dealRepository = require('../repositories/deal.repository');
const dealRequestRepository = require('../repositories/dealRequest.repository');
const chatRepository = require('../repositories/chat.repository');
const notificationRepository = require('../repositories/notification.repository');
const supportRepository = require('../repositories/support.repository');
const supportChatRepository = require('../repositories/supportChat.repository');
const deviceTokenRepository = require('../repositories/deviceToken.repository');
const emailLogRepository = require('../repositories/emailLog.repository');
const pendingUpdateRepository = require('../repositories/pendingUpdate.repository');
const adRepository = require('../repositories/ad.repository');
const logger = require('../utils/logger');

const COMPANY_TYPES = [
  'supplier',
  'manufacturer',
  'distributor',
  'retailer',
  'serviceProvider',
  'wholesaler',
  'eCommerce',
  'franchise',
  'cooperative',
  'holdingCompany',
  'consultancy',
  'logistics',
  'other',
];

const INDUSTRIES = [
  'agriculture',
  'automotive',
  'banking',
  'construction',
  'education',
  'healthcare',
  'hospitality',
  'manufacturing',
  'retail',
  'technology',
  'telecommunications',
  'transportation',
  'other',
];

const MANUFACTURING_STRATEGIES = [
  'makeToStock',
  'makeToOrder',
  'assembleToOrder',
  'engineerToOrder',
];

const DEAL_TYPES = ['auction', 'rfq'];

const CITY_NAMES = [
  'Cairo',
  'Alexandria',
  'Giza',
  'Port Said',
  'Suez',
  'Mansoura',
  'Tanta',
  'Asyut',
  'Ismailia',
  'Faiyum',
  'New Cairo',
  'Zagazig',
  'Damietta',
];

const COMPANY_NAME_SEEDS = [
  'Acme Industrial Co.',
  'Delta Manufacturing',
  'Nile Logistics Group',
  'Cairo Tech Supplies',
  'Alexandria Wholesale',
  'Suez Construction Partners',
  'Mansoura Agro Solutions',
  'Upper Egypt Steelworks',
  'Red Sea Marine Supplies',
  'Sinai Energy Partners',
  'Luxor Agro Traders',
  'Aswan Packaging Solutions',
  'Port Said Shipping Co.',
  'Giza Industrial Tools',
  'Helwan Engineering Group',
  'Obour Plastics',
  'October Electronics',
  'Damietta Furniture Works',
  'Ismailia Petrochem',
  'Beni Suef Cement',
];

const MESSAGE_SNIPPETS = [
  'Hello! We reviewed your deal details and have a quick question.',
  'Thanks for sharing the RFQ. We can provide a proposal this week.',
  'We are interested in negotiating terms for delivery and pricing.',
  'Could you confirm the required quantities and timeline?',
  'We can offer flexible payment terms if needed.',
];

const truthy = (value) => value === true || value === 'true' || value === '1' || value === 1;

const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomChoice = (list) => list[randomInt(0, list.length - 1)];
const randomFloat = (min, max, digits = 2) =>
  parseFloat((Math.random() * (max - min) + min).toFixed(digits));
const randomId = () => Math.random().toString(36).slice(2, 10);

const randomDateWithinDays = (days) => {
  const ms = randomInt(0, days * 24 * 60 * 60 * 1000);
  return new Date(Date.now() - ms);
};

const randomDateBetween = (start, end) => {
  const startTime = start.getTime();
  const endTime = end.getTime();
  if (endTime <= startTime) return new Date(startTime);
  const ms = startTime + Math.random() * (endTime - startTime);
  return new Date(ms);
};

const getTestConfig = () => {
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@indeal.local';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Password123!';
  const adminUsername = process.env.SEED_ADMIN_USERNAME || 'admin';

  const agentPassword = process.env.SEED_TEST_PASSWORD || 'Password123!';
  const agentPrefix = process.env.SEED_TEST_AGENT_PREFIX || 'agent';
  const emailDomain = process.env.SEED_TEST_EMAIL_DOMAIN || 'indeal.test';
  const companyCount = parseInt(process.env.SEED_TEST_COMPANY_COUNT || '20', 10);
  const companyPrefix = process.env.SEED_TEST_COMPANY_PREFIX || 'Company';

  const forcePasswords = truthy(process.env.SEED_FORCE_PASSWORD);

  return {
    admin: {
      email: adminEmail.toLowerCase(),
      password: adminPassword,
      username: adminUsername,
      firstName: process.env.SEED_ADMIN_FIRST_NAME || 'Admin',
      lastName: process.env.SEED_ADMIN_LAST_NAME || 'User',
    },
    agent: {
      password: agentPassword,
      prefix: agentPrefix,
    },
    company: {
      count: Number.isInteger(companyCount) && companyCount > 0 ? companyCount : 20,
      prefix: companyPrefix,
      emailDomain,
    },
    forcePasswords,
  };
};

const ensureUser = async ({
  email,
  username,
  firstName,
  lastName,
  role,
  status,
  password,
  forcePassword,
}) => {
  const existing = await userRepository.findByEmail(email);

  if (!existing) {
    const passwordHash = await bcrypt.hash(password, 12);
    const created = await userRepository.createUser(null, {
      username,
      email,
      passwordHash,
      firstName,
      lastName,
      jobTitle: null,
    });

    const updated = await userRepository.updateById(created.id, {
      role,
      status,
    });

    return updated;
  }

  const updates = {
    username,
    first_name: firstName,
    last_name: lastName,
    role,
    status,
  };

  const updated = await userRepository.updateById(existing.id, updates);

  if (forcePassword) {
    const passwordHash = await bcrypt.hash(password, 12);
    await userRepository.updatePasswordHash(existing.id, passwordHash);
  }

  return updated;
};

const ensureCompanyForAgent = async ({ agentId, name, description }) => {
  const existing = await companyRepository.findByAgentId(agentId);

  if (!existing) {
    const created = await companyRepository.createCompany(null, {
      agentId,
      name,
      description,
    });

    await companyRepository.updateCompanyStatus(created.id, 'active');
    return await companyRepository.findByAgentId(agentId);
  }

  await companyRepository.updateCompanyByAgent(agentId, {
    name,
    description,
  });

  if (existing.status !== 'active') {
    await companyRepository.updateCompanyStatus(existing.id, 'active');
  }

  return await companyRepository.findByAgentId(agentId);
};

const createSeedFile = async ({ fileName, fileType, size = 150000 }) => {
  const safeName = fileName || 'seed-file.bin';
  const ext = safeName.includes('.') ? safeName.split('.').pop() : 'bin';
  const pathSuffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const filePath = `seed/${pathSuffix}.${ext}`;

  return fileRepository.createFile({
    fileName: safeName,
    filePath,
    fileMetadata: {
      originalFileName: safeName,
      mimeType: fileType || 'application/octet-stream',
      size,
      seeded: true,
    },
  });
};

const setUserTimestamps = async (userId, date) => {
  await pool.query('UPDATE users SET created_at = $1, updated_at = $1 WHERE id = $2', [
    date,
    userId,
  ]);
};

const setCompanyTimestamps = async (companyId, date) => {
  await pool.query('UPDATE companies SET created_at = $1, updated_at = $1 WHERE id = $2', [
    date,
    companyId,
  ]);
};

const setDealTimestamps = async (dealId, date) => {
  await pool.query('UPDATE deals SET created_at = $1, updated_at = $1 WHERE id = $2', [
    date,
    dealId,
  ]);
};

const setDealStatusWithTimestamp = async (dealId, status, date) => {
  await pool.query('UPDATE deals SET status = $1, updated_at = $2 WHERE id = $3', [
    status,
    date,
    dealId,
  ]);
};

const setDealRequestTimestamps = async (requestId, date) => {
  await pool.query(
    'UPDATE deal_requests SET created_at = $1, updated_at = $1 WHERE id = $2',
    [date, requestId]
  );
};

const setReviewTimestamp = async (reviewId, date) => {
  await pool.query('UPDATE company_reviews SET created_at = $1 WHERE id = $2', [
    date,
    reviewId,
  ]);
};

const setGalleryTimestamp = async (galleryId, date) => {
  await pool.query('UPDATE company_gallery SET uploaded_at = $1 WHERE id = $2', [
    date,
    galleryId,
  ]);
};

const setDocumentTimestamp = async (documentId, date) => {
  await pool.query('UPDATE company_documents SET uploaded_at = $1 WHERE id = $2', [
    date,
    documentId,
  ]);
};

const setContributionTimestamps = async (contributionId, date) => {
  await pool.query(
    'UPDATE company_contributions SET created_at = $1, updated_at = $1 WHERE id = $2',
    [date, contributionId]
  );
};

const setChatRoomTimestamp = async (roomId, date) => {
  await pool.query('UPDATE chat_rooms SET created_at = $1 WHERE id = $2', [date, roomId]);
};

const setChatMessageTimestamp = async (messageId, date) => {
  await pool.query('UPDATE chat_messages SET sent_at = $1 WHERE id = $2', [date, messageId]);
};

const setNotificationTimestamp = async (notificationId, date) => {
  await pool.query('UPDATE notifications SET created_at = $1 WHERE id = $2', [
    date,
    notificationId,
  ]);
};

const setSupportTicketTimestamp = async (ticketId, date) => {
  await pool.query('UPDATE support_tickets SET created_at = $1, updated_at = $1 WHERE id = $2', [
    date,
    ticketId,
  ]);
};

const setSupportResponseTimestamp = async (responseId, date) => {
  await pool.query('UPDATE support_ticket_responses SET created_at = $1 WHERE id = $2', [
    date,
    responseId,
  ]);
};

const setAdTimestamp = async (adId, date) => {
  await pool.query('UPDATE advertisements SET created_at = $1, updated_at = $1 WHERE id = $2', [
    date,
    adId,
  ]);
};

const setAuditLogTimestamp = async (logId, date) => {
  await pool.query('UPDATE audit_logs SET timestamp = $1 WHERE id = $2', [date, logId]);
};

const setSupportChatRoomTimestamp = async (roomId, date) => {
  await pool.query('UPDATE support_chat_rooms SET started_at = $1 WHERE id = $2', [
    date,
    roomId,
  ]);
};

const setSupportChatMessageTimestamp = async (messageId, date) => {
  await pool.query('UPDATE support_chat_messages SET sent_at = $1 WHERE id = $2', [
    date,
    messageId,
  ]);
};

const setEmailLogTimestamp = async (logId, date) => {
  await pool.query('UPDATE email_logs SET created_at = $1 WHERE id = $2', [date, logId]);
};

const setPendingUpdateTimestamp = async (pendingId, date) => {
  await pool.query('UPDATE company_pending_updates SET submitted_at = $1 WHERE id = $2', [
    date,
    pendingId,
  ]);
};

const createAuditLog = async ({ userId, companyId, action, details, date }) => {
  const result = await pool.query(
    `INSERT INTO audit_logs (user_id, company_id, action, details)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [userId || null, companyId || null, action, details || null]
  );
  if (date) {
    await setAuditLogTimestamp(result.rows[0].id, date);
  }
  return result.rows[0];
};

const buildCompanyDetails = (index, companyName, emailDomain) => {
  const companyType = randomChoice(COMPANY_TYPES);
  const companyIndustry = randomChoice(INDUSTRIES);
  const manufacturingStrategy =
    companyType === 'manufacturer' ? randomChoice(MANUFACTURING_STRATEGIES) : null;
  const city = randomChoice(CITY_NAMES);

  return {
    email: `${companyName.toLowerCase().replace(/\s+/g, '.')}@${emailDomain}`,
    address: `${randomInt(10, 99)} ${city} Industrial Zone, ${city}, Egypt`,
    phone: `+20${randomInt(100000000, 999999999)}`,
    website: `https://www.${companyName.toLowerCase().replace(/\s+/g, '')}.com`,
    companyType,
    companyIndustry,
    manufacturingStrategy,
    contacts: [
      { type: 'email', value: `contact@${companyName.toLowerCase().replace(/\s+/g, '')}.com` },
      { type: 'phone', value: `+20${randomInt(100000000, 999999999)}` },
    ],
    locations: [city, randomChoice(CITY_NAMES)],
  };
};

const createNotification = async (userId, payload, date) => {
  const notification = await notificationRepository.createNotification({
    userId,
    ...payload,
  });
  await setNotificationTimestamp(notification.id, date);
  return notification;
};

const seedTestData = async () => {
  const cfg = getTestConfig();

  const admin = await ensureUser({
    ...cfg.admin,
    role: 'admin',
    status: 'verified',
    forcePassword: cfg.forcePasswords,
  });

  await userRepository.insertPasswordHistory(
    admin.id,
    await bcrypt.hash(cfg.admin.password, 12)
  );

  await deviceTokenRepository.upsert(admin.id, `dev-token-${randomId()}`, 'web', {
    model: 'Browser',
    os: 'Linux',
    appVersion: '1.0.0',
  });

  const companies = [];

  for (let i = 1; i <= cfg.company.count; i += 1) {
    const agentEmail = `${cfg.agent.prefix}${i}@${cfg.company.emailDomain}`.toLowerCase();
    const agentUsername = `${cfg.agent.prefix}${i}`;
    const agentFirstName = `Agent${i}`;
    const agentLastName = `Test${i}`;

    const agent = await ensureUser({
      email: agentEmail,
      username: agentUsername,
      firstName: agentFirstName,
      lastName: agentLastName,
      role: 'agent',
      status: 'verified',
      password: cfg.agent.password,
      forcePassword: cfg.forcePasswords,
    });

    await userRepository.insertPasswordHistory(
      agent.id,
      await bcrypt.hash(cfg.agent.password, 12)
    );

    await deviceTokenRepository.upsert(agent.id, `dev-token-${randomId()}`, 'web', {
      model: 'Browser',
      os: 'Linux',
      appVersion: '1.0.0',
    });

    const companyName = COMPANY_NAME_SEEDS[i - 1] || `${cfg.company.prefix} ${i}`;
    const companyDescription = `Seeded test company ${i} for QA scenarios.`;

    const companyRecord = await ensureCompanyForAgent({
      agentId: agent.id,
      name: companyName,
      description: companyDescription,
    });

    const companyDetails = buildCompanyDetails(i, companyName, cfg.company.emailDomain);

    const logoFile = await createSeedFile({
      fileName: `${companyName.replace(/\s+/g, '-')}-logo.png`,
      fileType: 'image/png',
    });

    await companyRepository.updateCompanyById(companyRecord.id, {
      address: companyDetails.address,
      phone: companyDetails.phone,
      website: companyDetails.website,
      company_type: companyDetails.companyType,
      company_industry: companyDetails.companyIndustry,
      manufacturing_strategy: companyDetails.manufacturingStrategy,
      contacts: companyDetails.contacts,
      locations: companyDetails.locations,
      logo: logoFile.id,
      email: companyDetails.email,
    });

    const seededAt = randomDateWithinDays(30);
    await setUserTimestamps(agent.id, seededAt);
    await setCompanyTimestamps(companyRecord.id, seededAt);

    await pool.query(
      `INSERT INTO company_agents (company_id, user_id, role, status, created_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (company_id, user_id) DO NOTHING`,
      [companyRecord.id, agent.id, 'owner', 'active', seededAt]
    );

    await createAuditLog({
      userId: agent.id,
      companyId: companyRecord.id,
      action: 'company_seeded',
      details: { source: 'testSeeder' },
      date: seededAt,
    });

    const docFile = await createSeedFile({
      fileName: `${companyName.replace(/\s+/g, '-')}-certificate.pdf`,
      fileType: 'application/pdf',
      size: 220000,
    });

    const issueDate = randomDateWithinDays(365 * 2);
    const expiryDate = new Date(issueDate.getTime() + 365 * 24 * 60 * 60 * 1000);

    const document = await companyDocumentRepository.createDocument({
      companyId: companyRecord.id,
      fileId: docFile.id,
      docType: 'certificate',
      title: 'ISO 9001 Certification',
      issuer: 'ISO Org',
      url: null,
      description: 'Quality management certification.',
      issueDate,
      expiryDate,
    });

    await setDocumentTimestamp(document.id, randomDateBetween(seededAt, new Date()));

    const galleryFile = await createSeedFile({
      fileName: `${companyName.replace(/\s+/g, '-')}-facility.jpg`,
      fileType: 'image/jpeg',
    });

    const galleryItem = await galleryRepository.createGalleryItem({
      companyId: companyRecord.id,
      imageFileId: galleryFile.id,
      description: 'Main production facility',
    });

    await setGalleryTimestamp(galleryItem.id, randomDateBetween(seededAt, new Date()));

    const contribution = await contributionRepository.createContribution({
      companyId: companyRecord.id,
      mediaFileId: null,
      mediaType: 'url',
      mediaUrl: `https://example.com/${companyRecord.id}/portfolio`,
      type: 'project',
      title: `${companyName} flagship project`,
      description: 'Seeded project showcase for testing.',
      details: {
        value: randomFloat(50000, 250000),
        locations: companyDetails.locations,
        tags: ['seed', 'qa', 'portfolio'],
      },
    });

    await setContributionTimestamps(contribution.id, randomDateBetween(seededAt, new Date()));

    const contributionMediaFile = await createSeedFile({
      fileName: `${companyName.replace(/\s+/g, '-')}-portfolio.jpg`,
      fileType: 'image/jpeg',
    });

    await contributionMediaRepository.addMedia({
      contributionId: contribution.id,
      fileId: contributionMediaFile.id,
      mediaType: 'image',
      mediaUrl: null,
      caption: 'Project highlight',
      sortOrder: 0,
    });

    const pendingUpdate = await pendingUpdateRepository.create(companyRecord.id, {
      description: `${companyName} pending update request`,
    });
    await setPendingUpdateTimestamp(pendingUpdate.id, randomDateBetween(seededAt, new Date()));

    companies.push({
      agent,
      companyId: companyRecord.id,
      companyName,
      seededAt,
    });
  }

  const deals = [];

  for (const company of companies) {
    for (let d = 1; d <= 2; d += 1) {
      const dealDate = randomDateBetween(company.seededAt, new Date());
      const deal = await dealRepository.createDeal(null, {
        companyId: company.companyId,
        dealName: `${company.companyName} Deal ${d}`,
        dealDescription: 'Seeded deal for functional testing.',
        dealValue: randomFloat(20000, 250000),
        dealType: randomChoice(DEAL_TYPES),
        status: 'open',
      });

      await setDealTimestamps(deal.id, dealDate);

      await createNotification(
        company.agent.id,
        {
          type: 'deal_created',
          title: 'New deal created',
          message: `Your deal "${deal.deal_name}" is now live.`,
          metadata: { dealId: deal.id },
        },
        dealDate
      );

      await createAuditLog({
        userId: company.agent.id,
        companyId: company.companyId,
        action: 'deal_created',
        details: { dealId: deal.id },
        date: dealDate,
      });

      deals.push({
        dealId: deal.id,
        ownerCompanyId: company.companyId,
        ownerUserId: company.agent.id,
        dealDate,
      });
    }
  }

  for (const deal of deals) {
    const ownerCompany = companies.find((c) => c.companyId === deal.ownerCompanyId);
    const applicants = companies.filter((c) => c.companyId !== deal.ownerCompanyId);
    const selectedApplicants = applicants.sort(() => 0.5 - Math.random()).slice(0, 2);

    for (const applicant of selectedApplicants) {
      const requestDate = randomDateBetween(deal.dealDate, new Date());
      const request = await dealRequestRepository.createRequest(null, {
        dealId: deal.dealId,
        applicantCompanyId: applicant.companyId,
        requestDetails: 'Seeded request details for testing workflows.',
        requestOffer: randomFloat(15000, 220000),
        status: 'pending',
      });

      await setDealRequestTimestamps(request.id, requestDate);

      const status = randomChoice(['pending', 'accepted', 'rejected']);
      if (status !== 'pending') {
        await dealRequestRepository.updateStatus(request.id, status);
        await setDealRequestTimestamps(request.id, requestDate);
      }

      await createNotification(
        ownerCompany.agent.id,
        {
          type: 'deal_request',
          title: 'New deal request',
          message: `${applicant.companyName} submitted a request on your deal.`,
          metadata: { dealId: deal.dealId, requestId: request.id },
        },
        requestDate
      );

      await createNotification(
        applicant.agent.id,
        {
          type: 'deal_request_submitted',
          title: 'Request submitted',
          message: `Your request was sent to ${ownerCompany.companyName}.`,
          metadata: { dealId: deal.dealId, requestId: request.id },
        },
        requestDate
      );

      if (status === 'accepted') {
        const statusDate = randomDateBetween(requestDate, new Date());
        const nextDealStatus = randomChoice(['negotiating', 'closed']);
        await setDealStatusWithTimestamp(deal.dealId, nextDealStatus, statusDate);

        const review = await reviewRepository.createReview({
          companyId: ownerCompany.companyId,
          reviewerCompanyId: applicant.companyId,
          dealId: deal.dealId,
          reviewText: 'Great collaboration and timely delivery.',
          rating: randomInt(3, 5),
        });

        await setReviewTimestamp(review.id, randomDateBetween(statusDate, new Date()));

        const { room } = await chatRepository.findOrCreateRoom(
          null,
          ownerCompany.companyId,
          applicant.companyId
        );
        await setChatRoomTimestamp(room.id, requestDate);

        for (let m = 0; m < 4; m += 1) {
          const sender = Math.random() > 0.5 ? ownerCompany.agent : applicant.agent;
          const message = await chatRepository.createMessage(null, {
            roomId: room.id,
            senderUserId: sender.id,
            messageText: randomChoice(MESSAGE_SNIPPETS),
            attachmentFileId: null,
          });
          await setChatMessageTimestamp(message.id, randomDateBetween(requestDate, new Date()));
        }

        await createNotification(
          applicant.agent.id,
          {
            type: 'deal_request_accepted',
            title: 'Request accepted',
            message: `${ownerCompany.companyName} accepted your request.`,
            metadata: { dealId: deal.dealId, requestId: request.id },
          },
          statusDate
        );

        await createAuditLog({
          userId: ownerCompany.agent.id,
          companyId: ownerCompany.companyId,
          action: 'deal_request_accepted',
          details: { dealId: deal.dealId, requestId: request.id },
          date: statusDate,
        });
      }
    }
  }

  for (const company of companies) {
    const adImage = await createSeedFile({
      fileName: `${company.companyName.replace(/\s+/g, '-')}-ad.jpg`,
      fileType: 'image/jpeg',
    });

    const ad = await adRepository.create(null, {
      companyId: company.companyId,
      title: `${company.companyName} Featured Listing`,
      content: 'Seeded ad content for testing placement.',
      imageFileId: adImage.id,
      targetUrl: 'https://example.com/ads',
      location: 'homepage_banner',
      type: 'banner',
      startDate: new Date(),
      endDate: null,
    });

    await adRepository.update(ad.id, { status: 'active' });
    const adDate = randomDateBetween(company.seededAt, new Date());
    await setAdTimestamp(ad.id, adDate);

    await pool.query(
      `INSERT INTO ad_analytics_daily (advertisement_id, date, impressions_count, clicks_count)
       VALUES ($1, $2, $3, $4)`,
      [ad.id, adDate.toISOString().split('T')[0], randomInt(50, 500), randomInt(5, 50)]
    );

    await pool.query(
      `INSERT INTO ad_click_events (advertisement_id, user_id, ip_address, user_agent, clicked_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        ad.id,
        company.agent.id,
        '127.0.0.1',
        'Seeder/1.0',
        randomDateBetween(company.seededAt, new Date()),
      ]
    );
  }

  for (const company of companies.slice(0, 5)) {
    const ticket = await supportRepository.createTicket(null, {
      userId: company.agent.id,
      companyId: company.companyId,
      subject: 'Seeded support request',
      message: 'Need help with test workflow.',
      email: company.agent.email,
      priority: 'medium',
    });

    const ticketDate = randomDateBetween(company.seededAt, new Date());
    await setSupportTicketTimestamp(ticket.id, ticketDate);

    const response = await supportRepository.addResponse(ticket.id, admin.id, 'Support reply');
    await setSupportResponseTimestamp(response.id, randomDateBetween(ticketDate, new Date()));

    const emailLog = await emailLogRepository.createLog({
      recipient: company.agent.email,
      template: 'supportReply',
      subject: 'Support update',
      status: 'sent',
    });
    await setEmailLogTimestamp(emailLog.id, randomDateBetween(ticketDate, new Date()));
  }

  for (const company of companies.slice(0, 3)) {
    const supportRoom = await supportChatRepository.createRoom(
      company.agent.id,
      company.companyId
    );
    await setSupportChatRoomTimestamp(supportRoom.id, randomDateBetween(company.seededAt, new Date()));
    await supportChatRepository.assignAdmin(supportRoom.id, admin.id);

    const userMessage = await supportChatRepository.createMessage(
      supportRoom.id,
      company.agent.id,
      'Hello support, need assistance.',
      false
    );
    await setSupportChatMessageTimestamp(
      userMessage.id,
      randomDateBetween(company.seededAt, new Date())
    );

    const adminMessage = await supportChatRepository.createMessage(
      supportRoom.id,
      admin.id,
      'We are reviewing your request.',
      true
    );
    await setSupportChatMessageTimestamp(
      adminMessage.id,
      randomDateBetween(company.seededAt, new Date())
    );
  }

  logger.info('✅ Test seed completed', {
    adminEmail: admin.email,
    companies: companies.length,
    deals: deals.length,
  });

  return { admin, companies, deals };
};

module.exports = {
  seedTestData,
};
