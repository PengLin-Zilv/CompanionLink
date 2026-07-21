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

  assert.deepEqual(messagesToRows(history), [
    {
      Timestamp: "2026-07-08 16:36:40",
      From: "Rep",
      Text: "Hello, \"there\"",
      Reaction: "Love",
      ID: "msg-rep-new"
    },
    {
      Timestamp: "2026-07-08 16:36:32",
      From: "Me",
      Text: "Sometimes I think it\\nspills over",
      Reaction: "None",
      ID: "msg-me-old"
    }
  ]);
});

test("builds Python csv.writer compatible CSV text", () => {
  const rows = [
    {
      Timestamp: "2026-07-08 16:36:40",
      From: "Rep",
      Text: "Hello, \"there\"",
      Reaction: "Love",
      ID: "msg-rep-new"
    },
    {
      Timestamp: "2026-07-08 16:36:32",
      From: "Me",
      Text: "Sometimes I think it\\nspills over",
      Reaction: "None",
      ID: "msg-me-old"
    }
  ];

  assert.equal(
    buildCsv(rows),
    "Timestamp,From,Text,Reaction,ID\r\n" +
      "2026-07-08 16:36:40,Rep,\"Hello, \"\"there\"\"\",Love,msg-rep-new\r\n" +
      "2026-07-08 16:36:32,Me,Sometimes I think it\\nspills over,None,msg-me-old\r\n"
  );
});

test("builds a header-only CSV when the study window has no messages", () => {
  assert.equal(buildCsv([]), "Timestamp,From,Text,Reaction,ID\r\n");
});
