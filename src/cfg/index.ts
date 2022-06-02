var cfg = {
  default: {
    enabled: true,
    network: "livenet",
    keysRequired: false,
    apiKeys: ["somekey1", "somekey2"],
    serviceKeys: ["servicekey1"],
    hosts: ["*", "localhost:8097", "myhostname.com", "api.somewhere1332.io"],
    queue: {
      // Max number of concurrent requests to sync tx status from merchantapi
      taskRequestConcurrency: 1,
      abandonedSyncTaskRescanSeconds: 3600, // How many seconds to rescan for missed tasks
      syncBackoff: {
        // 'full' or 'none'
        jitter: "full",
        // Exponential back off multiple
        timeMultiple: 2,
        // Initial start delay before first status check
        startingDelay: 1000 * 60,
        // Max back off time 30 Minutes is max
        maxDelay: 1000 * 30 * 60,
        // Max attempts before being put into 'dlq'
        numOfAttempts: 25,
      },
      // If 'nosync' is true, then the server process always places new transactions into txsync.state=0 (sync_none)
      // In other words, then TXQ behaves as a datastore and makes no attempts to broadcast transations or settle status.
      nosync: false,
    },
    // MAPI configuration setttings
    merchantapi: {
      sendPolicy: "SERIAL_BACKUP",
      statusPolicy: "SERIAL_BACKUP", // "SERIAL_BACKUP"
      enableResponseLogging: true, // Whether to log every request and response from merchantapi"s to the database
      endpoints: {
        livenet: [
          {
            name: 'merchantapi.matterpool.io',
            url: 'https://merchantapi.matterpool.io',
            headers: {}
          },
          {
            name: "merchantapi.taal.com",
            url: "https://merchantapi.taal.com",
            headers: {
              Authorization: process.env.MERCHANTAPI_KEY_TAAL_MAINNET || "mainnet_fad153b62723dc39571937c79072b33b"
            },
          },
          {
            name: "mempool.io",
            url: "https://www.ddpurse.com/openapi",
            headers: {
              token: process.env.MERCHANTAPI_KEY_MEMPOOL_MAINNET || "561b756d12572020ea9a104c3441b71790acbbce95a6ddbf7e0630971af9424b",
            },
          },
        ],
        testnet: [
          {
            name: "merchantapi2.taal.com",
            url: "https://merchantapi2.taal.com",
            headers: {
              Authorization: process.env.MERCHANTAPI_KEY_TAAL_TESTNET || "testnet_d92f1c4dfa6309cf83430664a397dde1"
            },
          },
        ],
      },
    },
    // This is the database connection.
    // Install the schema at src/database/schema-latest.sql
    dbConnection: {
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      database: process.env.DB_DATABASE,
      password: process.env.DB_PASSWORD,
      port: process.env.DB_PORT || 5432,
      max: 3,
      idleTimeoutMillis: 10000,
    },
  },
};

module.exports.contextsConfig = cfg;
