import { Chat } from 'baileys';

export const chatDB = () => {
  let chats = {};
  function get(id: string): Chat {
    if (!id) return;
    return chats[id];
  }

  function update(id: string, update: Partial<Chat>): Chat {
    if (!id) return;
    if (!chats[id]) return;
    return (chats[id] = { ...chats[id], ...update });
  }

  function deleteById(id: string) {
    if (!id) return;
    if (!chats[id]) return;
    return delete chats[id];
  }

  function upsert(messages: Chat[] = []): void {
    for (const i of messages) {
      if (!i.conversationTimestamp) continue;
      chats[i.id] = i;
    }
  }

  function all(): Chat[] {
    return Object.values(chats);
  }

  function clear() {
    chats = {};
  }

  return {
    chats,
    get,
    update,
    deleteById,
    upsert,
    all,
    clear,
  };
};
