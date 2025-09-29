import CryptoJS from "crypto-js";

export function getEncryptedPassword(password: string) {
  let hashed = CryptoJS.SHA1(password);
  password = CryptoJS.enc.Base64.stringify(hashed);
  return password;
}
