const companyRepository = require('../repositories/company.repository');
const adRepository = require('../repositories/ad.repository');
const pendingUpdateRepository = require('../repositories/pendingUpdate.repository');

const getDashboardCards = async () => {
  const [newRegistrationRequests, pendingAdverts, profileUpdates] = await Promise.all([
    companyRepository.countByStatus('underReview'),
    adRepository.countAll({ status: 'pending' }),
    pendingUpdateRepository.countPending(),
  ]);

  return {
    cards: {
      newRegistrationRequests: { count: newRegistrationRequests },
      pendingAdverts: { count: pendingAdverts },
      profileUpdates: { count: profileUpdates },
    },
    generatedAt: new Date().toISOString(),
  };
};

module.exports = {
  getDashboardCards,
};
