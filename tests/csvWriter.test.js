import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCsv,
  messagesToRows,
  normalizeParticipantFilename
} from "../extension/csvWriter.js";

test("normalizes participant IDs into P-prefixed CSV filenames", () => {
  assert.equal(normalizeParticipantFilename("040"), "P040.csv");
  assert.equal(normalizeParticipantFilename("P040"), "P040.csv");
  assert.equal(normalizeParticipantFilename("p040"), "P040.csv");
  assert.equal(normalizeParticipantFilename("  abc-01_2  "), "Pabc-01_2.csv");
});

test("rejects empty or unsafe participant IDs", () => {
  assert.throws(() => normalizeParticipantFilename(""), /participant id/i);
  assert.throws(() => normalizeParticipantFilename("../040"), /participant id/i);
});

test("maps v17 history messages to current lab CSV rows newest-to-oldest", () => {
  const history = {
    payload: {
      message_reactions: [
        { message_id: "msg-rep-new", reaction: "Love" }
      ],
      messages: [
        {
          id: "msg-me-old",
          meta: {
            timestamp: "2026-07-08T20:36:32.000Z",
            nature: "Customer"
          },
          content: {
            text: "Sometimes I think it\nspills over"
          }
        },
        {
          id: "msg-rep-new",
          meta: {
            timestamp: "2026-07-08T20:36:40.000Z",
            nature: "Robot"
          },
          content: {
            text: "Hello, \"there\""
          }
        }
      ]
    }
  };

  assert.deepEqual(messagesToRows(history, "America/Los_Angeles"), [
    {
      Timestamp_Local: "2026-07-08 13:36:40",
      Local_Timezone: "America/Los_Angeles",
      Timestamp_UTC: "2026-07-08T20:36:40.000Z",
      Timestamp_Eastern: "2026-07-08 16:36:40",
      From: "Rep",
      Text: "Hello, \"there\"",
      Reaction: "Love",
      ID: "msg-rep-new"
    },
    {
      Timestamp_Local: "2026-07-08 13:36:32",
      Local_Timezone: "America/Los_Angeles",
      Timestamp_UTC: "2026-07-08T20:36:32.000Z",
      Timestamp_Eastern: "2026-07-08 16:36:32",
      From: "Me",
      Text: "Sometimes I think it\nspills over",
      Reaction: "None",
      ID: "msg-me-old"
    }
  ]);
});

test("builds Python csv.writer compatible CSV text", () => {
  const rows = [
    {
      Timestamp_Local: "2026-07-08 13:36:40",
      Local_Timezone: "America/Los_Angeles",
      Timestamp_UTC: "2026-07-08T20:36:40.000Z",
      Timestamp_Eastern: "2026-07-08 16:36:40",
      From: "Rep",
      Text: "Hello, \"there\"",
      Reaction: "Love",
      ID: "msg-rep-new"
    },
    {
      Timestamp_Local: "2026-07-08 13:36:32",
      Local_Timezone: "America/Los_Angeles",
      Timestamp_UTC: "2026-07-08T20:36:32.000Z",
      Timestamp_Eastern: "2026-07-08 16:36:32",
      From: "Me",
      Text: "Sometimes I think it\nspills over",
      Reaction: "None",
      ID: "msg-me-old"
    }
  ];

  assert.equal(
    buildCsv(rows),
    "Timestamp_Local,Local_Timezone,Timestamp_UTC,Timestamp_Eastern,From,Text,Reaction,ID\r\n" +
      "2026-07-08 13:36:40,America/Los_Angeles,2026-07-08T20:36:40.000Z,2026-07-08 16:36:40,Rep,\"Hello, \"\"there\"\"\",Love,msg-rep-new\r\n" +
      "2026-07-08 13:36:32,America/Los_Angeles,2026-07-08T20:36:32.000Z,2026-07-08 16:36:32,Me,\"Sometimes I think it\nspills over\",None,msg-me-old\r\n"
  );
});

test("builds a header-only CSV when the study window has no messages", () => {
  assert.equal(buildCsv([]), "Timestamp_Local,Local_Timezone,Timestamp_UTC,Timestamp_Eastern,From,Text,Reaction,ID\r\n");
});

test("uses each message's daylight-saving offset and retains distinct UTC instants", () => {
  const timestamps = [
    "2026-11-01T08:30:00.123Z",
    "2026-11-01T09:30:00.456Z"
  ];
  const rows = messagesToRows({ payload: { messages: timestamps.map((timestamp, index) => ({
    id: `msg-${index}`, meta: { timestamp, nature: "Customer" }, content: { text: "Example" }
  })) } }, "America/Los_Angeles");
  assert.deepEqual(rows.map((row) => [row.Timestamp_Local, row.Timestamp_UTC, row.Timestamp_Eastern]), [
    ["2026-11-01 01:30:00", "2026-11-01T09:30:00.456Z", "2026-11-01 04:30:00"],
    ["2026-11-01 01:30:00", "2026-11-01T08:30:00.123Z", "2026-11-01 03:30:00"]
  ]);
});

test("formats fractional-offset zones and normalizes offset timestamps to UTC", () => {
  const rows = messagesToRows({ payload: { messages: [{
    id: "example", meta: { timestamp: "2026-01-01T00:30:00.789+08:00", nature: "Customer" },
    content: { text: "Example" }
  }] } }, "Asia/Kathmandu");
  assert.equal(rows[0].Timestamp_Local, "2025-12-31 22:15:00");
  assert.equal(rows[0].Timestamp_UTC, "2025-12-31T16:30:00.789Z");
  assert.equal(rows[0].Timestamp_Eastern, "2025-12-31 11:30:00");
});
