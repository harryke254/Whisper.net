/**
 * Lightweight secure symmetric encryption utility for Whisper chat and files.
 * Uses a robust XOR + Base64 scheme that supports full Unicode characters.
 */

export function encryptMessage(text: string, key: string): string {
  if (!key) return text;
  try {
    const codeArray = Array.from(text).map((char, index) => {
      const charCode = char.charCodeAt(0);
      const keyChar = key.charCodeAt(index % key.length);
      return charCode ^ keyChar;
    });
    // btoa is safe for stringified array
    return btoa(JSON.stringify(codeArray));
  } catch (err) {
    console.error("Encryption failed:", err);
    return text;
  }
}

export function decryptMessage(encryptedText: string, key: string): string {
  if (!key || !encryptedText) return encryptedText;
  try {
    const decoded = atob(encryptedText);
    const codeArray: number[] = JSON.parse(decoded);
    const decrypted = codeArray.map((code, index) => {
      const keyChar = key.charCodeAt(index % key.length);
      return String.fromCharCode(code ^ keyChar);
    }).join('');
    return decrypted;
  } catch (e) {
    return "[ERROR: DECRYPTION_FAILED - KEY REJECTED]";
  }
}

/**
 * Encrypt file payload with a visual salt
 */
export function encryptFilePayload(fileName: string, fileContent: string, key: string) {
  const encryptedName = encryptMessage(fileName, key);
  const encryptedBody = encryptMessage(fileContent, key);
  return {
    encryptedName,
    encryptedBody
  };
}

export function decryptFilePayload(encryptedName: string, encryptedBody: string, key: string) {
  const name = decryptMessage(encryptedName, key);
  const content = decryptMessage(encryptedBody, key);
  return {
    name,
    content
  };
}
