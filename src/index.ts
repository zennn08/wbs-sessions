import { DataSource } from 'typeorm';

import { Chat } from './entity/Chat';
import { Contact } from './entity/Contact';
import { GroupMetadata } from './entity/GroupMetadata';
import { Session } from './entity/Session';
import AuthHandler from './handler/AuthHandler';
import StoreHandler from './handler/StoreHandler';

class WbsSessions {
  dbName: string;
  auth: AuthHandler;
  store: StoreHandler;
  ds: DataSource;

  constructor(dbName: string) {
    this.dbName = dbName;

    this.ds = new DataSource({
      type: "better-sqlite3",
      database: this.dbName,
      synchronize: true,
      enableWAL: true,
      logging: false,
      entities: [Session, Chat, Contact, GroupMetadata],
      migrations: [],
      subscribers: [],
    });
  }

  async init() {
    this.ds = await this.ds.initialize();
    this.auth = new AuthHandler(this.ds);
    this.store = new StoreHandler(this.ds);
  }
}

export default WbsSessions;
