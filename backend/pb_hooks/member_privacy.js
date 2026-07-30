const PHONE_PATTERN = /^010-[0-9]{4}-[0-9]{4}$/;

function getKeys() {
  const config = require(`${__hooks}/config.js`);
  const secret = $os.getenv("PB_ENCRYPTION_KEY");

  if (!secret) {
    throw new BadRequestError("서버 암호화 키 설정을 확인해 주세요.");
  }

  return {
    encryptionKey: config.createMemberPhoneEncryptionKey(secret),
    hashKey: config.createMemberPhoneHashKey(secret),
  };
}

function normalizePhone(value) {
  const input = String(value || "").trim();

  if (!input) {
    return "";
  }

  const digits = input.replace(/[^0-9]/g, "");

  /*
   * 신규 회원 폼의 000-0000-0000은 실제 번호가 없다는 표시입니다.
   * 동일한 가짜 번호를 암호화·해시해 본인 확인 대상이 되지 않도록
   * 빈 연락처로 저장합니다.
   */
  if (digits === "00000000000") {
    return "";
  }

  if (digits.length !== 11 || digits.slice(0, 3) !== "010") {
    throw new BadRequestError(
      "연락처는 010-1234-5678 형식으로 입력해 주세요.",
    );
  }

  const formatted =
    digits.slice(0, 3) +
    "-" +
    digits.slice(3, 7) +
    "-" +
    digits.slice(7, 11);

  if (!PHONE_PATTERN.test(formatted)) {
    throw new BadRequestError(
      "연락처는 010-1234-5678 형식으로 입력해 주세요.",
    );
  }

  return formatted;
}

function hashPhone(value) {
  const phone = normalizePhone(value);

  if (!phone) {
    return "";
  }

  return $security.hs256(phone, getKeys().hashKey);
}

function encryptPhone(value) {
  const phone = normalizePhone(value);

  if (!phone) {
    return "";
  }

  return $security.encrypt(phone, getKeys().encryptionKey);
}

function decryptPhone(value) {
  const encryptedPhone = String(value || "").trim();

  if (!encryptedPhone) {
    return "";
  }

  try {
    return String($security.decrypt(encryptedPhone, getKeys().encryptionKey));
  } catch {
    throw new BadRequestError("회원 연락처를 복호화하지 못했습니다.");
  }
}

function protectRecordPhone(record) {
  const phone = normalizePhone(record.getString("phone"));

  record.set("phone", encryptPhone(phone));
  record.set("phone_hash", hashPhone(phone));
}

function revealRecordPhone(record) {
  if (!record) {
    return;
  }

  record.set("phone", decryptPhone(record.getString("phone")));
  record.set("phone_hash", "");
}

module.exports = {
  decryptPhone,
  encryptPhone,
  hashPhone,
  normalizePhone,
  protectRecordPhone,
  revealRecordPhone,
};
