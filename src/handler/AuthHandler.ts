import {
    AuthenticationCreds, AuthenticationState, BufferJSON, initAuthCreds, proto, SignalDataTypeMap
} from 'baileys';
import { DataSource } from 'typeorm';

import { Session } from '../entity/Session';

class AuthHandler {
  private ds: DataSource;

  constructor(ds: DataSource) {
    this.ds = ds;
  }

  async init(): Promise<{
    state: AuthenticationState;
    saveCreds: () => Promise<void>;
  }> {
    const fixFileName = (file?: string) =>
      file?.replace(/\//g, "__")?.replace(/:/g, "-");

    const auth = this.ds.getRepository(Session);

    const writeData = async (data: unknown, name: string) => {
      name = fixFileName(name);
      try {
        await auth.upsert(
          {
            name,
            data: JSON.stringify(data, BufferJSON.replacer),
          },
          {
            conflictPaths: {
              name: true,
            },
            upsertType: "on-conflict-do-update",
          }
        );
      } catch (error) {
        console.error("Error while write session", error);
      }
    };

    const readData = async (name: string) => {
      name = fixFileName(name);
      try {
        const data = await auth.findOneByOrFail({
          name,
        });
        return JSON.parse(data.data, BufferJSON.reviver);
      } catch (error) {
        return null;
      }
    };

    const removeData = async (name: string) => {
      name = fixFileName(name);
      try {
        await auth.delete({
          name,
        });
      } catch (error) {
        console.error("Error while write session", error);
      }
    };

    const creds: AuthenticationCreds =
      (await readData("creds")) || initAuthCreds();

    return {
      state: {
        creds,
        keys: {
          get: async (type, ids) => {
            const data: { [_: string]: SignalDataTypeMap[typeof type] } = {};
            await Promise.all(
              ids.map(async (id) => {
                let value = await readData(`${type}-${id}`);
                if (type === "app-state-sync-key" && value) {
                  value = proto.Message.AppStateSyncKeyData.fromObject(value);
                }

                data[id] = value;
              })
            );

            return data;
          },
          set: async (data) => {
            const tasks: Promise<void>[] = [];
            for (const category in data) {
              for (const id in data[category as keyof SignalDataTypeMap]) {
                const value = data[category as keyof SignalDataTypeMap][id];
                const file = `${category}-${id}`;
                tasks.push(value ? writeData(value, file) : removeData(file));
              }
            }

            await Promise.all(tasks);
          },
        },
      },
      saveCreds: async (): Promise<void> => {
        try {
          await writeData(creds, "creds");
        } catch (e) {
          console.log(e);
        }
      },
    };
  }
}

export default AuthHandler;
