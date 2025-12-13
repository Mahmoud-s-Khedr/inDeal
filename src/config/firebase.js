const admin = require('firebase-admin');
const config = require('./env');
const logger = require('../utils/logger');

let firebaseApp = null;

const hasCredentials =
    config.firebase.projectId && config.firebase.clientEmail && config.firebase.privateKey;

if (hasCredentials) {
    try {
        firebaseApp =
            admin.apps.length > 0
                ? admin.app()
                : admin.initializeApp({
                      credential: admin.credential.cert({
                          projectId: config.firebase.projectId,
                          clientEmail: config.firebase.clientEmail,
                          privateKey: config.firebase.privateKey,
                      }),
                  });
        logger.info('Firebase Admin initialized');
    } catch (err) {
        firebaseApp = null;
        logger.error('Failed to initialize Firebase Admin SDK', err);
    }
} else {
    logger.warn('Firebase configuration incomplete. Push notifications disabled.');
}

module.exports = {
    firebaseApp,
    messaging: firebaseApp ? admin.messaging() : null,
};
