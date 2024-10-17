import dotenv from 'dotenv';
import {schedule} from 'node-cron';
import {resolve, join} from 'node:path';
import mysql2, {
  FieldPacket,
  Pool,
  PoolConnection,
  PoolOptions,
  RowDataPacket,
} from 'mysql2/promise';
import {parseOfficeAsync} from 'officeparser';

dotenv.config();

const MYSQL_HOST: string = getEnv('MYSQL_HOST');
const MYSQL_PORT: number = parseInt(getEnv('MYSQL_PORT', 3306));
const MYSQL_USER: string = getEnv('MYSQL_USER');
const MYSQL_PASS: string = getEnv('MYSQL_PASS');
const MYSQL_DB: string = getEnv('MYSQL_DATABASE_NAME');

const UPLOADED_PATH: string = resolve(getEnv('UPLOADED_PATH', '.'));
const SCHEDULE_PATTERN: string = getEnv('SCHEDULE_PATTERN');

function getEnv(envKey: string, defaultValue?: unknown): string {
  return (process.env[envKey] || defaultValue) as string;
}

const mysqlConfig: PoolOptions = {
  host: MYSQL_HOST,
  port: MYSQL_PORT,
  user: MYSQL_USER,
  password: MYSQL_PASS,
  database: MYSQL_DB,
};

class Database {
  protected poolConnection: Pool = mysql2.createPool(mysqlConfig);
}

class TextExtractor extends Database {
  protected tableName = 'attactments';
  protected queryLimit = 3;
  private isSingle: Boolean = false;
  private schedulePattern = '* * * * *';

  constructor() {
    super();
  }

  public single(): this {
    this.isSingle = true;
    return this;
  }

  public schedule(cronPattern?: string): this {
    if (cronPattern) {
      this.schedulePattern = cronPattern;
      console.warn(
        `System will use custom pattern from user [${this.schedulePattern}]`,
      );
    }
    return this;
  }

  public async handle(): Promise<Boolean> {
    console.log('Starting Service...');
    await this.testConnection();
    if (this.isSingle) await this.runSingle();
    else await this.runSchedule();
    return true;
  }

  private async runSingle(): Promise<boolean> {
    let hasNext: Boolean = false;
    do {
      const items = (await this.getData()) as unknown as {
        id: number;
        filename: string | null;
      }[];
      for (const item of items) {
        const [id, content] = await this.getContent(item);
        await this.updateContent({id, content});
      }
      hasNext = items.length === this.queryLimit;
    } while (hasNext);
    console.log('All Process are Done');
    return true;
  }
  private runSchedule() {
    return new Promise((_resolve, reject) => {
      console.log('Waiting For Schedule');
      schedule(this.schedulePattern, async () => {
        this.runSingle()
          .then(() => {
            console.log('Waiting For the Next Schedule');
          })
          .catch(reject);
      });
    });
  }

  private async getContent({
    filename,
    id,
  }: {
    id: number;
    filename: string | null;
  }): Promise<[id: number, content: string | null]> {
    try {
      if (!filename) return [id, null];
      const fullPath = join(UPLOADED_PATH, filename);
      const content = await parseOfficeAsync(fullPath);
      return [id, content];
    } catch (err: unknown) {
      console.log(`Error On [id: ${id}]`);
      console.log(err);
      if (err instanceof Error) return [id, err.message];
      else if (typeof err === 'string') {
        return [id, err];
      }
      return [id, 'Error While Reading File (No Any Information)'];
    }
  }

  /* data */
  private async testConnection() {
    const c: PoolConnection = await this.poolConnection.getConnection();
    await c.ping();
    c.release();
  }
  private async getData() {
    const sql = `SELECT id, filename FROM ${this.tableName} WHERE flag = "file" AND is_extract IS NULL AND is_trash=0 LIMIT ${this.queryLimit}`;
    const c: PoolConnection = await this.poolConnection.getConnection();
    const [items, _]: [RowDataPacket[], FieldPacket[]] = await c.query(sql);
    c.release();
    return items;
  }

  private async updateContent({
    content,
    id,
  }: {
    id: number;
    content: string | null;
  }) {
    const sql = `UPDATE ${this.tableName} SET content = ?, is_extract=1, date_extract=NOW() WHERE id=?`;
    const c: PoolConnection = await this.poolConnection.getConnection();
    await (await c.prepare(sql)).execute([content, id]);
    c.release();
  }
}

new TextExtractor()
  .schedule(SCHEDULE_PATTERN)
  // .single()
  .handle()
  .then(res => {
    console.log(res);
  })
  .catch(err => console.error(err));
