# inDeal API Test Scripts

Node.js scripts to simulate user flows for functional testing and load testing of the inDeal API.

## Features

- **9 User Flow Scripts**: Simulate realistic user journeys through the API
- **Editable Test Data**: JSON file for custom test values (temp emails, passwords)
- **Faker-based Data Generation**: Auto-generate realistic test data
- **Load Testing**: Artillery configurations for stress testing
- **Detailed Logging**: Colored console output with timing information

## Quick Start

```bash
# Navigate to test scripts directory
cd api_test_scripts

# Install dependencies
npm install

# Generate test data
npm run generate-data

# Run a specific flow
npm run flow:session

# Run all flows
npm run flow:all
```

## Project Structure

```
api_test_scripts/
├── package.json              # Dependencies + npm scripts
├── config/
│   ├── default.js            # Configuration (API URL, timeouts)
│   └── test-data.json        # Editable test data file
├── lib/
│   ├── api-client.js         # Axios wrapper with auth handling
│   ├── data-generator.js     # Faker-based data generators
│   ├── file-uploader.js      # R2 signed URL upload helper
│   └── flow-runner.js        # Flow execution utilities
├── flows/
│   ├── 01-registration.flow.js
│   ├── 02-session.flow.js
│   ├── 03-password-reset.flow.js
│   ├── 04-company-profile.flow.js
│   ├── 05-documents.flow.js
│   ├── 06-gallery.flow.js
│   ├── 07-contributions.flow.js
│   ├── 08-reviews.flow.js
│   └── 09-admin.flow.js
├── scripts/
│   ├── generate-test-data.js
│   └── run-all-flows.js
├── load-testing/
│   ├── artillery.yml
│   └── scenarios/
│       ├── registration.yml
│       └── session.yml
└── assets/                   # Sample files for upload tests
```

## Configuration

### Environment Variables

Create a `.env` file in the project root or set these environment variables:

```bash
# API base URL (default: https://api-test.indealeg.com)
API_TEST_BASE_URL=https://api-test.indealeg.com

# Logging options
VERBOSE=true           # Show request/response details
SHOW_RESPONSE=true     # Show response bodies
```

### Test Data File

Edit `config/test-data.json` to customize test users:

```json
{
  "users": [
    {
      "id": "user-1",
      "email": "your-temp-email@example.com", // ← Add real temp email
      "password": "TestPassword123!",
      "firstName": "John",
      "lastName": "Doe",
      "username": "johndoe_test",
      "jobTitle": "Manager"
    }
  ],
  "admin": {
    "email": "admin@indealeg.com",
    "password": "your-admin-password" // ← Add real admin password
  },
  "testTokens": {
    "passwordResetOtp": "123456" // ← Add OTP from email for password reset flow
  }
}
```

## User Flows

### 1. Registration & Onboarding

```bash
npm run flow:registration
```

- Gets signed URL for document upload
- Uploads document to R2
- Registers agent + company
- Attempts initial login

### 2. Login/Logout Session

```bash
npm run flow:session
```

- Authenticates with credentials
- Gets user profile
- Gets company profile
- Logs out and verifies token invalidation

### 3. Password Reset

```bash
npm run flow:password-reset
```

- Requests OTP via email
- Verifies OTP (requires manual input)
- Resets password
- Logs in with new password

> **Note**: Update `testTokens.passwordResetOtp` in test-data.json with the OTP from email.

### 4. Company Profile Management

```bash
npm run flow:company-profile
```

- Updates company profile details
- Submits for review (if needed)
- Verifies changes

### 5. Document Management

```bash
npm run flow:documents
```

- Uploads document file
- Creates document record
- Lists, updates, and deletes document

### 6. Gallery Management

```bash
npm run flow:gallery
```

- Uploads image file
- Adds gallery item
- Lists, updates, and deletes gallery item

### 7. Contributions & Media

```bash
npm run flow:contributions
```

- Creates contribution with media
- Adds multiple media items
- Reorders media
- Updates and deletes

### 8. Company Reviews

```bash
npm run flow:reviews
```

- Views target company profile
- Lists existing reviews
- Submits new review

### 9. Admin Management

```bash
npm run flow:admin
```

- Admin login
- Lists pending companies
- Approves/reviews companies

## Running Multiple Flows

```bash
# Run all flows sequentially
npm run flow:all

# Skip specific flows
npm run flow:all -- --skip=registration,admin

# Run only specific flows
npm run flow:all -- --only=session,profile
```

## Load Testing

### Prerequisites

```bash
# Artillery is installed as a dev dependency
npm install
```

### Running Load Tests

```bash
# Run main load test
npm run load-test

# Run specific scenarios
npm run load-test:registration
npm run load-test:session

# Override target URL
API_TEST_BASE_URL=http://localhost:3000 npm run load-test
```

### Load Test Phases

The main `artillery.yml` includes these phases:

| Phase     | Duration | Rate   | Description      |
| --------- | -------- | ------ | ---------------- |
| Warm-up   | 30s      | 1/s    | Initial ramp     |
| Ramp-up   | 60s      | 1→10/s | Gradual increase |
| Sustained | 120s     | 10/s   | Steady state     |
| Peak      | 60s      | 20/s   | High load        |
| Cool-down | 30s      | 5→1/s  | Gradual decrease |

### Artillery Reports

```bash
# Generate HTML report
npx artillery run load-testing/artillery.yml --output report.json
npx artillery report report.json
```

## Troubleshooting

### Email Verification Required

If login fails with "email not verified", either:

1. Check email for verification link
2. Use the admin panel to manually activate the user
3. Mark email as verified in the database

### OTP Not Working

For password reset flow:

1. Run `npm run flow:password-reset`
2. Check email for OTP
3. Update `testTokens.passwordResetOtp` in test-data.json
4. Run the flow again

### Admin Credentials

Update the `admin` section in test-data.json with valid admin credentials.

### Connection Issues

```bash
# Test API connectivity
curl https://api-test.indealeg.com/api/v1/health
```

## Development

### Adding New Flows

1. Create `flows/XX-flowname.flow.js`
2. Export a `runFlownameFlow` function
3. Add to `scripts/run-all-flows.js`
4. Add npm script in `package.json`

### Data Generator Extensions

Edit `lib/data-generator.js` to add new entity generators.
