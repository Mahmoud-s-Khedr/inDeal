/**
 * Data Generator - Faker-based test data generation
 */

import { faker } from '@faker-js/faker';

// Company types and industries from API reference
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

const CONTRIBUTION_TYPES = ['product', 'project', 'deal', 'partnership'];

const MEDIA_TYPES = ['image', 'video', 'file', 'url'];

const DOC_TYPES = ['certificate', 'license', 'other'];

const EGYPTIAN_CITIES = [
  'Cairo',
  'Alexandria',
  'Giza',
  'Shubra El Kheima',
  'Port Said',
  'Suez',
  'Mansoura',
  'Tanta',
  'Asyut',
  'Ismailia',
  'Faiyum',
  '6th of October',
  'New Cairo',
  'Zagazig',
  'Damietta',
];

/**
 * Generate a unique username
 */
export function generateUsername() {
  return `${faker.person.firstName().toLowerCase()}_${faker.person.lastName().toLowerCase()}_${faker.string.alphanumeric(4)}`;
}

/**
 * Generate user registration data
 */
export function generateUser(overrides = {}) {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();

  return {
    username: generateUsername(),
    email: faker.internet.email({ firstName, lastName }).toLowerCase(),
    password: `Test${faker.string.alphanumeric(8)}!`,
    firstName,
    lastName,
    jobTitle: faker.person.jobTitle(),
    ...overrides,
  };
}

/**
 * Generate company registration data
 */
export function generateCompany(overrides = {}) {
  const companyType = faker.helpers.arrayElement(COMPANY_TYPES);
  const industry = faker.helpers.arrayElement(INDUSTRIES);

  const company = {
    name: faker.company.name(),
    description: faker.company.catchPhrase() + '. ' + faker.lorem.paragraph(),
    address: `${faker.location.streetAddress()}, ${faker.helpers.arrayElement(EGYPTIAN_CITIES)}, Egypt`,
    phone: `+20${faker.string.numeric(10)}`,
    website: faker.internet.url(),
    companyType,
    companyIndustry: industry,
    contacts: [
      { type: 'email', value: faker.internet.email() },
      { type: 'phone', value: `+20${faker.string.numeric(10)}` },
    ],
    locations: faker.helpers.arrayElements(EGYPTIAN_CITIES, { min: 1, max: 3 }),
  };

  // Only include manufacturingStrategy for manufacturer type
  if (companyType === 'manufacturer') {
    company.manufacturingStrategy = faker.helpers.arrayElement(MANUFACTURING_STRATEGIES);
  }

  return { ...company, ...overrides };
}

/**
 * Generate document data
 */
export function generateDocument(fileId, overrides = {}) {
  const docType = faker.helpers.arrayElement(DOC_TYPES);

  return {
    fileId,
    docType,
    title:
      docType === 'certificate'
        ? `${faker.helpers.arrayElement(['ISO 9001', 'ISO 14001', 'OHSAS 18001', 'CE', 'FDA'])} Certification`
        : faker.commerce.productName() + ' License',
    issuer: faker.company.name(),
    description: faker.lorem.sentence(),
    ...overrides,
  };
}

/**
 * Generate gallery item data
 */
export function generateGalleryItem(imageFileId, overrides = {}) {
  return {
    imageFileId,
    description: faker.helpers.arrayElement([
      'Company headquarters',
      'Production facility',
      'Team photo',
      'Product showcase',
      'Office interior',
      'Manufacturing floor',
      'Quality control lab',
      'Warehouse',
    ]),
    ...overrides,
  };
}

/**
 * Generate contribution data
 */
export function generateContribution(mediaFileId = null, overrides = {}) {
  const type = faker.helpers.arrayElement(CONTRIBUTION_TYPES);
  const useUrl = !mediaFileId && faker.datatype.boolean();

  const base = {
    type,
    title: type === 'product' ? faker.commerce.productName() : faker.company.catchPhrase(),
    description: faker.lorem.paragraphs(2),
    details: generateContributionDetails(type),
  };

  if (useUrl) {
    base.mediaType = 'url';
    base.mediaUrl = faker.internet.url();
  } else if (mediaFileId) {
    base.mediaType = faker.helpers.arrayElement(['image', 'video', 'file']);
    base.mediaFileId = mediaFileId;
  }

  return { ...base, ...overrides };
}

