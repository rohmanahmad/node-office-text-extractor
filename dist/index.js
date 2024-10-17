"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const node_cron_1 = require("node-cron");
const node_path_1 = require("node:path");
const promise_1 = __importDefault(require("mysql2/promise"));
const officeparser_1 = require("officeparser");
dotenv_1.default.config();
const MYSQL_HOST = getEnv('MYSQL_HOST');
const MYSQL_PORT = parseInt(getEnv('MYSQL_PORT', 3306));
const MYSQL_USER = getEnv('MYSQL_USER');
const MYSQL_PASS = getEnv('MYSQL_PASS');
const MYSQL_DB = getEnv('MYSQL_DATABASE_NAME');
const UPLOADED_PATH = (0, node_path_1.resolve)(getEnv('UPLOADED_PATH', '.'));
const SCHEDULE_PATTERN = getEnv('SCHEDULE_PATTERN');
function getEnv(envKey, defaultValue) {
    return (process.env[envKey] || defaultValue);
}
const mysqlConfig = {
    host: MYSQL_HOST,
    port: MYSQL_PORT,
    user: MYSQL_USER,
    password: MYSQL_PASS,
    database: MYSQL_DB,
};
class Database {
    constructor() {
        this.poolConnection = promise_1.default.createPool(mysqlConfig);
    }
}
class TextExtractor extends Database {
    constructor() {
        super();
        this.tableName = 'attactments';
        this.queryLimit = 3;
        this.isSingle = false;
        this.schedulePattern = '* * * * *';
    }
    single() {
        this.isSingle = true;
        return this;
    }
    schedule(cronPattern) {
        if (cronPattern) {
            this.schedulePattern = cronPattern;
            console.warn(`System will use custom pattern from user [${this.schedulePattern}]`);
        }
        return this;
    }
    handle() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('Starting Service...');
            yield this.testConnection();
            if (this.isSingle)
                yield this.runSingle();
            else
                yield this.runSchedule();
            return true;
        });
    }
    runSingle() {
        return __awaiter(this, void 0, void 0, function* () {
            let hasNext = false;
            do {
                const items = (yield this.getData());
                for (const item of items) {
                    const [id, content] = yield this.getContent(item);
                    yield this.updateContent({ id, content });
                }
                hasNext = items.length === this.queryLimit;
            } while (hasNext);
            console.log('All Process are Done');
            return true;
        });
    }
    runSchedule() {
        return new Promise((_resolve, reject) => {
            console.log('Waiting For Schedule');
            (0, node_cron_1.schedule)(this.schedulePattern, () => __awaiter(this, void 0, void 0, function* () {
                this.runSingle()
                    .then(() => {
                    console.log('Waiting For the Next Schedule');
                })
                    .catch(reject);
            }));
        });
    }
    getContent(_a) {
        return __awaiter(this, arguments, void 0, function* ({ filename, id, }) {
            try {
                if (!filename)
                    return [id, null];
                const fullPath = (0, node_path_1.join)(UPLOADED_PATH, filename);
                const content = yield (0, officeparser_1.parseOfficeAsync)(fullPath);
                return [id, content];
            }
            catch (err) {
                console.log(`Error On [id: ${id}]`);
                console.log(err);
                if (err instanceof Error)
                    return [id, err.message];
                else if (typeof err === 'string') {
                    return [id, err];
                }
                return [id, 'Error While Reading File (No Any Information)'];
            }
        });
    }
    /* data */
    testConnection() {
        return __awaiter(this, void 0, void 0, function* () {
            const c = yield this.poolConnection.getConnection();
            yield c.ping();
            c.release();
        });
    }
    getData() {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `SELECT id, filename FROM ${this.tableName} WHERE flag = "file" AND is_extract IS NULL AND is_trash=0 LIMIT ${this.queryLimit}`;
            const c = yield this.poolConnection.getConnection();
            const [items, _] = yield c.query(sql);
            c.release();
            return items;
        });
    }
    updateContent(_a) {
        return __awaiter(this, arguments, void 0, function* ({ content, id, }) {
            const sql = `UPDATE ${this.tableName} SET content = ?, is_extract=1, date_extract=NOW() WHERE id=?`;
            const c = yield this.poolConnection.getConnection();
            yield (yield c.prepare(sql)).execute([content, id]);
            c.release();
        });
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
//# sourceMappingURL=index.js.map