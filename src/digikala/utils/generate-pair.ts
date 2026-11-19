import { setServiceInfo } from '@/settings/services/servicesService';
import { generateKeyPairSync } from 'crypto';

// must be  RSA (4096-bit, Public-Private Key) 
export default async function generateDgkKeyPair(vendorId: string) {
    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
        modulusLength: 4096,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });

    await setServiceInfo("dgk", "keys", vendorId, {
        publicKey,
        privateKey
    });

    return { publicKey, privateKey }
}