/**
 * Generate contribution details based on type
 */
function generateContributionDetails(type) {
  switch (type) {
    case 'product':
      return {
        price: parseFloat(faker.commerce.price({ min: 100, max: 10000 })),
        currency: 'EGP',
        unit: faker.helpers.arrayElement(['piece', 'kg', 'ton', 'box', 'pallet']),
        minOrderQuantity: faker.number.int({ min: 1, max: 100 }),
        specs: {
          material: faker.commerce.productMaterial(),
          weight: `${faker.number.float({ min: 0.1, max: 100, fractionDigits: 2 })} kg`,
          dimensions: `${faker.number.int({ min: 10, max: 100 })}x${faker.number.int({ min: 10, max: 100 })}x${faker.number.int({ min: 10, max: 100 })} cm`,
        },
      };
    case 'project':
      return {
        startDate: faker.date.past().toISOString().split('T')[0],
        endDate: faker.date.future().toISOString().split('T')[0],
        status: faker.helpers.arrayElement(['completed', 'ongoing', 'planned']),
        value: parseFloat(faker.commerce.price({ min: 10000, max: 1000000 })),
      };
    case 'deal':
      return {
        dealType: faker.helpers.arrayElement(['auction', 'rfq', 'direct']),
        deadline: faker.date.future().toISOString().split('T')[0],
        estimatedValue: parseFloat(faker.commerce.price({ min: 5000, max: 500000 })),
      };
    case 'partnership':
      return {
        partnerType: faker.helpers.arrayElement([
          'strategic',
          'distribution',
          'technology',
          'investment',
        ]),
        duration: `${faker.number.int({ min: 1, max: 5 })} years`,
        scope: faker.lorem.sentence(),
      };
    default:
      return {};
  }
}

/**
 * Generate contribution media item
 */
export function generateContributionMedia(fileId = null, overrides = {}) {
  const useUrl = !fileId && faker.datatype.boolean();

  const base = {
    caption: faker.helpers.arrayElement([
      'Product overview',
      'Technical specifications',
      'Installation guide',
      'Customer testimonial',
      'Demo video',
      'Certificate of authenticity',
    ]),
    sortOrder: faker.number.int({ min: 0, max: 10 }),
  };

  if (useUrl) {
    base.mediaType = 'url';
    base.mediaUrl = faker.internet.url();
  } else if (fileId) {
    base.mediaType = faker.helpers.arrayElement(['image', 'video', 'file']);
    base.fileId = fileId;
  }

  return { ...base, ...overrides };
}

/**
 * Generate review data
 */
export function generateReview(overrides = {}) {
  return {
    rating: faker.number.int({ min: 1, max: 5 }),
    reviewText:
      faker.helpers.arrayElement([
        'Excellent company to work with. Professional and reliable.',
        'Good quality products. Delivery was on time.',
        'Average experience. Communication could be better.',
        'Great customer service and competitive pricing.',
        'Highly recommended for B2B partnerships.',
        'Quality products but shipping took longer than expected.',
        'Very professional team. Will definitely work with them again.',
      ]) +
      ' ' +
      faker.lorem.sentence(),
    ...overrides,
  };
}

/**
 * Generate a complete test data set
 */
export function generateTestDataSet(userCount = 2) {
  const users = [];
  const companies = [];

  for (let i = 0; i < userCount; i++) {
    const user = generateUser();
    user.id = `user-${i + 1}`;
    users.push(user);

    const company = generateCompany();
    company.id = `company-${i + 1}`;
    company.userId = user.id;
    companies.push(company);
  }

  return {
    _comment:
      'Auto-generated test data. Edit values as needed, especially email addresses for testing email flows.',
    users,
    companies,
    admin: {
      email: 'admin@indealeg.com',
      password: 'AdminPassword123!',
      _note: 'Update with real admin credentials for testing',
    },
    testTokens: {
      emailVerificationToken: '',
      passwordResetOtp: '',
      _note: 'These are populated during test runs or manually for email flow testing',
    },
    generatedAt: new Date().toISOString(),
  };
}

export default {
  generateUser,
  generateCompany,
  generateDocument,
  generateGalleryItem,
  generateContribution,
  generateContributionMedia,
  generateReview,
  generateTestDataSet,
};
