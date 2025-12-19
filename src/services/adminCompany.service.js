const AppError = require('../utils/AppError');
const companyRepository = require('../repositories/company.repository');
const companyDocumentRepository = require('../repositories/companyDocument.repository');
const userRepository = require('../repositories/user.repository');
const fileRepository = require('../repositories/file.repository');
const { publicUrl } = require('../config/storage');

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

const sanitizeDocument = (doc) => ({
    id: doc.id,
    companyId: doc.company_id,
    fileId: doc.file_id,
    docType: doc.doc_type,
    description: doc.description,
    uploadedAt: doc.uploaded_at,
});

const sanitizeUser = (user) => {
    if (!user) return null;
    return {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
    };
};

const buildPublicUrl = (filePath) => {
    if (!publicUrl || !filePath) return null;
    return `${publicUrl.replace(/\/$/, '')}/${filePath}`;
};

const populateDocumentsWithFiles = async (documents) => {
    if (!documents || !documents.length) {
        return [];
    }

    const fileIds = [...new Set(documents.map((doc) => doc.file_id).filter(Boolean))];
    const files = fileIds.length ? await fileRepository.findByIds(fileIds) : [];
    const fileMap = new Map(files.map((file) => [file.id, file]));

    return documents.map((doc) => {
        const sanitized = sanitizeDocument(doc);
        const file = fileMap.get(doc.file_id);
        if (file) {
            sanitized.file = {
                id: file.id,
                fileName: file.fileName,
                filePath: file.filePath,
                publicUrl: buildPublicUrl(file.filePath),
                fileMetadata: file.fileMetadata,
                uploadedAt: file.uploadedAt,
            };
        }
        return sanitized;
    });
};

const listPendingCompanies = async () => {
    const pendingCompanies = await companyRepository.listByStatus('underReview');
    const documentsByCompany = await Promise.all(
        pendingCompanies.map((company) => companyDocumentRepository.listByCompanyId(company.id))
    );
    const documentsWithFiles = await Promise.all(documentsByCompany.map(populateDocumentsWithFiles));

    return pendingCompanies.map((company, index) => ({
        company: sanitizeCompany(company),
        documents: documentsWithFiles[index],
    }));
};

const parseCompanyId = (value) => {
    const id = Number(value);
    if (!Number.isInteger(id) || id <= 0) {
        throw new AppError('Invalid company id', 400);
    }
    return id;
};

const listAllCompanies = async () => {
    const companies = await companyRepository.listAll();
    return companies.map(sanitizeCompany);
};

const getCompanyDetail = async (companyId) => {
    const numericId = parseCompanyId(companyId);
    const company = await companyRepository.findById(numericId);
    if (!company) {
        throw new AppError('Company not found', 404);
    }

    const [documents, agent] = await Promise.all([
        companyDocumentRepository.listByCompanyId(numericId),
        userRepository.findById(company.agent_id),
    ]);
    const documentsWithFiles = await populateDocumentsWithFiles(documents);

    return {
        company: sanitizeCompany(company),
        documents: documentsWithFiles,
        agent: sanitizeUser(agent),
    };
};

const reviewCompanyStatus = async (companyId, status) => {
    const numericId = parseCompanyId(companyId);
    const existing = await companyRepository.findById(numericId);
    if (!existing) {
        throw new AppError('Company not found', 404);
    }

    if (status === 'active') {
        const agent = await userRepository.findById(existing.agent_id);
        if (!agent) {
            throw new AppError('Associated agent not found', 400);
        }
        if (agent.status !== 'verified') {
            throw new AppError('Agent must verify their email before their company can be approved', 400);
        }
    }

    if (existing.status === status) {
        return sanitizeCompany(existing);
    }

    const updated = await companyRepository.updateCompanyStatus(numericId, status);
    return sanitizeCompany(updated);
};

const approveCompany = async (companyId) => reviewCompanyStatus(companyId, 'active');

const rejectCompany = async (companyId) => reviewCompanyStatus(companyId, 'rejected');

const changeCompanyAgent = async (companyId, agentId) => {
    const numericCompanyId = parseCompanyId(companyId);
    const numericAgentId = Number(agentId);
    if (!Number.isInteger(numericAgentId) || numericAgentId <= 0) {
        throw new AppError('Invalid agent id', 400);
    }

    const [company, agent] = await Promise.all([
        companyRepository.findById(numericCompanyId),
        userRepository.findById(numericAgentId),
    ]);

    if (!company) {
        throw new AppError('Company not found', 404);
    }

    if (!agent) {
        throw new AppError('Agent not found', 404);
    }

    const existingCompanyForAgent = await companyRepository.findByAgentId(numericAgentId);
    if (existingCompanyForAgent && existingCompanyForAgent.id !== numericCompanyId) {
        throw new AppError('Agent is already assigned to another company', 400);
    }

    const updated = await companyRepository.updateCompanyAgent(numericCompanyId, numericAgentId);
    return {
        company: sanitizeCompany(updated),
        agent: sanitizeUser(agent),
    };
};

module.exports = {
    listPendingCompanies,
    listAllCompanies,
    getCompanyDetail,
    reviewCompanyStatus,
    approveCompany,
    rejectCompany,
    changeCompanyAgent,
};
