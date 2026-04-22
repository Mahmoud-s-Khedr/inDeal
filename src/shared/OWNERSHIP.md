# Shared Ownership Index

Shared code is intentionally broad in this repository, but every artifact needs an owner and usage intent.

| Path                               | Owner Module | Usage Intent                                                            |
| ---------------------------------- | ------------ | ----------------------------------------------------------------------- |
| `shared/utils/jwt.js`              | auth         | Token signing/verification primitive used by auth and transport guards. |
| `shared/utils/chatEncryption.js`   | chat         | Shared encryption helpers for chat persistence and socket transport.    |
| `shared/utils/logger.js`           | system       | Unified logger for app/infrastructure/modules.                          |
| `shared/utils/startupLogger.js`    | system       | Startup/runtime lifecycle logging helpers.                              |
| `shared/utils/validationHelper.js` | company      | Cross-module validation helpers for entity completeness checks.         |
| `shared/constants/storage.js`      | file         | File upload constraints and storage defaults.                           |

Rule: before adding a new shared artifact, assign owner module + intent here.
