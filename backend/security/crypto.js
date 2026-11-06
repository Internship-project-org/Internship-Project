
const {
  randomBytes,
  createCipheriv,
  createDecipheriv
} = require("node:crypto");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

// Read the encryption key from environment variables
const getEncryptionKey = () => {
  const keyHex = process.env.ENCRYPTION_KEY;

  if (
    typeof keyHex !== "string" ||
    !/^[0-9a-fA-F]{64}$/.test(keyHex)
  ) {
    throw new Error(
      "ENCRYPTION_KEY must be a 64-character hexadecimal value"
    );
  }

  return Buffer.from(keyHex, "hex");
};

// Encrypt a plaintext password
const encryptPassword = (password) => {
  if (typeof password !== "string" || password.length === 0) {
    throw new Error("A password is required");
  }

  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(
    ALGORITHM,
    key,
    iv,
    { authTagLength: AUTH_TAG_LENGTH }
  );

  const encrypted = Buffer.concat([
    cipher.update(password, "utf8"),
    cipher.final()
  ]);

  const authTag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("hex"),
    authTag.toString("hex"),
    encrypted.toString("hex")
  ].join(":");
};

// Decrypt a previously encrypted password
const decryptPassword = (encryptedPassword) => {
  if (typeof encryptedPassword !== "string") {
    throw new Error("Invalid encrypted password");
  }

  const parts = encryptedPassword.split(":");

  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new Error("Invalid encrypted password format");
  }

  const [, ivHex, authTagHex, encryptedHex] = parts;

  if (
    !/^[0-9a-fA-F]{24}$/.test(ivHex) ||
    !/^[0-9a-fA-F]{32}$/.test(authTagHex) ||
    !/^(?:[0-9a-fA-F]{2})+$/.test(encryptedHex)
  ) {
    throw new Error("Invalid encrypted password format");
  }

  const key = getEncryptionKey();

  try {
    const decipher = createDecipheriv(
      ALGORITHM,
      key,
      Buffer.from(ivHex, "hex"),
      { authTagLength: AUTH_TAG_LENGTH }
    );

    decipher.setAuthTag(
      Buffer.from(authTagHex, "hex")
    );

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedHex, "hex")),
      decipher.final()
    ]);

    return decrypted.toString("utf8");
  } catch {
    throw new Error("Unable to decrypt password");
  }
};

module.exports = {
  encryptPassword,
  decryptPassword
};
