/**
 * WebAuthn / Passkey Service
 *
 * Handles FIDO2 WebAuthn registration and authentication ceremonies
 * using @simplewebauthn/server. Integrates with the Prisma-backed
 * PasskeyCredential model for persistent credential storage.
 *
 * Two-step ceremonies:
 *   1. Registration:   generateRegistrationOptions → verifyRegistrationResponse
 *   2. Authentication:  generateAuthenticationOptions → verifyAuthenticationResponse
 *
 * Each step stores/retrieves challenge state from the database.
 *
 * @module webauthnService
 */

const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require("@simplewebauthn/server");

const { isoBase64URL, isoUint8Array } = require("@simplewebauthn/server/helpers");

/**
 * Relying Party configuration — MUST match the values served by the frontend.
 * These should be set via environment variables for different deployments.
 */
const RP_NAME = process.env.WEBAUTHN_RP_NAME || "Lodgist";
const RP_ID = process.env.WEBAUTHN_RP_ID || "localhost";
const ORIGIN = process.env.WEBAUTHN_ORIGIN || "http://localhost:3000";

/**
 * Determines if WebAuthn/passkey authentication is enabled.
 * Controlled via WEBAUTHN_ENABLED env var (defaults to true).
 */
function isWebAuthnEnabled() {
  return process.env.WEBAUTHN_ENABLED !== "false";
}

/**
 * Step 1 of Registration Ceremony
 *
 * Generates registration options for the client (navigator.credentials.create).
 * Stores the challenge temporarily (in a real app, use Redis or a challenges table).
 *
 * @param {object} user - { id, name, email }
 * @param {Array} existingCredentials - Array of { credentialId } for this user
 * @returns {Promise<object>} Registration options to send to the client
 */
async function generatePasskeyRegistrationOptions(user, existingCredentials = []) {
  if (!isWebAuthnEnabled()) {
    throw new Error("WebAuthn is not enabled");
  }

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userName: user.email,
    userDisplayName: user.name,
    attestationType: "none",
    excludeCredentials: existingCredentials.map((cred) => ({
      id: cred.credentialId,
      type: "public-key",
      transports: cred.transports ? JSON.parse(cred.transports) : ["internal"],
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });

  return options;
}

/**
 * Step 2 of Registration Ceremony
 *
 * Verifies the client's response to the registration challenge.
 * On success, stores the credential in the database.
 *
 * @param {object} prisma - Prisma client instance
 * @param {number} userId - The user's database ID
 * @param {object} credential - The credential object from the client
 * @returns {Promise<object>} { verified, credential }
 */
async function verifyAndStorePasskey(prisma, userId, credential, expectedChallenge) {
  if (!isWebAuthnEnabled()) {
    throw new Error("WebAuthn is not enabled");
  }

  const verification = await verifyRegistrationResponse({
    credential,
    expectedRPID: RP_ID,
    expectedOrigin: ORIGIN,
    expectedChallenge,
  });

  if (!verification.verified || !verification.registrationInfo) {
    throw new Error("Passkey registration verification failed");
  }

  const { credentialPublicKey, credentialID, counter } = verification.registrationInfo;

  // Store the credential in the database
  const savedCredential = await prisma.passkeyCredential.create({
    data: {
      userId,
      credentialId: isoBase64URL.fromBytes(credentialID),
      publicKey: Buffer.from(credentialPublicKey), // COSE-encoded public key bytes
      counter,
      transports: JSON.stringify(credential.response.transports || []),
      backedUp: credential.response.backedUp || false,
      deviceType: credential.response.authenticatorAttachment || "platform",
      name: `Passkey ${new Date().toLocaleDateString()}`,
    },
  });

  return {
    verified: true,
    credential: savedCredential,
  };
}

/**
 * Step 1 of Authentication Ceremony
 *
 * Generates authentication options for the client (navigator.credentials.get).
 *
 * @param {Array} allowedCredentials - Array of { credentialId } to allow
 * @returns {Promise<object>} Authentication options to send to the client
 */
async function generatePasskeyAuthenticationOptions(allowedCredentials = []) {
  if (!isWebAuthnEnabled()) {
    throw new Error("WebAuthn is not enabled");
  }

  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    allowCredentials: allowedCredentials.map((cred) => ({
      id: cred.credentialId,
      type: "public-key",
      transports: cred.transports ? JSON.parse(cred.transports) : ["internal"],
    })),
    userVerification: "preferred",
  });

  return options;
}

/**
 * Step 2 of Authentication Ceremony
 *
 * Verifies the client's authentication response.
 *
 * @param {object} credential - The credential assertion from the client
 * @param {object} storedCredential - The stored PasskeyCredential from DB
 * @returns {Promise<object>} { verified, newCounter }
 */
async function verifyPasskeyAuthentication(credential, storedCredential, expectedChallenge) {
  if (!isWebAuthnEnabled()) {
    throw new Error("WebAuthn is not enabled");
  }

  const verification = await verifyAuthenticationResponse({
    credential,
    expectedRPID: RP_ID,
    expectedOrigin: ORIGIN,
    expectedChallenge,
    credential: {
      id: storedCredential.credentialId,
      publicKey: new Uint8Array(storedCredential.publicKey),
      counter: storedCredential.counter,
      transports: storedCredential.transports
        ? JSON.parse(storedCredential.transports)
        : ["internal"],
    },
  });

  if (!verification.verified) {
    throw new Error("Passkey authentication verification failed");
  }

  return {
    verified: true,
    newCounter: verification.authenticationInfo.newCounter,
  };
}

module.exports = {
  isWebAuthnEnabled,
  generatePasskeyRegistrationOptions,
  verifyAndStorePasskey,
  generatePasskeyAuthenticationOptions,
  verifyPasskeyAuthentication,
};
