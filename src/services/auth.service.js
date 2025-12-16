const bcrypt = require('bcryptjs');
const AppError = require('../utils/AppError');
const { pool } = require('../config/db');
const { signToken } = require('../utils/jwt');
const userRepository = require('../repositories/user.repository');
const companyRepository = require('../repositories/company.repository');
const companyDocumentRepository = require('../repositories/companyDocument.repository');
const fileRepository = require('../repositories/file.repository');

const fileService = require('./file.service');

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

const sanitizeDocument = (doc) => {
    if (!doc) return null;

    return {
        id: doc.id,
        companyId: doc.company_id,
        fileId: doc.file_id,
        docType: doc.doc_type,
        description: doc.description,
        uploadedAt: doc.uploaded_at,
    };
};

const createRegistrationUploadUrl = async ({ fileName, fileType, fileSize }) => {
    return fileService.createUploadUrl({
        fileName,
        fileType,
        fileSize,
        uploaderId: null,
    });
};

const register = async (payload) => {
    const email = payload.user.email.toLowerCase();
    const username = payload.user.username.trim();
    const documentsPayload = payload.company.documents || [];

    const existingByEmail = await userRepository.findByEmail(email);
    if (existingByEmail) {
        throw new AppError('Email already registered', 400);
    }

    const existingByUsername = await userRepository.findByUsername(username);
    if (existingByUsername) {
        throw new AppError('Username already taken', 400);
    }

    if (documentsPayload.length) {
        const documentFileIds = documentsPayload.map((doc) => doc.fileId);
        const existingFiles = await fileRepository.findByIds(documentFileIds);
        if (existingFiles.length !== documentFileIds.length) {
            throw new AppError('One or more company document files are invalid', 400);
        }
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

        let createdDocuments = [];
        if (documentsPayload.length) {
            createdDocuments = await companyDocumentRepository.bulkCreateDocuments(
                client,
                documentsPayload.map((doc) => ({
                    companyId: newCompany.id,
                    fileId: doc.fileId,
                    docType: doc.docType,
                    description: doc.description,
                }))
            );
        }

        await client.query('COMMIT');

        const token = signToken(newUser.id);
        const companyPayload = sanitizeCompany(newCompany);
        if (createdDocuments.length) {
            companyPayload.documents = createdDocuments.map(sanitizeDocument);
        }

        return {
            token,
            user: sanitizeUser(newUser),
            company: companyPayload,
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

const adminLogin = async (payload) => {
    const email = payload.email.toLowerCase();
    const user = await userRepository.findByEmail(email);

    if (!user || user.role !== 'admin') {
        throw new AppError('Invalid credentials', 401);
    }

    const isPasswordValid = await bcrypt.compare(payload.password, user.password_hash);
    if (!isPasswordValid) {
        throw new AppError('Invalid credentials', 401);
    }

    const token = signToken(user.id);

    return {
        token,
        user: sanitizeUser(user),
    };
};

module.exports = {
    createRegistrationUploadUrl,
    register,
    login,
    adminLogin,
};
