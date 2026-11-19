import crypto from "crypto";

export default function decryptDgkAuthorizationCode(encryptedBase64: string, privateKey: string) {
    const encryptedBuffer = Buffer.from(encryptedBase64, 'base64');

    const decrypted = crypto.privateDecrypt(
        {
            key: privateKey,
            padding: crypto.constants.RSA_NO_PADDING
        },
        encryptedBuffer
    );

    let dataStart = -1;
    for (let i = 0; i < decrypted.length - 1; i++) {
        if (decrypted[i] === 0x00 && decrypted[i + 1] === 0x02) {
            for (let j = i + 2; j < decrypted.length; j++) {
                if (decrypted[j] === 0x00) {
                    dataStart = j + 1;
                    break;
                }
            }
            break;
        }
    }

    if (dataStart === -1) {
        return decrypted.toString('utf8').replace(/\0/g, '');
    }

    const result = decrypted.slice(dataStart);
    return result.toString('utf8');
}
