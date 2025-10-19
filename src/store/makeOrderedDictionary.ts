import NodeCache from 'node-cache';

function makeOrderedDictionary<T>(idGetter: (item: T) => string) {
  const messagesCache = new NodeCache({
    stdTTL: 6 * 10 * 60, // 60 minutes
    useClones: false,
    deleteOnExpire: true,
  });

  const get = (id: string): T | undefined => messagesCache.get<T>(id);

  const update = (item: T) => {
    const id = idGetter(item);
    if (messagesCache.has(id)) {
      messagesCache.set(id, item);
    }

    return false;
  };

  const upsert = (item: T) => {
    const id = idGetter(item);
    messagesCache.set(id, item);
  };

  const remove = (item: T) => {
    const id = idGetter(item);
    if (messagesCache.has(id)) {
      messagesCache.del(id);
      return true;
    }

    return false;
  };

  return {
    messagesCache,
    get,
    upsert,
    update,
    remove,
    updateAssign: (id: string, update: Partial<T>) => {
      const item = get(id?.toString());
      if (item) {
        Object.assign(item, update);
        messagesCache.set(idGetter(item), item);
        return true;
      }

      return false;
    },
    clear: () => {
      messagesCache.del(messagesCache.keys());
    },
    filter: (contain: (item: T) => boolean) => {
      for (const id of messagesCache.keys()) {
        if (!contain(get(id))) {
          messagesCache.del(id);
        }
      }
    },
  };
}

export default makeOrderedDictionary;
