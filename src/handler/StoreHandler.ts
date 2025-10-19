import {
    BaileysEventEmitter, BufferJSON, Chat as ChatWBS, GroupMetadata as GroupMetadataBaileys,
    jidDecode, jidNormalizedUser, md5, proto, toNumber, updateMessageWithReaction,
    updateMessageWithReceipt, WAMessage, WAMessageKey, WASocket
} from 'baileys';
import { DataSource } from 'typeorm';

import { Chat } from '../entity/Chat';
import { Contact } from '../entity/Contact';
import { GroupMetadata } from '../entity/GroupMetadata';
import { chatDB } from '../store/chatDB';
import makeOrderedDictionary from '../store/makeOrderedDictionary';

const waMessageID = (m: WAMessage) => m.key.id || "";

const makeMessagesDictionary = () => makeOrderedDictionary(waMessageID);

class StoreHandler {
  ds: DataSource;

  constructor(ds: DataSource) {
    this.ds = ds;
  }

  async init() {
    const chats = chatDB();
    const presences = {};
    const messages: {
      [key: string]: ReturnType<typeof makeMessagesDictionary>;
    } = {};
    const groupMetadata: { [jid: string]: GroupMetadata } = {};
    const contacts: Partial<{ [id: string]: Contact }> = {};
    const repos = {
      chats: this.ds.getRepository(Chat),
      groupMetadata: this.ds.getRepository(GroupMetadata),
      contacts: this.ds.getRepository(Contact),
    };

    const listGroupMetadata = await repos.groupMetadata.find();
    for (const metadata of listGroupMetadata)
      groupMetadata[metadata.id] = metadata;

    const listChat = await repos.chats.find();
    chats.upsert(listChat.map((v) => JSON.parse(v.data, BufferJSON.reviver)));

    const listContact = await repos.contacts.find();
    for (const contact of listContact) contacts[contact.id] = contact;

    const assertMessageList = (jid: string) => {
      if (!messages[jid]) {
        messages[jid] = makeMessagesDictionary();
      }

      return messages[jid];
    };

    const bind = (ev: BaileysEventEmitter) => {
      ev.on(
        "messaging-history.set",
        async ({
          chats: newChats,
          contacts: newContacts,
          messages: newMessages,
          isLatest,
          syncType,
        }) => {
          if (syncType === proto.HistorySync.HistorySyncType.ON_DEMAND) {
            return; // FOR NOW,
            //TODO: HANDLE
          }

          if (isLatest) {
            try {
              chats.clear();
              await repos.chats.clear();
              for (const id in messages) {
                delete messages[id];
              }
            } catch {}
          }
          chats.upsert(newChats);
          const chatUpdates = newChats.map((v) => {
            const chat = new Chat();
            chat.id = v.id;
            chat.data = JSON.stringify(v, BufferJSON.replacer);
            return chat;
          });
          await repos.chats.save(chatUpdates);

          for (const contact of newContacts) {
            const update: Partial<Contact> = {};
            if (contact.id) update.id = contact.id;
            if (contact.imgUrl) update.imgUrl = contact.imgUrl;
            if (contact.lid) update.lid = contact.lid;
            if (contact.name) update.name = contact.name;
            if (contact.notify) update.notify = contact.notify;
            if (contact.status) update.status = contact.status;
            if (contact.verifiedName)
              update.verifiedName = contact.verifiedName;
            contacts[contact.id] = { ...contacts[contact.id], ...update };

            await repos.contacts.upsert(update, {
              conflictPaths: {
                id: true,
              },
              upsertType: "on-conflict-do-update",
            });
          }

          for (const msg of newMessages) {
            const jid = msg.key.remoteJid;
            const list = assertMessageList(jid);
            list.upsert(msg);
          }
        }
      );

      ev.on("presence.update", ({ id, presences: update }) => {
        presences[id] = presences[id] || {};
        presences[id] = { ...presences[id], ...update };
      });

      ev.on("contacts.upsert", async (contacts) => {
        for (const contact of contacts) {
          const update: Partial<Contact> = {};
          if (contact.id) update.id = contact.id;
          if (contact.imgUrl) update.imgUrl = contact.imgUrl;
          if (contact.lid) update.lid = contact.lid;
          if (contact.name) update.name = contact.name;
          if (contact.notify) update.notify = contact.notify;
          if (contact.status) update.status = contact.status;
          if (contact.verifiedName) update.verifiedName = contact.verifiedName;
          contacts[contact.id] = { ...contacts[contact.id], ...update };
          await repos.contacts.upsert(update, {
            conflictPaths: {
              id: true,
            },
            upsertType: "on-conflict-do-update",
          });
        }
      });

      ev.on("contacts.update", async (updates) => {
        for (const update of updates) {
          let contact = contacts[update.id];
          if (!contact) {
            const allContact = Object.values(contacts);
            const hashes = allContact.map(async (c) => {
              const { user } = jidDecode(c.id);
              return (await md5(Buffer.from(user + "WA_ADD_NOTIF", "utf8")))
                .toString("base64")
                .slice(0, 3);
            });
            contact = allContact.find((v) =>
              hashes.find(async (w) => (await w).includes(v.id))
            );
          }

          if (contact) {
            const update: Partial<Contact> = {};
            if (contact.id) update.id = contact.id;
            if (contact.imgUrl) update.imgUrl = contact.imgUrl;
            if (contact.lid) update.lid = contact.lid;
            if (contact.name) update.name = contact.name;
            if (contact.notify) update.notify = contact.notify;
            if (contact.status) update.status = contact.status;
            if (contact.verifiedName)
              update.verifiedName = contact.verifiedName;
            contacts[contact.id] = { ...contacts[contact.id], ...update };
            await repos.contacts.upsert(update, {
              conflictPaths: {
                id: true,
              },
              upsertType: "on-conflict-do-update",
            });
          }
        }
      });

      ev.on("chats.upsert", async (newChats) => {
        chats.upsert(newChats);
        const chatUpdates = newChats.map((v) => {
          const chat = new Chat();
          chat.id = v.id;
          chat.data = JSON.stringify(v, BufferJSON.replacer);
          return chat;
        });
        await repos.chats.upsert(chatUpdates, {
          conflictPaths: {
            id: true,
          },
          upsertType: "on-conflict-do-update",
        });
      });

      ev.on("chats.update", async (updates) => {
        const chatUpdates = [];
        for (const update of updates) {
          const oldChat = chats.get(update.id);
          if (oldChat) {
            if (update.unreadCount > 0) {
              update.unreadCount =
                (oldChat.unreadCount || 0) + update.unreadCount;
            }
            chats.update(update.id, update);
            const chat = new Chat();
            chat.id = update.id;
            chat.data = JSON.stringify(
              chats.get(update.id),
              BufferJSON.replacer
            );
            chatUpdates.push(chat);
          }
        }
        await repos.chats.upsert(chatUpdates, {
          conflictPaths: {
            id: true,
          },
          upsertType: "on-conflict-do-update",
        });
      });

      ev.on("chats.delete", async (deletions) => {
        deletions.map((id) => {
          if (chats.get(id)) {
            chats.deleteById(id);
            repos.chats.delete({ id: id });
          }
        });
      });

      ev.on("messages.upsert", ({ messages: newMessages, type }) => {
        switch (type) {
          case "append":
          case "notify":
            for (const msg of newMessages) {
              const jid = jidNormalizedUser(msg.key.remoteJid);

              if (msg?.message?.protocolMessage?.type == 3) {
                ev.emit("chats.update", [
                  {
                    id: jid,
                    ephemeralExpiration:
                      msg.message?.protocolMessage?.ephemeralExpiration,
                  },
                ]);
                if (jid.endsWith("@g.us")) {
                  ev.emit("groups.update", [
                    {
                      id: jid,
                      ephemeralDuration:
                        msg.message?.protocolMessage?.ephemeralExpiration,
                    },
                  ]);
                }
              }

              const list = assertMessageList(jid);
              list.upsert(msg);
              if (type === "notify") {
                if (!chats.get(jid)) {
                  ev.emit("chats.upsert", [
                    {
                      id: jid,
                      conversationTimestamp: toNumber(msg.messageTimestamp),
                      unreadCount: 1,
                    },
                  ]);
                }
                if (!msg.key?.fromMe) {
                  ev.emit("chats.update", [
                    {
                      id: jid,
                      lastMessageRecvTimestamp: toNumber(msg.messageTimestamp),
                    },
                  ]);
                }
              }
            }
            break;
        }
      });

      ev.on("messages.update", (updates) => {
        for (const { update, key } of updates) {
          const list = assertMessageList(key.remoteJid);
          if (!key.id) return;
          if (update?.messageStubType == 1) {
            list.updateAssign(key.id, { messageStubType: 1 });
          } else {
            list.updateAssign(key.id, update);
          }
        }
      });

      ev.on("messages.delete", (item) => {
        if ("all" in item) {
          const list = messages[item.jid];
          list?.clear();
        } else {
          const jid = item.keys[0].remoteJid;
          const list = messages[jid];
          if (list) {
            const idSet = new Set(item.keys.map((k) => k.id));
            list.filter((m) => !idSet.has(m?.key?.id));
          }
        }
      });

      ev.on("groups.update", async (updates) => {
        const groupUpdates: GroupMetadata[] = [];
        for (const update of updates) {
          let metadata = groupMetadata[update.id];
          if (metadata) {
            groupMetadata[update.id] = {
              ...metadata,
              ...update,
            };
            groupMetadata[update.id].descTime = isNaN(
              groupMetadata[update.id].descTime
            )
              ? null
              : groupMetadata[update.id].descTime;
            groupUpdates.push(groupMetadata[update.id]);
          }
        }
        await repos.groupMetadata.upsert(groupUpdates, {
          conflictPaths: {
            id: true,
          },
          upsertType: "on-conflict-do-update",
        });
      });

      ev.on("groups.upsert", async (updates) => {
        const groupUpdates: GroupMetadata[] = [];
        for (const update of updates) {
          let metadata = groupMetadata[update.id];
          if (metadata) {
            groupMetadata[update.id] = {
              ...metadata,
              ...update,
            };
          } else {
            groupMetadata[update.id] = update;
          }
          groupMetadata[update.id].descTime = isNaN(
            groupMetadata[update.id].descTime
          )
            ? null
            : groupMetadata[update.id].descTime;
          groupUpdates.push(groupMetadata[update.id]);
        }
        await repos.groupMetadata.upsert(groupUpdates, {
          conflictPaths: {
            id: true,
          },
          upsertType: "on-conflict-do-update",
        });
      });

      ev.on(
        "group-participants.update",
        async ({ id, participants, action }) => {
          const metadata = groupMetadata[id];
          if (metadata) {
            switch (action) {
              case "add":
                for (const part of participants) {
                  if (!metadata.participants.some((p) => p.id === part.id)) {
                    metadata.participants.push({
                      ...part,
                      isAdmin: false,
                      isSuperAdmin: false,
                      admin: null,
                    });
                  }
                }
                metadata.size++;
                break;
              case "demote":
              case "promote":
                for (const participant of metadata.participants) {
                  const match = participants.find(
                    (part) => part.id === participant.id
                  );
                  if (match) {
                    participant.isAdmin = action === "promote";
                    participant.admin = action === "promote" ? "admin" : null;
                  }
                }
                break;
              case "remove":
                metadata.participants = metadata.participants.filter(
                  (p) => !participants.some((part) => part.id === p.id)
                );
                metadata.size--;
                break;
            }

            groupMetadata[id] = metadata;
            await repos.groupMetadata.upsert([groupMetadata[id]], {
              conflictPaths: {
                id: true,
              },
              upsertType: "on-conflict-do-update",
            });
          }
        }
      );

      ev.on("message-receipt.update", (updates) => {
        for (const { key, receipt } of updates) {
          const obj = messages[key.remoteJid];
          const msg = obj?.get(key.id);
          if (msg) {
            updateMessageWithReceipt(msg, receipt);
          }
        }
      });

      ev.on("messages.reaction", (reactions) => {
        for (const { key, reaction } of reactions) {
          const obj = messages[key.remoteJid];
          const msg = obj?.get(key.id);
          if (msg) {
            updateMessageWithReaction(msg, reaction);
          }
        }
      });
    };
    return {
      repos,
      chats,
      contacts,
      messages,
      groupMetadata,
      presences,
      bind,
      loadMessage: async (jid: string, id: string) => messages[jid]?.get(id),
      fetchMessageReceipts: async ({ remoteJid, id }: WAMessageKey) => {
        const list = messages[remoteJid];
        const msg = list?.get(id);
        return msg?.userReceipt;
      },
      fetchGroupMetadata: async (
        jid: string,
        sock: Partial<{
          groupMetadata: (jid: string) => Promise<GroupMetadataBaileys>;
        }>,
        force = false
      ) => {
        const metadata = groupMetadata[jid];
        if (
          force ||
          !metadata ||
          metadata.expiredMetadata * 1000 < Date.now()
        ) {
          const metadataNew = await sock.groupMetadata(jid);
          metadataNew.descTime = isNaN(metadataNew.descTime)
            ? null
            : metadataNew.descTime;
          await repos.groupMetadata.upsert(
            {
              ...metadataNew,
              expiredMetadata: Math.floor(
                (Date.now() + 1000 * 60 * 60 * 3) / 1000
              ),
            },
            {
              conflictPaths: {
                id: true,
              },
              upsertType: "on-conflict-do-update",
            }
          );

          if (metadataNew) {
            groupMetadata[jid] = metadataNew;
          }
        }

        return groupMetadata[jid];
      },
    };
  }
}

export default StoreHandler;
