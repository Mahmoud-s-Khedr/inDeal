const dotenv = require('dotenv');
dotenv.config();
const bcrypt = require('bcryptjs');
const userRepository = require('../repositories/user.repository');
const companyRepository = require('../repositories/company.repository');
const logger = require('../utils/logger');

const truthy = (value) => value === true || value === 'true' || value === '1' || value === 1;

const getSeedConfig = () => {
    const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@indeal.local';
    const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Password123!';
    const adminUsername = process.env.SEED_ADMIN_USERNAME || 'admin';

    const agentEmail = process.env.SEED_AGENT_EMAIL || 'agent1@indeal.local';
    const agentPassword = process.env.SEED_AGENT_PASSWORD || 'Password123!';
    const agentUsername = process.env.SEED_AGENT_USERNAME || 'agent1';

    const companyName = process.env.SEED_COMPANY_NAME || 'Acme Industrial Co.';
    const companyDescription = process.env.SEED_COMPANY_DESCRIPTION || 'Seeded demo company for local development.';

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
            email: agentEmail.toLowerCase(),
            password: agentPassword,
            username: agentUsername,
            firstName: process.env.SEED_AGENT_FIRST_NAME || 'Agent',
            lastName: process.env.SEED_AGENT_LAST_NAME || 'One',
        },
        company: {
            name: companyName,
            description: companyDescription,
        },
        forcePasswords,
    };
};

const ensureUser = async ({ email, username, firstName, lastName, role, status, password, forcePassword }) => {
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

        // Default in schema is underReview; for dev seed we want it usable immediately.
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

const seedDevData = async () => {
    const cfg = getSeedConfig();

    const admin = await ensureUser({
        ...cfg.admin,
        role: 'admin',
        status: 'verified',
        forcePassword: cfg.forcePasswords,
    });

    const agent = await ensureUser({
        ...cfg.agent,
        role: 'agent',
        status: 'verified',
        forcePassword: cfg.forcePasswords,
    });

    const company = await ensureCompanyForAgent({
        agentId: agent.id,
        name: cfg.company.name,
        description: cfg.company.description,
    });

    logger.info('✅ Seed completed', {
        adminEmail: admin.email,
        agentEmail: agent.email,
        companyId: company?.id,
    });

    return { admin, agent, company };
};

module.exports = {
    seedDevData,
};
