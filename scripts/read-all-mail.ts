import "dotenv/config";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

async function dumpFolder(client: ImapFlow, folder: string) {
  console.log(`\n===== FOLDER: ${folder} =====`);
  const lock = await client.getMailboxLock(folder);
  try {
    const uids = await client.search({ all: true }, { uid: true });
    if (!uids || uids.length === 0) {
      console.log("(tuščia)");
      return;
    }
    console.log(`Rasta ${uids.length} laiškų`);
    for (const uid of uids) {
      const message = await client.fetchOne(uid, { source: true, flags: true }, { uid: true });
      if (!message || !message.source) continue;
      const parsed = await simpleParser(message.source);
      console.log(`\n--- UID ${uid} | seen=${message.flags?.has("\\Seen")} ---`);
      console.log(`Subject: ${parsed.subject}`);
      console.log(`From: ${parsed.from?.text}`);
      console.log(`Date: ${parsed.date}`);
      console.log(`Text:\n${(parsed.text || "").trim()}`);
    }
  } finally {
    lock.release();
  }
}

async function main() {
  const client = new ImapFlow({
    host: process.env.IMAP_HOST!,
    port: Number(process.env.IMAP_PORT ?? 993),
    secure: true,
    auth: { user: process.env.IMAP_USER!, pass: process.env.IMAP_PASSWORD! },
    logger: false,
  });

  await client.connect();
  try {
    await dumpFolder(client, "INBOX");
    const list = await client.list();
    const processedFolder = process.env.IMAP_PROCESSED_FOLDER || "Imported";
    if (list.some((box) => box.path === processedFolder)) {
      await dumpFolder(client, processedFolder);
    }
  } finally {
    await client.logout();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
