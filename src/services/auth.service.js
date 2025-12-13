const bcrypt = require('bcryptjs');
const AppError = require('../utils/AppError');
const { pool } = require('../config/db');
const { signToken } = require('../utils/jwt');
const userRepository = require('../repositories/user.repository');
const companyRepository = require('../repositories/company.repository');

const sanitizeUser = (user) => {
    if (!user) return null;

    return {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        jobTitle: user.job_title,
        role: user.role,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
    };
};

const sanitizeCompany = (company) => {
    if (!company) return null;

    return {
        id: company.id,
        agentId: company.agent_id,
        name: company.name,
        description: company.description,
        address: company.address,
        phone: company.phone,
        website: company.website,
        companyType: company.company_type,
        companyIndustry: company.company_industry,
        manufacturingStrategy: company.manufacturing_strategy,
        status: company.status,
        contacts: company.contacts,
        locations: company.locations,
        createdAt: company.created_at,
        updatedAt: company.updated_at,
    };
};

const register = async (payload) => {
    const email = payload.user.email.toLowerCase();
    const username = payload.user.username.trim();

    const existingByEmail = await userRepository.findByEmail(email);
    if (existingByEmail) {
        throw new AppError('Email already registered', 400);
    }

    const existingByUsername = await userRepository.findByUsername(username);
    if (existingByUsername) {
        throw new AppError('Username already taken', 400);
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const passwordHash = await bcrypt.hash(payload.user.password, 12);

        const newUser = await userRepository.createUser(client, {
            username,
            email,
            passwordHash,
            firstName: payload.user.firstName,
            lastName: payload.user.lastName,
            jobTitle: payload.user.jobTitle,
        });

        const newCompany = await companyRepository.createCompany(client, {
            agentId: newUser.id,
            name: payload.company.name,
            description: payload.company.description,
            address: payload.company.address,
            phone: payload.company.phone,
            website: payload.company.website,
            companyType: payload.company.companyType,
            companyIndustry: payload.company.companyIndustry,
            manufacturingStrategy: payload.company.manufacturingStrategy,
            contacts: payload.company.contacts,
            locations: payload.company.locations,
        });

        await client.query('COMMIT');

        const token = signToken(newUser.id);

        return {
            token,
            user: sanitizeUser(newUser),
            company: sanitizeCompany(newCompany),
        };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

const login = async (payload) => {
    const email = payload.email.toLowerCase();
    const user = await userRepository.findByEmail(email);

    if (!user) {
        throw new AppError('Invalid credentials', 401);
    }

    const isPasswordValid = await bcrypt.compare(payload.password, user.password_hash);
    if (!isPasswordValid) {
        throw new AppError('Invalid credentials', 401);
    }

    const company = await companyRepository.findByAgentId(user.id);
    const token = signToken(user.id);

    return {
        token,
        user: sanitizeUser(user),
        company: sanitizeCompany(company),
    };
};

module.exports = {
    register,
    login,
};
