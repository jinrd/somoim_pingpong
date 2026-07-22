/// <reference path="../pb_data/types.d.ts" />

onRecordBeforeCreateRequest((event) => {
  const privacy = require(`${__hooks}/member_privacy.js`);

  privacy.protectRecordPhone(event.record);
}, "members");

onRecordAfterCreateRequest((event) => {
  const privacy = require(`${__hooks}/member_privacy.js`);

  privacy.revealRecordPhone(event.record);
}, "members");

onRecordBeforeUpdateRequest((event) => {
  const privacy = require(`${__hooks}/member_privacy.js`);
  const originalPhone = event.record.originalCopy().getString("phone");
  const submittedPhone = event.record.getString("phone");

  if (submittedPhone !== originalPhone) {
    privacy.protectRecordPhone(event.record);
  }
}, "members");

onRecordAfterUpdateRequest((event) => {
  const privacy = require(`${__hooks}/member_privacy.js`);

  privacy.revealRecordPhone(event.record);
}, "members");

onRecordsListRequest((event) => {
  const privacy = require(`${__hooks}/member_privacy.js`);

  event.records.forEach((record) => privacy.revealRecordPhone(record));
}, "members");

onRecordViewRequest((event) => {
  const privacy = require(`${__hooks}/member_privacy.js`);

  privacy.revealRecordPhone(event.record);
}, "members");
